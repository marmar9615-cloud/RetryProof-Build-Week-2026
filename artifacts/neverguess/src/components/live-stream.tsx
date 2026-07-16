import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Check, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type PhaseEvent = { ts: number; phase: string; message: string };

const PHASE_LABEL: Record<string, string> = {
  ingesting: "Ingesting",
  "detecting-stack": "Detecting stack",
  "calling-llm": "Calling model",
  "running-smoke": "Smoke test",
  done: "Done",
  error: "Failed",
};

/**
 * The four pipeline stages as the tracker shows them, in display order.
 * Keys are the exact phase strings published by the api-server sse-bus
 * (see AuditPhase in api-server/src/lib/sse-bus.ts).
 */
export const PHASE_SEGMENTS = [
  { key: "ingesting", label: "Ingest" },
  { key: "detecting-stack", label: "Detect stack" },
  { key: "running-smoke", label: "Smoke test" },
  { key: "calling-llm", label: "Model analysis" },
] as const;

export type SegmentState = "completed" | "active" | "upcoming";

// Rank of each phase along the tracker. done/error sit past the last segment
// so every segment reads completed once the run finishes.
const SEGMENT_RANK: Record<string, number> = {
  ingesting: 0,
  "detecting-stack": 1,
  "running-smoke": 2,
  "calling-llm": 3,
  done: 4,
  error: 4,
};

/**
 * Derive per-segment tracker state from the set of phases observed so far.
 * Monotonic — phases can arrive out of order over the wire (e.g., smoke
 * completes after the model call starts), but the tracker never steps back.
 */
export function segmentStates(phases: Iterable<string>): SegmentState[] {
  let highest = -1;
  for (const p of phases) highest = Math.max(highest, SEGMENT_RANK[p] ?? -1);
  return PHASE_SEGMENTS.map((_, i) =>
    i < highest ? "completed" : i === highest ? "active" : "upcoming",
  );
}

/**
 * Map an audit's persisted status to the phases it implies, so surfaces
 * without an event stream (e.g., ReportPanel) derive tracker state from the
 * same logic and can never contradict the live view.
 */
export function phasesForAuditStatus(status: string): string[] {
  switch (status) {
    case "running":
      return ["ingesting"];
    case "ingested":
      return ["ingesting", "detecting-stack"];
    case "analyzing":
      // The runner publishes calling-llm as soon as analysis starts.
      return ["ingesting", "detecting-stack", "calling-llm"];
    case "done":
    case "error":
      return [status];
    default:
      return [];
  }
}

/** Shared 4-segment phase tracker: Ingest → Detect stack → Smoke test → Model analysis. */
export function PhaseSegmentTracker({
  phases,
  testIdPrefix,
}: {
  phases: Iterable<string>;
  testIdPrefix: string;
}) {
  const states = segmentStates(phases);
  return (
    <ol
      className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4"
      data-testid={`tracker-${testIdPrefix}-phases`}
    >
      {PHASE_SEGMENTS.map((seg, i) => {
        const state = states[i];
        return (
          <li
            key={seg.key}
            className="space-y-1.5"
            data-state={state}
            data-testid={`segment-${testIdPrefix}-${seg.key}`}
          >
            <span
              aria-hidden="true"
              className={`block h-0.5 rounded-full ${
                state === "completed"
                  ? "bg-primary"
                  : state === "active"
                    ? "bg-primary/50"
                    : "bg-border"
              }`}
            />
            <span
              className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest ${
                state === "active"
                  ? "text-primary"
                  : state === "completed"
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60"
              }`}
            >
              {state === "completed" ? (
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                </span>
              ) : state === "active" ? (
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                </span>
              ) : (
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full border border-border" />
                </span>
              )}
              {seg.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// Sections of the finished report, mirrored from report-view.tsx so the
// checklist only promises what the report actually renders.
const REPORT_CHECKLIST = [
  { key: "risk-score", label: "Risk score & verdict" },
  { key: "architecture", label: "Architecture summary & graph" },
  { key: "risky-assumptions", label: "Risky assumptions" },
  { key: "acceptance-criteria", label: "Acceptance criteria" },
  { key: "prompt-pack", label: "Safer prompt pack" },
  { key: "test-plan", label: "Test plan" },
] as const;

function ElapsedClock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <Badge
      variant="outline"
      className="border-card-border bg-card text-muted-foreground tabular-nums uppercase text-[10px] tracking-wider"
      data-testid="badge-live-elapsed"
    >
      <Clock className="w-3 h-3 mr-1" />
      {seconds}s
    </Badge>
  );
}

export function LiveStream({
  auditId,
  status,
  createdAt,
}: {
  auditId: string;
  status: string;
  createdAt?: string | Date;
}) {
  const [events, setEvents] = useState<PhaseEvent[]>([]);
  const [closed, setClosed] = useState(false);
  const initialStartedAt =
    createdAt == null
      ? Date.now()
      : typeof createdAt === "string"
        ? new Date(createdAt).getTime()
        : createdAt.getTime();
  const [startedAt, setStartedAt] = useState<number>(() => initialStartedAt);
  const esRef = useRef<EventSource | null>(null);
  const seenEventsRef = useRef<Set<string>>(new Set());
  const logRef = useRef<HTMLOListElement | null>(null);
  // Whether the user is pinned to the bottom of the log (true until they scroll up).
  const pinnedRef = useRef(true);

  useEffect(() => {
    if (!auditId) return;
    setEvents([]);
    setClosed(false);
    setStartedAt(Number.isFinite(initialStartedAt) ? initialStartedAt : Date.now());
    seenEventsRef.current = new Set();
    pinnedRef.current = true;
    const es = new EventSource(`/api/audits/${auditId}/events`);
    esRef.current = es;
    es.addEventListener("phase", (ev) => {
      try {
        const data: PhaseEvent = JSON.parse((ev as MessageEvent).data);
        const key = `${data.ts}:${data.phase}:${data.message}`;
        if (seenEventsRef.current.has(key)) return;
        seenEventsRef.current.add(key);
        setEvents((prev) => [...prev, data]);
      } catch {
        // ignore
      }
    });
    es.addEventListener("end", () => {
      setClosed(true);
      es.close();
    });
    // Don't close on transient errors — let EventSource auto-reconnect.
    // Buffered replay on the server side will fill any missed events.
    es.onerror = () => {
      // Surface "reconnecting" state but keep the connection alive.
      setClosed(false);
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [auditId, initialStartedAt]);

  const latest = events[events.length - 1];

  // Tracker input: phases implied by the persisted status (so the tracker is
  // meaningful before/without the stream) merged with phases actually seen.
  const seenPhases = useMemo(() => {
    const set = new Set(phasesForAuditStatus(status));
    for (const e of events) set.add(e.phase);
    return set;
  }, [status, events]);

  // Auto-scroll the log to the newest entry, but only while the user hasn't
  // scrolled up to read earlier lines.
  useEffect(() => {
    const el = logRef.current;
    if (!el || !pinnedRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [events.length]);

  if (status === "done" || status === "error") return null;

  const analysisStarted = status === "analyzing" || seenPhases.has("calling-llm");
  const reportReady = seenPhases.has("done");
  return (
    <Card
      className="ink overflow-hidden border-card-border bg-card shadow-lg ring-brand-glow"
      data-testid="card-live-stream"
    >
      {/* Live analysis log header. */}
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span>analyzer · live</span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
            closed
              ? "border-border bg-muted text-muted-foreground"
              : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
          }`}
          data-testid="badge-live-connection"
        >
          {!closed && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
          )}
          {closed ? "Closed" : "Streaming"}
        </span>
      </div>

      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          Live phase
          {latest && (
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary uppercase text-[10px] tracking-wider"
              data-testid="badge-live-phase"
            >
              {PHASE_LABEL[latest.phase] ?? latest.phase}
            </Badge>
          )}
          {!closed && <ElapsedClock startedAt={startedAt} />}
        </CardTitle>
        <CardDescription>
          Streaming progress from the analyzer. {closed ? "Stream closed." : "Connected."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div data-testid="section-live-progress">
          <PhaseSegmentTracker phases={seenPhases} testIdPrefix="live" />
        </div>

        {analysisStarted && (
          <div className="space-y-2" data-testid="section-report-checklist">
            <p className="eyebrow">Your report will include</p>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {REPORT_CHECKLIST.map(({ key, label }) => (
                <li
                  key={key}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                  data-testid={`item-report-section-${key}`}
                >
                  {reportReady ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full border border-border" />
                    </span>
                  )}
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Log readout — mono lines with elapsed offsets, like terminal output. */}
        <ol
          ref={logRef}
          onScroll={() => {
            const el = logRef.current;
            if (!el) return;
            pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
          className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-xs"
          data-testid="list-live-events"
        >
          {events.length === 0 ? (
            <li className="space-y-1.5" data-testid="live-events-skeleton">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </li>
          ) : (
            events.map((e, i) => {
              const offsetSec = Math.max(0, Math.round((e.ts - startedAt) / 1000));
              return (
                <li
                  key={i}
                  className="flex items-start gap-2"
                  data-testid={`item-live-event-${i}`}
                >
                  {e.phase === "done" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  ) : e.phase === "error" ? (
                    <AlertCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 mt-0.5 inline-flex items-center justify-center shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </span>
                  )}
                  <span
                    className="text-[10px] text-muted-foreground tabular-nums w-10 shrink-0 mt-0.5"
                    data-testid={`item-live-event-${i}-ts`}
                    title={new Date(e.ts).toLocaleTimeString()}
                  >
                    +{offsetSec}s
                  </span>
                  <span className="text-muted-foreground">
                    <span className="text-foreground">{PHASE_LABEL[e.phase] ?? e.phase}</span>
                    {" — "}
                    {e.message}
                  </span>
                </li>
              );
            })
          )}
        </ol>
      </CardContent>
    </Card>
  );
}

export function LivePhaseChip({ auditId }: { auditId: string }) {
  const [phase, setPhase] = useState<string | null>(null);
  useEffect(() => {
    const es = new EventSource(`/api/audits/${auditId}/events`);
    es.addEventListener("phase", (ev) => {
      try {
        const data: PhaseEvent = JSON.parse((ev as MessageEvent).data);
        setPhase(data.phase);
      } catch {
        // ignore
      }
    });
    es.addEventListener("end", () => es.close());
    // Allow EventSource to auto-reconnect on transient errors.
    return () => es.close();
  }, [auditId]);
  if (!phase) return null;
  return (
    <Badge
      variant="outline"
      className="border-primary/30 bg-primary/5 text-primary font-mono uppercase text-[10px] tracking-wider"
      data-testid={`chip-live-phase-${auditId}`}
    >
      <Activity className="w-3 h-3 mr-1 animate-pulse" />
      {PHASE_LABEL[phase] ?? phase}
    </Badge>
  );
}
