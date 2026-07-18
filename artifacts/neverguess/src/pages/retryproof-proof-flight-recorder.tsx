import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  GitBranch,
  Route,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProofNode = {
  id: string;
  name: string;
  type: string;
  position?: [number, number];
  parameters?: Record<string, unknown>;
};

export type ProofCanonical = {
  nodes: ProofNode[];
  connections: Record<string, unknown>;
};

export type ProofScenarioResult = {
  scenarioId: string;
  label: string;
  faultPhase: string;
  passed: boolean;
  effectCount: number;
};

type ProofExecution = {
  passed: boolean;
  effectCount: number;
  scenarioResults: ProofScenarioResult[];
};

type ProofRepair = {
  changedNodeIds: string[];
  repairedWorkflowHash: string;
  patchedCanonical: ProofCanonical;
};

type ProofArtifact = {
  sha256: string;
  receipt: unknown;
};

type ConnectionTarget = { node: string };
const MAX_GRAPH_PATHS = 32;

function connectionTargets(canonical: ProofCanonical, sourceName: string): string[] {
  const connection = canonical.connections[sourceName];
  if (!connection || typeof connection !== "object" || Array.isArray(connection)) return [];
  const main = (connection as { main?: unknown }).main;
  if (!Array.isArray(main)) return [];
  return main.flatMap((output) => Array.isArray(output)
    ? output.flatMap((target) => target && typeof target === "object" && !Array.isArray(target)
      && typeof (target as ConnectionTarget).node === "string"
      ? [(target as ConnectionTarget).node]
      : [])
    : []);
}

export function workflowPaths(canonical: ProofCanonical): ProofNode[][] {
  const nodeByName = new Map(canonical.nodes.map((node) => [node.name, node]));
  const targeted = new Set(Object.keys(canonical.connections).flatMap((name) => connectionTargets(canonical, name)));
  const roots = canonical.nodes.filter((node) => node.type === "n8n-nodes-base.webhook" || !targeted.has(node.name));
  const starts = roots.length > 0 ? roots : canonical.nodes.slice(0, 1);
  const paths: ProofNode[][] = [];
  const maxDepth = Math.min(64, Math.max(1, canonical.nodes.length + 1));

  const walk = (node: ProofNode, path: ProofNode[], visited: Set<string>) => {
    if (paths.length >= MAX_GRAPH_PATHS) return;
    const nextPath = [...path, node];
    const targets = connectionTargets(canonical, node.name)
      .map((name) => nodeByName.get(name))
      .filter((target): target is ProofNode => Boolean(target));
    if (targets.length === 0 || nextPath.length >= maxDepth) {
      paths.push(nextPath);
      return;
    }
    for (const target of targets) {
      if (paths.length >= MAX_GRAPH_PATHS) break;
      if (visited.has(target.id)) {
        paths.push(nextPath);
        continue;
      }
      walk(target, nextPath, new Set([...visited, target.id]));
    }
  };

  for (const root of starts) {
    if (paths.length >= MAX_GRAPH_PATHS) break;
    walk(root, [], new Set([root.id]));
  }
  return paths;
}

export function scenarioProofRows(before: ProofExecution, after: ProofExecution) {
  const afterById = new Map(after.scenarioResults.map((result) => [result.scenarioId, result]));
  return before.scenarioResults.map((beforeResult) => {
    const afterResult = afterById.get(beforeResult.scenarioId);
    return {
      scenarioId: beforeResult.scenarioId,
      label: beforeResult.label,
      faultPhase: beforeResult.faultPhase,
      beforePassed: beforeResult.passed,
      beforeEffectCount: beforeResult.effectCount,
      afterPassed: afterResult?.passed ?? false,
      afterEffectCount: afterResult?.effectCount ?? null,
    };
  });
}

export function validatorCheckLabel(check: string): string {
  if (check === "source_fixture_failed") return "Red confirmed on source";
  return check.split("_").map((word, index) => index === 0
    ? `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`
    : word).join(" ");
}

export function repairProvenanceLabel(mode: "cached" | "bounded-template" | "live-codex"): string {
  return mode === "live-codex"
    ? "Fresh Codex · validators live"
    : "Validated fallback · not a fresh Codex run";
}

export function seededSyntheticStake(workflow?: { demoSeed: boolean; fixture: Record<string, unknown> }): string | null {
  if (!workflow?.demoSeed) return null;
  const event = workflow.fixture.event;
  if (!event || typeof event !== "object" || Array.isArray(event)) return null;
  const amount = (event as { amount?: unknown }).amount;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount / 100);
}

function GraphCard({
  title,
  canonical,
  effectNodeId,
  changedNodeIds,
  execution,
}: {
  title: string;
  canonical: ProofCanonical;
  effectNodeId: string;
  changedNodeIds: string[];
  execution: ProofExecution;
}) {
  const changed = new Set(changedNodeIds);
  const paths = workflowPaths(canonical);
  const pathSummary = paths.map((path, index) => `Path ${index + 1}: ${path.map((node) => node.name).join(" then ")}.`).join(" ");
  return (
    <section className="rounded-2xl border border-border bg-background/80 p-4" aria-label={`${title} workflow graph`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><Route className="h-4 w-4 text-primary" />{title}</div>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
          execution.passed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700",
        )}>
          {execution.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {execution.passed ? "GREEN" : "RED"} · {execution.effectCount} effect{execution.effectCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-4 space-y-3 overflow-x-auto pb-1">
        <p className="sr-only">{pathSummary}</p>
        {paths.map((path, pathIndex) => (
          <div key={`${title}-${pathIndex}`} className="min-w-max rounded-xl border border-border/70 bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />Path {pathIndex + 1}
            </div>
            <ol className="flex items-center" aria-label={`${title} path ${pathIndex + 1}`}>
              {path.map((node, nodeIndex) => (
                <li key={`${pathIndex}-${node.id}`} className="flex items-center">
                  <div className={cn(
                    "max-w-40 rounded-lg border px-3 py-2 text-center",
                    node.id === effectNodeId && !execution.passed
                      ? "border-red-300 bg-red-50 text-red-900"
                      : changed.has(node.id)
                        ? "border-violet-300 bg-violet-50 text-violet-950"
                        : "border-border bg-background text-foreground",
                  )}>
                    <div className="text-xs font-semibold">{node.name}</div>
                    <div className="mt-1 max-w-36 truncate font-mono text-[9px] text-muted-foreground" title={node.type}>{node.type.replace("n8n-nodes-base.", "")}</div>
                  </div>
                  {nodeIndex < path.length - 1 && <ArrowRight className="mx-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function shortHash(value: string): string {
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export function ProofFlightRecorder({
  sourceCanonical,
  sourceHash,
  planHash,
  effectNodeId,
  before,
  repair,
  after,
  artifact,
}: {
  sourceCanonical: ProofCanonical;
  sourceHash: string;
  planHash: string;
  effectNodeId: string;
  before: ProofExecution;
  repair: ProofRepair;
  after: ProofExecution;
  artifact: ProofArtifact;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const sourceIds = new Set(sourceCanonical.nodes.map((node) => node.id));
  const addedNodes = repair.patchedCanonical.nodes.filter((node) => !sourceIds.has(node.id));
  const rows = scenarioProofRows(before, after);
  const hashes = [
    { label: "Source workflow", value: sourceHash },
    { label: "Approved plan", value: planHash },
    { label: "Repaired workflow", value: repair.repairedWorkflowHash },
    { label: "Evidence receipt", value: artifact.sha256 },
  ];

  const copyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(artifact.receipt, null, 2));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="space-y-6" data-testid="proof-flight-recorder">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 md:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="eyebrow text-primary">Proof Flight Recorder</div>
            <h3 className="mt-2 text-2xl font-semibold">See what Codex changed—and what deterministic replay proved.</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">Every node, path, scenario result, and identifier below is derived from this run’s accepted repair and evidence artifacts.</p>
          </div>
          <div className="shrink-0 rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm text-violet-950">
            <div className="font-semibold">Bounded patch</div>
            <div className="mt-1 text-xs text-violet-800">{addedNodes.length} node{addedNodes.length === 1 ? "" : "s"} added · {repair.changedNodeIds.length} nodes bound</div>
          </div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <GraphCard title="Before repair" canonical={sourceCanonical} effectNodeId={effectNodeId} changedNodeIds={[]} execution={before} />
          <GraphCard title="After repair" canonical={repair.patchedCanonical} effectNodeId={effectNodeId} changedNodeIds={repair.changedNodeIds} execution={after} />
        </div>
        <div className="mt-4 rounded-xl border border-violet-200 bg-white/80 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">What changed</div>
          <p className="mt-2 text-sm leading-relaxed text-violet-950">
            The validated repair added {addedNodes.length} source-bound node{addedNodes.length === 1 ? "" : "s"}: {addedNodes.map((node) => node.name).join(", ")}. The duplicate path now bypasses the consequential effect when the durable reservation already exists.
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border" aria-labelledby="proof-scenario-matrix">
        <div className="border-b border-border bg-secondary/40 px-4 py-3">
          <h3 id="proof-scenario-matrix" className="font-semibold">Four-scenario proof matrix</h3>
          <p className="mt-1 text-xs text-muted-foreground">Paired by durable scenario ID; each row compares the same declared fault before and after repair.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Before and after effect counts for every deterministic fault scenario in this run.</caption>
            <thead className="bg-card text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Scenario</th><th scope="col" className="px-4 py-3 font-medium">Fault phase</th><th scope="col" className="px-4 py-3 font-medium">Before</th><th scope="col" className="px-4 py-3 font-medium">After</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.scenarioId} className="bg-background/70">
                  <th scope="row" className="px-4 py-3 text-left"><div className="font-medium">{row.label}</div><div className="mt-1 font-mono text-[10px] font-normal text-muted-foreground">{row.scenarioId}</div></th>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.faultPhase}</td>
                  <td className="px-4 py-3"><span className={cn("inline-flex items-center gap-1 font-semibold", row.beforePassed ? "text-emerald-700" : "text-red-700")}>{row.beforePassed ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{row.beforeEffectCount} effect{row.beforeEffectCount === 1 ? "" : "s"}</span></td>
                  <td className="px-4 py-3"><span className={cn("inline-flex items-center gap-1 font-semibold", row.afterPassed ? "text-emerald-700" : "text-red-700")}>{row.afterPassed ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{row.afterEffectCount ?? "—"} effect{row.afterEffectCount === 1 ? "" : "s"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background/70 p-4 md:p-5" aria-labelledby="proof-chain-title">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><h3 id="proof-chain-title" className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" />Evidence references</h3><p className="mt-1 text-xs text-muted-foreground">Run-level source, approved-plan, repaired-workflow, and evidence-receipt identifiers shown without implying they form one signed chain.</p></div>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyReceipt()}><Copy className="h-3.5 w-3.5" />{copyState === "copied" ? "Receipt copied" : "Copy receipt JSON"}</Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-center">
          {hashes.map((item, index) => (
            <div key={item.label} className="contents">
              <div className="rounded-lg border border-border bg-card p-3"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</div><div className="mt-1 font-mono text-xs" title={item.value}>{shortHash(item.value)}</div></div>
              {index < hashes.length - 1 && <ArrowRight className="mx-auto hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />}
            </div>
          ))}
        </div>
        <div className="sr-only" aria-live="polite">{copyState === "copied" ? "Evidence receipt copied to clipboard." : copyState === "failed" ? "Evidence receipt could not be copied." : ""}</div>
        {copyState === "failed" && <p className="mt-3 text-xs text-red-700" role="alert">Copy failed. The complete receipt remains available in the evidence ZIP.</p>}
      </section>
    </div>
  );
}
