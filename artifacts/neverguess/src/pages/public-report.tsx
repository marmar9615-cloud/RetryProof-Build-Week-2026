import { useRoute, Link } from "wouter";
import {
  useGetPublicReport,
  getGetPublicReportQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/motion";
import { Activity, AlertCircle, ArrowRight, Download, GitBranch, Globe, Printer } from "lucide-react";
import { ReportView } from "@/components/report-view";
import { OpenInReplitButton } from "@/components/open-in-replit-button";
import { DownloadsMenu } from "@/components/report-actions";
import type { Report } from "@workspace/api-client-react";
import {
  reportToMarkdown,
  downloadMarkdown,
  type AuditContext,
} from "@/lib/markdown-export";
import { format } from "date-fns";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useMetaTags } from "@/lib/use-meta-tags";
import { useAuth } from "@workspace/replit-auth-web";
import { safeUrlHost, safeUrlPath } from "@/lib/safe-url";
import { displayNameFor } from "@/data/model-catalog";

export default function PublicReport() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/r/:slug");
  const slug = params?.slug || "";
  const { data, isLoading, error } = useGetPublicReport(slug, {
    query: {
      enabled: !!slug,
      queryKey: getGetPublicReportQueryKey(slug),
      retry: false,
    },
  });
  const showUnavailable = !isLoading && (error || !data || !data.report || !data.audit);

  useDocumentTitle(
    showUnavailable
      ? "Report not found | NeverGuess"
      : "Shared Report | NeverGuess by MarMar Labs"
  );
  useMetaTags(
    showUnavailable
      ? {
          title: "Report not found | NeverGuess",
          description:
            "This share link was removed, expired, or never existed. Run a free preflight at NeverGuess by MarMar Labs.",
        }
      : {}
  );

  const ctaLabel = isAuthenticated ? "Start new audit" : "Try one free preflight";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-[hsl(var(--background)/0.8)] backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/app" className="flex items-center gap-2.5 group" data-testid="link-home-brand">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-card-border bg-secondary text-primary">
              <Activity className="w-4 h-4" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-display text-base font-semibold tracking-tight text-foreground">
                NeverGuess
              </span>
              <span className="text-[10px] text-muted-foreground">a MarMar Labs product</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="https://marmarlabs.com"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="badge-attribution"
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow text-muted-foreground transition-colors hover:text-foreground hover:border-[color:var(--brand-line)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              by MarMar Labs
            </a>
            <Button asChild size="sm" data-testid="button-cta-analyze-own">
              <Link href="/audits/new">
                {ctaLabel}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-8 py-10 md:py-16 space-y-8">
        {isLoading && (
          <div className="space-y-4" data-testid="state-public-report-loading">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        )}

        {showUnavailable && (
          <Reveal>
            <Card
              className="rounded-2xl border-destructive/30 bg-card"
              data-testid="state-public-report-unavailable"
            >
              <CardContent className="pt-10 pb-10 text-center">
                <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600">
                  <AlertCircle className="w-6 h-6" />
                </span>
                <h2 className="text-xl font-semibold tracking-tight">Report not found</h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  This share link was removed, expired, or never existed.
                </p>
                <div className="mt-6">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/app">Back to NeverGuess</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        )}

        {!showUnavailable && data?.report && data?.audit && (
          <PublicReportContent
            report={data.report}
            audit={data.audit}
          />
        )}
      </main>

      <footer className="border-t border-border bg-card no-print">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4 text-primary" />
            <span>
              Shared via <span className="font-medium text-foreground">NeverGuess</span>
            </span>
          </div>
          <Button asChild variant="outline" size="sm" data-testid="button-cta-footer">
            <Link href="/audits/new">
              {ctaLabel}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}

function PublicReportContent({
  report,
  audit,
}: {
  report: Parameters<typeof ReportView>[0]["report"];
  audit: AuditContext;
}) {
  // Surface verdict + score in the social-share preview so a /r/<slug> link
  // unfurls with the actual outcome instead of the generic site image.
  const verdict = (report as { verdict?: string }).verdict ?? "safe";
  const riskScore = (report as { riskScore?: number }).riskScore;
  const verdictWord =
    verdict === "block"
      ? "BLOCKER"
      : verdict === "caution"
        ? "CAUTION"
        : "SAFE";
  const scoreSuffix = typeof riskScore === "number" ? ` · risk ${riskScore}/100` : "";
  const metaTitle = `${verdictWord}${scoreSuffix} — ${audit.requestedChange.slice(0, 80)}${
    audit.requestedChange.length > 80 ? "…" : ""
  }`;
  // Same defensive access as verdict/riskScore above — shared payloads for
  // legacy reports may not carry an analysis receipt.
  const servedModelId =
    (report as { analysisUsage?: { model?: string } | null }).analysisUsage
      ?.model ?? null;
  const auditedBy = servedModelId ? displayNameFor(servedModelId) : null;
  const summarySlice = report.architectureSummary?.slice(0, 220) ?? null;
  const metaDescription = auditedBy
    ? summarySlice
      ? `${summarySlice} · audited by ${auditedBy}`
      : `Audited by ${auditedBy}.`
    : summarySlice;
  const slug = report.shareSlug;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://marmarlabs.com";
  const ogImage = slug ? `${origin}/api/r/${slug}/badge.svg` : null;
  const canonicalUrl = slug ? `${origin}/r/${slug}` : null;
  useMetaTags({
    title: metaTitle,
    description: metaDescription,
    canonicalUrl,
    ogImage,
    ogImageAlt: `NeverGuess verdict: ${verdictWord}${scoreSuffix}`,
  });

  // Verdict chip tone on paper — keep status colors at -600/-50/-200.
  const verdictTone =
    verdict === "block"
      ? "border-red-200 bg-red-50 text-red-600"
      : verdict === "caution"
        ? "border-amber-200 bg-amber-50 text-amber-600"
        : "border-emerald-200 bg-emerald-50 text-emerald-600";

  function handleExport() {
    const md = reportToMarkdown(report, audit);
    const stamp = new Date(audit.createdAt).toISOString().slice(0, 10);
    downloadMarkdown(`neverguess-report-${stamp}.md`, md);
  }

  return (
    <>
      <Reveal>
        <header className="space-y-4 border-b border-border pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow text-primary">Shared NeverGuess report</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${verdictTone}`}
              data-testid="badge-public-verdict"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {verdictWord}
              {typeof riskScore === "number" && (
                <span className="opacity-70">· {riskScore}/100</span>
              )}
            </span>
            {auditedBy && (
              <span
                className="inline-flex items-center rounded-full border border-card-border bg-secondary px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
                title={servedModelId ?? undefined}
                data-testid="badge-audited-by-model"
              >
                audited by {auditedBy}
              </span>
            )}
          </div>
          <h1
            className="text-3xl md:text-4xl font-semibold tracking-tight text-balance"
            data-testid="text-public-requested-change"
          >
            {audit.requestedChange}
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-muted-foreground">
            <span>{format(new Date(audit.createdAt), "MMM d, yyyy")}</span>
            {audit.githubUrl && (
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-primary" />
                {safeUrlPath(audit.githubUrl)}
              </span>
            )}
            {audit.liveUrl && (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-primary" />
                {safeUrlHost(audit.liveUrl)}
              </span>
            )}
          </div>
        </header>
      </Reveal>

      <Reveal delay={0.08}>
        <ReportView
          report={report}
          audit={audit}
          actions={
            <div className="flex flex-wrap gap-2" data-testid="section-report-actions">
              <OpenInReplitButton
                promptText={report.promptPack?.replit ?? ""}
                githubUrl={audit.githubUrl}
                testId="button-open-in-replit"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const previousTitle = document.title;
                  const date = new Date().toISOString().slice(0, 10);
                  document.title = `neverguess-report-${date}`;
                  window.print();
                  setTimeout(() => {
                    document.title = previousTitle;
                  }, 1000);
                }}
                data-testid="button-print-pdf"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Export PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExport}
                data-testid="button-public-export-markdown"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Export Markdown
              </Button>
              {/* Same agent-instruction downloads owners get — a shared
                  report is where a new visitor takes AGENTS.md home from. */}
              <DownloadsMenu report={report as Report} audit={audit} />
            </div>
          }
        />
      </Reveal>
    </>
  );
}
