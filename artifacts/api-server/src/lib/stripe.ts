// Lightweight Stripe singleton + helpers used by the webhook + portal route.
//
// The webhook and portal route both need a configured Stripe instance, but
// nothing else in the codebase should import the SDK directly — keep all
// surface area narrow and async-import-friendly.
import Stripe from "stripe";
import { and, eq, isNull, or } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "./logger";

let cached: Stripe | null = null;

/**
 * Returns a configured Stripe client. Throws if STRIPE_SECRET_KEY is unset —
 * callers should gate routes behind `isStripeConfigured()` before invoking.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY must be set to use the Stripe client.");
  }
  cached = new Stripe(key, {
    // Pin to the API version the installed SDK was generated against
    // (stripe@17.7.0 → 2025-02-24.acacia). Bumping this requires bumping
    // the SDK too — keep them in lockstep so types stay accurate.
    apiVersion: "2025-02-24.acacia",
    appInfo: {
      name: "NeverGuess",
      url: "https://marmarlabs.com",
    },
  });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

const DEFAULT_NEVERGUESS_PRO_PRICE_IDS = [
  "price_1TUrroL63c2y5C4UolezfDcp",
  "price_1TUrrpL63c2y5C4URdOr9EaN",
];

function allowedNeverGuessPriceIds(): Set<string> {
  const configured = [
    process.env.STRIPE_NEVERGUESS_PRO_PRICE_IDS,
    process.env.STRIPE_ALLOWED_PRICE_IDS,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(configured.length > 0 ? configured : DEFAULT_NEVERGUESS_PRO_PRICE_IDS);
}

export function isNeverGuessProSubscription(
  subscription: Stripe.Subscription,
): boolean {
  const allowed = allowedNeverGuessPriceIds();
  return subscription.items.data.some((item) => allowed.has(item.price.id));
}

/**
 * Single source of truth for syncing a Stripe Subscription onto our
 * `users` row. Idempotent — safe to call from any webhook event.
 */
export async function syncSubscriptionToUser(args: {
  userId: string;
  customerId: string;
  subscription: Stripe.Subscription | null;
}): Promise<void> {
  const { userId, customerId, subscription } = args;

  if (!subscription) {
    // No subscription means the user never paid OR fully canceled and the
    // sub was deleted. Reset to free tier but keep the customer link so
    // future Checkouts find the same Stripe customer.
    const updated = await db
      .update(usersTable)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: null,
        subscriptionTier: "free",
        subscriptionStatus: "canceled",
        subscriptionPeriodEnd: null,
      })
      .where(
        and(
          eq(usersTable.id, userId),
          or(
            isNull(usersTable.stripeCustomerId),
            eq(usersTable.stripeCustomerId, customerId),
          ),
        ),
      )
      .returning({ id: usersTable.id });
    if (updated.length === 0) {
      logger.warn(
        { userId, customerId },
        "Stripe sync refused to overwrite an existing customer link",
      );
    }
    return;
  }

  if (!isNeverGuessProSubscription(subscription)) {
    logger.warn(
      { userId, customerId, subscriptionId: subscription.id },
      "Ignoring Stripe subscription with no allowed NeverGuess price",
    );
    return;
  }

  // "active" + "trialing" are the only states that should grant Pro access.
  // Everything else (past_due, unpaid, canceled, incomplete) → free.
  const grantsPro = subscription.status === "active" || subscription.status === "trialing";
  // Stripe types reasonably guarantee current_period_end on active subs;
  // null-coalesce defensively for incomplete states.
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  const updated = await db
    .update(usersTable)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionTier: grantsPro ? "pro" : "free",
      subscriptionStatus: subscription.status,
      subscriptionPeriodEnd: periodEnd,
    })
    .where(
      and(
        eq(usersTable.id, userId),
        or(
          isNull(usersTable.stripeCustomerId),
          eq(usersTable.stripeCustomerId, customerId),
        ),
      ),
    )
    .returning({ id: usersTable.id });
  if (updated.length === 0) {
    logger.warn(
      { userId, customerId, subscriptionId: subscription.id },
      "Stripe sync refused to overwrite an existing customer link",
    );
  }
}

/**
 * Find a NeverGuess user from a Stripe checkout/customer payload. The
 * resolution order is, in priority:
 *
 *   1. `clientReferenceId` — passed back from the Payment Link via
 *      `?client_reference_id=` and surfaced on session.client_reference_id.
 *      This is the most reliable join — it's the actual user id captured
 *      at checkout time, immune to email mismatches.
 *   2. `customerId` — once we've stored stripeCustomerId on a user row,
 *      every subsequent webhook event resolves through this. Durable.
 *   3. `email` — fallback for first-time legacy payments where the
 *      Payment Link wasn't stamped with client_reference_id (anonymous
 *      flow, or pre-2026-05 customers).
 *
 * Returns null if none match — caller should log + skip. `silent: true`
 * suppresses the warning log for known races (e.g. subscription.created
 * arriving before checkout.session.completed).
 */
export async function findUserForStripe(args: {
  customerId: string;
  email: string | null | undefined;
  clientReferenceId?: string | null;
  silent?: boolean;
}): Promise<{ id: string } | null> {
  const { customerId, email, clientReferenceId, silent } = args;
  const normalizedEmail = email?.trim().toLowerCase() || null;

  // 1. client_reference_id (only set on checkout.session.completed when the
  // Payment Link URL included the query param).
  if (clientReferenceId) {
    const [byRef] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        stripeCustomerId: usersTable.stripeCustomerId,
      })
      .from(usersTable)
      .where(eq(usersTable.id, clientReferenceId));
    if (byRef) {
      if (byRef.stripeCustomerId && byRef.stripeCustomerId !== customerId) {
        logger.warn(
          { userId: byRef.id, customerId },
          "Stripe webhook refused to overwrite an existing customer link",
        );
        return null;
      }
      if (
        normalizedEmail &&
        byRef.email &&
        byRef.email.toLowerCase() !== normalizedEmail
      ) {
        logger.warn(
          { userId: byRef.id, customerId },
          "Stripe webhook client reference email did not match user email",
        );
        return null;
      }
      return { id: byRef.id };
    }
    // If clientReferenceId was present but didn't match any user, that's
    // unusual — fall through to the other paths and warn at the end.
  }

  // 2. customerId — the durable join key once a user has paid before.
  const [byCustomer] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.stripeCustomerId, customerId));
  if (byCustomer) return byCustomer;

  // 3. email fallback — disabled by default because a public Checkout email
  // is not proof that the payer controls the matching app account.
  if (normalizedEmail && process.env.STRIPE_ALLOW_EMAIL_FALLBACK === "true") {
    const [byEmail] = await db
      .select({
        id: usersTable.id,
        stripeCustomerId: usersTable.stripeCustomerId,
      })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));
    if (byEmail) {
      if (byEmail.stripeCustomerId && byEmail.stripeCustomerId !== customerId) {
        logger.warn(
          { userId: byEmail.id, customerId },
          "Stripe webhook email fallback refused to overwrite customer link",
        );
        return null;
      }
      return { id: byEmail.id };
    }
  }

  if (!silent) {
    logger.warn(
      {
        customerId,
        hasEmail: Boolean(email),
        hasClientReferenceId: Boolean(clientReferenceId),
      },
      "Stripe webhook: no NeverGuess user matches this customer/email/reference",
    );
  }
  return null;
}
