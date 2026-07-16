import {
  useGetReport,
  getGetReportQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PhaseSegmentTracker,
  PHASE_SEGMENTS,
  phasesForAuditStatus,
  segmentStates,
} from "@/components/live-stream";
import { AlertCircle, Sparkles } from "lucide-react";
import { ReportView } from "@/components/report-view";
import { ReportActions } from "@/components/report-actions";
import type { AuditContext } from "@/lib/markdown-export";

export function ReportPanel({
  auditId,
  status,
  audit,
  allowOwnerActions = true,
}: {
  auditId: string;
  status: string;
  audit: AuditContext;
  allowOwnerActions?: boolean;
}) {
  const enabled = status === "done";
  const { data: report, isLoading, error } = useGetReport(auditId, {
    query: {
      enabled,
      queryKey: getGetReportQueryKey(auditId),
    },
  });

  if (status === "pending" || status === "running") {
    return (
      <Card className="border-card-border bg-card" data-testid="card-report-waiting-ingest">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
              <Sparkles className="w-4 h-4" />
            </span>
            Analysis Report
          </CardTitle>
          <CardDescription>Waiting for ingestion to finish before analysis can start.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "ingested" || status === "analyzing") {
    // Same phase logic as the live stream tracker, derived from the persisted
    // status, so the two indicators can never contradict each other.
    const phases = phasesForAuditStatus(status);
    const activeIdx = segmentStates(phases).indexOf("active");
    const activeLabel = activeIdx >= 0 ? PHASE_SEGMENTS[activeIdx].label : "Preparing";
    return (
      <Card className="border-card-border bg-card" data-testid="card-report-analyzing">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </span>
            Analyzing your change…
          </CardTitle>
          <CardDescription>
            We&apos;re reasoning about your stack and the proposed change. This usually takes 30–90 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2" data-testid="section-report-progress">
            <PhaseSegmentTracker phases={phases} testIdPrefix="report" />
            <div className="flex items-center justify-between eyebrow">
              <span>{activeLabel}</span>
              <span>Usually 30-90s</span>
            </div>
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="border-red-200 bg-red-50" data-testid="card-report-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-700">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-card text-red-600">
              <AlertCircle className="w-4 h-4" />
            </span>
            Analysis failed
          </CardTitle>
          <CardDescription className="text-red-700/80">
            We couldn&apos;t complete the analysis for this audit. Try creating a new audit.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!enabled) return null;

  if (isLoading) {
    return (
      <Card className="border-card-border bg-card">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !report) {
    return (
      <Card className="border-red-200 bg-red-50" data-testid="card-report-load-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-700">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-card text-red-600">
              <AlertCircle className="w-4 h-4" />
            </span>
            Could not load report
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <ReportView
      report={report}
      audit={audit}
      actions={<ReportActions report={report} audit={audit} canShare={allowOwnerActions} />}
    />
  );
}
