import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getStripe, isStripeConfigured } from "../lib/stripe";
import {
  getEntitlementForUser,
  getMonthlyAuditsUsed,
} from "../lib/entitlement";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * GET /api/billing/me
 *
 * Returns the authenticated user's subscription state. Used by the
 * dashboard sidebar + audit form to render Pro / Free pills, the
 * "X of N audits" counter, and to gate the "Manage subscription"
 * menu item.
 */
router.get(
  "/billing/me",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }
    const [ent, monthlyAuditsUsed] = await Promise.all([
      getEntitlementForUser(req.user.id),
      getMonthlyAuditsUsed(req.user.id),
    ]);
    res.json({
      tier: ent.tier,
      status: ent.status,
      periodEnd: ent.periodEnd?.toISOString() ?? null,
      hasStripeCustomer: ent.hasStripeCustomer,
      maxActiveAudits: ent.maxActiveAudits,
      // number | null by contract — null would mean "unlimited", which no
      // current tier grants, so today this is always a number.
      monthlyAuditLimit: ent.monthlyAuditLimit,
      monthlyAuditsUsed,
    });
  },
);

/**
 * POST /api/billing/portal-session
 *
 * Creates a Stripe Billing Portal session for the authenticated user and
 * returns the redirect URL. The frontend opens it in the same tab so the
 * user can update card / cancel / view invoices, then comes back to /app.
 *
 * No-op for users that haven't completed Checkout yet (no stripeCustomerId).
 */
router.post(
  "/billing/portal-session",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }

    if (!isStripeConfigured()) {
      res
        .status(503)
        .json({ error: "Billing is not configured on this deployment." });
      return;
    }

    const [user] = await db
      .select({
        id: usersTable.id,
        stripeCustomerId: usersTable.stripeCustomerId,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id));

    if (!user?.stripeCustomerId) {
      res.status(400).json({
        error:
          "No billing customer on file. Subscribe to NeverGuess Pro first.",
        code: "NO_STRIPE_CUSTOMER",
      });
      return;
    }

    try {
      const stripe = getStripe();
      const returnUrl = process.env.PUBLIC_APP_URL
        ? `${process.env.PUBLIC_APP_URL.replace(/\/$/, "")}/app`
        : "https://marmarlabs.com/app";
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });
      res.json({ url: session.url });
    } catch (err) {
      logger.error(
        { err, userId: user.id },
        "Failed to create Stripe portal session",
      );
      res
        .status(502)
        .json({
          error: "Could not open the billing portal. Please try again.",
        });
    }
  },
);

export default router;
