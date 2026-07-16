import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const AUDIT_STATUSES = [
  "pending",
  "running",
  "ingested",
  "analyzing",
  "done",
  "error",
] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const INGESTION_SOURCES = ["github", "demo"] as const;
export type IngestionSource = (typeof INGESTION_SOURCES)[number];

export type IngestedFile = {
  path: string;
  size: number;
  truncated?: boolean;
  content?: string;
};

export type IngestedRepo = {
  owner: string;
  repo: string;
  defaultBranch: string;
  fileTree: string[];
  files: IngestedFile[];
  fetchedAt: string;
};

export const auditsTable = pgTable("audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  githubUrl: text("github_url"),
  liveUrl: text("live_url"),
  requestedChange: text("requested_change").notNull(),
  // OpenRouter model id (e.g. "anthropic/claude-fable-5") chosen for this
  // audit's analysis. Null means the server default — all rows created before
  // model selection shipped, plus users who never touch the selector.
  model: text("model"),
  status: text("status", { enum: AUDIT_STATUSES }).notNull().default("pending"),
  ingestionSource: text("ingestion_source", { enum: INGESTION_SOURCES }),
  detectedFramework: text("detected_framework"),
  detectedPackageManager: text("detected_package_manager"),
  detectedDbLayer: text("detected_db_layer"),
  detectedAuthLayer: text("detected_auth_layer"),
  routesFolder: text("routes_folder"),
  deploymentClues: jsonb("deployment_clues").$type<string[]>(),
  rawFilesJson: jsonb("raw_files_json").$type<IngestedRepo>(),
  ingestionError: text("ingestion_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Tracks the most-recent execution time (create OR rerun) for monthly quota
  // accounting. Reruns do not update createdAt, so a separate column is needed
  // to count re-executions of audits created in prior calendar months.
  // Null for rows inserted before this column was added; callers should
  // COALESCE(lastRunAt, createdAt) when computing monthly usage.
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
});

// Append-only execution ledger — one row per audit execution (create OR rerun).
// Intentionally has NO foreign key back to auditsTable so that deleting an
// audit row never removes quota history. Monthly limit checks MUST read from
// this table, not from audits.createdAt, to prevent delete-then-recreate loops
// and repeated-rerun abuse from bypassing per-user monthly quotas.
export const auditRunEventsTable = pgTable("audit_run_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Not a FK — quota history must survive audit row deletion.
  userId: text("user_id").notNull(),
  // Which audit execution this ledger row charged. Not a FK for the same
  // reason as userId. Nullable: rows from before refunds shipped have no
  // audit linkage. Used to refund (DELETE) the charge when ingestion fails
  // before any model tokens were spent.
  auditId: uuid("audit_id"),
  triggeredAt: timestamp("triggered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAuditSchema = createInsertSchema(auditsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  userId: true,
});
export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type Audit = typeof auditsTable.$inferSelect;
