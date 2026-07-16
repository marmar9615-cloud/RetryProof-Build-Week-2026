import { describe, it, expect } from "vitest";
import { reportToMarkdown, type AuditContext } from "../markdown-export";

const audit: AuditContext = {
  requestedChange: "Add per-user rate limiting",
  githubUrl: "https://github.com/demo/sample",
  liveUrl: "https://example.com",
  detectedFramework: "Vite + React",
  detectedPackageManager: "pnpm",
  detectedDbLayer: "Drizzle",
  detectedAuthLayer: "Replit Auth",
  createdAt: "2026-01-15T10:00:00.000Z",
};

const report = {
  id: "r1",
  auditId: "a1",
  source: "demo",
  architectureSummary: "An Express API with a React frontend.",
  mermaidGraph: "graph LR\n  A --> B",
  riskyAssumptions: [
    {
      title: "Schema is reversible",
      severity: "high" as const,
      detail: "Backfill required.",
    },
  ],
  acceptanceCriteria: [
    { title: "No regression", detail: "Existing audits load." },
  ],
  promptPack: {
    replit: "Replit prompt body",
    cursor: "Cursor prompt body",
    copilot: "Copilot prompt body",
    claudeCode: "Claude Code prompt body",
    codex: "Codex prompt body",
  },
  rolloutNotes: "Roll out behind a flag.",
  smokeTestResults: null,
  smokeScreenshotUrl: null,
  shareSlug: null,
  createdAt: "2026-01-15T10:00:00.000Z",
};

describe("reportToMarkdown", () => {
  const md = reportToMarkdown(report, audit);

  it("includes a top-level heading with the date", () => {
    expect(md).toMatch(/^# NeverGuess Report — 2026-01-15/);
  });

  it("quotes the requested change", () => {
    expect(md).toContain("> **Requested change:** Add per-user rate limiting");
  });

  it("renders the mermaid graph in a fenced ```mermaid block", () => {
    expect(md).toContain("```mermaid\ngraph LR\n  A --> B\n```");
  });

  it("includes every risky assumption with severity", () => {
    expect(md).toContain("Schema is reversible");
    expect(md).toContain("_(high)_");
  });

  it("includes every prompt-pack tool", () => {
    expect(md).toContain("### Replit");
    expect(md).toContain("Replit prompt body");
    expect(md).toContain("### Cursor");
    expect(md).toContain("Cursor prompt body");
    expect(md).toContain("### Copilot");
    expect(md).toContain("Copilot prompt body");
    expect(md).toContain("### Claude Code");
    expect(md).toContain("Claude Code prompt body");
    expect(md).toContain("### Codex");
    expect(md).toContain("Codex prompt body");
  });

  it("includes a rollout & rollback section", () => {
    expect(md).toContain("## Rollout & Rollback Notes");
    expect(md).toContain("Roll out behind a flag.");
  });

  it("omits the live-app health section when smoke results are absent", () => {
    expect(md).not.toContain("## Live App Health");
  });

  it("includes a live-app health section when smoke results are present", () => {
    const withSmoke = reportToMarkdown(
      {
        ...report,
        smokeTestResults: {
          ranAt: "2026-01-15T10:00:00.000Z",
          url: "https://example.com",
          skipped: false,
          checks: [
            {
              id: "load",
              label: "Page loads",
              status: "pass",
              metric: "1200ms",
              detail: "200 OK",
            },
          ],
        },
      },
      audit,
    );
    expect(withSmoke).toContain("## Live App Health");
    expect(withSmoke).toContain("✅ Pass");
    expect(withSmoke).toContain("Page loads");
  });

  it("escapes exported prose and prevents fence breakouts", () => {
    const md = reportToMarkdown(
      {
        ...report,
        architectureSummary: "<img src=x onerror=alert(1)>",
        mermaidGraph: "graph LR\nA[ok] --> B\n```html\n<script>alert(1)</script>",
        promptPack: {
          ...report.promptPack,
          codex: "run this\n```\n<script>alert(1)</script>",
        },
        rolloutNotes: "Ship <strong>carefully</strong>.",
      },
      {
        ...audit,
        requestedChange: "Change <img src=x onerror=alert(1)>",
      },
    );

    expect(md).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(md).toContain("````mermaid\n");
    expect(md).toContain("````\n\n## Risky Assumptions");
    expect(md).toContain("&lt;strong&gt;carefully&lt;/strong&gt;");
  });
});
