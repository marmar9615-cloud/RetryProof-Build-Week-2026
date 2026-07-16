import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@workspace/replit-auth-web";

export type BillingState = {
  tier: "free" | "pro";
  status: string | null;
  periodEnd: string | null;
  hasStripeCustomer: boolean;
  maxActiveAudits: number;
  /** null = unknown (fetch failed / signed out) or no monthly cap. */
  monthlyAuditLimit: number | null;
  /** Audits consumed since UTC month start. null until the server sends it. */
  monthlyAuditsUsed: number | null;
};

const FREE_DEFAULT: BillingState = {
  tier: "free",
  status: null,
  periodEnd: null,
  hasStripeCustomer: false,
  maxActiveAudits: 3,
  monthlyAuditLimit: null,
  monthlyAuditsUsed: null,
};

// Stripe Checkout's success redirect (`?upgraded=1`) usually lands BEFORE the
// subscription webhook has flipped the user to Pro, so one refetch right after
// returning is not enough. 10 polls x 3s covers the realistic webhook delay
// without hammering the API forever if the webhook never arrives.
const PRO_ACTIVATION_POLL_MS = 3_000;
const PRO_ACTIVATION_MAX_POLLS = 10;

type UseBillingOptions = {
  /**
   * Re-poll /api/billing/me every few seconds (bounded) until `tier` flips
   * to "pro". Enable when the URL carries Stripe's `?upgraded=1` flag.
   */
  pollForProActivation?: boolean;
};

/**
 * Lightweight hook for the authenticated user's subscription state.
 *
 * Hits GET /api/billing/me on mount + on demand. Skipped (returns Free
 * defaults) for unauthenticated visitors. Cache is per-tab and lives for
 * the page session. The tier flip after Checkout depends on the Stripe
 * webhook, which can arrive after the user is redirected back — callers
 * that land on `?upgraded=1` should pass `pollForProActivation` instead
 * of assuming one fetch reflects the new subscription.
 */
export function useBilling(options?: UseBillingOptions) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<BillingState>(FREE_DEFAULT);
  const [loading, setLoading] = useState<boolean>(false);
  const [tick, setTick] = useState(0);
  const [pollsUsed, setPollsUsed] = useState(0);

  const pollForPro = options?.pollForProActivation ?? false;

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!isAuthenticated) {
      setState(FREE_DEFAULT);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch("/api/billing/me", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) return FREE_DEFAULT;
        // In static preview the SPA shell answers /api/* with HTML; .json()
        // may throw or produce a non-object. Never let that reach the field
        // reads below.
        const data: unknown = await r.json().catch(() => null);
        return data !== null && typeof data === "object"
          ? (data as Record<string, unknown>)
          : FREE_DEFAULT;
      })
      .then((data: Record<string, unknown>) => {
        if (cancelled) return;
        setState({
          tier: data.tier === "pro" ? "pro" : "free",
          status: typeof data.status === "string" ? data.status : null,
          periodEnd:
            typeof data.periodEnd === "string" ? data.periodEnd : null,
          hasStripeCustomer: Boolean(data.hasStripeCustomer),
          maxActiveAudits:
            typeof data.maxActiveAudits === "number" ? data.maxActiveAudits : 3,
          monthlyAuditLimit:
            typeof data.monthlyAuditLimit === "number"
              ? data.monthlyAuditLimit
              : null,
          monthlyAuditsUsed:
            typeof data.monthlyAuditsUsed === "number"
              ? data.monthlyAuditsUsed
              : null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState(FREE_DEFAULT);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, tick]);

  // Give the poll budget back whenever polling is (re)enabled so a second
  // upgrade attempt in the same tab gets a fresh window.
  useEffect(() => {
    if (pollForPro) setPollsUsed(0);
  }, [pollForPro]);

  useEffect(() => {
    if (!pollForPro || !isAuthenticated) return;
    if (state.tier === "pro") return;
    if (loading) return; // schedule the next poll only after the last fetch settles
    if (pollsUsed >= PRO_ACTIVATION_MAX_POLLS) return;
    const timer = setTimeout(() => {
      setPollsUsed((n) => n + 1);
      setTick((n) => n + 1);
    }, PRO_ACTIVATION_POLL_MS);
    return () => clearTimeout(timer);
  }, [pollForPro, isAuthenticated, state.tier, loading, pollsUsed]);

  /** True while we're still waiting for the webhook to flip the tier. */
  const activatingPro =
    pollForPro &&
    isAuthenticated &&
    state.tier !== "pro" &&
    pollsUsed < PRO_ACTIVATION_MAX_POLLS;

  return { ...state, loading, refetch, activatingPro };
}

/**
 * Open the Stripe Customer Portal in the same tab. The backend creates the
 * portal session against the user's stripeCustomerId and returns a URL.
 * Returns true on success — caller can show a toast on false.
 */
export async function openCustomerPortal(): Promise<boolean> {
  try {
    const res = await fetch("/api/billing/portal-session", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { url?: string };
    if (!data.url) return false;
    window.location.assign(data.url);
    return true;
  } catch {
    return false;
  }
}
