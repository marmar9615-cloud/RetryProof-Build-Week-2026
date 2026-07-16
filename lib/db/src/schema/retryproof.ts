import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export type RetryProofSessionState = Record<string, unknown>;

export const retryProofSessionsTable = pgTable(
  "retryproof_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    csrfHash: text("csrf_hash").notNull(),
    state: jsonb("state").$type<RetryProofSessionState>().notNull().default({}),
    operationCounts: jsonb("operation_counts")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("retryproof_sessions_token_hash_idx").on(table.tokenHash),
    index("retryproof_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export type RetryProofSession = typeof retryProofSessionsTable.$inferSelect;

export const retryProofAdmissionBucketsTable = pgTable(
  "retryproof_admission_buckets",
  {
    keyHash: text("key_hash").primaryKey(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("retryproof_admission_buckets_window_idx").on(table.windowStartedAt)],
);

export type RetryProofAdmissionBucket = typeof retryProofAdmissionBucketsTable.$inferSelect;
