import type { Report } from "@workspace/api-client-react";
import { displayNameFor } from "@/data/model-catalog";

const PROMPT_PACK_TOOLS = [
  { key: "replit", label: "Replit" },
  { key: "cursor", label: "Cursor" },
  { key: "copilot", label: "Copilot" },
  { key: "claudeCode", label: "Claude Code" },
  { key: "codex", label: "Codex" },
] as const;

export type AuditContext = {
  requestedChange: string;
  githubUrl: string | null;
  liveUrl: string | null;
  detectedFramework: string | null;
  detectedPackageManager: string | null;
  detectedDbLayer: string | null;
  detectedAuthLayer: string | null;
  createdAt: string;
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

const VERDICT_WORDS: Record<string, string> = {
  safe: "SAFE",
  caution: "CAUTION",
  block: "BLOCKER",
};

function severityEmoji(s: string): string {
  switch (s) {
    case "critical":
      return "🔴";
    case "high":
      return "🟠";
    case "medium":
      return "🟡";
    default:
      return "🔵";
  }
}

function smokeStatusLabel(s: string): string {
  switch (s) {
    case "pass":
      return "✅ Pass";
    case "warn":
      return "⚠️ Warn";
    case "fail":
      return "❌ Fail";
    default:
      return "⏭️ Skipped";
  }
}

// The helpers below are exported so agent-file-export.ts can build AGENTS.md
// and per-tool instruction files with the exact same escaping/fencing rules.
export function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
}

export function escapeMarkdownText(value: string): string {
  return normalizeText(value).replace(/[&<>]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      default:
        return "&gt;";
    }
  });
}

export function escapeMarkdownInline(value: string): string {
  return escapeMarkdownText(value).replace(/\s+/g, " ");
}

// Markdown table cells additionally need `|` neutralized or the row splits.
function escapeTableCell(value: string): string {
  return escapeMarkdownInline(value).replace(/\|/g, "\\|");
}

export function fencedCodeBlock(info: string, value: string): string[] {
  const text = normalizeText(value);
  const longestFence = Math.max(
    2,
    ...Array.from(text.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = "`".repeat(longestFence + 1);
  return [`${fence}${info}`, text, fence];
}

export function reportToMarkdown(report: Report, audit: AuditContext): string {
  const lines: string[] = [];
  const date = new Date(audit.createdAt).toISOString().slice(0, 10);

  lines.push(`# NeverGuess Report — ${date}`);
  lines.push("");

  // Verdict block — mirrors the report view's TL;DR card. Guarded so exports
  // of legacy reports without a stored verdict/score still render cleanly.
  const verdict = (report as { verdict?: string }).verdict;
  const riskScore = (report as { riskScore?: number }).riskScore;
  if (verdict) {
    const word = VERDICT_WORDS[verdict] ?? verdict.toUpperCase();
    const scoreSuffix =
      typeof riskScore === "number" ? ` — ${riskScore}/100` : "";
    lines.push(`**Verdict: ${word}${scoreSuffix}**`);
    lines.push("");
  }
  const severityRank = (s: string): number => {
    const idx = SEVERITY_ORDER.indexOf(s as (typeof SEVERITY_ORDER)[number]);
    return idx === -1 ? SEVERITY_ORDER.length : idx;
  };
  const topRisk = [...report.riskyAssumptions].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  )[0];
  if (topRisk) {
    lines.push(
      `> **Top risk:** ${severityEmoji(topRisk.severity)} ${escapeMarkdownInline(topRisk.title)} _(${topRisk.severity})_`,
    );
    lines.push("");
  }
  const tally = SEVERITY_ORDER.map((sev) => ({
    sev,
    count: report.riskyAssumptions.filter((r) => r.severity === sev).length,
  })).filter((t) => t.count > 0);
  lines.push(
    `**Severity tally:** ${
      tally.length > 0
        ? tally.map((t) => `${t.count} ${t.sev}`).join(" · ")
        : "no risky assumptions flagged"
    }`,
  );
  lines.push("");
  lines.push(
    `> **Requested change:** ${escapeMarkdownInline(audit.requestedChange)}`,
  );
  lines.push("");

  lines.push("## Project Context");
  lines.push("");
  if (audit.githubUrl) {
    lines.push(`- **Repository:** ${escapeMarkdownInline(audit.githubUrl)}`);
  }
  if (audit.liveUrl) {
    lines.push(`- **Live URL:** ${escapeMarkdownInline(audit.liveUrl)}`);
  }
  lines.push(
    `- **Framework:** ${escapeMarkdownInline(audit.detectedFramework ?? "unknown")}`,
  );
  lines.push(
    `- **Package manager:** ${escapeMarkdownInline(audit.detectedPackageManager ?? "unknown")}`,
  );
  lines.push(
    `- **Database layer:** ${escapeMarkdownInline(audit.detectedDbLayer ?? "unknown")}`,
  );
  lines.push(
    `- **Auth layer:** ${escapeMarkdownInline(audit.detectedAuthLayer ?? "unknown")}`,
  );
  lines.push("");

  lines.push("## Architecture Summary");
  lines.push("");
  lines.push(escapeMarkdownText(report.architectureSummary));
  lines.push("");

  lines.push("## Architecture Graph");
  lines.push("");
  lines.push(...fencedCodeBlock("mermaid", report.mermaidGraph));
  lines.push("");

  // Blast radius — only for reports that carry model-proposed affected areas.
  // Shape-checked because legacy reports (and static preview payloads) omit
  // or null the field.
  const affectedAreas = Array.isArray(report.affectedAreas)
    ? report.affectedAreas.filter(
        (a) =>
          a != null &&
          typeof a.path === "string" &&
          typeof a.reason === "string",
      )
    : [];
  if (affectedAreas.length > 0) {
    lines.push("## Blast radius");
    lines.push("");
    lines.push(
      "Files this change is expected to touch, as proposed by the analysis model.",
    );
    lines.push("");
    lines.push("| Action | Path | Reason |");
    lines.push("| --- | --- | --- |");
    for (const a of affectedAreas) {
      const action =
        typeof a.action === "string" && a.action.length > 0 ? a.action : "read";
      lines.push(
        `| ${escapeTableCell(action)} | \`${escapeTableCell(a.path)}\` | ${escapeTableCell(a.reason)} |`,
      );
    }
    lines.push("");
  }

  if (report.smokeTestResults) {
    const smoke = report.smokeTestResults;
    lines.push("## Live App Health");
    lines.push("");
    lines.push(`- **URL:** ${escapeMarkdownInline(smoke.url)}`);
    lines.push(`- **Run at:** ${escapeMarkdownInline(smoke.ranAt)}`);
    if (smoke.skipped && smoke.skipReason) {
      lines.push(`- **Skipped:** ${escapeMarkdownInline(smoke.skipReason)}`);
    }
    lines.push("");
    for (const c of smoke.checks) {
      lines.push(
        `- ${smokeStatusLabel(c.status)} **${escapeMarkdownInline(c.label)}**${c.metric ? ` — \`${escapeMarkdownInline(c.metric)}\`` : ""}`,
      );
      lines.push(`    - ${escapeMarkdownText(c.detail)}`);
    }
    lines.push("");
  }

  lines.push("## Risky Assumptions");
  lines.push("");
  for (const r of report.riskyAssumptions) {
    lines.push(
      `### ${severityEmoji(r.severity)} ${escapeMarkdownInline(r.title)} _(${r.severity})_`,
    );
    lines.push("");
    lines.push(escapeMarkdownText(r.detail));
    lines.push("");
    // Evidence citations — absent on reports generated before citations
    // shipped, so the whole block is skipped for legacy exports.
    const evidence = Array.isArray(r.evidence)
      ? r.evidence.filter((e) => e != null && typeof e.path === "string")
      : [];
    if (evidence.length > 0) {
      lines.push("**Evidence:**");
      lines.push("");
      for (const e of evidence) {
        const verifiedMark = e.verified === true ? " ✓ verified" : "";
        const quote =
          typeof e.quote === "string" && e.quote.trim() !== ""
            ? ` — "${escapeMarkdownInline(e.quote)}"`
            : "";
        lines.push(`- \`${escapeMarkdownInline(e.path)}\`${verifiedMark}${quote}`);
      }
      lines.push("");
    }
  }

  lines.push("## Acceptance Criteria");
  lines.push("");
  for (const c of report.acceptanceCriteria) {
    lines.push(`### ${escapeMarkdownInline(c.title)}`);
    lines.push("");
    lines.push(escapeMarkdownText(c.detail));
    lines.push("");
  }

  lines.push("## Safer Prompt Pack");
  lines.push("");
  for (const { key, label } of PROMPT_PACK_TOOLS) {
    const promptText =
      (report.promptPack as unknown as Record<string, string | undefined>)[key] ??
      report.promptPack.replit;
    lines.push(`### ${label}`);
    lines.push("");
    lines.push(...fencedCodeBlock("", promptText));
    lines.push("");
  }

  lines.push("## Rollout & Rollback Notes");
  lines.push("");
  lines.push(escapeMarkdownText(report.rolloutNotes));
  lines.push("");

  lines.push("---");
  lines.push("");
  // Provenance footer — only when the report carries an analysis receipt
  // (legacy reports without analysisUsage skip it entirely).
  const usage = report.analysisUsage ?? null;
  if (usage) {
    const gateway =
      usage.gateway === "replit-ai-integrations"
        ? "hosted gateway"
        : "OpenRouter direct";
    const generated = new Date(usage.generatedAt);
    const generatedStamp = Number.isNaN(generated.getTime())
      ? usage.generatedAt
      : generated.toISOString().slice(0, 10);
    const origin =
      typeof window !== "undefined" ? window.location.origin : null;
    const shareUrl =
      report.shareSlug && origin ? `${origin}/r/${report.shareSlug}` : null;
    const parts = [
      `Generated by ${displayNameFor(usage.model) ?? usage.model} via ${gateway}`,
      usage.totalTokens != null ? `${usage.totalTokens} tokens` : null,
      generatedStamp,
      shareUrl,
    ].filter((p): p is string => p != null);
    lines.push(`_${parts.join(" · ")}_`);
    lines.push("");
  }
  lines.push("_Generated by [NeverGuess](https://neverguess.app) — analyze AI-built apps before you change them._");
  lines.push("");
  return lines.join("\n");
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
