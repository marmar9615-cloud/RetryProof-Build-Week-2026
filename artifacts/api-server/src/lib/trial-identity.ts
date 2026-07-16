import { createHmac } from "node:crypto";

export function hmacHash(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function normalizeIp(value: string | undefined): string {
  if (!value) return "unknown";
  let ip = value.trim().split(",", 1)[0]?.trim() || "unknown";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip.startsWith("[") && ip.includes("]")) ip = ip.slice(1, ip.indexOf("]"));
  const ipv4WithPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) ip = ipv4WithPort[1];
  return ip.toLowerCase();
}

export function trustedRequestIp(args: {
  socketRemoteAddress?: string;
  expressIp?: string;
}): string {
  // Do not accept raw X-Forwarded-For here. If a deployment needs forwarded
  // client IPs, configure Express trusted proxies and pass the resulting req.ip.
  return normalizeIp(args.socketRemoteAddress || args.expressIp || "unknown");
}
