import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetaTags } from "@/lib/use-meta-tags";
import { ArrowRight, GitBranch, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";

type GalleryReport = {
  slug: string;
  verdict: "safe" | "caution" | "block";
  riskScore: number;
  requestedChange: string;
  githubRepo: string | null;
  createdAt: string;
};

// Shown when the gallery API returns nothing (e.g. frontend-only preview, or
// no demo reports yet) so the page mirrors its server-rendered SEO body
// instead of looking empty.
const EXAMPLE_REPORTS: GalleryReport[] = [
  {
    slug: "next-isr",
    verdict: "caution",
    riskScore: 48,
    requestedChange: "Enable Next.js ISR on the product listing page with revalidate=60.",
    githubRepo: "next.js",
    createdAt: "",
  },
];

const verdictStyle: Record<
  GalleryReport["verdict"],
  { label: string; classes: string; Icon: typeof ShieldCheck }
> = {
  safe: { label: "Safe", classes: "border-emerald-200 bg-emerald-50 text-emerald-700", Icon: ShieldCheck },
  caution: { label: "Caution", classes: "border-amber-200 bg-amber-50 text-amber-700", Icon: AlertTriangle },
  block: { label: "Blocker", classes: "border-red-200 bg-red-50 text-red-700", Icon: ShieldAlert },
};

function VerdictPill({ verdict, riskScore }: { verdict: GalleryReport["verdict"]; riskScore: number }) {
  const v = verdictStyle[verdict] ?? verdictStyle.caution;
  const Icon = v.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${v.classes}`}>
      <Icon className="h-3.5 w-3.5" />
      {v.label}
      <span className="font-mono text-[11px] opacity-70">· {riskScore}/100</span>
    </span>
  );
}

function useGallery(): GalleryReport[] | null {
  const [reports, setReports] = useState<GalleryReport[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/r/gallery", { credentials: "include" })
      .then(async (r) => (r.ok && r.headers.get("content-type")?.includes("application/json") ? r.json() : { reports: [] }))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.reports) ? (data.reports as GalleryReport[]) : [];
        // De-dupe by repo so the gallery doesn't show several near-identical rows.
        const seen = new Set<string>();
        const uniq = list.filter((r) => {
          const key = r.githubRepo ?? r.slug;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setReports(uniq);
      })
      .catch(() => {
        if (!cancelled) setReports([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return reports;
}

function ReportCard({ report, isExample = false }: { report: GalleryReport; isExample?: boolean }) {
  return (
    <a
      href={`/r/${report.slug}`}
      data-testid={`gallery-report-${report.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-card-border bg-card p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[color:var(--brand-border)]"
    >
      {isExample && (
        <span className="mb-2 self-start rounded-full border border-card-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Example
        </span>
      )}
      <div className="mb-3 flex items-center justify-between gap-2">
        <VerdictPill verdict={report.verdict} riskScore={report.riskScore} />
        {report.githubRepo && (
          <span className="inline-flex items-center gap-1 truncate max-w-[55%] font-mono text-[11px] text-muted-foreground">
            <GitBranch className="h-3 w-3 shrink-0" />
            <span className="truncate">{report.githubRepo}</span>
          </span>
        )}
      </div>
      <p className="flex-1 text-sm font-medium leading-snug text-foreground line-clamp-3">
        {report.requestedChange}
      </p>
      <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        Open report
        <ArrowRight className="h-3 w-3 text-primary transition-transform group-hover:translate-x-0.5" />
      </div>
    </a>
  );
}

export default function MarketingReports() {
  useMetaTags({
    title: "NeverGuess report examples — real preflight audits",
    description:
      "Browse example NeverGuess preflight reports. Each report includes verdict, risk score, architecture summary, risky assumptions, acceptance criteria, safer prompts, and rollout notes.",
    canonicalUrl: "https://marmarlabs.com/reports",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
  });

  const reports = useGallery();
  const loading = reports === null;
  const hasReports = !loading && reports.length > 0;
  const shown = hasReports ? reports : EXAMPLE_REPORTS;

  return (
    <MarketingLayout>
      {/* ---- Hero -------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[1000px] h-[560px] bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-30" />
        <div className="relative max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="animate-fade-up">
            <div className="eyebrow text-primary mb-3">Report examples</div>
            <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-4xl md:text-6xl">
              Recent NeverGuess <span className="text-primary">reports</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed text-muted-foreground">
              Every example is a 60-second preflight: what will break, how risky it is, and the
              exact prompt to ship the change safely. Click any card to see one.
            </p>
            <div className="mt-9">
              <Button asChild size="lg" data-testid="button-reports-cta">
                <Link href="/audits/new">
                  Run a free preflight <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Gallery ----------------------------------------------------- */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24" data-testid="section-reports-gallery">
        {!hasReports && !loading && (
          <Reveal className="mb-8">
            <div className="rounded-2xl border border-card-border bg-secondary/60 px-5 py-4 text-sm text-muted-foreground">
              Showing example reports. Shared user reports stay unlisted unless you send someone the link.
            </div>
          </Reveal>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {shown.slice(0, 12).map((report, i) => (
              <Reveal key={report.slug} delay={i * 0.05}>
                <ReportCard report={report} isExample={!hasReports} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </MarketingLayout>
  );
}
