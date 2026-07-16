import { Link } from "wouter";
import { AlertTriangle, ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";

export type SampleVerdict = "safe" | "caution" | "block";

export type SampleReport = {
  slug: string;
  title: string;
  description: string;
  verdict: SampleVerdict;
  score: number;
};

// Verdict presentation lives with the sample card so the dashboard's risk
// pills and every sample strip stay on the same emerald/amber/red scale.
export function verdictPillClasses(v: SampleVerdict) {
  return v === "block"
    ? "border-red-200 bg-red-50 text-red-600"
    : v === "caution"
      ? "border-amber-200 bg-amber-50 text-amber-600"
      : "border-emerald-200 bg-emerald-50 text-emerald-600";
}

export function verdictIcon(v: SampleVerdict) {
  return v === "block" ? ShieldAlert : v === "caution" ? AlertTriangle : ShieldCheck;
}

/** Pre-baked public reports served at /r/:slug — no sign-in needed. */
export const SAMPLE_GALLERY: SampleReport[] = [
  {
    slug: "next-isr",
    title: "Next.js — switch to ISR",
    description: "Move the blog index from getServerSideProps to ISR with revalidate=60.",
    verdict: "caution",
    score: 48,
  },
  {
    slug: "shadcn-dark",
    title: "shadcn/ui — add dark-mode toggle",
    description: "Add an accessible next-themes toggle and audit WCAG AA contrast.",
    verdict: "safe",
    score: 22,
  },
  {
    slug: "vite-lightning",
    title: "Vite — cut cold-start in half",
    description: "Lazy-load routes, swap moment.js for date-fns, tune optimizeDeps.",
    verdict: "block",
    score: 75,
  },
];

export function SampleReportCard({
  report,
  compact = false,
  testId,
  pillTestId,
}: {
  report: SampleReport;
  /** Tighter padding and type for secondary strips (reference reports, empty state). */
  compact?: boolean;
  testId: string;
  pillTestId?: string;
}) {
  const Icon = verdictIcon(report.verdict);
  return (
    <Link
      href={`/r/${report.slug}`}
      data-testid={testId}
      className={`group flex h-full flex-col rounded-2xl border border-card-border bg-card ${compact ? "p-4" : "p-5"} shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[color:var(--brand-border)]`}
    >
      <div className={`flex items-center justify-between gap-2 ${compact ? "mb-2" : "mb-3"}`}>
        <span
          className={`inline-flex items-center rounded-full border py-0.5 font-mono font-medium ${compact ? "gap-1 px-2 text-[10px]" : "gap-1.5 px-2.5 text-[11px]"} ${verdictPillClasses(report.verdict)}`}
          data-testid={pillTestId}
        >
          <Icon className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
          {report.verdict.toUpperCase()} · {report.score}
        </span>
        <ArrowRight className="w-4 h-4 text-muted-foreground transition-all group-hover:text-primary group-hover:translate-x-0.5" />
      </div>
      <div className="font-semibold text-sm tracking-tight">{report.title}</div>
      <div
        className={`text-xs text-muted-foreground ${compact ? "mt-1 line-clamp-1" : "mt-1.5 leading-relaxed line-clamp-2"}`}
      >
        {report.description}
      </div>
    </Link>
  );
}
