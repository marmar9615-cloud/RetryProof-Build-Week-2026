import app from "./app";
import { logger } from "./lib/logger";
import { maybeSeedDemoOnBoot } from "./lib/seed-demo";
import { startStaleAuditSweeper } from "./lib/stale-audit-sweeper";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (process.env.NODE_ENV === "production") {
  const publicAppUrl = process.env.PUBLIC_APP_URL?.trim();
  if (!publicAppUrl) {
    throw new Error(
      "PUBLIC_APP_URL is required in production. Set it to your deployed origin, e.g. https://marmarlabs.com.",
    );
  }
  try {
    new URL(publicAppUrl);
  } catch {
    throw new Error(
      `PUBLIC_APP_URL must be a valid URL in production. Received: "${publicAppUrl}"`,
    );
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void maybeSeedDemoOnBoot();
  // Jobs run in-process, so a restart strands active audits — sweep them
  // into an error state (and refund) once on boot, then every 5 minutes.
  startStaleAuditSweeper();
});
