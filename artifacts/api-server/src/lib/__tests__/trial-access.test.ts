import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

// @workspace/db throws at import time without DATABASE_URL. The Pool it
// creates never connects — every query below is intercepted by spies.
vi.hoisted(() => {
  process.env.DATABASE_URL ??=
    "postgres://unused:unused@localhost:5432/unused";
});

import { db } from "@workspace/db";
import {
  adoptTrialAudits,
  refundTrialAuditSlot,
  TRIAL_COOKIE,
} from "../trial-access";

const TRIAL_USER_ID = "trial_00000000-0000-4000-8000-000000000000";
const NEW_USER_ID = "user-oidc-sub-123";
const VALID_TOKEN = "a".repeat(32);

function makeReq(cookies: Record<string, string> = {}): Request {
  return {
    cookies,
    log: { info: vi.fn(), warn: vi.fn() },
  } as unknown as Request;
}

function makeRes(): Response & { clearCookie: ReturnType<typeof vi.fn> } {
  return { clearCookie: vi.fn() } as unknown as Response & {
    clearCookie: ReturnType<typeof vi.fn>;
  };
}

/** Stub the single select chain getTrialUserId runs (token hash lookup). */
function stubTrialLookup(rows: Array<{ userId: string }>) {
  return vi.spyOn(db, "select").mockReturnValue({
    from: () => ({ where: () => Promise.resolve(rows) }),
  } as unknown as ReturnType<typeof db.select>);
}

/** Stub the audits UPDATE chain, capturing the values passed to .set(). */
function stubAuditUpdate(adoptedIds: Array<{ id: string }>) {
  const set = vi.fn(() => ({
    where: () => ({ returning: () => Promise.resolve(adoptedIds) }),
  }));
  const update = vi
    .spyOn(db, "update")
    .mockReturnValue({ set } as unknown as ReturnType<typeof db.update>);
  return { update, set };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("adoptTrialAudits", () => {
  it("does nothing without a trial cookie", async () => {
    const update = vi.spyOn(db, "update");
    const res = makeRes();

    const adopted = await adoptTrialAudits(makeReq(), res, NEW_USER_ID);

    expect(adopted).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it("ignores malformed (too short) trial cookies without touching the db", async () => {
    const select = vi.spyOn(db, "select");
    const update = vi.spyOn(db, "update");
    const res = makeRes();

    const adopted = await adoptTrialAudits(
      makeReq({ [TRIAL_COOKIE]: "short" }),
      res,
      NEW_USER_ID,
    );

    expect(adopted).toBe(0);
    expect(select).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it("re-parents trial audits to the new account and clears the cookie", async () => {
    stubTrialLookup([{ userId: TRIAL_USER_ID }]);
    const { set } = stubAuditUpdate([{ id: "audit-1" }, { id: "audit-2" }]);
    const req = makeReq({ [TRIAL_COOKIE]: VALID_TOKEN });
    const res = makeRes();

    const adopted = await adoptTrialAudits(req, res, NEW_USER_ID);

    expect(adopted).toBe(2);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ userId: NEW_USER_ID }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      TRIAL_COOKIE,
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );
  });

  it("clears the cookie even when the trial identity owns no audits", async () => {
    stubTrialLookup([{ userId: TRIAL_USER_ID }]);
    stubAuditUpdate([]);
    const res = makeRes();

    const adopted = await adoptTrialAudits(
      makeReq({ [TRIAL_COOKIE]: VALID_TOKEN }),
      res,
      NEW_USER_ID,
    );

    expect(adopted).toBe(0);
    expect(res.clearCookie).toHaveBeenCalledOnce();
  });

  it("skips adoption when the resolved id already matches the new user", async () => {
    stubTrialLookup([{ userId: NEW_USER_ID }]);
    const update = vi.spyOn(db, "update");
    const res = makeRes();

    const adopted = await adoptTrialAudits(
      makeReq({ [TRIAL_COOKIE]: VALID_TOKEN }),
      res,
      NEW_USER_ID,
    );

    expect(adopted).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("never throws into the sign-in flow when the db update fails", async () => {
    stubTrialLookup([{ userId: TRIAL_USER_ID }]);
    vi.spyOn(db, "update").mockImplementation(() => {
      throw new Error("connection refused");
    });
    const req = makeReq({ [TRIAL_COOKIE]: VALID_TOKEN });
    const res = makeRes();

    await expect(adoptTrialAudits(req, res, NEW_USER_ID)).resolves.toBe(0);
    // Cookie is kept so a later sign-in can still adopt the audits.
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(req.log.warn).toHaveBeenCalled();
  });
});

/** Stub the quota UPDATE chain refundTrialAuditSlot runs. */
function stubQuotaRefundUpdate(refundedRows: Array<{ id: string }>) {
  const set = vi.fn((_values: Record<string, unknown>) => ({
    where: () => ({ returning: () => Promise.resolve(refundedRows) }),
  }));
  const update = vi
    .spyOn(db, "update")
    .mockReturnValue({ set } as unknown as ReturnType<typeof db.update>);
  return { update, set };
}

describe("refundTrialAuditSlot", () => {
  it("decrements the used slot and reports the refund", async () => {
    const { update, set } = stubQuotaRefundUpdate([{ id: "quota-1" }]);

    await expect(refundTrialAuditSlot(TRIAL_USER_ID)).resolves.toBe(true);

    expect(update).toHaveBeenCalledOnce();
    // usedCount must be a SQL expression (greatest(... - 1, 0)), never a
    // plain JS number that could race with a concurrent claim.
    const setArg = set.mock.calls[0]?.[0] as
      | { usedCount?: unknown }
      | undefined;
    expect(setArg).toBeDefined();
    expect(setArg).toHaveProperty("usedCount");
    expect(typeof setArg?.usedCount).not.toBe("number");
  });

  it("reports false when the counter is already at the zero floor", async () => {
    // WHERE usedCount > 0 matches nothing — the UPDATE returns no rows.
    stubQuotaRefundUpdate([]);

    await expect(refundTrialAuditSlot(TRIAL_USER_ID)).resolves.toBe(false);
  });

  it("refuses non-trial user ids without touching the db", async () => {
    const update = vi.spyOn(db, "update");

    await expect(refundTrialAuditSlot(NEW_USER_ID)).resolves.toBe(false);

    expect(update).not.toHaveBeenCalled();
  });

  it("returns false instead of throwing when the db update fails", async () => {
    vi.spyOn(db, "update").mockImplementation(() => {
      throw new Error("connection refused");
    });

    await expect(refundTrialAuditSlot(TRIAL_USER_ID)).resolves.toBe(false);
  });
});
