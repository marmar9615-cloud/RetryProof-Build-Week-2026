import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Code2,
  Download,
  FlaskConical,
  GitCompareArrows,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  Wrench,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RETRYPROOF } from "@/data/retryproof";
import { useMetaTags } from "@/lib/use-meta-tags";
import { cn } from "@/lib/utils";
import {
  ProofFlightRecorder,
  repairProvenanceLabel,
  seededSyntheticStake,
  validatorCheckLabel,
  type ProofCanonical,
} from "./retryproof-proof-flight-recorder";

const API = "/api/retryproof/v1";
const STEPS = ["Import", "Contract", "Break", "Repair", "Evidence"] as const;
const LIVE_REPAIR_STAGES = [
  { id: "request_authenticated", label: "Proof bound" },
  { id: "worker_accepted", label: "Worker accepted" },
  { id: "codex_running", label: "Codex running" },
  { id: "candidate_received", label: "Candidate received" },
  { id: "deterministic_validation", label: "Deterministic gate" },
] as const;

export const RAW_PATCH_CONTAINMENT_CLASSES = {
  grid: "grid min-w-0 gap-4 md:grid-cols-[1fr_1.2fr]",
  details: "min-w-0 max-w-full overflow-hidden rounded-xl border border-violet-950 bg-[#0b0a12] text-violet-100",
  pre: "max-h-72 max-w-full overflow-x-auto border-t border-violet-800 p-4 text-[11px] leading-relaxed",
  code: "block w-max min-w-full whitespace-pre",
} as const;

type LiveRepairStage = typeof LIVE_REPAIR_STAGES[number]["id"];
type LiveRepairEvent = {
  stage: LiveRepairStage;
  message: string;
  elapsedMs: number | null;
};

type Workflow = {
  id: string;
  name: string;
  sourceHash: string;
  demoSeed: boolean;
  canonical: ProofCanonical;
  compatibility: { canExecute: boolean; coverage: { supported: number; total: number }; unsupportedNodeIds: string[] };
  credentialReferencesRemoved: number;
  fixture: Record<string, unknown>;
};

type Analysis = {
  id: string;
  planHash: string;
  sideEffect: { nodeId: string; nodeName: string; effectId: string; method: string; url: string; businessKeyPath: string };
  invariant: {
    statement: string;
    approved: boolean;
    oracle: { type: string; effectId: string; keyPath: string; maxCount: number };
  };
  scenarios: Array<{ id: string; label: string; faultPhase: string; deliveries: number }>;
  provenance: {
    mode: "cached" | "live" | "deterministic-fallback";
    model: string;
    label: string;
    sourceRepository: string;
    sourceCommit: string;
  };
};

type Execution = {
  id: string;
  analysisId: string;
  phase: "before" | "after";
  seed: string;
  suiteHash: string;
  passed: boolean;
  effectCount: number;
  effectKey: string;
  deliveries: number;
  scenarioId: string;
  workflowHash: string;
  traces: Array<{ delivery: number; event: string; detail: string; effectCount: number }>;
  scenarioResults: Array<{ scenarioId: string; label: string; faultPhase: string; passed: boolean; effectCount: number; traces: Execution["traces"] }>;
};

type Repair = {
  id: string;
  sourceHash: string;
  repairedWorkflowHash: string;
  strategy: string;
  changedNodeIds: string[];
  explanation: string;
  patch: Array<{ op: string; path: string; value: unknown }>;
  patchedCanonical: ProofCanonical;
  regressionFixture: { seed: string; scenarioIds: string[]; invariantId: string; sourceSuiteHash: string };
  validation: { passed: true; checks: string[] };
  provenance: {
    mode: "cached" | "bounded-template" | "live-codex";
    generatedBy: "cached-template" | "validated-template" | "codex";
    label: string;
    sourceRepository: string;
    sourceCommit: string;
    requestId?: string;
    threadId?: string;
    attempts?: number;
    generatedAt?: string;
  };
};

type Artifact = {
  id: string;
  sha256: string;
  receipt: {
    schemaVersion: string;
    claim: string;
    workflow: { id: string; name: string; sourceHash: string };
    invariant: Record<string, unknown>;
    scenario: { ids: string[]; seed: string; deliveries: number };
    before: { passed: boolean; effectCount: number; suiteHash: string };
    after: { passed: boolean; effectCount: number; suiteHash: string };
    repair: { strategy: string; changedNodeIds: string[]; sourceHash: string; repairedWorkflowHash: string };
    modelArtifacts: { analysis: string; repair: string; deterministicValidation: string };
    limitations: string[];
    generatedAt: string;
  };
};

type LabState = {
  workflow?: Workflow;
  analysis?: Analysis;
  approved?: Analysis;
  before?: Execution;
  repair?: Repair;
  after?: Execution;
  artifact?: Artifact;
};

type LabSession = {
  csrfToken: string;
  expiresAt: string;
  retentionHours: number;
  state: LabState;
};

type Readiness = {
  liveCodexConfigured: boolean;
};

class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly paths: string[] = []) {
    super(message);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as {
    error?: { code?: string; message?: string; details?: { paths?: string[] } };
  } | null;
  if (!response.ok) {
    throw new ApiError(
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.message ?? "RetryProof could not complete the request.",
      body?.error?.details?.paths ?? [],
    );
  }
  return body as T;
}

function shortHash(value?: string): string {
  return value ? `${value.slice(0, 10)}…${value.slice(-6)}` : "—";
}

function analysisProvenanceLabel(mode: Analysis["provenance"]["mode"]): string {
  if (mode === "live") return "Live GPT-5.6 proposal";
  if (mode === "deterministic-fallback") return "Grounded deterministic fallback";
  return "GPT-5.6-informed seeded contract";
}

export function analysisBadgeLabel(mode?: Analysis["provenance"]["mode"]): string {
  if (mode === "live") return "Live GPT-5.6";
  if (mode === "cached") return "Seeded · cached";
  if (mode === "deterministic-fallback") return "Grounded fallback";
  return "Proposal only";
}

export function stageFor(state: LabState): number {
  if (state.artifact) return 5;
  if (state.repair || state.before) return 4;
  if (state.approved) return 3;
  if (state.analysis) return 2;
  return 1;
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-card-border bg-card shadow-sm", className)}>{children}</section>;
}

function LabelPill({ children, tone = "iris" }: { children: React.ReactNode; tone?: "iris" | "green" | "red" | "amber" | "neutral" }) {
  const tones = {
    iris: "border-violet-200 bg-violet-50 text-violet-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    neutral: "border-border bg-secondary text-muted-foreground",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide", tones[tone])}>{children}</span>;
}

function TraceList({ execution }: { execution: Execution }) {
  return (
    <ol className="space-y-3" aria-label={`${execution.phase} execution trace`}>
      {execution.traces.map((trace, index) => (
        <li key={`${trace.delivery}-${trace.event}`} className="grid grid-cols-[30px_1fr_auto] items-start gap-3 rounded-xl border border-border bg-background/70 p-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary font-mono text-xs font-semibold">{index + 1}</span>
          <div>
            <div className="font-mono text-xs font-semibold text-foreground">{trace.event}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Delivery {trace.delivery} · {trace.detail}</p>
          </div>
          <LabelPill tone={trace.effectCount > 1 ? "red" : "neutral"}>{trace.effectCount} effect{trace.effectCount === 1 ? "" : "s"}</LabelPill>
        </li>
      ))}
    </ol>
  );
}

export default function RetryProofLab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const importStepRef = useRef<HTMLDivElement>(null);
  const contractStepRef = useRef<HTMLDivElement>(null);
  const breakStepRef = useRef<HTMLDivElement>(null);
  const repairStepRef = useRef<HTMLDivElement>(null);
  const evidenceStepRef = useRef<HTMLDivElement>(null);
  const shouldScrollToStepRef = useRef(false);
  const [session, setSession] = useState<LabSession | null>(null);
  const [readiness, setReadiness] = useState<Readiness>({ liveCodexConfigured: false });
  const [state, setState] = useState<LabState>({});
  const [busy, setBusy] = useState<string | null>("session");
  const [error, setError] = useState<ApiError | null>(null);
  const [approved, setApproved] = useState(false);
  const [statement, setStatement] = useState("");
  const [seed, setSeed] = useState("demo-v1");
  const [fixtureText, setFixtureText] = useState(JSON.stringify({ event: { id: "evt_example_1" } }, null, 2));
  const [liveEvents, setLiveEvents] = useState<LiveRepairEvent[]>([]);
  const [liveStatus, setLiveStatus] = useState<"running" | "complete" | "failed" | null>(null);
  const [liveStartedAt, setLiveStartedAt] = useState<number | null>(null);
  const [liveElapsedMs, setLiveElapsedMs] = useState(0);
  const [resumedSession, setResumedSession] = useState(false);

  useMetaTags({
    title: "RetryProof Lab | MarMar Labs",
    description: "Run a deterministic retry failure flight test, approve its invariant, validate a bounded repair, and export evidence.",
    canonicalUrl: "https://marmarlabs.com/retryproof/lab",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
    ogImageAlt: "RetryProof workflow flight test lab",
  });

  const step = stageFor(state);
  const analysis = state.approved ?? state.analysis;
  const syntheticStake = seededSyntheticStake(state.workflow);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${API}/ready`, { credentials: "same-origin" })
      .then((response) => parseResponse<Readiness>(response))
      .then((next) => { if (!cancelled) setReadiness(next); })
      .catch(() => undefined);
    void fetch(`${API}/session`, { credentials: "same-origin" })
      .then((response) => parseResponse<{ session: LabSession }>(response))
      .then(({ session: next }) => {
        if (cancelled) return;
        const restoredState = next.state ?? {};
        setSession(next);
        setState(restoredState);
        setStatement(restoredState.analysis?.invariant.statement ?? restoredState.approved?.invariant.statement ?? "");
        setApproved(Boolean(restoredState.approved));
        setResumedSession(Boolean(restoredState.workflow));
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught : new ApiError("SESSION_FAILED", "The anonymous lab session could not be established."));
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (liveStatus !== "running" || liveStartedAt === null) return;
    const updateElapsed = () => setLiveElapsedMs(Date.now() - liveStartedAt);
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(timer);
  }, [liveStartedAt, liveStatus]);

  useEffect(() => {
    if (!shouldScrollToStepRef.current) return;
    shouldScrollToStepRef.current = false;
    const targets = [importStepRef, contractStepRef, breakStepRef, repairStepRef, evidenceStepRef];
    const target = targets[step - 1]?.current;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!session) throw new ApiError("SESSION_REQUIRED", "The anonymous session is still loading.");
    setError(null);
    const response = await fetch(`${API}${path}`, {
      credentials: "same-origin",
      ...options,
      headers: {
        "content-type": "application/json",
        "x-csrf-token": session.csrfToken,
        ...options.headers,
      },
    });
    return parseResponse<T>(response);
  }

  async function act<T>(name: string, operation: () => Promise<T>, onSuccess: (result: T) => void): Promise<void> {
    setResumedSession(false);
    setBusy(name);
    try {
      const result = await operation();
      shouldScrollToStepRef.current = true;
      onSuccess(result);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError("REQUEST_FAILED", "RetryProof could not complete the request."));
    } finally {
      setBusy(null);
    }
  }

  function recordLiveEvent(event: LiveRepairEvent): void {
    setLiveEvents((current) => {
      const existing = current.findIndex((item) => item.stage === event.stage);
      if (existing < 0) return [...current, event];
      return current.map((item, index) => index === existing ? event : item);
    });
  }

  async function createLiveRepair(): Promise<void> {
    if (!state.approved || !session) return;
    setBusy("repair-live");
    setError(null);
    setLiveEvents([]);
    setLiveStatus("running");
    setLiveElapsedMs(0);
    setLiveStartedAt(Date.now());
    let completed = false;
    try {
      const response = await fetch(`${API}/analyses/${state.approved.id}/repairs`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          accept: "application/x-ndjson",
          "content-type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ mode: "live" }),
      });
      if (!response.ok) await parseResponse(response);
      if (!response.body || !response.headers.get("content-type")?.includes("application/x-ndjson")) {
        throw new ApiError("LIVE_STREAM_UNAVAILABLE", "The live Codex progress stream was unavailable. No repair was accepted.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consumeLine = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as {
          type?: string;
          stage?: string;
          message?: string;
          elapsedMs?: number | null;
          repair?: Repair;
          error?: { code?: string; message?: string; details?: { paths?: string[] } };
        };
        if (event.type === "progress" && LIVE_REPAIR_STAGES.some((stage) => stage.id === event.stage)
          && typeof event.message === "string") {
          recordLiveEvent({
            stage: event.stage as LiveRepairStage,
            message: event.message,
            elapsedMs: typeof event.elapsedMs === "number" ? event.elapsedMs : null,
          });
          return;
        }
        if (event.type === "complete" && event.repair?.provenance.mode === "live-codex") {
          completed = true;
          setState({ ...state, repair: event.repair });
          setLiveStatus("complete");
          return;
        }
        if (event.type === "error") {
          throw new ApiError(
            event.error?.code ?? "LIVE_REPAIR_FAILED",
            event.error?.message ?? "The live Codex repair did not pass the acceptance boundary.",
            event.error?.details?.paths ?? [],
          );
        }
        throw new ApiError("LIVE_STREAM_INVALID", "RetryProof received an invalid live progress event. No repair was accepted.");
      };
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          consumeLine(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
        }
      }
      buffer += decoder.decode();
      consumeLine(buffer);
      if (!completed) throw new ApiError("LIVE_STREAM_INCOMPLETE", "The live Codex stream ended before a repair passed validation.");
    } catch (caught) {
      setLiveStatus("failed");
      setError(caught instanceof ApiError ? caught : new ApiError("LIVE_REPAIR_FAILED", "The live Codex repair could not be completed. The validated fallback is still available."));
    } finally {
      setBusy(null);
    }
  }

  async function loadDemo(): Promise<void> {
    await act("import", () => request<{ workflow: Workflow }>("/workflows", {
      method: "POST",
      body: JSON.stringify({ demo: true }),
    }), ({ workflow }) => {
      setState({ workflow });
      setApproved(false);
      setStatement("");
    });
  }

  async function uploadWorkflow(file: File): Promise<void> {
    if (file.size > 1024 * 1024) {
      setError(new ApiError("WORKFLOW_TOO_LARGE", "Workflow JSON must be 1 MB or smaller."));
      return;
    }
    const rawWorkflow = await file.text();
    let fixture: unknown;
    try {
      fixture = JSON.parse(fixtureText);
    } catch {
      setError(new ApiError("INVALID_FIXTURE", "The synthetic fixture must be valid JSON before choosing a workflow."));
      return;
    }
    await act("upload", () => request<{ workflow: Workflow }>("/workflows", {
      method: "POST",
      body: JSON.stringify({ rawWorkflow, fixture }),
    }), ({ workflow }) => {
      setState({ workflow });
      setApproved(false);
      setStatement("");
    });
  }

  async function analyze(): Promise<void> {
    if (!state.workflow) return;
    const workflow = state.workflow;
    await act("analysis", () => request<{ analysis: Analysis }>(`/workflows/${workflow.id}/analyses`, {
      method: "POST",
      body: JSON.stringify({ mode: workflow.demoSeed ? "cached" : "auto" }),
    }), ({ analysis: next }) => {
      setState({ workflow, analysis: next });
      setStatement(next.invariant.statement);
      setApproved(false);
    });
  }

  async function approveContract(): Promise<void> {
    if (!state.analysis) return;
    await act("approval", () => request<{ analysis: Analysis }>(`/analyses/${state.analysis!.id}/plan`, {
      method: "PATCH",
      headers: { "if-match": state.analysis!.planHash },
      body: JSON.stringify({ approved, statement }),
    }), ({ analysis: next }) => {
      setState({ workflow: state.workflow, analysis: state.analysis, approved: next });
    });
  }

  async function runFailure(): Promise<void> {
    if (!state.approved) return;
    await act("execution", async () => {
      await request(`/analyses/${state.approved!.id}/scenarios`, { method: "POST", body: "{}" });
      return request<{ execution: Execution }>(`/analyses/${state.approved!.id}/executions`, {
        method: "POST",
        body: JSON.stringify({ phase: "before", seed }),
      });
    }, ({ execution }) => setState({ ...state, before: execution }));
  }

  async function createRepair(mode: "live" | "cached"): Promise<void> {
    if (!state.approved) return;
    if (mode === "live") {
      await createLiveRepair();
      return;
    }
    setLiveEvents([]);
    setLiveStatus(null);
    setLiveStartedAt(null);
    await act("repair-cached", () => request<{ repair: Repair }>(`/analyses/${state.approved!.id}/repairs`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    }), ({ repair }) => setState({ ...state, repair }));
  }

  async function recheck(): Promise<void> {
    if (!state.repair) return;
    await act("recheck", () => request<{ execution: Execution; artifact: Artifact }>(`/repairs/${state.repair!.id}/recheck`, {
      method: "POST",
      body: "{}",
    }), ({ execution, artifact }) => setState({ ...state, after: execution, artifact }));
  }

  async function reset(): Promise<void> {
    await act("reset", async () => {
      await request<{ deleted: boolean }>("/session", { method: "DELETE", body: "{}" });
      const response = await fetch(`${API}/session`, { credentials: "same-origin" });
      return parseResponse<{ session: LabSession }>(response);
    }, ({ session: next }) => {
      setSession(next);
      setState({});
      setApproved(false);
      setStatement("");
      setSeed("demo-v1");
      setFixtureText(JSON.stringify({ event: { id: "evt_example_1" } }, null, 2));
      setLiveEvents([]);
      setLiveStatus(null);
      setLiveStartedAt(null);
      setLiveElapsedMs(0);
      setResumedSession(false);
    });
  }

  const evidenceDownload = state.artifact ? `${API}/artifacts/${state.artifact.id}/download` : "";
  const expires = useMemo(() => session ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(session.expiresAt)) : "—", [session]);
  const currentLiveStage = liveEvents.at(-1)?.stage;
  const currentLiveStageIndex = Math.max(0, LIVE_REPAIR_STAGES.findIndex((stage) => stage.id === currentLiveStage));
  const liveProgressPercent = liveStatus === "complete"
    ? 100
    : Math.max(8, ((currentLiveStageIndex + 1) / LIVE_REPAIR_STAGES.length) * 100);
  const liveElapsedSeconds = Math.max(0, Math.floor(liveElapsedMs / 1_000));

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/retryproof" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Product page
            </Link>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden font-display text-lg font-semibold sm:block">RetryProof Lab</span>
          </div>
          <div className="flex items-center gap-2">
            <LabelPill tone="green"><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />{RETRYPROOF.labModeLabel}</LabelPill>
            <Button variant="ghost" size="sm" onClick={() => void reset()} disabled={!session || busy !== null}>
              <RefreshCw className="h-3.5 w-3.5" /> Start over
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <section className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="eyebrow text-primary">Workflow flight test · anonymous judge path</div>
              {syntheticStake && <LabelPill tone="red">Seeded demo · synthetic {syntheticStake} refund</LabelPill>}
            </div>
            <h1 className="mt-3 max-w-4xl text-balance font-display text-4xl font-semibold tracking-tight md:text-6xl">
              Reproduce the retry bug. Repair it. Prove the same scenario turns green.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
              RetryProof verifies a user-approved invariant against a declared deterministic fault model. It never executes uploaded workflow code or makes real network, payment, SQL, or shell calls.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs">
            <div className="bg-card px-4 py-3"><div className="text-muted-foreground">Session access</div><div className="mt-1 font-mono font-semibold">24 hours</div></div>
            <div className="bg-card px-4 py-3"><div className="text-muted-foreground">Expires near</div><div className="mt-1 font-mono font-semibold">{expires}</div></div>
          </div>
        </section>

        <nav className="mt-10 overflow-x-auto pb-2" aria-label="RetryProof progress">
          <ol className="flex min-w-[680px] overflow-hidden rounded-xl border border-border bg-card">
            {STEPS.map((label, index) => {
              const number = index + 1;
              const complete = step > number;
              const current = step === number;
              return (
                <li key={label} className={cn("flex flex-1 items-center gap-3 border-r border-border px-4 py-3 last:border-r-0", current && "bg-violet-50")} aria-current={current ? "step" : undefined}>
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold", complete ? "border-emerald-600 bg-emerald-600 text-white" : current ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground")}>
                    {complete ? <Check className="h-3.5 w-3.5" /> : number}
                  </span>
                  <span className={cn("text-sm font-medium", !current && !complete && "text-muted-foreground")}>{label}</span>
                  {index < STEPS.length - 1 && <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/50" />}
                </li>
              );
            })}
          </ol>
        </nav>

        {resumedSession && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-violet-950 sm:flex-row sm:items-center sm:justify-between" role="status">
            <div className="flex items-start gap-3">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="text-sm font-semibold">Resumed your anonymous session</div>
                <p className="mt-0.5 text-xs leading-relaxed text-violet-800">Your saved progress is still available. Continue from the highlighted step, or start over with a blank session.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void reset()} disabled={busy !== null} className="shrink-0 bg-white">Start over</Button>
          </div>
        )}

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">{error.code.replaceAll("_", " ")}</div>
              <p className="mt-1 text-sm leading-relaxed text-red-800">{error.message}</p>
              {error.paths.length > 0 && <p className="mt-2 font-mono text-xs">Remove values at: {error.paths.join(", ")}</p>}
            </div>
          </div>
        )}

        {busy === "session" ? (
          <Panel className="mt-6 grid min-h-80 place-items-center p-8">
            <div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Establishing an isolated anonymous session…</p></div>
          </Panel>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6">
              <div ref={importStepRef} className="scroll-mt-24">
                <Panel className="p-6 md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="eyebrow text-primary">01 · Controlled input</div>
                    <h2 className="mt-2 text-2xl font-semibold">Load a compatible n8n workflow and synthetic fixture</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Use the seeded refund flight test or bring a supported webhook workflow with one HTTP side effect and one response. RetryProof analyzes and simulates only sanitized structure and synthetic data—never uploaded code or real integrations.</p>
                  </div>
                  {state.workflow && <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />}
                </div>

                {!state.workflow ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <button type="button" onClick={() => void loadDemo()} disabled={!session || busy !== null} className="group rounded-2xl border border-violet-200 bg-violet-50/70 p-5 text-left transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-md disabled:pointer-events-none disabled:opacity-50">
                      <div className="flex items-center justify-between"><FlaskConical className="h-6 w-6 text-primary" /><LabelPill tone="iris">Recommended demo</LabelPill></div>
                      <h3 className="mt-5 font-semibold">Unsafe refund retry</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Five supported n8n nodes, a synthetic event, and a timeout after the mock refund commits.</p>
                      <div className="mt-4 inline-flex items-center text-sm font-semibold text-primary">Load seeded workflow <ArrowRight className="ml-1.5 h-4 w-4 transition group-hover:translate-x-0.5" /></div>
                    </button>
                    <div className="rounded-2xl border border-border bg-background/70 p-5 text-left transition hover:border-primary/40 hover:shadow-md">
                      <div className="flex items-center justify-between"><Upload className="h-6 w-6 text-primary" /><LabelPill tone="green">End-to-end</LabelPill></div>
                      <h3 className="mt-5 font-semibold">Test your supported n8n export</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Workflow limit 1 MB; synthetic fixture limit 64 KB. Inline secrets are rejected before sanitized session storage.</p>
                      <label htmlFor="retryproof-fixture" className="mt-4 block text-xs font-semibold text-muted-foreground">Synthetic fixture JSON</label>
                      <Textarea id="retryproof-fixture" className="mt-2 min-h-28 font-mono text-xs" value={fixtureText} onChange={(event) => setFixtureText(event.target.value)} spellCheck={false} />
                      <Button variant="outline" className="mt-4" onClick={() => fileRef.current?.click()} disabled={!session || busy !== null || !fixtureText.trim()}>
                        Choose workflow JSON <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadWorkflow(file); event.currentTarget.value = ""; }} />
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-border bg-background/70 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <LabelPill tone={state.workflow.compatibility.canExecute ? "green" : "amber"}>{state.workflow.compatibility.canExecute ? "Executable flight-test topology" : "Diagnosis only"}</LabelPill>
                      <LabelPill tone="neutral">{state.workflow.compatibility.coverage.supported}/{state.workflow.compatibility.coverage.total} nodes supported</LabelPill>
                      {state.workflow.credentialReferencesRemoved > 0 && <LabelPill tone="amber">{state.workflow.credentialReferencesRemoved} credential reference{state.workflow.credentialReferencesRemoved === 1 ? "" : "s"} removed</LabelPill>}
                    </div>
                    <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                      <div>
                        <div className="text-lg font-semibold">{state.workflow.name}</div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">source sha256 · {shortHash(state.workflow.sourceHash)}</div>
                        <div className="mt-4 flex flex-wrap gap-2">{state.workflow.canonical.nodes.map((node) => <span key={node.id} className="rounded-md border border-border bg-card px-2 py-1 text-xs">{node.name}</span>)}</div>
                      </div>
                      <Button onClick={() => void analyze()} disabled={busy !== null || Boolean(state.analysis) || !state.workflow.compatibility.canExecute}>Analyze retry risk <Sparkles className="h-4 w-4" /></Button>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                      <pre className="max-h-36 overflow-auto rounded-lg border border-border bg-card p-3 font-mono text-[11px] leading-relaxed"><code>{JSON.stringify(state.workflow.fixture, null, 2)}</code></pre>
                      {!state.workflow.demoSeed && <Button variant="ghost" size="sm" onClick={() => void reset()} disabled={busy !== null}>Choose another workflow</Button>}
                    </div>
                    {!state.workflow.compatibility.canExecute && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">This graph contains unsupported nodes: {state.workflow.compatibility.unsupportedNodeIds.join(", ")}. RetryProof keeps it diagnosis-only and will not simulate or repair it.</p>}
                  </div>
                )}
                </Panel>
              </div>

              {analysis && (
                <div ref={contractStepRef} className="scroll-mt-24">
                  <Panel className="p-6 md:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="eyebrow text-primary">02 · Human-approved contract</div>
                      <h2 className="mt-2 text-2xl font-semibold">Approve what “correct” means</h2>
                    </div>
                    <LabelPill tone={analysis.provenance.mode === "live" ? "green" : "amber"}>{analysisProvenanceLabel(analysis.provenance.mode)}</LabelPill>
                  </div>
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-border bg-background/70 p-4"><div className="text-xs text-muted-foreground">Consequential effect</div><div className="mt-2 font-semibold">{analysis.sideEffect.nodeName}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{analysis.sideEffect.method} {analysis.sideEffect.url}</div></div>
                    <div className="rounded-xl border border-border bg-background/70 p-4"><div className="text-xs text-muted-foreground">Business key</div><div className="mt-2 font-mono text-sm font-semibold">{analysis.sideEffect.businessKeyPath}</div><div className="mt-1 text-xs text-muted-foreground">Pins retries to one synthetic event</div></div>
                    <div className="rounded-xl border border-border bg-background/70 p-4"><div className="text-xs text-muted-foreground">Oracle</div><div className="mt-2 font-mono text-sm font-semibold">count ≤ {analysis.invariant.oracle.maxCount}</div><div className="mt-1 text-xs text-muted-foreground">Owned by deterministic validator</div></div>
                  </div>
                  <label className="mt-5 block text-sm font-semibold" htmlFor="retryproof-invariant">Invariant statement</label>
                  <Textarea id="retryproof-invariant" className="mt-2 min-h-24" value={statement} readOnly aria-describedby="retryproof-invariant-note" />
                  <p id="retryproof-invariant-note" className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    The statement is cryptographically bound to the analyzed oracle. Re-analyze to test a different contract.
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {analysis.provenance.label} The submitted Build Week baseline and verification path are recorded at{" "}
                    <a className="font-mono font-medium text-primary underline-offset-4 hover:underline" href={`${analysis.provenance.sourceRepository}/commit/${analysis.provenance.sourceCommit}`} target="_blank" rel="noreferrer">
                      {analysis.provenance.sourceCommit.slice(0, 8)}
                    </a>. GPT proposes; the human approves; the deterministic validator owns the verdict.
                  </p>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/70 p-4">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--brand-iris)]" checked={approved} onChange={(event) => setApproved(event.target.checked)} disabled={Boolean(state.approved)} />
                    <span className="text-sm leading-relaxed"><strong>I approve this invariant and its declared scope.</strong><span className="mt-1 block text-muted-foreground">I understand the result covers this workflow hash, fixture, seed, and scenario—not arbitrary production behavior.</span></span>
                  </label>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="font-mono text-xs text-muted-foreground">plan sha256 · {shortHash(analysis.planHash)}</div>
                    {!state.approved ? <Button onClick={() => void approveContract()} disabled={busy !== null || !approved || !statement.trim()}>Approve contract <ShieldCheck className="h-4 w-4" /></Button> : <LabelPill tone="green"><Check className="mr-1 h-3.5 w-3.5" />Approved</LabelPill>}
                  </div>
                  </Panel>
                </div>
              )}

              {state.approved && (
                <div ref={breakStepRef} className="scroll-mt-24">
                  <Panel className="p-6 md:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><div className="eyebrow text-primary">03 · Deterministic counterexample</div><h2 className="mt-2 text-2xl font-semibold">Make the retry failure happen on command</h2></div>
                    {state.before && <LabelPill tone="red"><XCircle className="mr-1 h-3.5 w-3.5" />RED · {state.before.effectCount} effects</LabelPill>}
                  </div>
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {state.approved.scenarios.map((scenario) => {
                      const result = state.before?.scenarioResults.find((item) => item.scenarioId === scenario.id);
                      return <div key={scenario.id} className="rounded-xl border border-border bg-background/70 p-4">
                        <div className="flex items-start justify-between gap-3"><div className="font-semibold">{scenario.label}</div>{result && <LabelPill tone={result.passed ? "green" : "red"}>{result.effectCount} effect{result.effectCount === 1 ? "" : "s"}</LabelPill>}</div>
                        <p className="mt-2 font-mono text-[11px] text-muted-foreground">{scenario.faultPhase} · {scenario.deliveries} deliveries</p>
                      </div>;
                    })}
                  </div>
                  <div className="mt-4 w-full sm:w-56"><label htmlFor="retryproof-seed" className="text-xs font-medium text-muted-foreground">Pinned deterministic seed</label><Input id="retryproof-seed" className="mt-1 font-mono text-xs" value={seed} onChange={(event) => setSeed(event.target.value)} disabled={Boolean(state.before)} /></div>
                  {!state.before ? <Button className="mt-5" variant="destructive" onClick={() => void runFailure()} disabled={busy !== null || !seed.trim()}>Run four-scenario suite <FlaskConical className="h-4 w-4" /></Button> : <div className="mt-5"><div className="mb-3 text-xs font-semibold text-muted-foreground">Primary timeout trace</div><TraceList execution={state.before} /></div>}
                  </Panel>
                </div>
              )}

              {state.before && (
                <div ref={repairStepRef} className="scroll-mt-24">
                  <Panel className="p-6 md:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><div className="eyebrow text-primary">04 · Bounded repair</div><h2 className="mt-2 text-2xl font-semibold">Bind a repair to the failing proof</h2></div>
                    <LabelPill tone={state.repair?.provenance.mode === "live-codex" ? "green" : "amber"}>
                      {state.repair
                        ? repairProvenanceLabel(state.repair.provenance.mode)
                          : readiness.liveCodexConfigured ? RETRYPROOF.repairModeLabel : "Validated fallback available"}
                    </LabelPill>
                  </div>
                  {!state.repair ? (
                    <div className="mt-6 rounded-2xl border border-dashed border-primary/30 bg-violet-50/50 p-6 text-center">
                      <Wrench className="mx-auto h-7 w-7 text-primary" /><h3 className="mt-3 font-semibold">Generate a source-bound repair artifact</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">A fresh Codex thread receives only this sanitized graph, approved invariant, and failing trace in an isolated worker. RetryProof then distrusts the candidate and validates its source binding, exact patch structure, secret scan, fixture, and deterministic replay before accepting it.</p>
                      <div className="mt-5 flex flex-wrap justify-center gap-3">
                        <Button onClick={() => void createRepair("live")} disabled={busy !== null || !readiness.liveCodexConfigured}>
                          {busy === "repair-live" ? <><Loader2 className="h-4 w-4 animate-spin" />Codex is working</> : <>Repair with live Codex <Sparkles className="h-4 w-4" /></>}
                        </Button>
                        <Button variant="outline" onClick={() => void createRepair("cached")} disabled={busy !== null}>Use validated fallback <Code2 className="h-4 w-4" /></Button>
                      </div>
                      {!readiness.liveCodexConfigured && <p className="mt-3 text-xs text-amber-800">The isolated worker is unavailable on this deployment; the fallback remains deterministic and is labeled in every artifact.</p>}
                      {liveEvents.length > 0 && (
                        <div className={cn(
                          "mx-auto mt-5 max-w-2xl rounded-xl border p-4 text-left",
                          liveStatus === "failed" ? "border-red-200 bg-red-50" : "border-violet-200 bg-white/80",
                        )} role="status" aria-live="polite" aria-atomic="false">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                {liveStatus === "running" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : liveStatus === "failed" ? <XCircle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                                {liveStatus === "running" ? "Fresh Codex repair in progress" : liveStatus === "failed" ? "Live repair stopped safely" : "Live repair accepted"}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {liveStatus === "running" ? "Real server events are shown below; worker events are signature-verified before relay. A fresh run typically takes 1–3 minutes and may take up to about 6 minutes within the enforced budget." : liveStatus === "failed" ? "No candidate was accepted. You can retry or use the clearly labeled validated fallback." : "The candidate crossed the deterministic acceptance boundary."}
                              </p>
                            </div>
                            <div className="font-mono text-xs font-semibold text-muted-foreground">{liveElapsedSeconds}s elapsed</div>
                          </div>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-violet-100" role="progressbar" aria-label="Live Codex repair progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(liveProgressPercent)}>
                            <div className={cn("h-full rounded-full transition-[width] duration-500", liveStatus === "failed" ? "bg-red-500" : "bg-primary")} style={{ width: `${liveProgressPercent}%` }} />
                          </div>
                          <ol className="mt-4 grid gap-2 sm:grid-cols-5" aria-label="Live repair stages">
                            {LIVE_REPAIR_STAGES.map((stage, index) => {
                              const reached = liveEvents.some((event) => event.stage === stage.id);
                              const current = currentLiveStage === stage.id && liveStatus === "running";
                              return (
                                <li key={stage.id} className={cn("rounded-lg border px-2 py-2 text-center text-[11px] font-medium", reached ? "border-violet-200 bg-violet-50 text-violet-900" : "border-border bg-secondary/40 text-muted-foreground")} aria-current={current ? "step" : undefined}>
                                  <span className="mb-1 flex justify-center">
                                    {current ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : reached || index < currentLiveStageIndex ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3.5 w-3.5" />}
                                  </span>
                                  {stage.label}
                                </li>
                              );
                            })}
                          </ol>
                          <div className="mt-4 space-y-2 border-t border-border/70 pt-3" aria-label="Live repair event feed">
                            {liveEvents.map((event) => (
                              <div key={event.stage} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                <span><strong className="text-foreground">{LIVE_REPAIR_STAGES.find((stage) => stage.id === event.stage)?.label}:</strong> {event.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 space-y-4">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 font-semibold text-emerald-900"><CheckCircle2 className="h-5 w-5" />Repair artifact validated</div><p className="mt-2 text-sm leading-relaxed text-emerald-900/80">{state.repair.explanation}</p></div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {state.repair.provenance.label} The submitted Build Week baseline is recorded at{" "}
                        <a className="font-mono font-medium text-primary underline-offset-4 hover:underline" href={`${state.repair.provenance.sourceRepository}/commit/${state.repair.provenance.sourceCommit}`} target="_blank" rel="noreferrer">
                          {state.repair.provenance.sourceCommit.slice(0, 8)}
                        </a>. {state.repair.provenance.mode === "live-codex" && state.repair.provenance.threadId
                          ? ` Fresh Codex thread ${state.repair.provenance.threadId.slice(0, 12)}… completed in ${state.repair.provenance.attempts ?? 1} attempt.`
                          : " The fallback is not represented as a fresh Codex run."} The patch, repaired graph, source binding, secret scan, and replay are validated live before a green result is possible.
                      </p>
                      <div className={RAW_PATCH_CONTAINMENT_CLASSES.grid}>
                        <div className="rounded-xl border border-border bg-background/70 p-4"><div className="text-xs text-muted-foreground">Changed nodes</div><div className="mt-3 flex flex-wrap gap-2">{state.repair.changedNodeIds.map((id) => <span key={id} className="rounded-md bg-secondary px-2 py-1 font-mono text-xs">{id}</span>)}</div><div className="mt-4 text-xs text-muted-foreground">Validator checks</div><ul className="mt-2 space-y-1.5">{state.repair.validation.checks.map((check) => <li key={check} className="flex items-center gap-2 text-xs" title={`Internal check ID: ${check}`}><Check className="h-3.5 w-3.5 text-emerald-600" /><span>{validatorCheckLabel(check)}</span></li>)}</ul></div>
                        <details className={RAW_PATCH_CONTAINMENT_CLASSES.details}>
                          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold">Inspect raw JSON patch</summary>
                          <pre className={RAW_PATCH_CONTAINMENT_CLASSES.pre}><code className={RAW_PATCH_CONTAINMENT_CLASSES.code}>{JSON.stringify(state.repair.patch, null, 2)}</code></pre>
                        </details>
                      </div>
                      {!state.after && <Button onClick={() => void recheck()} disabled={busy !== null}>Replay the identical suite <GitCompareArrows className="h-4 w-4" /></Button>}
                    </div>
                  )}
                  </Panel>
                </div>
              )}

              {state.after && state.artifact && (
                <div ref={evidenceStepRef} className="scroll-mt-24">
                  <Panel className="overflow-hidden">
                  <div className="border-b border-border bg-emerald-50 p-6 md:p-8">
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                      <div><div className="eyebrow text-emerald-700">05 · Exportable evidence</div><h2 className="mt-2 text-3xl font-semibold text-emerald-950">Same seed. Same fault. One effect.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-900/75">{state.artifact.receipt.claim}</p></div>
                      <Button asChild size="lg"><a href={evidenceDownload}><Download className="h-4 w-4" />Download evidence ZIP</a></Button>
                    </div>
                  </div>
                  <div className="grid gap-px bg-border md:grid-cols-[1fr_auto_1fr]">
                    <div className="bg-card p-6 text-center"><LabelPill tone="red">BEFORE · RED</LabelPill><div className="mt-4 font-display text-6xl font-semibold text-red-600">{state.before?.effectCount}</div><div className="mt-2 text-sm text-muted-foreground">maximum mock effects for {state.before?.effectKey}</div></div>
                    <div className="grid place-items-center bg-card px-6 py-3"><ArrowRight className="h-6 w-6 text-muted-foreground" /></div>
                    <div className="bg-card p-6 text-center"><LabelPill tone="green">AFTER · GREEN</LabelPill><div className="mt-4 font-display text-6xl font-semibold text-emerald-600">{state.after.effectCount}</div><div className="mt-2 text-sm text-muted-foreground">maximum mock effects for {state.after.effectKey}</div></div>
                  </div>
                  <div className="p-6 md:p-8">
                    <ProofFlightRecorder
                      sourceCanonical={state.workflow!.canonical}
                      sourceHash={state.workflow!.sourceHash}
                      planHash={state.approved!.planHash}
                      effectNodeId={state.approved!.sideEffect.nodeId}
                      before={state.before!}
                      repair={state.repair!}
                      after={state.after}
                      artifact={{ sha256: state.artifact.sha256, receipt: state.artifact.receipt }}
                    />
                    <div className="mt-6"><div className="mb-3 text-xs font-semibold text-muted-foreground">Primary repaired trace</div><TraceList execution={state.after} /></div>
                  </div>
                  </Panel>
                </div>
              )}
            </div>

            <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
              <Panel className="p-5">
                <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary" /><h2 className="font-semibold">Execution boundary</h2></div>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {["No uploaded code is executed", "No network, SQL, shell, or payment calls", "Inline secrets rejected before storage", "Session access expires after 24 hours"].map((item) => <li key={item} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}
                </ul>
              </Panel>
              <Panel className="p-5">
                <div className="eyebrow text-primary">Who owns the verdict?</div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-2 text-sm font-semibold">GPT-5.6 <LabelPill tone={analysis?.provenance.mode === "live" ? "green" : analysis ? "amber" : "neutral"}>{analysisBadgeLabel(analysis?.provenance.mode)}</LabelPill></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Proposes a structured effect, key, and invariant when configured; every citation is checked against the sanitized graph and fixture.</p></div>
                  <div className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-2 text-sm font-semibold">Human <LabelPill tone="iris">Approval</LabelPill></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Reviews and explicitly approves the invariant before testing.</p></div>
                  <div className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-2 text-sm font-semibold">Codex <LabelPill tone={readiness.liveCodexConfigured ? "green" : "amber"}>{readiness.liveCodexConfigured ? "Live worker" : "Fallback only"}</LabelPill></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">When available, a fresh Codex SDK thread writes the bounded patch in an isolated worker. RetryProof accepts it only after exact structural, source, fixture, secret, and deterministic replay validation.</p></div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><div className="flex items-center justify-between gap-2 text-sm font-semibold text-emerald-900">Simulator + validators <LabelPill tone="green">Live</LabelPill></div><p className="mt-1 text-xs leading-relaxed text-emerald-900/75">Own every red/green result and receipt.</p></div>
                </div>
              </Panel>
              <Panel className="p-5">
                <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /><h2 className="font-semibold">Claim limitation</h2></div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">A passing declared scenario is not proof of exactly-once execution or production safety. RetryProof proves only the approved invariant, pinned workflow hash, fixture, seed, and deterministic scenario shown here.</p>
              </Panel>
              <div className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />Anonymous session isolated with an HTTP-only cookie</div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
