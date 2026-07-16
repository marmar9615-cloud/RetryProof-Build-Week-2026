import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { type Request, type Response } from "express";
import {
  db,
  auditsTable,
  trialAuditQuotasTable,
  usersTable,
} from "@workspace/db";
import { hmacHash as hashWithSecret, trustedRequestIp } from "./trial-identity";
import { logger } from "./logger";

export const TRIAL_COOKIE = "ng_trial";
export const TRIAL_AUDIT_LIMIT = 1;
export const TRIAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type TrialStatus = {
  authenticated: boolean;
  trialEligible: boolean;
  used: number;
  limit: number;
  remaining: number;
};

export type TrialActor = {
  userId: string;
  trialId: string;
  remaining: number;
};

export class TrialLimitError extends Error {
  readonly status = 429;
  readonly code = "TRIAL_LIMIT_REACHED";

  constructor() {
    super(
      "You already used your free NeverGuess audit. Sign in to run more audits.",
    );
  }
}

function getHashSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "test") return "test-session-secret";
  throw new Error(
    "SESSION_SECRET must be set before anonymous trials can run.",
  );
}

export function hmacHash(value: string): string {
  return hashWithSecret(value, getHashSecret());
}

export function requestIp(req: Request): string {
  return trustedRequestIp({
    socketRemoteAddress: req.socket.remoteAddress,
    expressIp: req.ip,
  });
}

function requestUserAgent(req: Request): string {
  return req.get("user-agent")?.slice(0, 256) || "unknown";
}

function getCookieToken(req: Request): string | null {
  const token = req.cookies?.[TRIAL_COOKIE];
  return typeof token === "string" && token.length >= 24 ? token : null;
}

function setTrialCookie(res: Response, token: string) {
  res.cookie(TRIAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TRIAL_TTL_MS,
  });
}

function newTrialToken(): string {
  return randomBytes(32).toString("base64url");
}

function expiresAt(): Date {
  return new Date(Date.now() + TRIAL_TTL_MS);
}

function trialUserId(): string {
  return `trial_${randomUUID()}`;
}

async function getUsedByIp(ipHash: string): Promise<number> {
  const [row] = await db
    .select({
      used: sql<number>`coalesce(sum(${trialAuditQuotasTable.usedCount}), 0)::int`,
    })
    .from(trialAuditQuotasTable)
    .where(
      and(
        eq(trialAuditQuotasTable.ipHash, ipHash),
        gt(trialAuditQuotasTable.expiresAt, new Date()),
      ),
    );
  return Number(row?.used ?? 0);
}

export async function getTrialUserId(req: Request): Promise<string | null> {
  const token = getCookieToken(req);
  if (!token) return null;
  const tokenHash = hmacHash(token);
  const [trial] = await db
    .select({
      userId: trialAuditQuotasTable.userId,
    })
    .from(trialAuditQuotasTable)
    .where(
      and(
        eq(trialAuditQuotasTable.tokenHash, tokenHash),
        gt(trialAuditQuotasTable.expiresAt, new Date()),
      ),
    );
  return trial?.userId ?? null;
}

export async function getTrialStatus(req: Request): Promise<TrialStatus> {
  const ipHash = hmacHash(requestIp(req));
  const limit = TRIAL_AUDIT_LIMIT;
  const token = getCookieToken(req);

  if (token) {
    const tokenHash = hmacHash(token);
    const [trial] = await db
      .select({
        usedCount: trialAuditQuotasTable.usedCount,
        limit: trialAuditQuotasTable.limit,
      })
      .from(trialAuditQuotasTable)
      .where(
        and(
          eq(trialAuditQuotasTable.tokenHash, tokenHash),
          gt(trialAuditQuotasTable.expiresAt, new Date()),
        ),
      );
    if (trial) {
      const used = Math.max(0, trial.usedCount);
      const rowLimit = Math.max(1, trial.limit);
      return {
        authenticated: false,
        trialEligible: used < rowLimit,
        used,
        limit: rowLimit,
        remaining: Math.max(0, rowLimit - used),
      };
    }
  }

  const used = await getUsedByIp(ipHash);
  return {
    authenticated: false,
    trialEligible: used < limit,
    used: Math.min(used, limit),
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Re-parent any audits owned by the visitor's anonymous trial identity onto
 * the account they just signed in with, so the report they ran before
 * authenticating shows up on their dashboard.
 *
 * Trusts only the signed HttpOnly trial cookie (via getTrialUserId) — never a
 * caller-supplied trial id. The trial quota row and its trial_* users row are
 * left in place on purpose: the quota row is what stops the same IP/token
 * from claiming another free audit, and deleting the users row would
 * cascade-delete it (trial_audit_quotas.user_id references users.id ON
 * DELETE CASCADE).
 *
 * Best-effort and idempotent: failures are logged and swallowed so adoption
 * can never break a sign-in, and a replayed cookie finds zero audits left to
 * move. Returns the number of audits adopted.
 */
export async function adoptTrialAudits(
  req: Request,
  res: Response,
  newUserId: string,
): Promise<number> {
  try {
    const trialUserId = await getTrialUserId(req);
    if (!trialUserId || trialUserId === newUserId) return 0;

    const adopted = await db
      .update(auditsTable)
      .set({ userId: newUserId, updatedAt: new Date() })
      .where(eq(auditsTable.userId, trialUserId))
      .returning({ id: auditsTable.id });

    // The cookie has served its purpose; clear it with the same attributes
    // it was set with so the browser actually drops it.
    res.clearCookie(TRIAL_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    if (adopted.length > 0) {
      req.log?.info(
        { userId: newUserId, adoptedAudits: adopted.length },
        "Adopted anonymous trial audits on sign-in",
      );
    }
    return adopted.length;
  } catch (err) {
    req.log?.warn({ err }, "Failed to adopt trial audits after sign-in");
    return 0;
  }
}

/**
 * Hand the visitor's anonymous audit slot back after a failure that never
 * spent model tokens (ingestion errors, stranded jobs). The claim happened
 * in claimTrialAuditSlot before ingestion started, so without a refund a
 * bad GitHub URL would permanently burn the visitor's single free audit.
 *
 * Gated to trial_-prefixed user ids so a bug upstream can never decrement
 * a row for an authenticated account. The usedCount > 0 predicate plus the
 * GREATEST(... - 1, 0) floor make repeated refunds safe: once the counter
 * is back at zero there is nothing left to match, and we report false.
 *
 * Best-effort: never throws, because refunds run inside failure paths that
 * must still surface the original error to the user.
 */
export async function refundTrialAuditSlot(userId: string): Promise<boolean> {
  if (!userId.startsWith("trial_")) return false;
  try {
    const now = new Date();
    const refunded = await db
      .update(trialAuditQuotasTable)
      .set({
        usedCount: sql`greatest(${trialAuditQuotasTable.usedCount} - 1, 0)`,
        updatedAt: now,
      })
      .where(
        and(
          eq(trialAuditQuotasTable.userId, userId),
          gt(trialAuditQuotasTable.usedCount, 0),
        ),
      )
      .returning({ id: trialAuditQuotasTable.id });
    return refunded.length > 0;
  } catch (err) {
    logger.warn(
      { userId, err: err instanceof Error ? err.message : err },
      "Failed to refund trial audit slot",
    );
    return false;
  }
}

export async function claimTrialAuditSlot(
  req: Request,
  res: Response,
): Promise<TrialActor> {
  const now = new Date();
  const ipHash = hmacHash(requestIp(req));
  const userAgentHash = hmacHash(requestUserAgent(req));
  let token = getCookieToken(req);
  let tokenHash = token ? hmacHash(token) : null;
  let tokenToSet: string | null = null;

  const actor = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"trial-ip:" + ipHash}, 0))`,
    );

    const [ipRow] = await tx
      .select({
        used: sql<number>`coalesce(sum(${trialAuditQuotasTable.usedCount}), 0)::int`,
      })
      .from(trialAuditQuotasTable)
      .where(
        and(
          eq(trialAuditQuotasTable.ipHash, ipHash),
          gt(trialAuditQuotasTable.expiresAt, now),
        ),
      );

    if (Number(ipRow?.used ?? 0) >= TRIAL_AUDIT_LIMIT) {
      throw new TrialLimitError();
    }

    let [trial] = tokenHash
      ? await tx
          .select()
          .from(trialAuditQuotasTable)
          .where(
            and(
              eq(trialAuditQuotasTable.tokenHash, tokenHash),
              gt(trialAuditQuotasTable.expiresAt, now),
            ),
          )
      : [];

    if (!trial) {
      token = newTrialToken();
      const newTokenHash = hmacHash(token);
      tokenHash = newTokenHash;
      tokenToSet = token;
      const userId = trialUserId();
      await tx.insert(usersTable).values({
        id: userId,
        email: null,
        firstName: "NeverGuess",
        lastName: "Trial",
        profileImageUrl: null,
      });
      [trial] = await tx
        .insert(trialAuditQuotasTable)
        .values({
          userId,
          tokenHash: newTokenHash,
          ipHash,
          userAgentHash,
          usedCount: 0,
          limit: TRIAL_AUDIT_LIMIT,
          expiresAt: expiresAt(),
        })
        .returning();
    }

    const [claimed] = await tx
      .update(trialAuditQuotasTable)
      .set({
        usedCount: sql`${trialAuditQuotasTable.usedCount} + 1`,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(trialAuditQuotasTable.id, trial.id),
          gt(trialAuditQuotasTable.expiresAt, now),
          sql`${trialAuditQuotasTable.usedCount} < ${trialAuditQuotasTable.limit}`,
        ),
      )
      .returning({
        id: trialAuditQuotasTable.id,
        userId: trialAuditQuotasTable.userId,
        usedCount: trialAuditQuotasTable.usedCount,
        limit: trialAuditQuotasTable.limit,
      });

    if (!claimed) {
      throw new TrialLimitError();
    }

    return {
      userId: claimed.userId,
      trialId: claimed.id,
      remaining: Math.max(0, claimed.limit - claimed.usedCount),
    };
  });

  if (tokenToSet) {
    setTrialCookie(res, tokenToSet);
  }

  return actor;
}
