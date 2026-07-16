import { createHash, randomUUID } from "node:crypto";

const SUPPORTED_TYPES = new Set([
  "n8n-nodes-base.webhook",
  "n8n-nodes-base.set",
  "n8n-nodes-base.if",
  "n8n-nodes-base.switch",
  "n8n-nodes-base.httpRequest",
  "n8n-nodes-base.postgres",
  "n8n-nodes-base.respondToWebhook",
]);

const SECRET_KEY = /(?:api[_-]?key|authorization|bearer|password|private[_-]?key|secret|token)/i;
const SECRET_VALUE = /(?:\bsk-[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._-]{8,})/i;
const SAFE_CREDENTIAL_FIELD = /^(?:api[_-]?key|authorization|bearer|password|private[_-]?key|secret|token)$/i;
const SIMPLE_PATH_FIELD = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
const DANGEROUS_PATH_FIELD = /^(?:__proto__|prototype|constructor)$/;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_VALUES = 10_000;
const CANONICAL_SOURCE_REPOSITORY = "https://github.com/marmar9615-cloud/Copilot-Checker";
const CANONICAL_SOURCE_COMMIT = "6be402f1f8a5afffeb725bfe6b51eaf6cd020d7e";
const POSTGRES_RESERVATION_QUERY = `
INSERT INTO retryproof_idempotency_reservations
  (workflow_id, invariant_id, entity_key)
VALUES ($1, $2, $3)
ON CONFLICT (workflow_id, invariant_id, entity_key) DO NOTHING
RETURNING entity_key
`.trim();

type JsonObject = Record<string, unknown>;

export type RetryProofNode = {
  id: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: [number, number];
  parameters: JsonObject;
  alwaysOutputData?: boolean;
};

export type WorkflowResource = {
  id: string;
  name: string;
  sourceHash: string;
  demoSeed: boolean;
  canonical: {
    nodes: RetryProofNode[];
    connections: JsonObject;
  };
  compatibility: {
    canExecute: boolean;
    coverage: { supported: number; total: number };
    unsupportedNodeIds: string[];
  };
  credentialReferencesRemoved: number;
  fixture: JsonObject;
};

export type RetryProofScenario = {
  id: string;
  label: string;
  faultPhase: "before_replayed_delivery" | "after_effect_before_response" | "before_effect" | "after_node";
  deliveries: 2;
};

export type RiskAnalysis = {
  id: string;
  workflowId: string;
  planHash: string;
  planVersion: 1;
  sideEffect: {
    nodeId: string;
    nodeName: string;
    effectId: string;
    method: string;
    url: string;
    businessKeyPath: string;
  };
  invariant: {
    id: string;
    statement: string;
    oracle: {
      type: "at_most_once_effect";
      effectId: string;
      keyPath: "$.key";
      maxCount: 1;
    };
    sourceNodeIds: string[];
    approved: false;
  };
  scenarios: RetryProofScenario[];
  provenance: {
    mode: "cached" | "live" | "deterministic-fallback";
    model: string;
    promptVersion: string;
    label: string;
    sourceRepository: typeof CANONICAL_SOURCE_REPOSITORY;
    sourceCommit: typeof CANONICAL_SOURCE_COMMIT;
    requestId?: string;
  };
};

export type ApprovedRiskPlan = Omit<RiskAnalysis, "invariant"> & {
  approvedAt: string;
  invariant: Omit<RiskAnalysis["invariant"], "approved"> & { approved: true };
};

export type ExecutionResult = {
  id: string;
  analysisId: string;
  phase: "before" | "after";
  seed: string;
  scenarioId: string;
  suiteHash: string;
  workflowHash: string;
  passed: boolean;
  effectCount: number;
  effectKey: string;
  deliveries: 2;
  traces: Array<{
    delivery: 1 | 2;
    event: string;
    detail: string;
    effectCount: number;
  }>;
  scenarioResults: Array<{
    scenarioId: string;
    label: string;
    faultPhase: RetryProofScenario["faultPhase"];
    passed: boolean;
    effectCount: number;
    traces: ExecutionResult["traces"];
  }>;
};

export type RepairResource = {
  id: string;
  analysisId: string;
  sourceHash: string;
  repairedWorkflowHash: string;
  strategy: "durable_reservation_before_effect";
  changedNodeIds: string[];
  explanation: string;
  patch: Array<{ op: "add" | "replace"; path: string; value: unknown }>;
  patchedCanonical: WorkflowResource["canonical"];
  regressionFixture: {
    seed: string;
    scenarioIds: string[];
    invariantId: string;
    sourceSuiteHash: string;
  };
  validation: {
    passed: true;
    checks: Array<
      | "source_hash_bound"
      | "patch_structure_valid"
      | "credential_scan_clear"
      | "source_fixture_failed"
      | "codex_output_bound"
    >;
  };
  provenance: {
    mode: "cached" | "bounded-template" | "live-codex";
    generatedBy: "cached-template" | "validated-template" | "codex";
    label: string;
    sourceRepository: typeof CANONICAL_SOURCE_REPOSITORY;
    sourceCommit: typeof CANONICAL_SOURCE_COMMIT;
    requestId?: string;
    threadId?: string;
    attempts?: number;
    generatedAt?: string;
  };
};

export type LiveCodexRepairCandidate = {
  schemaVersion: "1";
  requestId: string;
  threadId: string;
  attempts: number;
  generatedAt: string;
  sourceHash: string;
  analysisId: string;
  strategy: "durable_reservation_before_effect";
  explanation: string;
  patch: RepairResource["patch"];
  changedNodeIds: string[];
  regressionFixture: RepairResource["regressionFixture"];
};

export type EvidenceArtifact = {
  id: string;
  analysisId: string;
  repairId: string;
  sha256: string;
  receipt: {
    schemaVersion: "1";
    claim: string;
    workflow: { id: string; name: string; sourceHash: string };
    invariant: ApprovedRiskPlan["invariant"];
    scenario: { ids: string[]; seed: string; deliveries: 2 };
    before: Pick<ExecutionResult, "suiteHash" | "passed" | "effectCount" | "effectKey">;
    after: Pick<ExecutionResult, "suiteHash" | "passed" | "effectCount" | "effectKey">;
    repair: Pick<RepairResource, "strategy" | "changedNodeIds" | "sourceHash" | "repairedWorkflowHash">;
    modelArtifacts: {
      analysis: string;
      repair: "codex-live" | "codex-validated-template";
      deterministicValidation: "live";
    };
    limitations: string[];
    generatedAt: string;
  };
};

export class RetryProofEngineError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 422,
    readonly secretPaths?: string[],
  ) {
    super(message);
    this.name = "RetryProofEngineError";
  }
}

function assertTraversal(depth: number, visited: { count: number }): void {
  visited.count += 1;
  if (depth > MAX_JSON_DEPTH || visited.count > MAX_JSON_VALUES) {
    throw new RetryProofEngineError(
      "WORKFLOW_TOO_COMPLEX",
      `Workflow JSON may contain at most ${MAX_JSON_VALUES.toLocaleString()} values and ${MAX_JSON_DEPTH} nested levels.`,
      422,
    );
  }
}

function stable(value: unknown, depth = 0, visited = { count: 0 }): string {
  assertTraversal(depth, visited);
  if (Array.isArray(value)) return `[${value.map((child) => stable(child, depth + 1, visited)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as JsonObject)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child, depth + 1, visited)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function urlContainsEmbeddedSecret(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) return true;
  const hasSecretParameter = (parameters: URLSearchParams) => [...parameters.entries()].some(([name, parameterValue]) =>
    SECRET_KEY.test(name) && parameterValue.trim().length > 0,
  );
  if (hasSecretParameter(parsed.searchParams)) return true;

  const fragment = parsed.hash.slice(1);
  if (!fragment) return false;
  const fragmentQuery = fragment.includes("?")
    ? fragment.slice(fragment.indexOf("?") + 1)
    : fragment;
  return hasSecretParameter(new URLSearchParams(fragmentQuery));
}

function safeChildPath(path: string, key: string): string {
  if (
    SECRET_VALUE.test(key)
    || (SECRET_KEY.test(key) && !SAFE_CREDENTIAL_FIELD.test(key))
  ) {
    return `${path}.<redacted-credential-key>`;
  }
  return SIMPLE_PATH_FIELD.test(key) ? `${path}.${key}` : `${path}.<redacted-key>`;
}

function scanSecretPaths(
  value: unknown,
  path = "$",
  key = "",
  depth = 0,
  visited = { count: 0 },
): string[] {
  assertTraversal(depth, visited);
  if (typeof value === "string") {
    if (
      (SECRET_KEY.test(key) && value.trim().length > 0)
      || SECRET_VALUE.test(value)
      || urlContainsEmbeddedSecret(value)
    ) {
      return [path];
    }
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => scanSecretPaths(child, `${path}[${index}]`, "", depth + 1, visited));
  }
  if (!isObject(value)) return [];
  const pairPath = typeof value.name === "string"
    && SECRET_KEY.test(value.name)
    && typeof value.value === "string"
    && value.value.trim().length > 0
    ? [`${path}.value`]
    : [];
  return [
    ...pairPath,
    ...Object.entries(value).flatMap(([childKey, child]) => {
      const childPath = safeChildPath(path, childKey);
      if (SECRET_VALUE.test(childKey)) return [childPath];
      return scanSecretPaths(child, childPath, childKey, depth + 1, visited);
    }),
  ];
}

function stripCredentialReferences(
  value: unknown,
  depth = 0,
  visited = { count: 0 },
): { value: unknown; removed: number } {
  assertTraversal(depth, visited);
  if (Array.isArray(value)) {
    const children = value.map((child) => stripCredentialReferences(child, depth + 1, visited));
    return {
      value: children.map((child) => child.value),
      removed: children.reduce((sum, child) => sum + child.removed, 0),
    };
  }
  if (!isObject(value)) return { value, removed: 0 };
  let removed = 0;
  const clean: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "credentials") {
      removed += isObject(child) ? Object.keys(child).length : 1;
      continue;
    }
    const nested = stripCredentialReferences(child, depth + 1, visited);
    clean[key] = nested.value;
    removed += nested.removed;
  }
  return { value: clean, removed };
}

function parseNode(value: unknown, index: number): RetryProofNode {
  if (!isObject(value)) {
    throw new RetryProofEngineError("INVALID_WORKFLOW", `Node ${index + 1} must be an object.`, 400);
  }
  const id = typeof value.id === "string" && value.id ? value.id : `node_${index + 1}`;
  const name = typeof value.name === "string" && value.name ? value.name : id;
  const type = typeof value.type === "string" ? value.type : "";
  if (!type) {
    throw new RetryProofEngineError("INVALID_WORKFLOW", `Node ${index + 1} is missing a type.`, 400);
  }
  const position = Array.isArray(value.position) && value.position.length === 2
    ? [Number(value.position[0]) || 0, Number(value.position[1]) || 0] as [number, number]
    : [index * 200, 300] as [number, number];
  return {
    id,
    name,
    type,
    ...(typeof value.typeVersion === "number" ? { typeVersion: value.typeVersion } : {}),
    position,
    parameters: isObject(value.parameters) ? value.parameters : {},
    ...(value.alwaysOutputData === true ? { alwaysOutputData: true } : {}),
  };
}

function effectId(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").filter(Boolean).at(-1) ?? parsed.hostname;
  } catch {
    return "effect";
  }
}

export function sanitizeFixture(value: unknown): JsonObject {
  if (!isObject(value)) {
    throw new RetryProofEngineError("INVALID_FIXTURE", "The synthetic fixture must be a JSON object.", 400);
  }
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 64 * 1024) {
    throw new RetryProofEngineError("FIXTURE_TOO_LARGE", "The synthetic fixture must be 64 KB or smaller.", 413);
  }
  const secretPaths = scanSecretPaths(value);
  if (secretPaths.length > 0) {
    throw new RetryProofEngineError(
      "INLINE_SECRET_DETECTED",
      `Inline secrets were detected at ${secretPaths.join(", ")}. Remove them before import.`,
      422,
      secretPaths,
    );
  }
  return structuredClone(value);
}

export function importWorkflow(raw: string, options?: { demoSeed?: boolean; fixture?: unknown }): WorkflowResource {
  if (Buffer.byteLength(raw, "utf8") > 1024 * 1024) {
    throw new RetryProofEngineError("WORKFLOW_TOO_LARGE", "Workflow JSON must be 1 MB or smaller.", 413);
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new RetryProofEngineError("INVALID_JSON", "Workflow upload must be valid JSON.", 400);
  }
  const secretPaths = scanSecretPaths(decoded);
  if (secretPaths.length > 0) {
    throw new RetryProofEngineError(
      "INLINE_SECRET_DETECTED",
      `Inline secrets were detected at ${secretPaths.join(", ")}. Remove them before import.`,
      422,
      secretPaths,
    );
  }
  const stripped = stripCredentialReferences(decoded);
  if (!isObject(stripped.value) || !Array.isArray(stripped.value.nodes)) {
    throw new RetryProofEngineError("INVALID_WORKFLOW", "Workflow JSON must contain a nodes array.", 400);
  }
  const nodes = stripped.value.nodes.map(parseNode);
  if (nodes.length === 0) {
    throw new RetryProofEngineError("INVALID_WORKFLOW", "Workflow must contain at least one node.", 400);
  }
  if (new Set(nodes.map((node) => node.id)).size !== nodes.length || new Set(nodes.map((node) => node.name)).size !== nodes.length) {
    throw new RetryProofEngineError("DUPLICATE_NODE_IDENTITY", "Workflow node IDs and names must be unique.", 422);
  }
  const unsupportedNodeIds = nodes.filter((node) => {
    if (!SUPPORTED_TYPES.has(node.type)) return true;
    if (options?.demoSeed !== true && (node.type === "n8n-nodes-base.if" || node.type === "n8n-nodes-base.switch")) return true;
    if (node.type === "n8n-nodes-base.postgres") {
      return node.parameters.query !== POSTGRES_RESERVATION_QUERY || node.alwaysOutputData !== true;
    }
    return false;
  }).map((node) => node.id);
  const canonical = {
    nodes: [...nodes].sort((left, right) => left.position[0] - right.position[0]),
    connections: isObject(stripped.value.connections) ? stripped.value.connections : {},
  };
  const sourceHash = hash(canonical);
  return {
    id: randomUUID(),
    name: typeof stripped.value.name === "string" && stripped.value.name
      ? stripped.value.name
      : "Imported n8n workflow",
    sourceHash,
    demoSeed: options?.demoSeed === true,
    canonical,
    compatibility: {
      canExecute: unsupportedNodeIds.length === 0,
      coverage: { supported: nodes.length - unsupportedNodeIds.length, total: nodes.length },
      unsupportedNodeIds,
    },
    credentialReferencesRemoved: stripped.removed,
    fixture: sanitizeFixture(options?.fixture ?? { event: { id: "evt_example_1" } }),
  };
}

export function createSeededWorkflow(): WorkflowResource {
  return importWorkflow(
    JSON.stringify({
      id: "wf_demo_refund",
      name: "Refund request - unsafe retry",
      active: false,
      nodes: [
        { id: "webhook_refund", name: "Refund webhook", type: "n8n-nodes-base.webhook", typeVersion: 2.1, position: [180, 300], parameters: { path: "refund-requested", httpMethod: "POST" } },
        { id: "normalize_event", name: "Normalize event", type: "n8n-nodes-base.set", typeVersion: 3.4, position: [380, 300], parameters: { mode: "manual", assignments: { assignments: [{ id: "event", name: "event", type: "object", value: "={{ $json.event }}" }] } } },
        { id: "check_event", name: "Check event", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [580, 300], parameters: { conditions: { string: [{ value1: "={{ $json.event.id }}", operation: "isNotEmpty" }] } } },
        { id: "http_refund", name: "Create refund", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [780, 300], parameters: { method: "POST", url: "mock://refunds", body: { event_id: "={{ $json.event.id }}", amount: "={{ $json.event.amount }}" }, headers: {} } },
        { id: "respond_ok", name: "Acknowledge", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.4, position: [980, 300], parameters: { respondWith: "json", responseBody: "received" } },
      ],
      connections: {
        "Refund webhook": { main: [[{ node: "Normalize event", type: "main", index: 0 }]] },
        "Normalize event": { main: [[{ node: "Check event", type: "main", index: 0 }]] },
        "Check event": { main: [[{ node: "Create refund", type: "main", index: 0 }]] },
        "Create refund": { main: [[{ node: "Acknowledge", type: "main", index: 0 }]] },
      },
    }),
    { demoSeed: true, fixture: { event: { id: "evt_refund_001", amount: 4200 } } },
  );
}

function findSimpleJsonPaths(value: unknown, path = "$", depth = 0): string[] {
  if (depth > 16) return [];
  if (Array.isArray(value)) return [];
  if (!isObject(value)) return [path];
  return Object.entries(value).flatMap(([key, child]) =>
    SIMPLE_PATH_FIELD.test(key) && !DANGEROUS_PATH_FIELD.test(key)
      ? findSimpleJsonPaths(child, `${path}.${key}`, depth + 1)
      : [],
  );
}

function readSimpleJsonPath(value: unknown, path: string): unknown {
  if (!/^\$(?:\.[A-Za-z_$][A-Za-z0-9_$]{0,63})+$/.test(path)) return undefined;
  return path.slice(2).split(".").reduce<unknown>((current, segment) =>
    isObject(current) && !DANGEROUS_PATH_FIELD.test(segment) && Object.hasOwn(current, segment)
      ? current[segment]
      : undefined, value);
}

function jsonPathExpression(path: string): string {
  return `={{ $json${path.slice(1)} }}`;
}

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (!isObject(value)) return [];
  return Object.values(value).flatMap(stringsIn);
}

function inferBusinessKeyPath(workflow: WorkflowResource, effect: RetryProofNode): string {
  const fixturePaths = findSimpleJsonPaths(workflow.fixture);
  const fixtureSet = new Set(fixturePaths);
  const expressionPaths = stringsIn(effect.parameters).flatMap((value) =>
    [...value.matchAll(/\$json((?:\.[A-Za-z_$][A-Za-z0-9_$]{0,63})+)/g)].map((match) => `$${match[1]}`),
  );
  const expressed = expressionPaths.find((path) => fixtureSet.has(path) && /(?:^|\.)(?:id|key|event_id|message_id)$/i.test(path));
  if (expressed) return expressed;
  const identifier = fixturePaths.find((path) => /(?:^|\.)(?:id|key|event_id|message_id)$/i.test(path));
  if (identifier) return identifier;
  throw new RetryProofEngineError(
    "BUSINESS_KEY_REQUIRED",
    "RetryProof could not infer a stable business key. Add an id or key field to the synthetic fixture and reference it from the HTTP effect.",
    422,
  );
}

function declaredScenarios(effectName: string, seeded: boolean): RetryProofScenario[] {
  const timeoutId = seeded ? "timeout_after_refund" : "timeout_after_effect";
  return [
    { id: "duplicate_delivery", label: `Duplicate delivery reaches ${effectName}`, faultPhase: "before_replayed_delivery", deliveries: 2 },
    { id: timeoutId, label: `${effectName} succeeds, response times out, platform retries`, faultPhase: "after_effect_before_response", deliveries: 2 },
    { id: "rate_limited_then_retry", label: `${effectName} is rate limited before the effect, then retried`, faultPhase: "before_effect", deliveries: 2 },
    { id: "partial_failure_then_retry", label: `${effectName} succeeds before a downstream partial failure and retry`, faultPhase: "after_node", deliveries: 2 },
  ];
}

function buildRiskPlan(
  workflow: WorkflowResource,
  provenance: RiskAnalysis["provenance"],
  preferredBusinessKeyPath?: string,
): RiskAnalysis {
  if (!workflow.compatibility.canExecute) {
    throw new RetryProofEngineError("UNSUPPORTED_WORKFLOW", "The deterministic path contains unsupported nodes.", 422);
  }
  const effects = workflow.canonical.nodes.filter((node) => node.type === "n8n-nodes-base.httpRequest");
  const webhooks = workflow.canonical.nodes.filter((node) => node.type === "n8n-nodes-base.webhook");
  const responses = workflow.canonical.nodes.filter((node) => node.type === "n8n-nodes-base.respondToWebhook");
  if (effects.length !== 1 || webhooks.length !== 1 || responses.length !== 1) {
    throw new RetryProofEngineError(
      "TOPOLOGY_REQUIRES_REVIEW",
      "The end-to-end path currently requires exactly one webhook, one HTTP side effect, and one webhook response. Other compatible graphs remain diagnosis-only.",
      422,
    );
  }
  const effect = effects[0]!;
  const method = String(effect.parameters.method ?? "POST").toUpperCase();
  if (!new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method)) {
    throw new RetryProofEngineError("NO_CONSEQUENTIAL_EFFECT", "The supported end-to-end path requires a POST, PUT, PATCH, or DELETE HTTP effect.", 422);
  }
  const businessKeyPath = preferredBusinessKeyPath ?? inferBusinessKeyPath(workflow, effect);
  if (readSimpleJsonPath(workflow.fixture, businessKeyPath) === undefined) {
    throw new RetryProofEngineError("BUSINESS_KEY_MISSING", "The selected business key path does not exist in the synthetic fixture.", 422);
  }
  const url = String(effect.parameters.url ?? "mock://effect");
  const sideEffect = {
    nodeId: effect.id,
    nodeName: effect.name,
    effectId: effectId(url),
    method,
    url,
    businessKeyPath,
  };
  const keyLabel = businessKeyPath.replace(/^\$\./, "");
  const invariant: RiskAnalysis["invariant"] = {
    id: `${sideEffect.effectId.replace(/[^A-Za-z0-9_]+/g, "_") || "effect"}_at_most_once`,
    statement: `For each ${keyLabel}, create at most one ${sideEffect.effectId} effect across retries.`,
    oracle: { type: "at_most_once_effect", effectId: sideEffect.effectId, keyPath: "$.key", maxCount: 1 },
    sourceNodeIds: [effect.id],
    approved: false,
  };
  const plan = {
    workflowId: workflow.id,
    sideEffect,
    invariant,
    scenarios: declaredScenarios(effect.name, workflow.demoSeed),
  };
  return { id: randomUUID(), planHash: hash(plan), planVersion: 1, ...plan, provenance };
}

export function proposeDeterministicRiskPlan(workflow: WorkflowResource): RiskAnalysis {
  return buildRiskPlan(workflow, {
    mode: "deterministic-fallback",
    model: "none",
    promptVersion: "deterministic-risk-analyzer-v1",
    label: "Deterministic, graph-grounded fallback contract; human approval and live validation are required.",
    sourceRepository: CANONICAL_SOURCE_REPOSITORY,
    sourceCommit: CANONICAL_SOURCE_COMMIT,
  });
}

export function proposeGroundedLiveRiskPlan(
  workflow: WorkflowResource,
  proposal: { effectNodeId: string; businessKeyPath: string; invariantStatement: string },
  provenance: { model: string; requestId: string },
): RiskAnalysis {
  const effect = workflow.canonical.nodes.find((node) => node.id === proposal.effectNodeId);
  if (!effect || effect.type !== "n8n-nodes-base.httpRequest") {
    throw new RetryProofEngineError("UNGROUNDED_MODEL_OUTPUT", "GPT-5.6 cited an unavailable HTTP effect node.", 422);
  }
  if (readSimpleJsonPath(workflow.fixture, proposal.businessKeyPath) === undefined) {
    throw new RetryProofEngineError("UNGROUNDED_MODEL_OUTPUT", "GPT-5.6 cited a business key that is absent from the synthetic fixture.", 422);
  }
  const referencedPaths = new Set(stringsIn(effect.parameters).flatMap((value) =>
    [...value.matchAll(/\$json((?:\.[A-Za-z_$][A-Za-z0-9_$]{0,63})+)/g)].map((match) => `$${match[1]}`),
  ));
  if (!referencedPaths.has(proposal.businessKeyPath)) {
    throw new RetryProofEngineError("UNGROUNDED_MODEL_OUTPUT", "GPT-5.6 cited a business key that the approved effect does not reference.", 422);
  }
  const statement = proposal.invariantStatement.trim();
  if (!statement || statement.length > 240 || /exactly[- ]once|production (?:safe|safety|ready)/i.test(statement)) {
    throw new RetryProofEngineError("UNGROUNDED_MODEL_OUTPUT", "GPT-5.6 returned an unsafe or invalid invariant statement.", 422);
  }
  const plan = buildRiskPlan(workflow, {
    mode: "live",
    model: provenance.model,
    requestId: provenance.requestId,
    promptVersion: "risk-analyzer-v2",
    label: "Live GPT-5.6 structured proposal; graph and fixture grounding validated before human approval.",
    sourceRepository: CANONICAL_SOURCE_REPOSITORY,
    sourceCommit: CANONICAL_SOURCE_COMMIT,
  }, proposal.businessKeyPath);
  const invariant = { ...plan.invariant, statement };
  const bound = {
    workflowId: plan.workflowId,
    sideEffect: plan.sideEffect,
    invariant,
    scenarios: plan.scenarios,
  };
  return { ...plan, invariant, planHash: hash(bound) };
}

export function proposeCachedRiskPlan(workflow: WorkflowResource): RiskAnalysis {
  if (!workflow.demoSeed) {
    throw new RetryProofEngineError(
      "CACHED_DEMO_ONLY",
      "The GPT-5.6-informed cached contract is limited to the seeded synthetic demo.",
      422,
    );
  }
  return buildRiskPlan(workflow, {
      mode: "cached",
      model: "gpt-5.6-sol",
      promptVersion: "risk-analyzer-v1",
      label: "Locally derived GPT-5.6-informed demo contract; deterministic validation runs live.",
      sourceRepository: CANONICAL_SOURCE_REPOSITORY,
      sourceCommit: CANONICAL_SOURCE_COMMIT,
    }, "$.event.id");
}

export function approveRiskPlan(
  analysis: RiskAnalysis,
  input: { planHash: string; statement: string; approved: boolean },
): ApprovedRiskPlan {
  if (input.planHash !== analysis.planHash) {
    throw new RetryProofEngineError("STALE_PLAN", "The plan changed. Review the latest contract before approval.", 409);
  }
  if (!input.approved || !input.statement.trim()) {
    throw new RetryProofEngineError("APPROVAL_REQUIRED", "Explicitly approve a non-empty invariant before execution.", 422);
  }
  if (input.statement.trim() !== analysis.invariant.statement) {
    throw new RetryProofEngineError(
      "INVARIANT_CHANGED",
      "The approved invariant must match the analyzed oracle. Re-analyze after changing the contract.",
      409,
    );
  }
  return {
    ...analysis,
    approvedAt: new Date().toISOString(),
    invariant: { ...analysis.invariant, approved: true },
  };
}

type ConnectionTarget = { node: string; type: "main"; index: number };

function pointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function connectionOutputs(canonical: WorkflowResource["canonical"], sourceName: string): ConnectionTarget[][] {
  const connection = canonical.connections[sourceName];
  if (!isObject(connection) || !Array.isArray(connection.main)) return [];
  return connection.main.map((output) => Array.isArray(output)
    ? output.filter((target): target is ConnectionTarget =>
      isObject(target)
      && typeof target.node === "string"
      && target.type === "main"
      && typeof target.index === "number")
    : []);
}

function buildExpectedRepair(input: {
  workflow: WorkflowResource;
  approved: ApprovedRiskPlan;
}): {
  patch: RepairResource["patch"];
  patchedCanonical: WorkflowResource["canonical"];
  changedNodeIds: string[];
} {
  const source = input.workflow.canonical;
  const effectIndex = source.nodes.findIndex((node) => node.id === input.approved.sideEffect.nodeId);
  const responses = source.nodes.filter((node) => node.type === "n8n-nodes-base.respondToWebhook");
  if (effectIndex < 0 || responses.length !== 1) {
    throw new RetryProofEngineError("REPAIR_UNSUPPORTED", "The bounded repair requires the approved HTTP effect and exactly one webhook response.", 422);
  }
  const effect = source.nodes[effectIndex]!;
  const response = responses[0]!;
  const incomingEdges: Array<{ sourceName: string; sourceId: string; outputIndex: number; targetIndex: number }> = [];
  for (const [sourceName] of Object.entries(source.connections)) {
    const outputs = connectionOutputs(source, sourceName);
    for (let outputIndex = 0; outputIndex < outputs.length; outputIndex += 1) {
      const targetIndex = outputs[outputIndex]!.findIndex((target) => target.node === effect.name);
      if (targetIndex >= 0) {
        const sourceNode = source.nodes.find((node) => node.name === sourceName);
        if (sourceNode) incomingEdges.push({ sourceName, sourceId: sourceNode.id, outputIndex, targetIndex });
      }
    }
  }
  if (incomingEdges.length !== 1) {
    throw new RetryProofEngineError("REPAIR_UNSUPPORTED", "The approved effect must have exactly one incoming graph edge.", 422);
  }
  const incoming = incomingEdges[0]!;
  const reservedIds = new Set(source.nodes.map((node) => node.id));
  const reservedNames = new Set(source.nodes.map((node) => node.name));
  const generated = [
    ["retryproof_bind_key", "RetryProof · Bind reservation key"],
    ["retryproof_reserve_key", "RetryProof · Reserve business key"],
    ["retryproof_reservation_acquired", "RetryProof · Reservation acquired?"],
  ] as const;
  if (generated.some(([id, name]) => reservedIds.has(id) || reservedNames.has(name))) {
    throw new RetryProofEngineError("REPAIR_ALREADY_PRESENT", "The workflow already contains RetryProof repair nodes. Import the original source workflow to avoid stacking repairs.", 409);
  }

  const [[bindId, bindName], [reservationId, reservationName], [branchId, branchName]] = generated;
  const keyExpression = jsonPathExpression(input.approved.sideEffect.businessKeyPath);
  const reservationAssignment = {
    id: "retryproof-reservation-values",
    name: "retryProofReservationValues",
    type: "array",
    value: [input.workflow.sourceHash, input.approved.invariant.id, keyExpression],
  };
  const bindNode: RetryProofNode = {
    id: bindId,
    name: bindName,
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [effect.position[0] - 300, effect.position[1]],
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: { assignments: [reservationAssignment] },
    },
  };
  const reservationNode: RetryProofNode = {
    id: reservationId,
    name: reservationName,
    type: "n8n-nodes-base.postgres",
    typeVersion: 2.6,
    position: [effect.position[0] - 200, effect.position[1]],
    alwaysOutputData: true,
    parameters: {
      operation: "executeQuery",
      query: POSTGRES_RESERVATION_QUERY,
      options: { queryReplacement: "={{ $json.retryProofReservationValues }}" },
    },
  };
  const branchNode: RetryProofNode = {
    id: branchId,
    name: branchName,
    type: "n8n-nodes-base.if",
    typeVersion: 2.2,
    position: [effect.position[0] - 100, effect.position[1]],
    parameters: {
      conditions: {
        conditions: [{
          leftValue: "={{ $json.entity_key }}",
          rightValue: "",
          operator: { type: "string", operation: "isNotEmpty" },
        }],
      },
    },
  };

  const nodes = structuredClone(source.nodes);
  const existingHeaderContainer = isObject(effect.parameters.headerParameters) ? effect.parameters.headerParameters : {};
  const existingHeaders = Array.isArray(existingHeaderContainer.parameters)
    ? existingHeaderContainer.parameters.filter((entry) => isObject(entry) && String(entry.name ?? "").toLowerCase() !== "idempotency-key")
    : [];
  const headerParameters = { ...existingHeaderContainer, parameters: [...existingHeaders, { name: "Idempotency-Key", value: keyExpression }] };
  nodes[effectIndex] = {
    ...nodes[effectIndex]!,
    parameters: {
      ...nodes[effectIndex]!.parameters,
      headerParameters,
    },
  };
  nodes.push(bindNode, reservationNode, branchNode);

  const connections = structuredClone(source.connections);
  const incomingConnection = connections[incoming.sourceName] as JsonObject;
  const main = incomingConnection.main as unknown[][];
  const output = main[incoming.outputIndex] as JsonObject[];
  output[incoming.targetIndex] = { ...output[incoming.targetIndex], node: bindName };
  connections[bindName] = { main: [[{ node: reservationName, type: "main", index: 0 }]] };
  connections[reservationName] = { main: [[{ node: branchName, type: "main", index: 0 }]] };
  connections[branchName] = {
    main: [
      [{ node: effect.name, type: "main", index: 0 }],
      [{ node: response.name, type: "main", index: 0 }],
    ],
  };
  const patchedCanonical = { nodes, connections };
  const patch: RepairResource["patch"] = [
    { op: "add", path: "/nodes/-", value: bindNode },
    { op: "add", path: "/nodes/-", value: reservationNode },
    { op: "add", path: "/nodes/-", value: branchNode },
    {
      op: "replace",
      path: `/connections/${pointerSegment(incoming.sourceName)}/main/${incoming.outputIndex}/${incoming.targetIndex}/node`,
      value: bindName,
    },
    { op: "add", path: `/connections/${pointerSegment(bindName)}`, value: connections[bindName] },
    { op: "add", path: `/connections/${pointerSegment(reservationName)}`, value: connections[reservationName] },
    { op: "add", path: `/connections/${pointerSegment(branchName)}`, value: connections[branchName] },
    {
      op: isObject(effect.parameters.headerParameters) ? "replace" : "add",
      path: `/nodes/${effectIndex}/parameters/headerParameters`,
      value: headerParameters,
    },
  ];
  return {
    patch,
    patchedCanonical,
    changedNodeIds: [incoming.sourceId, bindNode.id, reservationNode.id, branchNode.id, effect.id].sort(),
  };
}

function validateRepair(input: {
  workflow: WorkflowResource;
  approved: ApprovedRiskPlan;
  before: ExecutionResult;
  repair: RepairResource;
}): void {
  const expected = buildExpectedRepair(input);
  const issues: string[] = [];
  if (input.repair.sourceHash !== input.workflow.sourceHash) issues.push("source hash mismatch");
  if (input.repair.analysisId !== input.approved.id) issues.push("analysis mismatch");
  if (input.repair.regressionFixture.sourceSuiteHash !== input.before.suiteHash) issues.push("regression suite mismatch");
  if (stable(input.repair.patch) !== stable(expected.patch)) issues.push("patch differs from the bounded repair contract");
  if (stable(input.repair.patchedCanonical) !== stable(expected.patchedCanonical)) issues.push("patched graph differs from the validated repair");
  if (stable([...input.repair.changedNodeIds].sort()) !== stable(expected.changedNodeIds)) issues.push("changed-node manifest mismatch");
  if (input.repair.repairedWorkflowHash !== hash(expected.patchedCanonical)) issues.push("repaired workflow hash mismatch");
  if (scanSecretPaths(input.repair.patchedCanonical).length > 0) issues.push("patched graph contains an inline secret");
  if (issues.length > 0) {
    throw new RetryProofEngineError("REPAIR_VALIDATION_FAILED", `The repair failed deterministic validation: ${issues.join("; ")}.`, 422);
  }
}

function executeDeclaredScenario(input: {
  canonical: WorkflowResource["canonical"];
  effectNodeId: string;
  effectName: string;
  effectKey: string;
  scenario: RetryProofScenario;
}): ExecutionResult["scenarioResults"][number] {
  const { canonical, effectNodeId, effectName, effectKey, scenario } = input;
  const nodesByName = new Map(canonical.nodes.map((node) => [node.name, node]));
  const entry = canonical.nodes.find((node) => node.type === "n8n-nodes-base.webhook");
  if (!entry) throw new RetryProofEngineError("INVALID_GRAPH", "The deterministic workflow has no webhook entry node.", 422);
  const reservations = new Set<string>();
  const traces: ExecutionResult["traces"] = [];
  let effectCount = 0;

  for (const delivery of [1, 2] as const) {
    if (delivery === 2 && scenario.faultPhase === "before_replayed_delivery") {
      traces.push({ delivery, event: "duplicate_delivery_injected", detail: "The same synthetic event is delivered again.", effectCount });
    }
    let current: RetryProofNode | undefined = entry;
    let reservationAcquired = false;
    let terminated = false;
    for (let step = 0; current && step < 64; step += 1) {
      let outputIndex = 0;
      if (current.type === "n8n-nodes-base.postgres") {
        if (current.parameters.query !== POSTGRES_RESERVATION_QUERY || current.alwaysOutputData !== true) {
          throw new RetryProofEngineError("UNSUPPORTED_REPAIR", "The simulator accepts only the validated RetryProof reservation node.", 422);
        }
        reservationAcquired = !reservations.has(effectKey);
        if (reservationAcquired) reservations.add(effectKey);
        if (!reservationAcquired) {
          traces.push({ delivery, event: "reservation_conflict", detail: "Durable reservation suppresses the duplicate effect.", effectCount });
        }
      } else if (current.id === "retryproof_reservation_acquired") {
        outputIndex = reservationAcquired ? 0 : 1;
      } else if (current.type === "n8n-nodes-base.if") {
        outputIndex = 0;
      } else if (current.id === effectNodeId) {
        if (delivery === 1 && scenario.faultPhase === "before_effect") {
          traces.push({ delivery, event: "rate_limit_injected", detail: `A deterministic rate limit interrupts ${effectName} before the effect.`, effectCount });
          terminated = true;
          break;
        }
        effectCount += 1;
        traces.push({
          delivery,
          event: delivery === 1 ? "effect_committed" : "effect_replayed",
          detail: delivery === 1 ? `Mock ${effectName} effect recorded.` : `Retry records a second mock ${effectName} effect.`,
          effectCount,
        });
        if (delivery === 1 && scenario.faultPhase === "after_effect_before_response") {
          traces.push({ delivery, event: "timeout_injected", detail: "Response lost after effect; retry scheduled.", effectCount });
          terminated = true;
          break;
        }
        if (delivery === 1 && scenario.faultPhase === "after_node") {
          traces.push({ delivery, event: "partial_failure_injected", detail: "A downstream partial failure triggers a retry after the effect.", effectCount });
          terminated = true;
          break;
        }
      } else if (current.type === "n8n-nodes-base.respondToWebhook") {
        terminated = true;
        break;
      }
      const nextName: string | undefined = connectionOutputs(canonical, current.name)[outputIndex]?.[0]?.node;
      current = nextName ? nodesByName.get(nextName) : undefined;
      if (!current) terminated = true;
    }
    if (!terminated) throw new RetryProofEngineError("INVALID_GRAPH", "Workflow traversal exceeded the 64-node deterministic safety bound.", 422);
  }
  return {
    scenarioId: scenario.id,
    label: scenario.label,
    faultPhase: scenario.faultPhase,
    passed: effectCount <= 1,
    effectCount,
    traces,
  };
}

export function runDeterministicSuite(input: {
  workflow: WorkflowResource;
  approved: ApprovedRiskPlan;
  phase: "before" | "after";
  seed: string;
  repair?: RepairResource;
}): ExecutionResult {
  if (!input.approved.invariant.approved) {
    throw new RetryProofEngineError("APPROVAL_REQUIRED", "Approve the invariant before execution.", 422);
  }
  if (input.phase === "after") {
    if (!input.repair) throw new RetryProofEngineError("REPAIR_REQUIRED", "A validated repair is required before the after run.", 409);
    const sourceBefore = runDeterministicSuite({ ...input, phase: "before", repair: undefined });
    validateRepair({ workflow: input.workflow, approved: input.approved, before: sourceBefore, repair: input.repair });
  }
  const canonical = input.phase === "after" ? input.repair!.patchedCanonical : input.workflow.canonical;
  const rawEffectKey = readSimpleJsonPath(input.workflow.fixture, input.approved.sideEffect.businessKeyPath);
  if (rawEffectKey === undefined || rawEffectKey === null || (typeof rawEffectKey === "object")) {
    throw new RetryProofEngineError("INVALID_BUSINESS_KEY", "The approved business key must resolve to a scalar fixture value.", 422);
  }
  const effectKey = String(rawEffectKey);
  const scenarioResults = input.approved.scenarios.map((scenario) => executeDeclaredScenario({
    canonical,
    effectNodeId: input.approved.sideEffect.nodeId,
    effectName: input.approved.sideEffect.nodeName,
    effectKey,
    scenario,
  }));
  const primary = scenarioResults.find((result) => result.faultPhase === "after_effect_before_response") ?? scenarioResults[0];
  if (!primary) throw new RetryProofEngineError("SCENARIO_REQUIRED", "At least one approved scenario is required.", 422);
  const effectCount = Math.max(...scenarioResults.map((result) => result.effectCount));
  const traces = primary.traces;
  const workflowHash = input.phase === "after" ? input.repair!.repairedWorkflowHash : input.workflow.sourceHash;
  const payload = {
    workflowHash,
    invariantId: input.approved.invariant.id,
    scenarioIds: scenarioResults.map((result) => result.scenarioId),
    seed: input.seed,
    phase: input.phase,
    effectKey,
    effectCount,
    traces,
    scenarioResults,
  };
  return {
    id: randomUUID(),
    analysisId: input.approved.id,
    phase: input.phase,
    seed: input.seed,
    scenarioId: primary.scenarioId,
    suiteHash: hash(payload),
    workflowHash,
    passed: scenarioResults.every((result) => result.effectCount <= input.approved.invariant.oracle.maxCount),
    effectCount,
    effectKey,
    deliveries: 2,
    traces,
    scenarioResults,
  };
}

export function createCachedRepair(input: {
  workflow: WorkflowResource;
  approved: ApprovedRiskPlan;
  before: ExecutionResult;
}): RepairResource {
  if (input.before.passed || input.before.workflowHash !== input.workflow.sourceHash) {
    throw new RetryProofEngineError("COUNTEREXAMPLE_REQUIRED", "Repair generation requires a bound failing source run.", 409);
  }
  const expected = buildExpectedRepair(input);
  const repair: RepairResource = {
    id: randomUUID(),
    analysisId: input.approved.id,
    sourceHash: input.workflow.sourceHash,
    repairedWorkflowHash: hash(expected.patchedCanonical),
    strategy: "durable_reservation_before_effect",
    changedNodeIds: expected.changedNodeIds,
    explanation: "Reserve the approved business key before the consequential effect, route conflicts around it, and reuse the key downstream.",
    patch: expected.patch,
    patchedCanonical: expected.patchedCanonical,
    regressionFixture: {
      seed: input.before.seed,
      scenarioIds: input.before.scenarioResults.map((result) => result.scenarioId),
      invariantId: input.approved.invariant.id,
      sourceSuiteHash: input.before.suiteHash,
    },
    validation: {
      passed: true,
      checks: ["source_hash_bound", "patch_structure_valid", "credential_scan_clear", "source_fixture_failed"],
    },
    provenance: {
      mode: input.workflow.demoSeed ? "cached" : "bounded-template",
      generatedBy: input.workflow.demoSeed ? "cached-template" : "validated-template",
      label: input.workflow.demoSeed
        ? "Locally derived repair template aligned with the canonical Codex-validated strategy; validators run live."
        : "Graph-specific bounded repair generated from the approved contract; source binding and validators run live.",
      sourceRepository: CANONICAL_SOURCE_REPOSITORY,
      sourceCommit: CANONICAL_SOURCE_COMMIT,
    },
  };
  validateRepair({ ...input, repair });
  return repair;
}

export function createLiveCodexRepair(input: {
  workflow: WorkflowResource;
  approved: ApprovedRiskPlan;
  before: ExecutionResult;
  candidate: LiveCodexRepairCandidate;
}): RepairResource {
  if (input.before.passed || input.before.workflowHash !== input.workflow.sourceHash) {
    throw new RetryProofEngineError("COUNTEREXAMPLE_REQUIRED", "Repair generation requires a bound failing source run.", 409);
  }
  const expected = buildExpectedRepair(input);
  const candidate = input.candidate;
  const issues: string[] = [];
  if (candidate.schemaVersion !== "1") issues.push("unsupported candidate schema");
  if (!candidate.requestId || candidate.requestId.length > 128) issues.push("invalid worker request id");
  if (!candidate.threadId || candidate.threadId.length > 256) issues.push("invalid Codex thread id");
  if (!Number.isInteger(candidate.attempts) || candidate.attempts < 1 || candidate.attempts > 2) issues.push("invalid Codex attempt count");
  if (!candidate.generatedAt || Number.isNaN(Date.parse(candidate.generatedAt))) issues.push("invalid generation timestamp");
  if (candidate.sourceHash !== input.workflow.sourceHash) issues.push("source hash mismatch");
  if (candidate.analysisId !== input.approved.id) issues.push("analysis mismatch");
  if (candidate.strategy !== "durable_reservation_before_effect") issues.push("unsupported repair strategy");
  if (!candidate.explanation.trim() || candidate.explanation.length > 2_000) issues.push("invalid repair explanation");
  if (stable(candidate.patch) !== stable(expected.patch)) issues.push("patch differs from the bounded repair contract");
  if (stable([...candidate.changedNodeIds].sort()) !== stable(expected.changedNodeIds)) issues.push("changed-node manifest mismatch");
  const expectedFixture: RepairResource["regressionFixture"] = {
    seed: input.before.seed,
    scenarioIds: input.before.scenarioResults.map((result) => result.scenarioId),
    invariantId: input.approved.invariant.id,
    sourceSuiteHash: input.before.suiteHash,
  };
  if (stable(candidate.regressionFixture) !== stable(expectedFixture)) issues.push("regression fixture mismatch");
  if (issues.length > 0) {
    throw new RetryProofEngineError("REPAIR_VALIDATION_FAILED", `The live Codex repair failed deterministic validation: ${issues.join("; ")}.`, 422);
  }

  const repair: RepairResource = {
    id: randomUUID(),
    analysisId: input.approved.id,
    sourceHash: input.workflow.sourceHash,
    repairedWorkflowHash: hash(expected.patchedCanonical),
    strategy: candidate.strategy,
    changedNodeIds: expected.changedNodeIds,
    explanation: candidate.explanation,
    patch: expected.patch,
    patchedCanonical: expected.patchedCanonical,
    regressionFixture: expectedFixture,
    validation: {
      passed: true,
      checks: ["source_hash_bound", "patch_structure_valid", "credential_scan_clear", "source_fixture_failed", "codex_output_bound"],
    },
    provenance: {
      mode: "live-codex",
      generatedBy: "codex",
      label: "Fresh Codex repair accepted only after exact patch, source, fixture, secret, and deterministic replay validation.",
      sourceRepository: CANONICAL_SOURCE_REPOSITORY,
      sourceCommit: CANONICAL_SOURCE_COMMIT,
      requestId: candidate.requestId,
      threadId: candidate.threadId,
      attempts: candidate.attempts,
      generatedAt: candidate.generatedAt,
    },
  };
  validateRepair({ workflow: input.workflow, approved: input.approved, before: input.before, repair });
  return repair;
}

export function createEvidenceArtifact(input: {
  workflow: WorkflowResource;
  approved: ApprovedRiskPlan;
  before: ExecutionResult;
  repair: RepairResource;
  after: ExecutionResult;
}): EvidenceArtifact {
  if (input.before.passed || !input.after.passed) {
    throw new RetryProofEngineError("REGRESSION_NOT_PROVEN", "Evidence requires a failing source run and passing repaired run.", 409);
  }
  if (
    input.before.seed !== input.after.seed ||
    stable(input.before.scenarioResults.map((result) => result.scenarioId)) !== stable(input.after.scenarioResults.map((result) => result.scenarioId)) ||
    input.before.effectKey !== input.after.effectKey
  ) {
    throw new RetryProofEngineError("SUITE_MISMATCH", "Before and after evidence must use the identical seed, scenario, and effect key.", 409);
  }
  const receipt: EvidenceArtifact["receipt"] = {
    schemaVersion: "1",
    claim: "The approved at-most-once invariant failed before repair and passed after repair under the declared deterministic scenario.",
    workflow: { id: input.workflow.id, name: input.workflow.name, sourceHash: input.workflow.sourceHash },
    invariant: input.approved.invariant,
    scenario: { ids: input.before.scenarioResults.map((result) => result.scenarioId), seed: input.before.seed, deliveries: 2 },
    before: {
      suiteHash: input.before.suiteHash,
      passed: input.before.passed,
      effectCount: input.before.effectCount,
      effectKey: input.before.effectKey,
    },
    after: {
      suiteHash: input.after.suiteHash,
      passed: input.after.passed,
      effectCount: input.after.effectCount,
      effectKey: input.after.effectKey,
    },
    repair: {
      strategy: input.repair.strategy,
      changedNodeIds: input.repair.changedNodeIds,
      sourceHash: input.repair.sourceHash,
      repairedWorkflowHash: input.repair.repairedWorkflowHash,
    },
    modelArtifacts: {
      analysis: input.approved.provenance.mode === "cached" ? "gpt-5.6-informed-template" : input.approved.provenance.mode,
      repair: input.repair.provenance.mode === "live-codex" ? "codex-live" : "codex-validated-template",
      deterministicValidation: "live",
    },
    limitations: [
      "Mock adapters only; no real payment or network call is executed.",
      "A passing declared scenario is not proof of exactly-once execution or production safety.",
      "The receipt covers only the approved invariant, pinned workflow, fixture, seed, and scenario.",
    ],
    generatedAt: new Date().toISOString(),
  };
  return {
    id: randomUUID(),
    analysisId: input.approved.id,
    repairId: input.repair.id,
    sha256: createHash("sha256").update(serializeEvidenceReceipt(receipt)).digest("hex"),
    receipt,
  };
}

export function serializeEvidenceReceipt(receipt: EvidenceArtifact["receipt"]): string {
  const normalize = (value: unknown, depth = 0, visited = { count: 0 }): unknown => {
    assertTraversal(depth, visited);
    if (Array.isArray(value)) return value.map((child) => normalize(child, depth + 1, visited));
    if (!isObject(value)) return value;
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child, depth + 1, visited)]),
    );
  };
  return JSON.stringify(normalize(receipt), null, 2);
}
