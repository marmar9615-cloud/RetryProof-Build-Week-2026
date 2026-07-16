import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  MinusCircle,
  XCircle,
} from "lucide-react";
import type {
  Report,
  SmokeCheck,
  SmokeCheckStatus,
} from "@workspace/api-client-react";

const statusVisual: Record<
  SmokeCheckStatus,
  { color: string; iconColor: string; Icon: typeof CheckCircle2; label: string }
> = {
  pass: {
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconColor: "text-emerald-600",
    Icon: CheckCircle2,
    label: "Pass",
  },
  warn: {
    color: "bg-amber-50 text-amber-700 border-amber-200",
    iconColor: "text-amber-600",
    Icon: AlertTriangle,
    label: "Warn",
  },
  fail: {
    color: "bg-red-50 text-red-700 border-red-200",
    iconColor: "text-red-600",
    Icon: XCircle,
    label: "Fail",
  },
  skip: {
    color: "bg-secondary text-muted-foreground border-card-border",
    iconColor: "text-muted-foreground",
    Icon: MinusCircle,
    label: "Skipped",
  },
};

function CheckCard({ check, idx }: { check: SmokeCheck; idx: number }) {
  const visual = statusVisual[check.status] ?? statusVisual.skip;
  const Icon = visual.Icon;
  return (
    <div
      className="rounded-xl border border-card-border bg-card p-4 shadow-sm"
      data-testid={`item-smoke-check-${idx}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${visual.iconColor}`} />
          <h4 className="font-semibold text-sm text-foreground">{check.label}</h4>
        </div>
        <Badge
          variant="outline"
          className={`${visual.color} font-mono text-[10px] uppercase tracking-wider`}
        >
          {visual.label}
        </Badge>
      </div>
      {check.metric && (
        <div className="text-xs font-mono text-muted-foreground mb-1">
          {check.metric}
        </div>
      )}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {check.detail}
      </p>
    </div>
  );
}

export function LiveAppHealth({ report }: { report: Report }) {
  const [openLightbox, setOpenLightbox] = useState(false);
  const smoke = report.smokeTestResults;
  if (!smoke) return null;

  return (
    <Card className="rounded-2xl" data-testid="section-live-health">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-card-border bg-secondary text-primary">
                <Activity className="w-4 h-4" />
              </span>
              Live App Health
            </CardTitle>
            <CardDescription className="mt-1.5 break-all">
              Smoke test results for{" "}
              <span className="font-mono text-xs text-foreground">{smoke.url}</span>
            </CardDescription>
          </div>
          {smoke.skipped && (
            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
              Skipped
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {smoke.checks.map((c, idx) => (
          <CheckCard key={c.id ?? idx} check={c} idx={idx} />
        ))}

        {report.smokeScreenshotUrl && (
          <Dialog open={openLightbox} onOpenChange={setOpenLightbox}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="block w-full rounded-xl overflow-hidden border border-card-border shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-[color:var(--brand-border)] hover:shadow-md"
                data-testid="button-open-screenshot"
              >
                <div className="relative">
                  <img
                    src={report.smokeScreenshotUrl}
                    alt="Live app screenshot"
                    className="w-full h-auto object-cover max-h-64"
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur">
                    <ImageIcon className="w-3 h-3" />
                    Click to enlarge
                  </div>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl">
              <DialogTitle>Live app screenshot</DialogTitle>
              <img
                src={report.smokeScreenshotUrl}
                alt="Live app screenshot"
                className="w-full h-auto rounded-md"
                data-testid="img-screenshot-full"
              />
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
