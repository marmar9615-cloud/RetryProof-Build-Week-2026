// Per-user entitlement lookups. Centralized so the audit gate, billing
// route, and any future feature flags read tier from one place.
import { and, count, eq, gte } from "drizzle-orm";
import { db, auditRunEventsTable, usersTable } from "@workspace/db";

export type SubscriptionTier = "free" | "pro";

export type UserEntitlement = {
  tier: SubscriptionTier;
  /** Stripe subscription status (active, past_due, canceled…). null = no sub. */
  status: string | null;
  /** When the current paid period ends. null if no active sub. */
  periodEnd: Date | null;
  /** Is there a Stripe customer linked? Used to gate the portal-session route. */
  hasStripeCustomer: boolean;
  /** Concurrent in-flight audits this user is allowed to run. */
  maxActiveAudits: number;
  /** Audits this user is allowed to create in a UTC calendar month. */
  monthlyAuditLimit: number;
};

/** Free tier — non-paying authenticated users. */
const FREE_MAX_ACTIVE_AUDITS = 3;
/** Pro tier — paying subscribers. */
const PRO_MAX_ACTIVE_AUDITS = 10;
/** Monthly audit allowance for non-paying authenticated users. */
export const FREE_MONTHLY_AUDIT_LIMIT = 1;
/** Monthly audit allowance for paying subscribers. */
export const PRO_MONTHLY_AUDIT_LIMIT = 50;

/** Start of the current UTC calendar month — the monthly-quota window. */
export function currentUtcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Audits this user has executed since the start of the current UTC month.
 * Counts from the append-only audit_run_events ledger — not from audits
 * rows — so deleting an audit never resets the tally and every execution
 * (create or rerun) is counted individually. Refunds for ingestion-phase
 * failures DELETE their ledger row, which is what makes this number drop
 * back down without any separate "refunded" bookkeeping.
 */
export async function getMonthlyAuditsUsed(userId: string): Promise<number> {
  const [row] = await db
    .select({ monthlyCount: count() })
    .from(auditRunEventsTable)
    .where(
      and(
        eq(auditRunEventsTable.userId, userId),
        gte(auditRunEventsTable.triggeredAt, currentUtcMonthStart()),
      ),
    );
  return row?.monthlyCount ?? 0;
}

/**
 * Look up entitlement for an authenticated user. Returns Free defaults if
 * the user has no Stripe row OR if the subscription isn't in a granting
 * state (active/trialing).
 */
export async function getEntitlementForUser(
  userId: string,
): Promise<UserEntitlement> {
  const [row] = await db
    .select({
      tier: usersTable.subscriptionTier,
      status: usersTable.subscriptionStatus,
      periodEnd: usersTable.subscriptionPeriodEnd,
      stripeCustomerId: usersTable.stripeCustomerId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  // Treat anything that's not "pro" with active/trialing as Free. The
  // webhook is the source of truth — if it hasn't run yet (race during
  // first Checkout) the user falls back to Free until the next event.
  const isPro =
    row?.tier === "pro" &&
    (row?.status === "active" || row?.status === "trialing");

  return {
    tier: isPro ? "pro" : "free",
    status: row?.status ?? null,
    periodEnd: row?.periodEnd ?? null,
    hasStripeCustomer: Boolean(row?.stripeCustomerId),
    maxActiveAudits: isPro ? PRO_MAX_ACTIVE_AUDITS : FREE_MAX_ACTIVE_AUDITS,
    monthlyAuditLimit: isPro
      ? PRO_MONTHLY_AUDIT_LIMIT
      : FREE_MONTHLY_AUDIT_LIMIT,
  };
}
