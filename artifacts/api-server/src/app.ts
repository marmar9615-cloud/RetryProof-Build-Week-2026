import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import stripeRouter from "./routes/stripe";
import retryProofRouter from "./routes/retryproof";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

// Replit's production proxy is trusted only when the deployment explicitly
// opts into the documented one-hop topology. RetryProof uses req.ip for its
// anonymous-session admission limits and never parses forwarding headers itself.
if (process.env.RETRYPROOF_TRUST_PROXY === "1") app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self' https:",
      "form-action 'self' https://*.stripe.com https://buy.stripe.com",
    ].join("; "),
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  next();
});

// CRITICAL: Stripe webhook MUST be mounted before express.json() so the
// raw body survives for signature verification. The router itself uses
// express.raw({ type: "application/json" }) inline. CORS is applied first
// so Stripe's outbound POST is whitelisted (we don't need cookies on it).
// The pinoHttp middleware is mounted later so the webhook still gets
// minimal request logging via its own logger calls.

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Build the allowed-origin list from (in order):
//   1. CORS_ORIGINS — explicit comma-separated allowlist
//   2. PUBLIC_APP_URL — canonical production origin (e.g. https://marmarlabs.com)
//   3. REPLIT_DEV_DOMAIN — the Replit preview domain (development only)
// Each entry can be host-only or full-URL; we normalize to a full origin.
function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
    );
    return url.origin;
  } catch {
    return null;
  }
}

const allowedOrigins = new Set<string>(
  [
    ...(process.env.CORS_ORIGINS ?? "").split(","),
    process.env.PUBLIC_APP_URL ?? "",
    process.env.NODE_ENV === "production"
      ? ""
      : (process.env.REPLIT_DEV_DOMAIN ?? ""),
  ]
    .map(normalizeOrigin)
    .filter((s): s is string => Boolean(s)),
);

logger.info({ allowedOrigins: [...allowedOrigins] }, "CORS allow-list");

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      // No Origin header → not a CORS request (e.g. server-to-server, curl,
      // some same-origin GETs). Always allow.
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      // In dev, when nothing is configured, fall through permissively so
      // local testing isn't blocked.
      if (process.env.NODE_ENV !== "production" && allowedOrigins.size === 0) {
        return cb(null, true);
      }
      logger.warn({ origin }, "CORS blocked unrecognized origin");
      // Reflect a clean 403 instead of throwing — Express's default error
      // handler returns an HTML body for thrown errors, which trips up
      // SPA fetch() consumers.
      return cb(null, false);
    },
  }),
);
// Mount Stripe webhook BEFORE express.json() so the raw body is intact for
// signature verification. The webhook router uses express.raw() inline.
app.use("/api", stripeRouter);

app.use(cookieParser());
app.use(
  "/api/retryproof/v1",
  express.json({ limit: "1100kb", type: ["application/json", "application/*+json"] }),
  retryProofRouter,
);
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
