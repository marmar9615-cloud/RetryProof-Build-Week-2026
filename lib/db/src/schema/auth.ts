import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
//
// Subscription columns (stripe*, subscriptionTier, subscriptionStatus,
// subscriptionPeriodEnd) are nullable so existing free users keep working.
// They're hydrated by the Stripe webhook on subscription lifecycle events
// (see api-server/src/routes/stripe.ts).
export const usersTable = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email").unique(),
    firstName: varchar("first_name"),
    lastName: varchar("last_name"),
    profileImageUrl: varchar("profile_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    // Stripe linkage — populated by webhook on first paid Checkout session.
    stripeCustomerId: varchar("stripe_customer_id"),
    stripeSubscriptionId: varchar("stripe_subscription_id"),
    // "free" (no row in Stripe), "pro" (active monthly/annual sub).
    // Nullable for legacy rows; treat null as "free".
    subscriptionTier: varchar("subscription_tier"),
    // Mirrors Stripe subscription.status: "active" | "trialing" | "past_due"
    // | "canceled" | "incomplete" | "incomplete_expired" | "unpaid". Nullable.
    subscriptionStatus: varchar("subscription_status"),
    // Stripe current_period_end — used to render renewal date in the UI.
    subscriptionPeriodEnd: timestamp("subscription_period_end", { withTimezone: true }),
  },
  (table) => [
    index("IDX_users_stripe_customer").on(table.stripeCustomerId),
  ],
);

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
