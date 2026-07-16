import type { Report } from "@workspace/api-client-react";
import {
  type AuditContext,
  downloadMarkdown,
  escapeMarkdownInline,
  escapeMarkdownText,
  fencedCodeBlock,
  normalizeText,
} from "@/lib/markdown-export";

// Agent-native exports: turn a NeverGuess report into instruction files the
// user drops straight into their repo (AGENTS.md + per-tool variants). Pure
// string builders modeled on markdown-export.ts so they stay testable and
// safe for legacy reports where any of the newer fields may be missing.

export type PromptToolKey =
  | "replit"
  | "cursor"
  | "copilot"
  | "claudeCode"
  | "codex";

export type AgentExportTool = {
  key: PromptToolKey;
  /** Human tool name, e.g. "Claude Code". */
  toolLabel: string;
  /** Where the file belongs in the target repo (shown as the menu label). */
  label: string;
  /** Flat filename for the browser download — no directories allowed. */
  downloadName: string;
};

// Destination conventions per tool. Replit and Codex have no repo-file
// convention of their own, so both get a plain prompt file.
export const AGENT_EXPORT_TOOLS: AgentExportTool[] = [
  {
    key: "claudeCode",
    toolLabel: "Claude Code",
    label: "CLAUDE.md (snippet)",
    downloadName: "CLAUDE.md",
  },
  {
    key: "cursor",
    toolLabel: "Cursor",
    label: ".cursor/rules/neverguess.mdc",
    downloadName: "neverguess.mdc",
  },
  {
    key: "copilot",
    toolLabel: "Copilot",
    label: ".github/copilot-instructions.md",
    downloadName: "copilot-instructions.md",
  },
  {
    key: "replit",
    toolLabel: "Replit",
    label: "neverguess-prompt.md",
    downloadName: "neverguess-prompt.md",
  },
  {
    key: "codex",
    toolLabel: "Codex",
    label: "neverguess-prompt.md",
    downloadName: "neverguess-prompt.md",
  },
];

// Prompt packs are stored jsonb — a legacy row may miss individual keys, so
// fall back to the Replit entry the same way report-view.tsx does.
function promptTextFor(report: Report, key: PromptToolKey): string {
  const pack = (report.promptPack ?? {}) as unknown as Record<
    string,
    string | undefined
  >;
  return pack[key] ?? pack.replit ?? "";
}

function provenanceLine(report: Report): string {
  const usage = report.analysisUsage ?? null;
  const origin = typeof window !== "undefined" ? window.location.origin : null;
  const shareUrl =
    report.shareSlug && origin ? `${origin}/r/${report.shareSlug}` : null;
  const date = (usage?.generatedAt ?? report.createdAt ?? "").slice(0, 10);
  const parts = [
    `Generated from a NeverGuess preflight${shareUrl ? ` (${shareUrl})` : ""}`,
    `model ${usage?.model ?? "unknown"}`,
    date,
  ].filter((p) => p.length > 0);
  return parts.join(" · ");
}

/**
 * AGENTS.md — the cross-agent instruction file standard. Compiles the
 * report's guardrails into the sections coding agents actually read:
 * overview, boundaries, definition of done, testing, and a task brief.
 */
export function buildAgentsMd(report: Report, audit: AuditContext): string {
  const lines: string[] = [];

  lines.push("# AGENTS.md");
  lines.push("");
  lines.push(
    `> Preflight guardrails for: ${escapeMarkdownInline(audit.requestedChange)}`,
  );
  lines.push("");

  lines.push("## Project overview");
  lines.push("");
  lines.push(escapeMarkdownText(report.architectureSummary ?? ""));
  lines.push("");

  lines.push("## Boundaries — do not touch");
  lines.push("");
  const risks = Array.isArray(report.riskyAssumptions)
    ? report.riskyAssumptions
    : [];
  if (risks.length === 0) {
    lines.push("_No risky assumptions were flagged for this change._");
  }
  for (const r of risks) {
    lines.push(
      `- **${escapeMarkdownInline(r.title)}** _(${r.severity})_ — ${escapeMarkdownInline(r.detail)}`,
    );
    // Evidence paths — absent on reports generated before citations shipped.
    const paths = Array.isArray(r.evidence)
      ? r.evidence
          .filter((e) => e != null && typeof e.path === "string")
          .map((e) => e.path)
      : [];
    if (paths.length > 0) {
      lines.push(
        `  - Evidence: ${paths.map((p) => `\`${escapeMarkdownInline(p)}\``).join(", ")}`,
      );
    }
  }
  lines.push("");

  lines.push("## Definition of done");
  lines.push("");
  const criteria = Array.isArray(report.acceptanceCriteria)
    ? report.acceptanceCriteria
    : [];
  if (criteria.length === 0) {
    lines.push("_No acceptance criteria were generated for this change._");
  }
  for (const c of criteria) {
    lines.push(
      `- [ ] **${escapeMarkdownInline(c.title)}** — ${escapeMarkdownInline(c.detail)}`,
    );
  }
  lines.push("");

  // Test plan is a newer field — omit the whole section on legacy reports.
  const testPlan = report.testPlan ?? null;
  if (testPlan && typeof testPlan === "object") {
    const specs = [
      { label: "Vitest", info: "ts", text: testPlan.vitest },
      { label: "Playwright", info: "ts", text: testPlan.playwright },
    ].filter((s) => typeof s.text === "string" && s.text.trim() !== "");
    if (specs.length > 0) {
      lines.push("## Testing");
      lines.push("");
      for (const spec of specs) {
        lines.push(`### ${spec.label}`);
        lines.push("");
        lines.push(...fencedCodeBlock(spec.info, spec.text));
        lines.push("");
      }
    }
  }

  lines.push("## Task brief");
  lines.push("");
  const brief =
    promptTextFor(report, "codex") || promptTextFor(report, "claudeCode");
  lines.push(...fencedCodeBlock("", brief));
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push(`_${provenanceLine(report)}_`);
  lines.push("");
  return lines.join("\n");
}

/**
 * Per-tool instruction file: that tool's prompt-pack text under a one-line
 * generated-by header, ready to save at the tool's conventional repo path.
 */
export function buildToolInstructionFile(
  report: Report,
  tool: AgentExportTool,
): string {
  const prompt = normalizeText(promptTextFor(report, tool.key));
  const header = `<!-- ${tool.toolLabel} instructions generated by NeverGuess from a preflight audit — ${provenanceLine(report)}. Intended location: ${tool.label.replace("(snippet)", "").trim()} -->`;
  return `${header}\n\n${prompt}\n`;
}

export function downloadAgentsMd(report: Report, audit: AuditContext): void {
  downloadMarkdown("AGENTS.md", buildAgentsMd(report, audit));
}

export function downloadToolInstructionFile(
  report: Report,
  tool: AgentExportTool,
): void {
  downloadMarkdown(tool.downloadName, buildToolInstructionFile(report, tool));
}
