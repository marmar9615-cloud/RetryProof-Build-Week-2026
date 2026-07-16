import { promises as dns } from "node:dns";
import http from "node:http";
import net from "node:net";
import type { SmokeCheck, SmokeTestResults } from "@workspace/db";
import { logger } from "./logger";

const NAVIGATION_TIMEOUT_MS = 20_000;
const POST_LOAD_SETTLE_MS = 1500;
const LOAD_TIME_WARN_MS = 4000;
const MAX_SCREENSHOT_BYTES = 800_000;

const BLOCKED_HOST_SUFFIXES = [".internal", ".local", ".localhost"];
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function safeUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function ipToBigInt(ip: string, family: 4 | 6): bigint {
  if (family === 4) {
    return ip
      .split(".")
      .reduce((acc, part) => (acc << 8n) + BigInt(Number(part)), 0n);
  }
  const sides = ip.split("::");
  const head = sides[0] ? sides[0].split(":") : [];
  const tail = sides[1] ? sides[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  const parts = [...head, ...Array(missing).fill("0"), ...tail];
  return parts.reduce(
    (acc, part) => (acc << 16n) + BigInt(parseInt(part || "0", 16)),
    0n,
  );
}

function isIpv4InCidr(ip: string, base: string, bits: number): boolean {
  const n = ipToBigInt(ip, 4);
  const baseN = ipToBigInt(base, 4);
  const mask = ((1n << BigInt(32 - bits)) - 1n) ^ ((1n << 32n) - 1n);
  return (n & mask) === (baseN & mask);
}

function isIpv6InCidr(ip: string, base: string, bits: number): boolean {
  const n = ipToBigInt(ip, 6);
  const baseN = ipToBigInt(base, 6);
  const mask =
    bits === 0 ? 0n : ((1n << BigInt(128 - bits)) - 1n) ^ ((1n << 128n) - 1n);
  return (n & mask) === (baseN & mask);
}

function mappedIpv4(ip: string): string | null {
  const n = ipToBigInt(ip, 6);
  const mappedPrefix = ipToBigInt("::ffff:0:0", 6);
  if (n >> 32n !== mappedPrefix >> 32n) return null;
  const v4 = Number(n & 0xffffffffn);
  return [
    (v4 >>> 24) & 255,
    (v4 >>> 16) & 255,
    (v4 >>> 8) & 255,
    v4 & 255,
  ].join(".");
}

export function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 0) return false;
  if (family === 4) {
    const ranges: Array<[string, number]> = [
      ["10.0.0.0", 8],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.168.0.0", 16],
      ["100.64.0.0", 10],
      ["0.0.0.0", 8],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ];
    for (const [base, bits] of ranges)
      if (isIpv4InCidr(ip, base, bits)) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  const v4 = mappedIpv4(lower);
  if (v4) return isPrivateIp(v4);
  const ranges: Array<[string, number]> = [
    ["::", 128],
    ["::1", 128],
    ["64:ff9b::", 96],
    ["64:ff9b:1::", 48],
    ["100::", 64],
    ["2001::", 23],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
  ];
  for (const [base, bits] of ranges) {
    if (isIpv6InCidr(lower, base, bits)) return true;
  }
  return false;
}

type UrlSafeResult =
  | { ok: true; resolvedIp?: string }
  | { ok: false; reason: string };

async function isUrlSafe(hostname: string): Promise<UrlSafeResult> {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return { ok: false, reason: "missing hostname" };
  if (BLOCKED_HOSTNAMES.has(h)) {
    return { ok: false, reason: `hostname '${h}' is not allowed` };
  }
  if (BLOCKED_HOST_SUFFIXES.some((s) => h.endsWith(s))) {
    return { ok: false, reason: `hostname '${h}' is not allowed` };
  }
  if (net.isIP(h)) {
    if (isPrivateIp(h)) {
      return { ok: false, reason: `IP '${h}' is private/internal` };
    }
    return { ok: true };
  }
  try {
    const records = await dns.lookup(h, { all: true });
    if (records.length === 0) {
      return { ok: false, reason: "DNS lookup returned no records" };
    }
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        return {
          ok: false,
          reason: `hostname resolves to private IP ${r.address}`,
        };
      }
    }
    return { ok: true, resolvedIp: records[0]?.address };
  } catch (err) {
    return {
      ok: false,
      reason: `DNS lookup failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}

/**
 * Start a minimal SSRF-safe HTTP proxy that Chromium routes ALL traffic through.
 *
 * Because all DNS resolution happens here (Node.js), not in Chromium, the
 * time-of-check/time-of-use gap and DNS rebinding attacks are eliminated:
 * the same IP address we verify is the one we actually connect to.
 *
 * - HTTP requests: we resolve the target hostname, verify the IP, then
 *   forward the request to the resolved IP.
 * - HTTPS CONNECT requests: we resolve the target hostname, verify the IP,
 *   then establish a raw TCP tunnel to the resolved IP. TLS is handled
 *   end-to-end between Chromium and the server; we only control the TCP layer.
 */
async function createSsrfProxy(): Promise<{
  port: number;
  stop: () => Promise<void>;
}> {
  const server = http.createServer(
    (req: http.IncomingMessage, res: http.ServerResponse) => {
      void (async () => {
        try {
          if (!req.url) {
            res.writeHead(400);
            res.end();
            return;
          }
          const targetUrl = new URL(req.url);
          const check = await isUrlSafe(targetUrl.hostname);
          if (!check.ok) {
            logger.warn(
              { host: targetUrl.hostname, reason: check.reason },
              "SSRF proxy blocked HTTP request",
            );
            res.writeHead(403, { "Content-Type": "text/plain" });
            res.end(`Blocked: ${check.reason}`);
            return;
          }
          const targetIp = check.resolvedIp ?? targetUrl.hostname;
          const options: http.RequestOptions = {
            hostname: targetIp,
            port: targetUrl.port || 80,
            path: (targetUrl.pathname || "/") + (targetUrl.search || ""),
            method: req.method ?? "GET",
            headers: { ...req.headers, host: targetUrl.host },
          };
          const proxyReq = http.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
            proxyRes.pipe(res);
          });
          proxyReq.on("error", () => {
            if (!res.headersSent) {
              res.writeHead(502);
              res.end();
            }
          });
          req.pipe(proxyReq);
        } catch {
          if (!res.headersSent) {
            res.writeHead(400);
            res.end();
          }
        }
      })();
    },
  );

  server.on(
    "connect",
    (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
      void (async () => {
        try {
          const [rawHost, rawPort] = (req.url ?? "").split(":");
          const host = rawHost ?? "";
          const port = parseInt(rawPort ?? "443") || 443;

          const check = await isUrlSafe(host);
          if (!check.ok) {
            logger.warn(
              { host, reason: check.reason },
              "SSRF proxy blocked CONNECT request",
            );
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
          }
          const targetIp = check.resolvedIp ?? host;
          const tunnel = net.connect(port, targetIp, () => {
            socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
            if (head.length > 0) tunnel.write(head);
            tunnel.pipe(socket);
            socket.pipe(tunnel);
          });
          tunnel.on("error", () => {
            socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
            socket.destroy();
          });
          socket.on("error", () => tunnel.destroy());
        } catch {
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
        }
      })();
    },
  );

  const port = await new Promise<number>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      resolve(addr.port);
    });
    server.on("error", reject);
  });

  const stop = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

  return { port, stop };
}

function nowIso() {
  return new Date().toISOString();
}

function buildSkipped(
  url: string,
  skipReason: string,
): { results: SmokeTestResults; screenshot: string | null } {
  return {
    results: {
      ranAt: nowIso(),
      url,
      skipped: true,
      skipReason,
      checks: [
        {
          id: "skipped",
          label: "Smoke test skipped",
          status: "skip",
          detail: skipReason,
        },
      ],
    },
    screenshot: null,
  };
}

export async function runSmokeTest(
  rawUrl: string | null,
): Promise<{ results: SmokeTestResults; screenshot: string | null } | null> {
  if (!rawUrl) return null;
  const parsed = safeUrl(rawUrl);
  if (!parsed) {
    return buildSkipped(
      rawUrl,
      "The provided live URL is not a valid http(s) URL.",
    );
  }
  const url = parsed.toString();

  const initialCheck = await isUrlSafe(parsed.hostname);
  if (!initialCheck.ok) {
    logger.warn(
      { url, reason: initialCheck.reason },
      "Smoke test blocked: unsafe URL",
    );
    return buildSkipped(
      url,
      `URL blocked for safety: ${initialCheck.reason}. Smoke tests only run against public URLs.`,
    );
  }

  const executablePath = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (!executablePath) {
    return buildSkipped(
      url,
      "Headless browser is not available in this environment.",
    );
  }

  let chromium: typeof import("playwright-core").chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "playwright-core not installed — skipping smoke test",
    );
    return buildSkipped(url, "Headless browser package is not installed.");
  }

  let proxy: { port: number; stop: () => Promise<void> } | null = null;
  try {
    proxy = await createSsrfProxy();
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "Failed to start SSRF proxy — skipping smoke test",
    );
    return buildSkipped(url, "Internal safety proxy could not be started.");
  }

  const browser = await chromium
    .launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        // Route all Chromium traffic through our SSRF-safe proxy.
        `--proxy-server=http://127.0.0.1:${proxy.port}`,
        // By default Chromium skips the proxy for loopback addresses. Override
        // that so 127.0.0.1, ::1, and localhost are also forced through the
        // proxy and subject to our safety checks.
        "--proxy-bypass-list=<-loopback>",
      ],
    })
    .catch((err: unknown) => {
      logger.warn(
        { err: err instanceof Error ? err.message : err },
        "Failed to launch chromium",
      );
      return null;
    });
  if (!browser) {
    await proxy.stop().catch(() => {});
    return buildSkipped(url, "Headless browser failed to start.");
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (compatible; NeverGuessSmokeBot/1.0; +https://neverguess.app)",
  });
  const page = await context.newPage();

  // Defense-in-depth: even though the SSRF proxy is the primary guard, the
  // route handler independently blocks unsafe requests at the Playwright layer.
  // This catches edge-cases where Chromium might bypass the proxy (e.g. via
  // special URI schemes, data: URLs, or future browser behaviour changes).
  let blockedBySsrf: string | null = null;
  await context.route("**/*", async (route) => {
    try {
      const reqUrl = new URL(route.request().url());
      if (reqUrl.protocol !== "http:" && reqUrl.protocol !== "https:") {
        blockedBySsrf ??= `non-http(s) request to ${reqUrl.protocol}`;
        return route.abort("blockedbyclient");
      }
      const check = await isUrlSafe(reqUrl.hostname);
      if (!check.ok) {
        blockedBySsrf ??= `${reqUrl.host}: ${check.reason}`;
        return route.abort("blockedbyclient");
      }
      return route.continue();
    } catch {
      return route.abort("blockedbyclient");
    }
  });

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  const checks: SmokeCheck[] = [];
  let screenshot: string | null = null;
  let navigationFailed: string | null = null;

  try {
    const start = Date.now();
    let response;
    try {
      response = await page.goto(url, {
        waitUntil: "load",
        timeout: NAVIGATION_TIMEOUT_MS,
      });
    } catch (err) {
      navigationFailed = err instanceof Error ? err.message : "Unknown error";
      throw err;
    }
    const loadMs = Date.now() - start;

    const status = response?.status() ?? 0;
    checks.push({
      id: "http-status",
      label: "Page loads (HTTP 200)",
      status:
        status === 200
          ? "pass"
          : status >= 200 && status < 400
            ? "warn"
            : "fail",
      metric: status ? `HTTP ${status}` : "no response",
      detail:
        status === 200
          ? "The page returned HTTP 200."
          : status >= 200 && status < 400
            ? `The page returned HTTP ${status} — not a clean 200, but the browser was redirected or accepted the response.`
            : `The page returned HTTP ${status || "no response"} — the URL may be down or blocking bots.`,
    });

    checks.push({
      id: "load-time",
      label: "Page load time",
      status:
        loadMs <= LOAD_TIME_WARN_MS
          ? "pass"
          : loadMs <= LOAD_TIME_WARN_MS * 2
            ? "warn"
            : "fail",
      metric: `${loadMs} ms`,
      detail:
        loadMs <= LOAD_TIME_WARN_MS
          ? "Initial load completed within a healthy window."
          : `Initial load took ${loadMs}ms — consider checking large bundles or slow API calls.`,
    });

    await page.waitForTimeout(POST_LOAD_SETTLE_MS);

    const buttonCount = await page.locator("button, [role=button]").count();
    const linkCount = await page.locator("a[href]").count();

    checks.push({
      id: "interactive-elements",
      label: "Interactive elements present",
      status: buttonCount + linkCount > 0 ? "pass" : "warn",
      metric: `${buttonCount} buttons · ${linkCount} links`,
      detail:
        buttonCount + linkCount > 0
          ? "Found buttons and/or links on the page — the UI is interactive."
          : "No buttons or links were detected — the page may be a blank/loading state or rendering failed.",
    });

    checks.push({
      id: "console-errors",
      label: "JS console errors",
      status:
        consoleErrors.length === 0
          ? "pass"
          : consoleErrors.length <= 2
            ? "warn"
            : "fail",
      metric:
        consoleErrors.length === 0
          ? "0 errors"
          : `${consoleErrors.length} error${consoleErrors.length === 1 ? "" : "s"}`,
      detail:
        consoleErrors.length === 0
          ? "No JavaScript errors were reported in the browser console."
          : `Console errors detected: ${consoleErrors.slice(0, 3).join(" | ")}`,
    });

    try {
      let buf = await page.screenshot({ type: "jpeg", quality: 70 });
      if (buf.byteLength > MAX_SCREENSHOT_BYTES) {
        buf = await page.screenshot({ type: "jpeg", quality: 45 });
      }
      if (buf.byteLength > MAX_SCREENSHOT_BYTES) {
        screenshot = null;
        checks.push({
          id: "screenshot",
          label: "Screenshot captured",
          status: "warn",
          metric: `${Math.round(buf.byteLength / 1024)} KB`,
          detail:
            "Screenshot exceeded the size budget and was dropped to keep report payloads small.",
        });
      } else {
        screenshot = `data:image/jpeg;base64,${buf.toString("base64")}`;
        checks.push({
          id: "screenshot",
          label: "Screenshot captured",
          status: "pass",
          metric: `${Math.round(buf.byteLength / 1024)} KB`,
          detail: "A screenshot of the live URL is attached for visual review.",
        });
      }
    } catch (err) {
      checks.push({
        id: "screenshot",
        label: "Screenshot captured",
        status: "warn",
        detail:
          err instanceof Error
            ? `Could not capture a screenshot: ${err.message}`
            : "Could not capture a screenshot.",
      });
    }
  } catch (err) {
    const reason =
      navigationFailed ??
      (err instanceof Error ? err.message : "Unknown error");
    logger.warn({ url, reason, blockedBySsrf }, "Smoke test navigation failed");
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await proxy.stop().catch(() => {});
    const skipReason = blockedBySsrf
      ? `Navigation blocked for safety (${blockedBySsrf}). Smoke tests only run against public URLs.`
      : `The URL could not be reached: ${reason}`;
    return buildSkipped(url, skipReason);
  }
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  await proxy.stop().catch(() => {});

  return {
    results: {
      ranAt: nowIso(),
      url,
      skipped: false,
      checks,
    },
    screenshot,
  };
}
