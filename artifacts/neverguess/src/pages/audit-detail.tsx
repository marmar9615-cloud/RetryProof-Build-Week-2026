import { useRoute, useLocation, Link } from "wouter";
import {
  useGetAudit,
  getGetAuditQueryKey,
  useRerunAudit,
  useListModels,
  getListModelsQueryKey,
  useListAuditRuns,
  getListAuditRunsQueryKey,
  useListAudits,
  getListAuditsQueryKey,
  type ModelsResponse,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { useDocumentTitle } from "@/lib/use-document-title";
import { safeUrlHost } from "@/lib/safe-url";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Clock, Cpu, GitBranch, Globe, Search, Activity, CheckCircle2, AlertCircle, Terminal, Boxes, Database, Lock, Package, Rocket, FileCode, ChevronDown, ChevronUp, Copy, FolderTree, History, Sparkles, RotateCcw, Loader2, X } from "lucide-react";
import { ReportPanel } from "@/components/report-panel";
import { isTextField } from "@/components/keyboard-shortcuts";
import { LiveStream } from "@/components/live-stream";
import { Celebration } from "@/components/celebration";
import { Reveal } from "@/components/motion";
import {
  DEFAULT_MODEL_ID,
  STATIC_MODEL_CATALOG,
  displayNameFor,
} from "@/data/model-catalog";
import { format, formatDistanceToNow } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Status pill styling on the light "paper" theme. Each state uses the
// -50 tint / -200 hairline / -700 ink trio so it reads as a calm instrument
// readout rather than a neon chip. `done` leans on the iris accent; `error`
// on the semantic destructive token.
const statusConfig = {
  pending: { color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, label: "Pending" },
  running: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Activity, label: "Running" },
  ingested: { color: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: Boxes, label: "Ingested" },
  analyzing: { color: "bg-accent text-accent-foreground border-[color:var(--brand-border)]", icon: Sparkles, label: "Analyzing" },
  done: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "Done" },
  error: { color: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle, label: "Failed" },
};

export default function AuditDetail() {
  useDocumentTitle("Audit Detail | NeverGuess by MarMar Labs");
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/audits/:id");
  const id = params?.id || "";

  const { data: audit, isLoading, error } = useGetAudit(id, {
    query: {
      enabled: !!id,
      queryKey: getGetAuditQueryKey(id),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (
          status === "pending" ||
          status === "running" ||
          status === "ingested" ||
          status === "analyzing"
        ) {
          return 3000;
        }
        return false;
      },
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <Skeleton className="h-5 w-36" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !audit || !audit.id) {
    return (
      <div className="max-w-md mx-auto pt-16 md:pt-24">
        <div className="rounded-2xl border border-card-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Audit not found</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We couldn't load the details for this audit. It may have been removed, or the link is incomplete.
          </p>
          <Link href="/app" className="mt-6 inline-block">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Return to dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const config = statusConfig[audit.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = config.icon;

  const isInFlight =
    audit.status === "pending" ||
    audit.status === "running" ||
    audit.status === "ingested" ||
    audit.status === "analyzing";

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-up">
      <DoneCelebration status={audit.status} />
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/app"
          className="group inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5 transition-transform group-hover:-translate-x-0.5" />
          Back to dashboard
        </Link>
        {isAuthenticated && <AuditNav auditId={audit.id} />}
      </div>

      <div className="flex flex-col gap-5 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="eyebrow text-primary mb-3">Preflight report</div>
          <h1
            className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-balance line-clamp-2"
            title={audit.requestedChange}
            data-testid="text-audit-headline"
          >
            {audit.requestedChange}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs">
              <span className="text-muted-foreground/60">ID</span>
              <span className="text-foreground">{audit.id.split('-')[0]}</span>
            </span>
            <span className="text-border" aria-hidden>•</span>
            <span
              className="inline-flex items-center gap-1.5 font-mono text-xs"
              title={format(new Date(audit.createdAt), 'MMM d, yyyy HH:mm')}
            >
              <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
              {formatDistanceToNow(new Date(audit.createdAt), { addSuffix: true })}
            </span>
            {audit.githubUrl && (
              <>
                <span className="text-border" aria-hidden>•</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs" title={audit.githubUrl}>
                  <GitBranch className="w-3.5 h-3.5 text-muted-foreground/70" />
                  {safeUrlHost(audit.githubUrl)}
                </span>
              </>
            )}
            {audit.model && (
              <>
                <span className="text-border" aria-hidden>•</span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground"
                  data-testid="chip-audit-model"
                >
                  <Cpu className="w-3 h-3 text-primary" />
                  {displayNameFor(audit.model)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <Badge
            variant="outline"
            className={`${config.color} gap-1.5 px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-widest`}
            data-testid="badge-audit-status"
          >
            <StatusIcon className={`w-3.5 h-3.5 ${isInFlight ? "animate-pulse" : ""}`} />
            {config.label}
          </Badge>
          {isAuthenticated && (
            <Link href={duplicateHref(audit)}>
              <Button variant="outline" size="sm" data-testid="button-duplicate-audit">
                <Copy className="w-4 h-4 mr-1.5" />
                Duplicate
              </Button>
            </Link>
          )}
          {isAuthenticated && (audit.status === "done" || audit.status === "error") && (
            <RerunButton auditId={audit.id} status={audit.status} currentModel={audit.model} />
          )}
          {!isAuthenticated && (audit.status === "done" || audit.status === "error") && (
            <LockedRerunButton />
          )}
          {isInFlight && <StuckHint createdAt={audit.createdAt} />}
        </div>
      </div>

      <RunHistoryStrip audit={audit} />

      <LiveStream auditId={audit.id} status={audit.status} createdAt={audit.createdAt} />

      {!isAuthenticated && (audit.status === "done" || audit.status === "error") && (
        <TrialSignInBanner auditId={audit.id} failed={audit.status === "error"} />
      )}

      <IngestionPanel audit={audit} />

      <ReportPanel
        auditId={audit.id}
        status={audit.status}
        allowOwnerActions={isAuthenticated}
        audit={{
          requestedChange: audit.requestedChange,
          githubUrl: audit.githubUrl,
          liveUrl: audit.liveUrl,
          detectedFramework: audit.detectedFramework,
          detectedPackageManager: audit.detectedPackageManager,
          detectedDbLayer: audit.detectedDbLayer,
          detectedAuthLayer: audit.detectedAuthLayer,
          createdAt: audit.createdAt,
        }}
      />

      <Reveal>
        <Card className="overflow-hidden border-card-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div className="inline-flex items-center gap-1.5 eyebrow text-muted-foreground">
              <Terminal className="w-3.5 h-3.5 text-primary" />
              Inputs
            </div>
            <span className="eyebrow text-muted-foreground">Submitted</span>
          </div>
          <CardContent className="grid grid-cols-1 gap-5 p-5 md:grid-cols-3">
            <CardDescription className="sr-only">
              The repository, environment, and requested change you submitted.
            </CardDescription>
            {audit.githubUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <GitBranch className="w-3.5 h-3.5" /> Repository
                </div>
                <div className="truncate rounded-lg border border-border bg-secondary px-3 py-2 font-mono text-xs text-foreground" title={audit.githubUrl}>
                  {audit.githubUrl}
                </div>
              </div>
            )}

            {audit.liveUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Globe className="w-3.5 h-3.5" /> Environment
                </div>
                <div className="truncate rounded-lg border border-border bg-secondary px-3 py-2 font-mono text-xs text-foreground" title={audit.liveUrl}>
                  {audit.liveUrl}
                </div>
              </div>
            )}

            <div className={`space-y-2 ${audit.githubUrl || audit.liveUrl ? "" : "md:col-span-3"}`}>
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Search className="w-3.5 h-3.5" /> Requested change
              </div>
              <div className="whitespace-pre-wrap rounded-lg border border-border bg-secondary px-3 py-2.5 font-mono text-sm leading-relaxed text-foreground">
                {audit.requestedChange}
              </div>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

// Prefill link for "run this change again with tweaks". Param names (repo,
// live, change, model) are pinned with the new-audit page's prefill parser —
// change them there too or not at all.
function duplicateHref(audit: {
  githubUrl: string | null;
  liveUrl: string | null;
  requestedChange: string;
  model: string | null;
}): string {
  const parts: string[] = [];
  if (audit.githubUrl) parts.push(`repo=${encodeURIComponent(audit.githubUrl)}`);
  if (audit.liveUrl) parts.push(`live=${encodeURIComponent(audit.liveUrl)}`);
  // Cap the change text so a pathological description can't blow past
  // practical URL length limits — the form is a starting point, not a
  // lossless copy.
  const change = audit.requestedChange.slice(0, 2000);
  if (change) parts.push(`change=${encodeURIComponent(change)}`);
  if (audit.model) parts.push(`model=${encodeURIComponent(audit.model)}`);
  return parts.length > 0 ? `/audits/new?${parts.join("&")}` : "/audits/new";
}

// Prev/next stepping between the caller's own audits, ordered the same way
// the dashboard lists them (createdAt desc, newest first). Reuses the
// dashboard's query key so a visit from the dashboard hits the cache instead
// of refetching. Only mounted for authenticated users — the anonymous list
// endpoint returns the demo gallery, which would make j/k jump to audits the
// viewer doesn't own.
function AuditNav({ auditId }: { auditId: string }) {
  const [, setLocation] = useLocation();
  const { data } = useListAudits({
    query: {
      queryKey: getListAuditsQueryKey(),
      staleTime: 30_000,
    },
  });
  // Static preview serves HTML for /api/* — a truthy string can reach here,
  // so only trust the response when it's a real array.
  const list = Array.isArray(data) ? data : [];
  const sorted = [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const idx = sorted.findIndex((a) => a.id === auditId);
  const newerId = idx > 0 ? sorted[idx - 1].id : null;
  const olderId = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1].id : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Same guard as the global shortcuts: never fire while typing.
      if (isTextField(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't steal j/k while any dialog is open (share, delete, shortcut
      // help…) — Radix marks open content with data-state="open".
      if (
        document.querySelector(
          '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
        )
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "k" && newerId) {
        e.preventDefault();
        setLocation(`/audits/${newerId}`);
      } else if (key === "j" && olderId) {
        e.preventDefault();
        setLocation(`/audits/${olderId}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [newerId, olderId, setLocation]);

  return (
    <span className="inline-flex items-center gap-1" data-testid="control-audit-nav">
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={newerId ? -1 : 0} className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={!newerId}
              onClick={() => newerId && setLocation(`/audits/${newerId}`)}
              aria-label="Newer audit"
              data-testid="button-nav-newer-audit"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Newer audit · k</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={olderId ? -1 : 0} className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={!olderId}
              onClick={() => olderId && setLocation(`/audits/${olderId}`)}
              aria-label="Older audit"
              data-testid="button-nav-older-audit"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Older audit · j</TooltipContent>
      </Tooltip>
    </span>
  );
}

// Same verdict tone trio the dashboard cards use: red for block, amber for
// caution, emerald for safe.
function verdictPillClasses(v: string) {
  return v === "block"
    ? "border-red-200 bg-red-50 text-red-600"
    : v === "caution"
      ? "border-amber-200 bg-amber-50 text-amber-600"
      : "border-emerald-200 bg-emerald-50 text-emerald-600";
}

// Compact receipts of superseded runs so a re-run's verdict can be compared
// against what it replaced. The live report is not in the receipts table
// (only replaced runs are snapshotted), so a "current" row is synthesized
// from the audit's own verdict fields to anchor the comparison. Hidden
// entirely for never-rerun audits — the endpoint returns [] for those.
function RunHistoryStrip({
  audit,
}: {
  audit: {
    id: string;
    status: string;
    model: string | null;
    verdict?: string | null;
    riskScore?: number | null;
    updatedAt: string;
  };
}) {
  const isTerminal = audit.status === "done" || audit.status === "error";
  const { data } = useListAuditRuns(audit.id, {
    query: {
      enabled: isTerminal,
      queryKey: getListAuditRunsQueryKey(audit.id),
      staleTime: 30_000,
    },
  });
  // Static preview serves HTML for /api/* — a truthy string can reach here,
  // so only trust the response when it's a real array.
  const history = Array.isArray(data) ? data : [];
  if (!isTerminal || history.length === 0) return null;

  const rows = [
    {
      id: "current",
      model: audit.model,
      verdict: audit.verdict ?? null,
      riskScore: audit.riskScore ?? null,
      date: audit.updatedAt,
      current: true,
    },
    ...[...history]
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .map((run) => ({
        id: run.id,
        model: run.model,
        verdict: run.verdict ?? null,
        riskScore: run.riskScore ?? null,
        date: run.createdAt,
        current: false,
      })),
  ];

  return (
    <Reveal>
      <Card
        className="overflow-hidden border-card-border bg-card shadow-sm"
        data-testid="section-run-history"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="inline-flex items-center gap-1.5 eyebrow text-muted-foreground">
            <History className="w-3.5 h-3.5 text-primary" />
            Run history
          </div>
          <span className="eyebrow text-muted-foreground">
            {rows.length} runs
          </span>
        </div>
        <CardContent className="divide-y divide-border p-0">
          {rows.map((row) => {
            const date = new Date(row.date);
            const dateValid = !Number.isNaN(date.getTime());
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5"
                data-testid={`row-run-history-${row.id}`}
              >
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground">
                  <Cpu className="w-3 h-3 text-primary" />
                  {displayNameFor(row.model) ?? "Default model"}
                </span>
                {row.verdict ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${verdictPillClasses(row.verdict)}`}
                  >
                    {row.verdict.toUpperCase()}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground/70">—</span>
                )}
                <span className="font-mono text-xs text-foreground">
                  {typeof row.riskScore === "number" ? `${row.riskScore}/100` : "—"}
                </span>
                {row.current && (
                  <span className="text-[11px] text-muted-foreground">(current)</span>
                )}
                {dateValid && (
                  <span
                    className="ml-auto font-mono text-xs text-muted-foreground"
                    title={format(date, "MMM d, yyyy HH:mm")}
                  >
                    {formatDistanceToNow(date, { addSuffix: true })}
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </Reveal>
  );
}

type AuditLike = {
  status: string;
  ingestionSource: string | null;
  detectedFramework: string | null;
  detectedPackageManager: string | null;
  detectedDbLayer: string | null;
  detectedAuthLayer: string | null;
  routesFolder: string | null;
  deploymentClues: string[] | null;
  fileTreeSample: string[] | null;
  fileCount: number | null;
  ingestionError: string | null;
};

function IngestionPanel({ audit }: { audit: AuditLike }) {
  const [open, setOpen] = useState(true);
  const isRunning = audit.status === "pending" || audit.status === "running";
  // "We have something to show" includes the file tree itself, not just the
  // detected stack signals — so a successful repo ingest where every tech-detect
  // signal returned null (e.g. auditing the framework itself: expressjs/express)
  // still shows the file tree + an explicit "—" per signal, which is far more
  // useful than the misleading "No ingestion signals detected yet" empty state.
  const hasFiles = (audit.fileCount ?? 0) > 0 || (audit.fileTreeSample?.length ?? 0) > 0;
  const hasResults =
    !!audit.detectedFramework ||
    !!audit.detectedPackageManager ||
    !!audit.detectedDbLayer ||
    !!audit.detectedAuthLayer ||
    !!audit.routesFolder ||
    (!!audit.deploymentClues && audit.deploymentClues.length > 0) ||
    hasFiles;

  const signals: Array<{ icon: typeof Boxes; label: string; value: string | null }> = [
    { icon: Boxes, label: "Framework", value: audit.detectedFramework },
    { icon: Package, label: "Package Manager", value: audit.detectedPackageManager },
    { icon: Database, label: "DB Layer", value: audit.detectedDbLayer },
    { icon: Lock, label: "Auth Layer", value: audit.detectedAuthLayer },
    { icon: FolderTree, label: "Routes Folder", value: audit.routesFolder },
  ];
  const unknownLabel = hasFiles ? "Not detected" : "Awaiting scan";

  // Rendered in both the has-results and empty branches: a pure ingestion
  // failure (bad URL, rate limit) never persists any signals, so keeping the
  // message inside the results branch would hide exactly the errors this box
  // exists for. The quota note requires BOTH ingestionError AND no ingested
  // files: analysis-phase failures also write their message into
  // ingestionError (analysis-runner setStatus) but they happen after
  // ingestion persisted the repo — and those runs spent model tokens, so
  // they keep their quota charge. Only file-less failures were refunded.
  const errorNotice = audit.ingestionError ? (
    <div
      className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-700"
      data-testid="text-ingestion-error"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <div className="space-y-1">
        <div>{audit.ingestionError}</div>
        {audit.status === "error" && !hasFiles && (
          <div className="font-medium" data-testid="text-quota-refund-note">
            This failure did not use your quota.
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <Reveal>
      <Card className="overflow-hidden border-card-border bg-card shadow-sm">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          data-testid="toggle-ingestion-panel"
          className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-secondary/40"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
              <FileCode className="w-4 h-4" />
            </span>
            <div>
              <div className="font-display text-sm font-semibold tracking-tight">
                Ingestion results
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {isRunning
                  ? "Fetching repository context…"
                  : audit.ingestionSource === "demo"
                    ? "Showing demo fixture (GitHub data unavailable)"
                    : audit.ingestionSource === "github"
                      ? "Live data fetched from GitHub"
                      : "Awaiting ingestion"}
              </div>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <CardContent className="space-y-5 border-t border-border pt-5">
            {isRunning ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : hasResults ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {signals.map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.label}
                        className="rounded-lg border border-card-border bg-secondary/60 p-3"
                        data-testid={`signal-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          <Icon className="w-3 h-3" />
                          {s.label}
                        </div>
                        <div className="mt-2 truncate font-mono text-sm text-foreground" title={s.value ?? unknownLabel}>
                          {s.value ?? <span className="text-muted-foreground/70">{unknownLabel}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasFiles && signals.every((s) => !s.value) && (
                  <div
                    className="flex items-start gap-2 rounded-lg border border-[color:var(--brand-border)] bg-accent px-3.5 py-2.5 text-xs leading-relaxed text-accent-foreground"
                    data-testid="text-ingestion-framework-repo-note"
                  >
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>
                      Repository files were fetched, but no application scaffold was detected. This often happens when auditing a framework or library repository instead of an app.
                    </span>
                  </div>
                )}

                {audit.fileTreeSample && audit.fileTreeSample.length > 0 && (
                  <div className="ink overflow-hidden rounded-xl border border-card-border bg-card" data-testid="file-tree-summary">
                    <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      <FolderTree className="w-3 h-3 text-primary" />
                      File tree
                      <span className="ml-auto font-mono normal-case tracking-normal text-muted-foreground/80">
                        {audit.fileCount ?? audit.fileTreeSample.length} paths
                        {audit.fileCount && audit.fileCount > audit.fileTreeSample.length
                          ? ` · showing ${audit.fileTreeSample.length}`
                          : ""}
                      </span>
                    </div>
                    <div className="max-h-48 space-y-0.5 overflow-y-auto px-3.5 py-3 font-mono text-xs text-muted-foreground">
                      {audit.fileTreeSample.map((path) => (
                        <div key={path} className="truncate" title={path}>
                          {path}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {audit.deploymentClues && audit.deploymentClues.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      <Rocket className="w-3.5 h-3.5" />
                      Deployment
                    </span>
                    {audit.deploymentClues.map((clue) => (
                      <Badge
                        key={clue}
                        variant="secondary"
                        className="font-mono text-xs"
                        data-testid={`clue-${clue.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`}
                      >
                        {clue}
                      </Badge>
                    ))}
                  </div>
                )}

                {errorNotice}
              </>
            ) : (
              <>
                {errorNotice}
                <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  No ingestion signals detected yet.
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>
    </Reveal>
  );
}

// Fire a one-shot celebration the first time we observe a `done` status for
// this audit in the current session. Re-mounting the page (e.g. via a refresh)
// will re-fire only if the audit was previously in a non-done state in this
// component instance, so refreshing a long-completed report doesn't spam.
function DoneCelebration({ status }: { status: string }) {
  const [trigger, setTrigger] = useState(false);
  const wasNonDoneRef = useRef(false);
  useEffect(() => {
    if (status !== "done") {
      wasNonDoneRef.current = true;
      return;
    }
    if (wasNonDoneRef.current) {
      setTrigger(true);
      wasNonDoneRef.current = false;
    }
  }, [status]);
  return <Celebration trigger={trigger} onDone={() => setTrigger(false)} />;
}

// Static mirror of GET /models used as placeholderData so the re-run menu
// renders instantly and still works when the API hasn't answered yet. In the
// fallback, premium (proOnly) entries are treated as locked until live data
// says otherwise. Keep this mapping in sync with the model selector.
const STATIC_MODELS_PLACEHOLDER: ModelsResponse = {
  models: STATIC_MODEL_CATALOG.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    provider: m.provider,
    tier: m.tier,
    proOnly: m.proOnly,
    isDefault: m.isDefault,
    available: !m.proOnly,
    lockReason: m.proOnly ? "pro-required" : null,
    blurb: m.blurb,
    contextLength: null,
    promptPricePerMTok: null,
    completionPricePerMTok: null,
  })),
  defaultModel: DEFAULT_MODEL_ID,
  live: false,
};

function RerunButton({
  auditId,
  status,
  currentModel,
}: {
  auditId: string;
  status: string;
  currentModel: string | null;
}) {
  const queryClient = useQueryClient();
  const rerun = useRerunAudit();
  const isError = status === "error";

  const { data: modelsData } = useListModels({
    query: {
      queryKey: getListModelsQueryKey(),
      placeholderData: STATIC_MODELS_PLACEHOLDER,
      staleTime: 60_000,
    },
  });
  const catalog = modelsData?.models ?? STATIC_MODELS_PLACEHOLDER.models;
  const defaultModel = modelsData?.defaultModel ?? DEFAULT_MODEL_ID;
  const effectiveModel = currentModel ?? defaultModel;
  const standardModels = catalog.filter((m) => m.tier === "standard");
  const proModels = catalog.filter((m) => m.tier === "premium");

  function handleRerun(model?: string) {
    rerun.mutate(
      { id: auditId, data: model ? { model } : {} },
      {
        onSuccess: () => {
          toast.success(
            model
              ? `Re-running with ${displayNameFor(model)}`
              : isError
                ? "Re-running with a fresh attempt"
                : "Refreshing analysis",
            { description: "Streaming new phases now…" },
          );
          queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
        },
        onError: (err) => {
          const message = err instanceof Error && err.message ? err.message : "Please try again.";
          toast.error("Could not re-run audit", { description: message });
        },
      },
    );
  }

  const renderModelItems = (models: typeof catalog) =>
    models.map((m) => {
      const locked = !m.available;
      return (
        <DropdownMenuItem
          key={m.id}
          disabled={locked || rerun.isPending}
          onSelect={() => handleRerun(m.id)}
          className="gap-2"
          data-testid={`menu-rerun-model-${m.id.replace(/[^a-z0-9.]+/gi, "-")}`}
        >
          <span className="truncate">Re-run with {m.displayName}</span>
          {m.id === effectiveModel && (
            <span className="shrink-0 text-[11px] text-muted-foreground">(current)</span>
          )}
          {locked && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1.5">
              <Lock className="w-3 h-3 text-muted-foreground" />
              {m.proOnly && (
                <Badge
                  variant="outline"
                  className="px-1.5 py-0 font-mono text-[10px] uppercase tracking-wider"
                >
                  Pro
                </Badge>
              )}
            </span>
          )}
        </DropdownMenuItem>
      );
    });

  return (
    <div className="inline-flex" data-testid="control-rerun-split">
      <Button
        variant="outline"
        size="sm"
        className="rounded-r-none"
        onClick={() => handleRerun()}
        disabled={rerun.isPending}
        data-testid="button-rerun-audit"
      >
        {rerun.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            Re-running…
          </>
        ) : (
          <>
            <RotateCcw className="w-4 h-4 mr-1.5" />
            {isError ? "Retry" : "Re-run"}
          </>
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="rounded-l-none border-l-0 px-2"
            disabled={rerun.isPending}
            aria-label="Re-run with a different model"
            data-testid="button-rerun-model-menu"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Standard
          </DropdownMenuLabel>
          {renderModelItems(standardModels)}
          {proModels.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Pro
              </DropdownMenuLabel>
              {renderModelItems(proModels)}
            </>
          )}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Re-running replaces this report.
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Anonymous viewers of a finished trial audit see the re-run control as
// visibly locked instead of hidden. Signing in adopts this audit into the
// account (adoptTrialAudits), which is what unlocks re-run.
function LockedRerunButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          <Button
            variant="outline"
            size="sm"
            disabled
            className="pointer-events-none"
            data-testid="button-rerun-audit-locked"
          >
            <Lock className="w-4 h-4 mr-1.5" />
            Re-run
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Sign in to re-run — this audit moves to your account.</TooltipContent>
    </Tooltip>
  );
}

// Conversion nudge for anonymous viewers of a finished trial audit. The
// 30-day figure matches the server's trial cookie TTL (TRIAL_TTL_MS in
// api-server lib/trial-access.ts). Signing in adopts trial audits into the
// new account (adoptTrialAudits, called from both auth callback paths), so
// promising "keep this report / audit" is literally true. The `failed`
// variant covers errored trial audits: signing in is also what unlocks
// re-run, which is exactly what a failed audit needs.
function TrialSignInBanner({ auditId, failed = false }: { auditId: string; failed?: boolean }) {
  const { login } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div
      className="relative flex flex-col gap-3 rounded-2xl border border-[color:var(--brand-border)] bg-accent px-5 py-4 pr-12 shadow-sm md:flex-row md:items-center md:justify-between"
      data-testid="banner-trial-signin"
    >
      <div className="flex items-start gap-3 text-sm">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-card text-primary">
          <Sparkles className="w-4 h-4" />
        </span>
        <div>
          <div className="font-medium text-foreground">
            {failed
              ? "This audit is tied to a 30-day browser cookie."
              : "This report is tied to a 30-day browser cookie."}
          </div>
          <div className="text-muted-foreground">
            {failed
              ? "Sign in to keep this audit — it moves to your account where you can re-run it."
              : "Sign in to keep it — this audit moves to your dashboard, with re-run and share links."}
          </div>
        </div>
      </div>
      <Button
        size="sm"
        className="shrink-0 self-start md:self-auto"
        onClick={() => login(`/audits/${auditId}`)}
        data-testid="button-trial-signin"
      >
        Sign in
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        data-testid="button-trial-signin-dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Show a soft "this is taking a while" hint after 2 minutes so users know the
// audit isn't dead. We don't auto-cancel — just nudge them toward the rerun
// path once it lands in a terminal state.
function StuckHint({ createdAt }: { createdAt: Date | string }) {
  const startedAt =
    typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const minutes = Math.floor((now - startedAt) / 60000);
  if (minutes < 2) return null;
  return (
    <Badge
      variant="outline"
      className="gap-1 border-amber-200 bg-amber-50 font-mono text-[10px] uppercase tracking-wider text-amber-700"
      data-testid="badge-stuck-hint"
    >
      <Clock className="w-3 h-3" />
      Taking longer than usual ({minutes}m)
    </Badge>
  );
}
