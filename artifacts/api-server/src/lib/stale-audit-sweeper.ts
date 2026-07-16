// Stranded-audit recovery. Ingestion and analysis jobs run in-process
// (setImmediate) with no durable queue, so a server restart or crash
// leaves their audits stuck in an active status forever. Active audits
// can be neither deleted nor re-run (routes/audits.ts returns 409 for
// both), and they permanently occupy a concurrent-audit quota slot — so
// without this sweep the user is stranded until manual DB surgery.
//
// The sweep flips any active audit that hasn't been touched in 15 minutes
// into the error state, closes open SSE streams, and hands the quota
// charge back through the same refund path ingestion failures use. The
// 15-minute threshold is comfortably past the longest legitimate pipeline
// run; every pipeline stage bumps audits.updated_at, so a healthy job in
// flight is never swept.
import { and, inArray, lt, sql } from "drizzle-orm";
import { db, auditsTable } from "@workspace/db";
import { logger } from "./logger";
import { publishAuditEvent, resetAuditEvents } from "./sse-bus";
import { refundAuditCharge } from "./ingest-runner";

// Mirrors ACTIVE_AUDIT_STATUSES in routes/audits.ts: the set of statuses
// the delete/rerun 409 gates treat as "in flight".
const ACTIVE_AUDIT_STATUSES = [
  "pending",
  "running",
  "ingested",
  "analyzing",
] as const;

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export const STALE_AUDIT_ERROR_MESSAGE =
  "Analysis was interrupted (server restart or timeout). Re-run to try again.";

/**
 * Mark every stale in-flight audit as errored and refund its charge.
 * Returns the number of audits swept. The status IN (...) predicate makes
 * this idempotent against markErrored in ingest-runner: whichever path
 * flips the row first is the only one that refunds.
 */
export async function sweepStaleAudits(): Promise<number> {
  const swept = await db
    .update(auditsTable)
    .set({
      status: "error",
      ingestionError: STALE_AUDIT_ERROR_MESSAGE,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(auditsTable.status, [...ACTIVE_AUDIT_STATUSES]),
        // Compare against the DB clock so app/DB clock skew can't sweep
        // (or spare) a row early.
        lt(auditsTable.updatedAt, sql`now() - interval '15 minutes'`),
      ),
    )
    .returning({ id: auditsTable.id, userId: auditsTable.userId });

  for (const audit of swept) {
    // Terminal event first so any open SSE subscriber writes `end` and
    // closes; then drop the buffer so a later reconnect doesn't replay
    // phases from the interrupted run.
    publishAuditEvent(audit.id, "error", STALE_AUDIT_ERROR_MESSAGE);
    resetAuditEvents(audit.id);
    await refundAuditCharge(audit.id, audit.userId);
  }

  if (swept.length > 0) {
    logger.warn(
      { count: swept.length, auditIds: swept.map((a) => a.id) },
      "Swept stale in-flight audits into error state",
    );
  }
  return swept.length;
}

/**
 * Run one sweep now (catches audits stranded by the restart that just
 * happened), then keep sweeping every 5 minutes. The timer is unref'd so
 * it never keeps a shutting-down process alive.
 */
export function startStaleAuditSweeper(): void {
  const run = () => {
    void sweepStaleAudits().catch((err) => {
      logger.error(
        { err: err instanceof Error ? err.message : err },
        "Stale audit sweep failed",
      );
    });
  };
  run();
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref();
}
