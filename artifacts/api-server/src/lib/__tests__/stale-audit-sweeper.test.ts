import { afterEach, describe, expect, it, vi } from "vitest";

// @workspace/db throws at import time without DATABASE_URL. The Pool it
// creates never connects — every query below is intercepted by spies.
vi.hoisted(() => {
  process.env.DATABASE_URL ??=
    "postgres://unused:unused@localhost:5432/unused";
});

import { db, auditsTable, trialAuditQuotasTable } from "@workspace/db";
import {
  sweepStaleAudits,
  STALE_AUDIT_ERROR_MESSAGE,
} from "../stale-audit-sweeper";
import {
  getBufferedEvents,
  resetAuditEvents,
  subscribeAuditEvents,
  type AuditEvent,
} from "../sse-bus";

type SweptRow = { id: string; userId: string };

/**
 * Route db.update by table: the sweeper updates auditsTable (returning the
 * swept rows), and the trial-refund path updates trialAuditQuotasTable
 * (returning which quota rows were decremented).
 */
function stubUpdates(
  sweptRows: SweptRow[],
  quotaRefundRows: Array<{ id: string }> = [],
) {
  const quotaSet = vi.fn((_values: Record<string, unknown>) => ({
    where: () => ({ returning: () => Promise.resolve(quotaRefundRows) }),
  }));
  const auditsSet = vi.fn((_values: Record<string, unknown>) => ({
    where: () => ({ returning: () => Promise.resolve(sweptRows) }),
  }));
  const update = vi
    .spyOn(db, "update")
    .mockImplementation(((table: unknown) => {
      if (table === auditsTable) return { set: auditsSet };
      if (table === trialAuditQuotasTable) return { set: quotaSet };
      throw new Error("Unexpected table passed to db.update");
    }) as unknown as typeof db.update);
  return { update, auditsSet, quotaSet };
}

// The authenticated refund deletes the newest ledger row for the audit via
// raw SQL (a correlated subquery drizzle's builder can't express), so the
// spy target is db.execute rather than db.delete.
function stubLedgerDelete() {
  const execute = vi
    .spyOn(db, "execute")
    .mockResolvedValue([] as unknown as Awaited<ReturnType<typeof db.execute>>);
  return { del: execute, execute };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sweepStaleAudits", () => {
  it("does nothing when no audits are stale", async () => {
    stubUpdates([]);
    const { del } = stubLedgerDelete();

    await expect(sweepStaleAudits()).resolves.toBe(0);

    expect(del).not.toHaveBeenCalled();
  });

  it("writes the interruption error and refunds the ledger charge for an authenticated audit", async () => {
    const auditId = "00000000-0000-4000-8000-00000000aaaa";
    const { auditsSet, quotaSet } = stubUpdates([
      { id: auditId, userId: "user-oidc-sub-123" },
    ]);
    const { del } = stubLedgerDelete();

    const received: AuditEvent[] = [];
    const unsubscribe = subscribeAuditEvents(auditId, (ev) =>
      received.push(ev),
    );
    try {
      await expect(sweepStaleAudits()).resolves.toBe(1);
    } finally {
      unsubscribe();
      resetAuditEvents(auditId);
    }

    // The audit row was flipped into the same shape ingestion failures use.
    expect(auditsSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        ingestionError: STALE_AUDIT_ERROR_MESSAGE,
      }),
    );
    // Open SSE clients got a terminal event so they close...
    expect(received).toEqual([
      expect.objectContaining({
        phase: "error",
        message: STALE_AUDIT_ERROR_MESSAGE,
      }),
    ]);
    // ...and the stale buffer was dropped so reconnects don't replay it.
    expect(getBufferedEvents(auditId)).toEqual([]);
    // Authenticated refund = delete the newest audit_run_events ledger row.
    expect(del).toHaveBeenCalledOnce();
    expect(quotaSet).not.toHaveBeenCalled();
  });

  it("refunds a trial audit through the quota table, not the ledger", async () => {
    const auditId = "00000000-0000-4000-8000-00000000bbbb";
    const trialUserId = "trial_00000000-0000-4000-8000-000000000000";
    const { quotaSet } = stubUpdates(
      [{ id: auditId, userId: trialUserId }],
      [{ id: "quota-1" }],
    );
    const { del } = stubLedgerDelete();

    try {
      await expect(sweepStaleAudits()).resolves.toBe(1);
    } finally {
      resetAuditEvents(auditId);
    }

    expect(quotaSet).toHaveBeenCalledOnce();
    expect(del).not.toHaveBeenCalled();
  });

  it("keeps sweeping remaining audits when one refund fails", async () => {
    const first = "00000000-0000-4000-8000-00000000cccc";
    const second = "00000000-0000-4000-8000-00000000dddd";
    stubUpdates([
      { id: first, userId: "user-1" },
      { id: second, userId: "user-2" },
    ]);
    const execute = vi
      .spyOn(db, "execute")
      .mockRejectedValue(new Error("connection refused"));

    try {
      // refundAuditCharge swallows db errors, so both rows still count.
      await expect(sweepStaleAudits()).resolves.toBe(2);
    } finally {
      resetAuditEvents(first);
      resetAuditEvents(second);
    }

    expect(execute).toHaveBeenCalledTimes(2);
  });
});
