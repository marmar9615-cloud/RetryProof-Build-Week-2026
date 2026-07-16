import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LiveAppHealth } from "@/components/live-app-health";
import {
  AlertTriangle,
  Bot,
  Check,
  CheckSquare,
  Clipboard,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  Crosshair,
  FileCode2,
  GitFork,
  ReceiptText,
  Rocket,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TestTube2,
} from "lucide-react";
import type { Report } from "@workspace/api-client-react";
import { OpenInReplitButton } from "@/components/open-in-replit-button";
import { Reveal } from "@/components/motion";
import { displayNameFor } from "@/data/model-catalog";

const PROMPT_PACK_TOOLS = [
  { key: "replit", label: "Replit" },
  { key: "cursor", label: "Cursor" },
  { key: "copilot", label: "Copilot" },
  { key: "claudeCode", label: "Claude Code" },
  { key: "codex", label: "Codex" },
] as const;

// Mermaid is ~2.7 MB minified — keep it out of the page's first paint by
// dynamically loading on the first `<MermaidGraph>` mount. The promise is
// memoized at module scope so subsequent graphs hit cached module + cached
// initialize state. Without this, every report-view consumer (including the
// public report page) eagerly bundled Mermaid into the main chunk.
type MermaidModule = typeof import("mermaid").default;
let mermaidPromise: Promise<MermaidModule> | null = null;
function loadMermaid(): Promise<MermaidModule> {
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = import("mermaid").then((mod) => {
    const m = mod.default;
    m.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "strict",
      // sanitizeSvg strips <foreignObject>, which is where Mermaid puts node
      // labels when htmlLabels is on — without this every box renders empty.
      flowchart: { htmlLabels: false },
      themeVariables: {
        // Rendered inside an .ink instrument panel, so the diagram stays a dark
        // precision readout tuned to the electric-iris brand.
        background: "#0b0a12",
        primaryColor: "#12101c",
        primaryTextColor: "#f4f1ff",
        primaryBorderColor: "#7c5cff",
        lineColor: "#a78bff",
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
      },
    });
    return m;
  });
  return mermaidPromise;
}

function sanitizeSvg(svg: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror")) return "";

  const blockedElements = new Set([
    "script",
    "foreignObject",
    "iframe",
    "object",
    "embed",
  ]);
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    if (blockedElements.has(el.tagName)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (
        name.startsWith("on") ||
        value.startsWith("javascript:") ||
        value.startsWith("data:text/html")
      ) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return doc.documentElement.outerHTML;
}

const verdictStyles: Record<
  string,
  {
    label: string;
    classes: string;
    cardClasses: string;
    accentBar: string;
    Icon: typeof ShieldCheck;
  }
> = {
  safe: {
    label: "Safe to ship",
    classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cardClasses: "border-emerald-300",
    accentBar: "bg-emerald-500",
    Icon: ShieldCheck,
  },
  caution: {
    label: "Proceed with caution",
    classes: "border-amber-200 bg-amber-50 text-amber-700",
    cardClasses: "border-amber-300",
    accentBar: "bg-amber-500",
    Icon: AlertTriangle,
  },
  block: {
    label: "Blocker — do not ship",
    classes: "border-red-200 bg-red-50 text-red-700",
    cardClasses: "border-red-300",
    accentBar: "bg-red-500",
    Icon: ShieldAlert,
  },
};

const severityStyles: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-blue-50 text-blue-700 border-blue-200",
};

// Severity dot colors for the risk list — a small solid pip reads as an
// instrument indicator on the light document.
const severityDot: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

// Blast-radius action tones — status colors stay at -600/-50/-200 on paper;
// `read` is informational, so it takes the muted secondary treatment instead.
const AFFECTED_AREA_TONES: Record<string, string> = {
  modify: "border-amber-200 bg-amber-50 text-amber-600",
  create: "border-emerald-200 bg-emerald-50 text-emerald-600",
  read: "border-card-border bg-secondary text-muted-foreground",
};

// Middle-truncate long repo paths so the head (top-level dir) and tail
// (filename) both survive; the full path stays available via title=.
function truncatePathMiddle(path: string, max = 44): string {
  if (path.length <= max) return path;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${path.slice(0, head)}…${path.slice(path.length - tail)}`;
}

// Risk gauge zones mirror the server's verdict bands in
// artifacts/api-server/src/lib/risk-score.ts (computeRiskScore):
// safe <25, caution 25–59, block ≥60, and any critical assumption floors the
// score at 70. Keep these boundaries in sync with that file.
const RISK_ZONES = [
  { label: "safe", from: 0, to: 25, classes: "bg-emerald-500" },
  { label: "caution", from: 25, to: 60, classes: "bg-amber-500" },
  { label: "block", from: 60, to: 100, classes: "bg-red-500" },
] as const;

function MermaidGraph({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const id = `mmd-${Math.random().toString(36).slice(2)}`;

    const normalizeMermaidLabels = (source: string) =>
      source.replace(/\[([^\]\n]+)\]/g, (_match, label: string) => {
        const trimmed = String(label).trim();
        if (
          trimmed.startsWith('"') ||
          trimmed.startsWith("'") ||
          trimmed.startsWith("`") ||
          trimmed.includes("|")
        ) {
          return `[${label}]`;
        }
        const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return `["${escaped}"]`;
      });

    loadMermaid()
      .then((mermaid) => {
        const renderMermaid = async () => {
          try {
            return await mermaid.render(id, code);
          } catch (initialError) {
            const normalized = normalizeMermaidLabels(code);
            if (normalized === code) throw initialError;
            return mermaid.render(`${id}-normalized`, normalized);
          }
        };

        return mermaid
          .parse(code)
          .then(() => mermaid.render(id, code))
          .catch(() => renderMermaid());
      })
      .then((res) => {
        if (!cancelled) {
          const sanitized = sanitizeSvg(res.svg);
          if (sanitized) {
            setSvg(sanitized);
            setError(null);
          } else {
            // sanitizeSvg returns "" when the parser rejects the document —
            // surface the quiet fallback instead of an empty ink panel.
            setError("diagram markup failed sanitization");
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to render diagram",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        data-testid="text-mermaid-error"
      >
        Could not render architecture diagram: {error}
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className="ink rounded-xl border border-card-border bg-card p-4 overflow-x-auto shadow-sm"
      data-testid="img-mermaid-graph"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function AnimatedNumber({
  value,
  durationMs = 900,
}: {
  value: number;
  durationMs?: number;
}) {
  const initial = Math.max(0, Math.round(value));
  const [display, setDisplay] = useState(initial);
  const previous = useRef(initial);
  useEffect(() => {
    const to = Math.max(0, Math.round(value));
    const from = previous.current;
    previous.current = to;
    if (from === to) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);
  return <>{display}</>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copied",
        description: `${label} prompt copied to clipboard.`,
      });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser blocked clipboard access.",
        variant: "destructive",
      });
    }
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onCopy}
      data-testid={`button-copy-${label.toLowerCase()}`}
    >
      {copied ? (
        <>
          <ClipboardCheck className="w-4 h-4 mr-1.5" />
          Copied
        </>
      ) : (
        <>
          <Clipboard className="w-4 h-4 mr-1.5" />
          Copy
        </>
      )}
    </Button>
  );
}

export function ReportView({
  report,
  actions,
  audit,
}: {
  report: Report;
  actions?: React.ReactNode;
  audit?: {
    githubUrl?: string | null;
    liveUrl?: string | null;
    requestedChange?: string | null;
  };
}) {
  const verdict =
    (report as Report & { verdict?: string; riskScore?: number }).verdict ??
    "safe";
  const riskScore =
    (report as Report & { verdict?: string; riskScore?: number }).riskScore ??
    0;
  const source =
    report.source === "openrouter"
      ? "OpenRouter"
      : report.source === "demo"
        ? "Demo fixture"
        : report.source;
  const v = verdictStyles[verdict] ?? verdictStyles.safe;
  const VIcon = v.Icon;
  const testPlan = (
    report as Report & {
      testPlan?: { vitest: string; playwright: string } | null;
    }
  ).testPlan;
  const analysisUsage =
    (
      report as Report & {
        analysisUsage?: {
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
        } | null;
      }
    ).analysisUsage ?? null;
  const servedModelName = analysisUsage
    ? (displayNameFor(analysisUsage.model) ?? analysisUsage.model)
    : null;

  // Gauge marker position — clamp so a malformed score can't escape the track.
  const gaugePercent = Math.min(100, Math.max(0, riskScore));
  const severityTally = SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    count: report.riskyAssumptions.filter((r) => r.severity === sev).length,
  })).filter((t) => t.count > 0);

  // Blast radius — shape-checked because legacy reports omit or null the
  // field, and static preview can hand hooks non-JSON payloads.
  const affectedAreas = Array.isArray(report.affectedAreas)
    ? report.affectedAreas.filter(
        (a) =>
          a != null &&
          typeof a.path === "string" &&
          typeof a.reason === "string",
      )
    : [];

  // Controlled so the context strip's Tests shortcut can jump straight to the
  // Test Plan tab inside the prompt pack card.
  const [packTab, setPackTab] = useState("replit");
  function jumpToSection(id: string, tab?: string) {
    if (tab) setPackTab(tab);
    requestAnimationFrame(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Print should always show the AI receipt — force the <details> open for
  // the print pass, then restore the reader's toggle state afterwards.
  const receiptRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    let wasOpen = false;
    const handleBeforePrint = () => {
      const el = receiptRef.current;
      if (el) {
        wasOpen = el.open;
        el.open = true;
      }
    };
    const handleAfterPrint = () => {
      const el = receiptRef.current;
      if (el && !wasOpen) el.open = false;
    };
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const shareUrl =
    report.shareSlug && typeof window !== "undefined"
      ? `${window.location.origin}/r/${report.shareSlug}`
      : null;

  return (
    <div className="space-y-6" data-testid="section-report">
      <Card
        className="border-card-border bg-card print:hidden"
        data-testid="section-report-context"
      >
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
                <ClipboardList className="h-4 w-4" />
              </span>
              <span className="font-medium text-foreground">
                What we found, before your agent edits the code.
              </span>
            </div>
            <div
              className={`grid ${affectedAreas.length > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} gap-2 text-center text-[11px] font-mono uppercase tracking-wider text-muted-foreground`}
            >
              <button
                type="button"
                onClick={() => jumpToSection("report-risks")}
                className="rounded-lg border border-card-border bg-secondary px-3 py-2 tabular-nums transition-colors hover:border-primary/40 hover:text-foreground"
                data-testid="button-context-risks"
              >
                Risks · {report.riskyAssumptions.length}
              </button>
              {affectedAreas.length > 0 && (
                <button
                  type="button"
                  onClick={() => jumpToSection("report-blast-radius")}
                  className="rounded-lg border border-card-border bg-secondary px-3 py-2 tabular-nums transition-colors hover:border-primary/40 hover:text-foreground"
                  data-testid="button-context-blast-radius"
                >
                  Files · {affectedAreas.length}
                </button>
              )}
              <button
                type="button"
                disabled={!testPlan}
                onClick={() => jumpToSection("report-prompts", "test-plan")}
                className="rounded-lg border border-card-border bg-secondary px-3 py-2 tabular-nums transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-card-border disabled:hover:text-muted-foreground"
                data-testid="button-context-tests"
              >
                Tests · {testPlan ? 2 : 0}
              </button>
              <button
                type="button"
                onClick={() => jumpToSection("report-prompts")}
                className="rounded-lg border border-card-border bg-secondary px-3 py-2 tabular-nums transition-colors hover:border-primary/40 hover:text-foreground"
                data-testid="button-context-prompts"
              >
                Prompts · {PROMPT_PACK_TOOLS.length}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        className={`relative overflow-hidden border-2 ${v.cardClasses}`}
        data-testid="section-tldr-verdict"
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1 ${v.accentBar}`}
        />
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex flex-col gap-2">
              <span className="eyebrow">TL;DR · Verdict</span>
              <span
                className={`inline-flex items-center gap-2 self-start text-base md:text-lg font-semibold tracking-tight px-3 py-1.5 rounded-lg border ${v.classes}`}
                data-testid="badge-verdict"
              >
                <VIcon className="w-4 h-4" />
                {v.label}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {report.source === "demo" && (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-700"
                >
                  Demo report
                </Badge>
              )}
              {report.source === "openrouter" && (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  data-testid="badge-analysis-source-openrouter"
                >
                  <Bot className="w-3 h-3 mr-1" />
                  OpenRouter
                </Badge>
              )}
              {actions}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-5">
          {/* Hero risk score row */}
          <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-5 items-center">
            <div className="flex items-baseline gap-2">
              <span
                className="font-bold text-5xl md:text-6xl tabular-nums tracking-tight text-foreground leading-none"
                data-testid="text-risk-score"
              >
                <AnimatedNumber value={riskScore} />
              </span>
              <span className="text-lg text-muted-foreground font-normal tabular-nums">
                /100
              </span>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              Risk score weighted from {report.riskyAssumptions.length}{" "}
              assumption
              {report.riskyAssumptions.length === 1 ? "" : "s"}.
              {(() => {
                const order = {
                  critical: 0,
                  high: 1,
                  medium: 2,
                  low: 3,
                } as const;
                const top = [...report.riskyAssumptions].sort(
                  (a, b) =>
                    (order[a.severity as keyof typeof order] ?? 9) -
                    (order[b.severity as keyof typeof order] ?? 9),
                )[0];
                return top ? (
                  <span className="block mt-1.5" data-testid="text-top-risk">
                    <span className="font-medium text-foreground">
                      Top risk:
                    </span>{" "}
                    {top.title}
                  </span>
                ) : null;
              })()}
            </div>
          </div>

          {/* Risk gauge — zones mirror computeRiskScore's verdict bands in
              artifacts/api-server/src/lib/risk-score.ts. Client-computed so it
              renders for legacy reports, the public page, and static preview. */}
          <div className="space-y-2" data-testid="section-risk-gauge">
            <div className="relative">
              <div className="flex h-1.5 overflow-hidden rounded-full">
                {RISK_ZONES.map((zone) => (
                  <div
                    key={zone.label}
                    className={zone.classes}
                    style={{ width: `${zone.to - zone.from}%` }}
                  />
                ))}
              </div>
              <span
                aria-hidden="true"
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-sm"
                style={{ left: `${gaugePercent}%` }}
                data-testid="marker-risk-score"
              />
            </div>
            <div className="relative h-4">
              <span className="eyebrow absolute left-0">0</span>
              <span className="eyebrow absolute left-1/4 -translate-x-1/2">
                25
              </span>
              <span className="eyebrow absolute left-[60%] -translate-x-1/2">
                60
              </span>
              <span className="eyebrow absolute right-0">100</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {severityTally.length > 0 ? (
                severityTally.map(({ severity, count }) => (
                  <span
                    key={severity}
                    className="inline-flex items-center gap-1.5 font-mono tabular-nums"
                    data-testid={`tally-severity-${severity}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${severityDot[severity] ?? severityDot.low}`}
                    />
                    {count} {severity}
                  </span>
                ))
              ) : (
                <span className="font-mono" data-testid="tally-severity-none">
                  No risky assumptions flagged
                </span>
              )}
            </div>
            <p
              className="text-[11px] text-muted-foreground"
              data-testid="text-risk-rule"
            >
              Any critical assumption floors the score at 70 · 60+ = blocker ·
              25–59 = caution · under 25 = safe.
            </p>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
            data-testid="section-report-summary"
          >
            <div className="rounded-lg border border-card-border bg-secondary p-3">
              <div className="eyebrow">Result</div>
              <div className="mt-1.5 font-mono text-foreground">
                {v.label} · {riskScore}/100
              </div>
            </div>
            <div className="rounded-lg border border-card-border bg-secondary p-3">
              <div className="eyebrow">Analyzed by</div>
              <div
                className="mt-1.5 font-mono text-foreground truncate"
                title={analysisUsage?.model}
                data-testid="text-analysis-model"
              >
                {servedModelName ?? source}
              </div>
            </div>
            <div className="rounded-lg border border-card-border bg-secondary p-3">
              <div className="eyebrow">Repository</div>
              <div
                className="mt-1.5 font-mono text-foreground truncate"
                title={audit?.githubUrl ?? "Not provided"}
              >
                {audit?.githubUrl
                  ? audit.githubUrl.replace(/^https?:\/\/github\.com\//, "")
                  : "Not provided"}
              </div>
            </div>
          </div>
          {analysisUsage &&
            analysisUsage.requestedModel !== analysisUsage.model && (
              <div
                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
                data-testid="text-model-fallback"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">
                  requested {displayNameFor(analysisUsage.requestedModel)} ·
                  served {displayNameFor(analysisUsage.model)}
                </span>
              </div>
            )}
          {analysisUsage && (
            <details
              ref={receiptRef}
              className="ink group rounded-xl border border-card-border bg-card overflow-hidden shadow-sm"
              data-testid="section-ai-receipt"
            >
              <summary className="cursor-pointer list-none px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-secondary transition-colors">
                <span className="flex items-center gap-2 eyebrow text-emerald-400">
                  <ReceiptText className="w-3.5 h-3.5" />
                  AI receipt
                </span>
                <span className="text-muted-foreground text-xs group-open:rotate-180 transition-transform">
                  ▾
                </span>
              </summary>
              <div className="border-t border-border px-4 pb-4 pt-1">
                <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="eyebrow">Model</div>
                    <div
                      className="mt-1.5 font-mono text-foreground truncate"
                      title={analysisUsage.model}
                      data-testid="text-receipt-model"
                    >
                      {displayNameFor(analysisUsage.model) ??
                        analysisUsage.model}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow">Gateway</div>
                    <div className="mt-1.5 font-mono text-foreground">
                      {analysisUsage.gateway === "replit-ai-integrations"
                        ? "Hosted gateway"
                        : "OpenRouter direct"}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow">Tokens</div>
                    <div className="mt-1.5 font-mono text-foreground tabular-nums">
                      {analysisUsage.totalTokens ?? "Unavailable"} total
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow">Reasoning</div>
                    <div className="mt-1.5 font-mono text-foreground tabular-nums">
                      {analysisUsage.reasoningTokens ?? "Not returned"}{" "}
                      {analysisUsage.reasoningTokens == null ? "" : "tokens"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Cpu className="w-3 h-3" />
                  <span className="font-mono">
                    effort={analysisUsage.reasoningEffort}
                    {analysisUsage.requestId
                      ? ` · request=${analysisUsage.requestId.slice(0, 12)}`
                      : ""}
                  </span>
                </div>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Card className="border-card-border bg-accent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-card text-primary">
              <ScrollText className="w-4 h-4" />
            </span>
            Architecture Summary
          </CardTitle>
          <CardDescription className="mt-1">
            What we think your app is and how this change touches it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p
            className="text-sm leading-relaxed text-foreground"
            data-testid="text-architecture-summary"
          >
            {report.architectureSummary}
          </p>
        </CardContent>
      </Card>

      <LiveAppHealth report={report} />

      <Card className="border-card-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
              <GitFork className="w-4 h-4" />
            </span>
            Architecture Graph
          </CardTitle>
          <CardDescription>Auto-generated dependency diagram.</CardDescription>
        </CardHeader>
        <CardContent>
          <MermaidGraph code={report.mermaidGraph} />
        </CardContent>
      </Card>

      {affectedAreas.length > 0 && (
        <Card
          id="report-blast-radius"
          className="border-card-border bg-card"
          data-testid="section-blast-radius"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
                <Crosshair className="w-4 h-4" />
              </span>
              Blast Radius
            </CardTitle>
            <CardDescription>
              Files this change is expected to touch, as proposed by the
              analysis model.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {affectedAreas.map((area, idx) => {
              const action =
                typeof area.action === "string" && area.action.length > 0
                  ? area.action
                  : "read";
              return (
                <div
                  key={idx}
                  className="flex flex-col gap-2 rounded-xl border border-card-border bg-secondary p-3 sm:flex-row sm:items-baseline sm:gap-3"
                  data-testid={`item-affected-area-${idx}`}
                >
                  <Badge
                    variant="outline"
                    className={`${AFFECTED_AREA_TONES[action] ?? AFFECTED_AREA_TONES.read} shrink-0 self-start font-mono text-[10px] uppercase tracking-wider`}
                  >
                    {action}
                  </Badge>
                  <div className="min-w-0">
                    <div
                      className="font-mono text-xs text-foreground break-all"
                      title={area.path}
                    >
                      {area.path}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {area.reason}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card id="report-risks" className="border-card-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
              <AlertTriangle className="w-4 h-4" />
            </span>
            Risky Assumptions
          </CardTitle>
          <CardDescription>
            Things that could break if you don&apos;t check them first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.riskyAssumptions.map((risk, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-card-border bg-secondary p-4"
              data-testid={`item-risk-${idx}`}
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <h4 className="flex items-center gap-2 font-semibold text-sm text-foreground">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${severityDot[risk.severity] ?? severityDot.low}`}
                  />
                  {risk.title}
                </h4>
                <Badge
                  variant="outline"
                  className={`${severityStyles[risk.severity] ?? severityStyles.low} font-mono text-[10px] uppercase tracking-wider`}
                >
                  {risk.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {risk.detail}
              </p>
              {(() => {
                // Evidence citations — absent on reports generated before
                // citations shipped, so the whole block is skipped then.
                const evidence = Array.isArray(risk.evidence)
                  ? risk.evidence.filter(
                      (ev) => ev != null && typeof ev.path === "string",
                    )
                  : [];
                if (evidence.length === 0) return null;
                return (
                  <div
                    className="mt-3 space-y-1.5"
                    data-testid={`section-risk-evidence-${idx}`}
                  >
                    {evidence.map((ev, evIdx) => (
                      <div key={evIdx} className="min-w-0">
                        <span
                          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-card-border bg-card px-2 py-0.5 font-mono text-[11px] text-foreground"
                          title={ev.path}
                          data-testid={`chip-risk-evidence-${idx}-${evIdx}`}
                        >
                          <FileCode2
                            className="h-3 w-3 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            {truncatePathMiddle(ev.path)}
                          </span>
                          {ev.verified === true && (
                            <span
                              className="shrink-0 text-emerald-600"
                              title="Path verified against the ingested file tree"
                              data-testid={`icon-evidence-verified-${idx}-${evIdx}`}
                            >
                              <Check className="h-3 w-3" aria-hidden="true" />
                            </span>
                          )}
                        </span>
                        {typeof ev.quote === "string" &&
                          ev.quote.trim() !== "" && (
                            <p className="mt-1 text-xs italic text-muted-foreground leading-relaxed">
                              &ldquo;{ev.quote}&rdquo;
                            </p>
                          )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-card-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
              <CheckSquare className="w-4 h-4" />
            </span>
            Acceptance Criteria
          </CardTitle>
          <CardDescription>
            What &quot;done&quot; should look like for this change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.acceptanceCriteria.map((c, idx) => (
            <div
              key={idx}
              className="flex gap-3 rounded-xl border border-card-border bg-secondary p-4"
              data-testid={`item-criterion-${idx}`}
            >
              <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <h4 className="font-semibold text-sm mb-1 text-foreground">
                  {c.title}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {c.detail}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card id="report-prompts" className="border-card-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
              <Sparkles className="w-4 h-4" />
            </span>
            Safer Prompt Pack
          </CardTitle>
          <CardDescription>
            Drop-in prompts tailored to your stack — pick your tool and copy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={packTab} onValueChange={setPackTab}>
            <TabsList
              className="mb-3 flex h-auto flex-wrap justify-start"
              data-testid="tabs-prompt-pack"
            >
              {PROMPT_PACK_TOOLS.map(({ key, label }) => (
                <TabsTrigger key={key} value={key} data-testid={`tab-${key}`}>
                  {label}
                </TabsTrigger>
              ))}
              {testPlan && (
                <TabsTrigger value="test-plan" data-testid="tab-test-plan">
                  Test Plan
                </TabsTrigger>
              )}
            </TabsList>
            {PROMPT_PACK_TOOLS.map(({ key, label }) => {
              const promptText =
                (
                  report.promptPack as unknown as Record<
                    string,
                    string | undefined
                  >
                )[key] ?? report.promptPack.replit;
              return (
                <TabsContent key={key} value={key} className="space-y-2">
                  <div className="flex justify-end">
                    <CopyButton text={promptText} label={label} />
                  </div>
                  <pre
                    className="ink bg-card text-foreground border border-card-border rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono shadow-sm"
                    data-testid={`text-prompt-${key}`}
                  >
                    {promptText}
                  </pre>
                </TabsContent>
              );
            })}
            {testPlan && (
              <TabsContent
                value="test-plan"
                className="space-y-3"
                data-testid="section-test-plan"
              >
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <TestTube2 className="w-3.5 h-3.5 text-primary" />
                  Copy-pasteable Vitest and Playwright specs you can drop into
                  the repo.
                </p>
                <Tabs defaultValue="vitest">
                  <TabsList className="mb-3" data-testid="tabs-test-plan">
                    <TabsTrigger value="vitest" data-testid="tab-test-vitest">
                      Vitest
                    </TabsTrigger>
                    <TabsTrigger
                      value="playwright"
                      data-testid="tab-test-playwright"
                    >
                      Playwright
                    </TabsTrigger>
                  </TabsList>
                  {(["vitest", "playwright"] as const).map((kind) => (
                    <TabsContent key={kind} value={kind} className="space-y-2">
                      <div className="flex justify-end">
                        <CopyButton text={testPlan[kind]} label={kind} />
                      </div>
                      <pre
                        className="ink bg-card text-foreground border border-card-border rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono shadow-sm"
                        data-testid={`text-test-${kind}`}
                      >
                        {testPlan[kind]}
                      </pre>
                    </TabsContent>
                  ))}
                </Tabs>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <Card className="border-card-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
              <Rocket className="w-4 h-4" />
            </span>
            Rollout &amp; Rollback Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="text-sm leading-relaxed whitespace-pre-line text-foreground"
            data-testid="text-rollout-notes"
          >
            {report.rolloutNotes}
          </p>
        </CardContent>
      </Card>

      <div
        className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 print:hidden"
        data-testid="section-secondary-cta"
      >
        <div className="text-sm">
          <div className="font-medium">Ready to ship this change?</div>
          <div className="text-muted-foreground text-xs">
            Hand the prompt pack to Replit Agent and let it open a PR for you.
          </div>
        </div>
        <OpenInReplitButton
          promptText={report.promptPack?.replit ?? ""}
          githubUrl={audit?.githubUrl ?? null}
          testId="button-open-in-replit-cta"
          variant="default"
          size="default"
        >
          Send to Replit Agent
        </OpenInReplitButton>
      </div>

      {/* Print-only provenance line — hidden on screen, appended to PDFs. */}
      <div
        className="hidden print:block border-t border-border pt-3 font-mono text-[10px] text-muted-foreground"
        data-testid="text-print-footer"
      >
        {[
          "NeverGuess preflight",
          (analysisUsage?.generatedAt ?? report.createdAt).slice(0, 10),
          servedModelName,
          shareUrl,
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
    </div>
  );
}
