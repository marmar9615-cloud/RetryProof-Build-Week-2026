import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import type Stripe from "stripe";
import {
  getStripe,
  isStripeConfigured,
  isWebhookConfigured,
  findUserForStripe,
  isNeverGuessProSubscription,
  syncSubscriptionToUser,
} from "../lib/stripe";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * POST /api/stripe/webhook
 *
 * Stripe sends events here whenever a subscription state changes. We use the
 * raw body (mounted via express.raw before this route in app.ts) to verify
 * the signature, then upsert subscription state onto the matching user.
 *
 * Idempotency: every handler is safe to retry. Stripe will retry failed
 * deliveries with exponential backoff for up to 3 days, so any transient
 * DB error → return 5xx and let Stripe retry.
 */
router.post(
  "/stripe/webhook",
  // Raw body required for signature verification. Mounted only on this route
  // so the rest of the API keeps express.json() semantics.
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response): Promise<void> => {
    if (!isStripeConfigured() || !isWebhookConfigured()) {
      // Don't 200 — Stripe interprets that as "delivered, don't retry". 503
      // signals "configuration drift, please retry later" and surfaces in
      // the Stripe dashboard's failed-deliveries view.
      res
        .status(503)
        .json({ error: "Stripe is not configured on this deployment." });
      return;
    }

    const sig = req.get("stripe-signature");
    if (!sig) {
      res.status(400).json({ error: "Missing Stripe-Signature header." });
      return;
    }

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        // express.raw gives us a Buffer; constructEvent accepts string or Buffer.
        req.body as Buffer,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "unknown signature error";
      logger.warn(
        { err: message },
        "Stripe webhook signature verification failed",
      );
      // 400 ensures Stripe doesn't keep retrying a forged/misconfigured event.
      res
        .status(400)
        .json({ error: `Webhook signature verification failed: ${message}` });
      return;
    }

    try {
      await handleStripeEvent(stripe, event);
      // Acknowledge receipt — *after* the handler succeeded.
      res.json({ received: true, eventId: event.id, type: event.type });
    } catch (err) {
      logger.error(
        { err, eventId: event.id, type: event.type },
        "Stripe webhook handler threw — Stripe will retry",
      );
      // 500 → Stripe retries with backoff. This is desired for transient
      // DB errors. Permanent errors will surface as repeated retries in
      // the Stripe dashboard.
      res.status(500).json({ error: "Webhook handler failed; please retry." });
    }
  },
);

/**
 * Dispatch table for Stripe event types we care about. Keep this small —
 * each event implies a subscription-state lookup + user upsert. Anything
 * else (charges, invoices, etc.) is ignored.
 */
async function handleStripeEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(
        stripe,
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      // `created` may arrive before the matching checkout.session.completed
      // when Stripe fans events out concurrently — in that race we have no
      // user link yet, and onSubscriptionLifecycle silently drops. The
      // immediately-following checkout.session.completed picks up the
      // linkage via client_reference_id (or email fallback) and the next
      // .updated event resyncs from the customer id. End state is correct;
      // the lifecycle handler logs the no-user case at debug, not warn.
      await onSubscriptionLifecycle(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed":
      // Treat as subscription update — Stripe will move sub.status to
      // past_due/unpaid; sync that state.
      await onInvoicePaymentFailed(stripe, event.data.object as Stripe.Invoice);
      break;
    case "customer.updated":
      // Customer Portal lets users change their billing email + name. Sync
      // it onto the user row so support can find them by either email later.
      await onCustomerUpdated(event.data.object as Stripe.Customer);
      break;
    default:
      // Ignored event — log at debug so a noisy webhook config doesn't spam.
      logger.debug({ type: event.type }, "Ignoring Stripe event type");
  }
}

async function onCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  // Only handle the subscription Checkout flow (Pro). One-time checkouts
  // (if we ever add them) come through with mode="payment" and should
  // be handled separately.
  if (session.mode !== "subscription") {
    logger.debug(
      { sessionId: session.id, mode: session.mode },
      "Ignoring non-subscription checkout",
    );
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!customerId) {
    logger.warn(
      { sessionId: session.id },
      "Checkout completed but no customer attached",
    );
    return;
  }

  // Pricing page stamps the NeverGuess user id onto the Stripe Payment Link
  // via `?client_reference_id=...`. When present, that's the most reliable
  // way to link the payment — no email matching, no race conditions.
  // Fall back to email when client_reference_id is absent (legacy paying
  // customers, or anonymous flows that we kept as a soft path).
  const user = await findUserForStripe({
    customerId,
    email: session.customer_email ?? session.customer_details?.email,
    clientReferenceId: session.client_reference_id ?? null,
  });
  if (!user) return;

  // Pull the actual subscription object so we can read .status accurately.
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subscriptionId) {
    logger.warn(
      { sessionId: session.id },
      "Subscription Checkout missing subscription id",
    );
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (!isNeverGuessProSubscription(subscription)) {
    logger.warn(
      { sessionId: session.id, subscriptionId },
      "Checkout completed for subscription without an allowed NeverGuess price",
    );
    return;
  }

  await syncSubscriptionToUser({
    userId: user.id,
    customerId,
    subscription,
  });

  logger.info(
    {
      userId: user.id,
      customerId,
      subscriptionId,
      tier: subscription.status === "active" ? "pro" : "free",
    },
    "Stripe Checkout completed — user synced",
  );

  // Optional: fire a Slack ping so the founder knows when someone pays.
  await maybePingSlack({
    text: `🎉 New NeverGuess Pro: ${session.customer_email ?? session.customer_details?.email ?? "unknown"} ($${(session.amount_total ?? 0) / 100} checkout)`,
  });
}

async function onSubscriptionLifecycle(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  if (!isNeverGuessProSubscription(subscription)) {
    logger.debug(
      { customerId, subscriptionId: subscription.id },
      "Ignoring subscription lifecycle event for non-NeverGuess price",
    );
    return;
  }

  // `silent: true` — when subscription.created arrives before the matching
  // checkout.session.completed, the user row hasn't been linked to this
  // customerId yet. Don't warn; the .completed event will handle the link
  // and the subsequent .updated will find the user normally.
  const user = await findUserForStripe({
    customerId,
    email: null,
    silent: true,
  });
  if (!user) return;

  await syncSubscriptionToUser({
    userId: user.id,
    customerId,
    // For "deleted" events, treat as canceled — the Stripe object is the
    // final snapshot and its status will already be "canceled".
    subscription,
  });

  logger.info(
    { userId: user.id, customerId, status: subscription.status },
    "Stripe subscription lifecycle synced",
  );
}

/**
 * `customer.updated` fires when the customer's email, name, or address
 * changes — e.g. they updated billing details in the Customer Portal.
 * We mirror the email onto the user row so support can find them by
 * either historical or current email.
 */
async function onCustomerUpdated(customer: Stripe.Customer): Promise<void> {
  const customerId = customer.id;
  const newEmail = customer.email?.trim() || null;
  const user = await findUserForStripe({
    customerId,
    email: null,
    silent: true,
  });
  if (!user) {
    // No user linked yet — likely the .updated event arrived before any
    // checkout.session.completed for this customer. Drop silently.
    return;
  }
  if (!newEmail) return;

  // Don't overwrite the OIDC-issued email on the user row (that's their
  // login identity). Just record it on `stripeCustomerEmail` if/when we
  // need it. For now we only log so support has a breadcrumb in pino.
  logger.info(
    { userId: user.id, customerId, newEmail },
    "Stripe customer.updated — email change recorded",
  );
}

async function onInvoicePaymentFailed(
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<void> {
  // Re-fetch the subscription so its status reflects the failed payment.
  // Stripe may move it to past_due or unpaid depending on dunning settings.
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!subscriptionId) return;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await onSubscriptionLifecycle(subscription);
}

/**
 * Optional Slack notification on Pro signup. Gated behind SLACK_WEBHOOK_URL —
 * if not set, this is a silent no-op. Delivery failures are swallowed so they
 * never break the webhook handler (Slack downtime ≠ Stripe retry).
 */
async function maybePingSlack(args: { text: string }): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: args.text }),
      // Hard deadline so a slow Slack endpoint can't stall webhook ack.
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    logger.warn({ err }, "Slack webhook ping failed (ignored)");
  }
}

export default router;
