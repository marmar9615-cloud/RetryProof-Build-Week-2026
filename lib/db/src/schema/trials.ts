import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const trialAuditQuotasTable = pgTable(
  "trial_audit_quotas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    ipHash: text("ip_hash").notNull(),
    userAgentHash: text("user_agent_hash").notNull(),
    usedCount: integer("used_count").notNull().default(0),
    limit: integer("limit").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("trial_audit_quotas_token_hash_idx").on(table.tokenHash),
    index("trial_audit_quotas_user_id_idx").on(table.userId),
    index("trial_audit_quotas_ip_hash_idx").on(table.ipHash),
    index("trial_audit_quotas_expires_at_idx").on(table.expiresAt),
  ],
);

export type TrialAuditQuota = typeof trialAuditQuotasTable.$inferSelect;
