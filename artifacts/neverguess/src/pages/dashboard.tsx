import { useAuth } from "@workspace/replit-auth-web";
import {
  useDeleteAudit,
  useGetTrialStatus,
  useListAudits,
  getGetTrialStatusQueryKey,
  getListAuditsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useDocumentTitle } from "@/lib/use-document-title";
import { safeUrlHost, safeUrlPath } from "@/lib/safe-url";
import { Sparkles as DemoSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Plus, Activity, Cpu, GitBranch, Globe, AlertCircle, CheckCircle2, Clock, Boxes, Sparkles, Trash2, Loader2 } from "lucide-react";
import {
  SampleReportCard,
  SAMPLE_GALLERY,
  verdictIcon,
  verdictPillClasses,
} from "@/components/sample-report-card";
import { displayNameFor } from "@/data/model-catalog";
import { Skeleton } from "@/components/ui/skeleton";
import { LivePhaseChip } from "@/components/live-stream";
import { Reveal } from "@/components/motion";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusConfig = {
  pending: { color: "border-amber-200 bg-amber-50 text-amber-600", icon: Clock },
  running: { color: "border-blue-200 bg-blue-50 text-blue-600", icon: Activity },
  ingested: { color: "border-cyan-200 bg-cyan-50 text-cyan-700", icon: Boxes },
  analyzing: { color: "border-primary/25 bg-accent text-primary", icon: Sparkles },
  done: { color: "border-emerald-200 bg-emerald-50 text-emerald-600", icon: CheckCircle2 },
  error: { color: "border-destructive/25 bg-destructive/10 text-destructive", icon: AlertCircle },
};

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [auditToDelete, setAuditToDelete] = useState<DashboardAudit | null>(null);
  useDocumentTitle("NeverGuess | A MarMar Labs Product");
  const { data: trialStatus } = useGetTrialStatus({
    query: {
      queryKey: getGetTrialStatusQueryKey(),
      enabled: !isAuthenticated,
      staleTime: 15_000,
    },
  });
  const { data: audits, isLoading, error } = useListAudits({
    query: {
      queryKey: getListAuditsQueryKey(),
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!Array.isArray(data)) return false;
        return data.some((a) => a.status === "pending" || a.status === "running" || a.status === "ingested" || a.status === "analyzing")
          ? 2000
          : false;
      },
    },
  });
  const auditList = Array.isArray(audits) ? audits : [];
  const auditsLoadError = error || (audits !== undefined && !Array.isArray(audits));
  const trialUsed = trialStatus?.trialEligible === false;
  // Anonymous list responses mix the visitor's own trial audit(s) with the
  // read-only demo gallery, flagged via isDemo. Treat an absent flag as demo
  // so older cached responses without the field keep rendering as before.
  // Authenticated responses never set isDemo, so no split there.
  const ownAudits = isAuthenticated ? [] : auditList.filter((a) => a.isDemo === false);
  const demoAudits = isAuthenticated ? [] : auditList.filter((a) => a.isDemo !== false);
  const hasTrialAudit = !isAuthenticated && ownAudits.length > 0;
  const gridAudits = isAuthenticated ? auditList : demoAudits;
  const deleteAudit = useDeleteAudit({
    mutation: {
      onSuccess: async () => {
        toast.success("Audit deleted");
        setAuditToDelete(null);
        await queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, "Could not delete audit"));
      },
    },
  });

  const confirmDeleteAudit = () => {
    if (!auditToDelete) return;
    deleteAudit.mutate({ id: auditToDelete.id });
  };

  // Show a one-time celebratory toast when the user lands here from a
  // successful Stripe Checkout. The query param is set as the Payment
  // Link's success URL: https://marmarlabs.com/app?upgraded=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "1") {
      toast.success("Welcome to NeverGuess Pro 🎉", {
        description:
          "Payment received — Pro is activating: 50 audits a month and premium models.",
      });
      // Strip the flag so reloads don't refire the toast.
      params.delete("upgraded");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  return (
    <div
      className={
        isAuthenticated
          ? "space-y-10 animate-fade-up"
          : "min-h-[100dvh] bg-background text-foreground px-4 md:px-8 py-10 md:py-12 max-w-6xl mx-auto space-y-10 animate-fade-up"
      }
    >
      {!isAuthenticated && (
        <div
          data-testid="banner-demo-mode"
          className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-[color:var(--brand-border)] bg-accent px-5 py-4 shadow-sm"
        >
          <div className="flex items-start gap-3 text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-card text-primary">
              <DemoSparkles className="w-4 h-4" />
            </span>
            <div>
              <div className="font-medium text-foreground">You're viewing the NeverGuess demo.</div>
              <div className="text-muted-foreground">
                {hasTrialAudit
                  ? "Sign in to keep this report — it moves to your account."
                  : trialUsed
                    ? "Your free audit is used. Sign in to run more and keep every report."
                    : "Run one real repo preflight without signing in, then create an account for more."}
              </div>
            </div>
          </div>
          <Link href={trialUsed ? "/login" : "/audits/new"}>
            <Button size="sm" data-testid="button-demo-signin">
              {trialUsed ? "Sign in for more" : "Try free preflight"}
            </Button>
          </Link>
        </div>
      )}

      {hasTrialAudit && (
        <section data-testid="section-trial-audit" className="space-y-4">
          <Reveal>
            <div className="eyebrow text-primary mb-2">Your trial audit</div>
            <p className="text-sm text-muted-foreground">
              The preflight you ran with your free trial.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {ownAudits.map((audit, i) => (
              <Reveal key={audit.id} delay={i * 0.08} className="h-full">
                <AuditCard
                  audit={audit}
                  canDelete={false}
                  onOpen={() => navigate(`/audits/${audit.id}`)}
                  onDelete={() => setAuditToDelete(audit)}
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {!isAuthenticated && (
      <section data-testid="section-sample-gallery" className="space-y-5">
        <Reveal>
          <div className="eyebrow text-primary mb-2">Sample reports</div>
          <h2 className="text-xl font-semibold tracking-tight">
            Try a sample audit
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Three pre-baked NeverGuess reports — no sign-in needed.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAMPLE_GALLERY.map((s, i) => (
            <Reveal key={s.slug} delay={i * 0.08} className="h-full">
              <SampleReportCard
                report={s}
                testId={`sample-card-${s.slug}`}
                pillTestId={`sample-pill-${s.slug}`}
              />
            </Reveal>
          ))}
        </div>
      </section>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="eyebrow text-primary mb-2">
            {isAuthenticated ? "Dashboard" : "Demo mode"}
          </div>
          <h1 className="text-3xl tracking-tight">
            {isAuthenticated ? "Mission Control" : "Demo Audit"}
          </h1>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            {isAuthenticated
              ? "Review your recent analyses and app impact reports."
              : hasTrialAudit
                ? "Read-only example audits. Your trial audit is shown above."
                : "A read-only example audit. Run one real repo preflight for free."}
          </p>
        </div>
        <Link href="/audits/new">
          <Button data-testid="button-new-audit">
            <Plus className="w-4 h-4 mr-2" />
            {isAuthenticated ? "New Audit" : "Try one free preflight"}
          </Button>
        </Link>
      </div>

      {isAuthenticated && auditList.length > 0 && <StatsStrip audits={auditList} />}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <Card key={i} className="rounded-2xl border-card-border">
              <CardHeader className="pb-4">
                <Skeleton className="h-5 w-1/3 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : auditsLoadError ? (
        <Card className="rounded-2xl border-destructive/25 bg-destructive/5">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 text-destructive mb-3">
              <AlertCircle className="w-5 h-5" />
            </span>
            <p className="text-destructive font-medium">Failed to load audits</p>
          </CardContent>
        </Card>
      ) : auditList.length === 0 ? (
        <Reveal className="space-y-6" data-testid="section-empty-state">
          {/* One primary action first; the sample gallery is a quieter fallback
              row below so new users aren't pulled two directions at once. */}
          <div className="relative overflow-hidden rounded-2xl border border-card-border bg-card p-8 md:p-10 shadow-sm text-center">
            <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
            <div className="eyebrow text-primary mb-2">Get started</div>
            <h3 className="text-2xl font-semibold tracking-tight">Run your first preflight</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-md mx-auto">
              Point NeverGuess at a repo and the change you're planning — you get a risk
              verdict and a report you can share.
            </p>
            <Link href="/audits/new">
              <Button size="lg" className="mt-6" data-testid="button-empty-run-own">
                <Plus className="w-4 h-4 mr-2" />
                Run your first preflight
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Not sure what a report looks like? Skim a finished sample first.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SAMPLE_GALLERY.slice(0, 2).map((s) => (
                <SampleReportCard
                  key={s.slug}
                  report={s}
                  compact
                  testId={`empty-sample-${s.slug}`}
                />
              ))}
            </div>
          </div>
        </Reveal>
      ) : gridAudits.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {gridAudits.map((audit, i) => (
            <Reveal key={audit.id} delay={i * 0.08} className="h-full">
              <AuditCard
                audit={audit}
                canDelete={isAuthenticated}
                onOpen={() => navigate(`/audits/${audit.id}`)}
                onDelete={() => setAuditToDelete(audit)}
              />
            </Reveal>
          ))}
        </div>
      ) : null}
      {isAuthenticated && auditList.length > 0 && (
        <section data-testid="section-reference-reports" className="space-y-4 border-t border-border pt-8">
          <Reveal>
            <div className="eyebrow mb-2">Reference reports</div>
            <p className="text-sm text-muted-foreground">
              Sample outputs for comparison. Your recent audits stay first.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_GALLERY.map((s, i) => (
              <Reveal key={s.slug} delay={i * 0.08} className="h-full">
                <SampleReportCard
                  report={s}
                  compact
                  testId={`sample-card-${s.slug}`}
                  pillTestId={`sample-pill-${s.slug}`}
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <AlertDialog
        open={!!auditToDelete}
        onOpenChange={(open) => {
          if (!open && !deleteAudit.isPending) setAuditToDelete(null);
        }}
      >
        <AlertDialogContent data-testid="dialog-delete-audit">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this audit?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the audit and its report from your dashboard. Shared links for
              this report will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {auditToDelete && (
            <div
              className="rounded-lg border border-border bg-secondary p-3 text-sm"
              data-testid="text-delete-audit-summary"
            >
              <div className="line-clamp-2 font-mono font-medium">{auditToDelete.requestedChange}</div>
              {auditToDelete.githubUrl && (
                <div className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span className="truncate">
                    {safeUrlPath(auditToDelete.githubUrl)}
                  </span>
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteAudit.isPending}
              data-testid="button-cancel-delete-audit"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDeleteAudit();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAudit.isPending}
              data-testid="button-confirm-delete-audit"
            >
              {deleteAudit.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete audit
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type DashboardAudit = {
  id: string;
  status: string;
  requestedChange: string;
  createdAt: string;
  githubUrl?: string | null;
  liveUrl?: string | null;
  model?: string | null;
  riskScore?: number | null;
  verdict?: string | null;
};

type AuditWithRisk = Pick<DashboardAudit, "status" | "riskScore" | "verdict">;

// The audit card is shared by the main grid and the anonymous "Your trial
// audit" section, so both stay pixel-identical without a second copy.
function AuditCard({
  audit,
  canDelete,
  onOpen,
  onDelete,
}: {
  audit: DashboardAudit;
  canDelete: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const config = statusConfig[audit.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex h-full cursor-pointer flex-col rounded-2xl border-card-border bg-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[color:var(--brand-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      data-testid={`card-audit-${audit.id}`}
    >
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground mb-2">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDistanceToNow(new Date(audit.createdAt), { addSuffix: true })}</span>
          </div>
          <p className="font-mono text-sm leading-snug line-clamp-2 text-foreground font-medium">
            {audit.requestedChange}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative z-10 -mr-1 -mt-1 h-7 w-7 text-muted-foreground opacity-70 hover:text-destructive group-hover:opacity-100"
              aria-label="Delete audit"
              data-testid={`button-delete-audit-${audit.id}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Badge variant="outline" className={`${config.color} shrink-0 font-mono uppercase text-[10px] tracking-wider font-semibold`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {audit.status}
          </Badge>
          {(audit.status === "pending" ||
            audit.status === "running" ||
            audit.status === "ingested" ||
            audit.status === "analyzing") && (
            <LivePhaseChip auditId={audit.id} />
          )}
          {audit.status === "done" && audit.verdict && (() => {
            const verdict = (audit.verdict ?? "safe") as "safe" | "caution" | "block";
            const RiskIcon = verdictIcon(verdict);
            return (
              <Badge
                variant="outline"
                className={`${verdictPillClasses(verdict)} font-mono uppercase text-[10px] tracking-wider`}
                data-testid={`pill-risk-${audit.id}`}
              >
                <RiskIcon className="w-3 h-3 mr-1" />
                risk {audit.riskScore ?? 0}
              </Badge>
            );
          })()}
        </div>
      </CardHeader>
      <CardContent className="mt-auto pb-5">
        <div className="space-y-2">
          {audit.githubUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-2.5 py-2 font-mono text-xs text-muted-foreground">
              <GitBranch className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="truncate">{safeUrlPath(audit.githubUrl)}</span>
            </div>
          )}
          {audit.liveUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-2.5 py-2 font-mono text-xs text-muted-foreground">
              <Globe className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="truncate">{safeUrlHost(audit.liveUrl)}</span>
            </div>
          )}
          {audit.model && (
            <div>
              <span
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground"
                data-testid={`chip-model-${audit.id}`}
              >
                <Cpu className="w-3 h-3 shrink-0 text-primary" />
                <span className="truncate">{displayNameFor(audit.model)}</span>
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "error" in err) {
    const value = (err as { error?: unknown }).error;
    if (typeof value === "string" && value.length > 0) return value;
  }
  if (err instanceof Error && err.message.length > 0) return err.message;
  return fallback;
}

function StatsStrip({ audits }: { audits: AuditWithRisk[] }) {
  const completed = audits.filter((a) => a.status === "done");
  const inFlight = audits.filter((a) =>
    ["pending", "running", "ingested", "analyzing"].includes(a.status),
  );
  const scores = completed
    .map((a) => a.riskScore)
    .filter((s): s is number => typeof s === "number");
  const avg =
    scores.length === 0
      ? null
      : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const verdicts = completed.reduce(
    (acc, a) => {
      const v = (a.verdict ?? "safe") as "safe" | "caution" | "block";
      acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    },
    { safe: 0, caution: 0, block: 0 } as Record<"safe" | "caution" | "block", number>,
  );
  const tone =
    avg === null
      ? "text-muted-foreground"
      : avg >= 60
        ? "text-red-600"
        : avg >= 25
          ? "text-amber-600"
          : "text-emerald-600";

  return (
    <Reveal
      className="grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-card-border bg-border shadow-sm"
      data-testid="section-dashboard-stats"
    >
      <Stat label="Total audits" value={audits.length.toString()} testId="stat-total" />
      <Stat
        label="Avg risk"
        value={avg === null ? "—" : `${avg}/100`}
        testId="stat-avg-risk"
        valueClassName={tone}
      />
      <Stat
        label="Verdict mix"
        value={
          <span className="font-mono tabular-nums">
            <span className="text-emerald-600">{verdicts.safe}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="text-amber-600">{verdicts.caution}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="text-red-600">{verdicts.block}</span>
          </span>
        }
        testId="stat-verdict-mix"
      />
      <Stat
        label="In flight"
        value={inFlight.length.toString()}
        testId="stat-in-flight"
        valueClassName={inFlight.length > 0 ? "text-primary" : undefined}
      />
    </Reveal>
  );
}

function Stat({
  label,
  value,
  testId,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  testId: string;
  valueClassName?: string;
}) {
  return (
    <div
      className="bg-card px-4 py-4"
      data-testid={testId}
    >
      <div className="eyebrow">{label}</div>
      <div
        className={`text-2xl font-semibold font-mono tabular-nums mt-1.5 ${valueClassName ?? "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}
