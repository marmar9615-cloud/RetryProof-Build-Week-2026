import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { auditsTable } from "./audits";

export const RISK_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

export const PROMPT_TOOLS = ["replit", "cursor", "copilot", "claudeCode", "codex"] as const;
export type PromptTool = (typeof PROMPT_TOOLS)[number];

export const VERDICTS = ["safe", "caution", "block"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type TestPlan = {
  vitest: string;
  playwright: string;
};

export const SMOKE_CHECK_STATUSES = ["pass", "fail", "warn", "skip"] as const;
export type SmokeCheckStatus = (typeof SMOKE_CHECK_STATUSES)[number];

export type SmokeCheck = {
  id: string;
  label: string;
  status: SmokeCheckStatus;
  metric?: string;
  detail: string;
};

export type SmokeTestResults = {
  ranAt: string;
  url: string;
  skipped: boolean;
  skipReason?: string;
  checks: SmokeCheck[];
};

export type AnalysisUsage = {
  model: string;
  requestedModel: string;
  reasoningEffort: string;
  gateway: "replit-ai-integrations" | "openrouter-direct";
  requestId?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  reasoningTokens?: number | null;
  generatedAt: string;
};

// A concrete pointer into the ingested repo backing a risky assumption.
// `verified` is stamped server-side: the cited path was cross-checked
// against the ingested file tree (hallucinated paths are dropped).
export type RiskEvidence = {
  path: string;
  quote?: string | null;
  verified?: boolean;
};

export type RiskyAssumption = {
  title: string;
  severity: RiskSeverity;
  detail: string;
  // Optional: absent on reports generated before evidence citations shipped.
  evidence?: RiskEvidence[];
};

export const AFFECTED_AREA_ACTIONS = ["modify", "create", "read"] as const;
export type AffectedAreaAction = (typeof AFFECTED_AREA_ACTIONS)[number];

// Blast radius: a file or directory the requested change is expected to
// touch, and how. Paths are model-proposed; `create` entries may not exist
// in the tree yet.
export type AffectedArea = {
  path: string;
  reason: string;
  action: AffectedAreaAction;
};

export type AcceptanceCriterion = {
  title: string;
  detail: string;
};

export type PromptPack = Record<PromptTool, string>;

export const reportsTable = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditId: uuid("audit_id")
    .notNull()
    .unique()
    .references(() => auditsTable.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  architectureSummary: text("architecture_summary").notNull(),
  mermaidGraph: text("mermaid_graph").notNull(),
  riskyAssumptions: jsonb("risky_assumptions")
    .$type<RiskyAssumption[]>()
    .notNull(),
  acceptanceCriteria: jsonb("acceptance_criteria")
    .$type<AcceptanceCriterion[]>()
    .notNull(),
  promptPack: jsonb("prompt_pack").$type<PromptPack>().notNull(),
  rolloutNotes: text("rollout_notes").notNull(),
  smokeTestResults: jsonb("smoke_test_results").$type<SmokeTestResults | null>(),
  smokeScreenshotUrl: text("smoke_screenshot_url"),
  analysisUsage: jsonb("analysis_usage").$type<AnalysisUsage | null>(),
  riskScore: integer("risk_score").notNull().default(0),
  verdict: text("verdict", { enum: VERDICTS }).notNull().default("safe"),
  testPlan: jsonb("test_plan").$type<TestPlan | null>(),
  // Blast radius proposed by the model, path-verified server-side. Null on
  // reports generated before affected-areas shipped.
  affectedAreas: jsonb("affected_areas").$type<AffectedArea[] | null>(),
  shareSlug: text("share_slug").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Report = typeof reportsTable.$inferSelect;

// One row per superseded report, captured inside the rerun transaction just
// before the old report row is deleted. Powers the run-history strip on
// audit detail ("GPT-5.5 said caution · Fable 5 said safe") and preserves
// the share slug so /r/<slug> and README badges survive a rerun. Trimmed to
// the newest few rows per audit at insert time — this is a receipt trail,
// not an archive.
export const reportRunHistoryTable = pgTable("report_run_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditId: uuid("audit_id")
    .notNull()
    .references(() => auditsTable.id, { onDelete: "cascade" }),
  // Model that produced the superseded report (analysisUsage.model when
  // available, else the audit's model at snapshot time).
  model: text("model"),
  verdict: text("verdict", { enum: VERDICTS }),
  riskScore: integer("risk_score"),
  source: text("source"),
  analysisUsage: jsonb("analysis_usage").$type<AnalysisUsage | null>(),
  // Full report shape at snapshot time, for a future compare view.
  payload: jsonb("payload"),
  shareSlug: text("share_slug"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ReportRunHistoryRow = typeof reportRunHistoryTable.$inferSelect;
