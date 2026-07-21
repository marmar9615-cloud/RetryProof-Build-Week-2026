import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt, or, sql } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { strToU8, zipSync } from "fflate";
import { db, retryProofAdmissionBucketsTable, retryProofSessionsTable } from "@workspace/db";

import {
  approveRiskPlan,
  createCachedRepair,
  createEvidenceArtifact,
  createLiveCodexRepair,
  createSeededWorkflow,
  importWorkflow,
  RetryProofEngineError,
  runDeterministicSuite,
  serializeEvidenceReceipt,
  type ApprovedRiskPlan,
  type EvidenceArtifact,
  type ExecutionResult,
  type RepairResource,
  type RiskAnalysis,
  type WorkflowResource,
} from "../lib/retryproof-engine";
import { analyzeWorkflowRisk } from "../lib/retryproof-analyzer";
import { isLiveCodexWorkerConfigured, requestLiveCodexRepair } from "../lib/retryproof-worker";

const router = Router();
const COOKIE = "retryproof_session";
const TTL_MS = 24 * 60 * 60 * 1000;
const MUTATION_LIMIT = 60;
const OPERATION_LIMITS: Record<string, number> = {
  import: 60,
  analysis: 5,
  approval: 10,
  scenarios: 20,
  execution: 20,
  repair: 10,
  recheck: 10,
  "delete-session": 5,
};
const ADMISSION_LIMIT = 30;
const NETWORK_ADMISSION_LIMIT = 300;
const MODEL_NETWORK_LIMIT = 10;
const CODEX_REPAIR_NETWORK_LIMIT = 5;
const ADMISSION_WINDOW_MS = 60 * 60 * 1000;
const PURGE_INTERVAL_MS = 5 * 60 * 1000;

let lastPurgeAt = 0;
let purgePromise: Promise<void> | null = null;

type RuntimeState = {
  workflow?: WorkflowResource;
  analysis?: RiskAnalysis;
  approved?: ApprovedRiskPlan;
  before?: ExecutionResult;
  repair?: RepairResource;
  after?: ExecutionResult;
  artifact?: EvidenceArtifact;
};

type SessionRow = {
  id: string;
  tokenHash: string;
  csrfHash: string;
  state: RuntimeState;
  operationCounts: Record<string, number>;
  expiresAt: Date;
};

class HttpError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

function secret(): string {
  const value = process.env.SESSION_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "test") return "retryproof-test-session-secret";
  throw new Error("SESSION_SECRET must be configured before RetryProof can establish sessions.");
}

function hmac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function csrfToken(token: string): string {
  return hmac(`csrf:${token}`);
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieToken(req: Request): string | null {
  const value = req.cookies?.[COOKIE];
  return typeof value === "string" && value.length >= 32 ? value : null;
}

function setCookie(res: Response, token: string): void {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TTL_MS,
  });
}

function admissionKeys(req: Request): string[] {
  const address = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = (req.get("user-agent") ?? "unknown").slice(0, 256);
  return [
    hmac(`admission:client:${address}:${userAgent}`),
    hmac(`admission:network:${address}`),
  ];
}

async function consumeAdmissionBucket(keyHash: string, limit: number): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - ADMISSION_WINDOW_MS);
  const [bucket] = await db
    .insert(retryProofAdmissionBucketsTable)
    .values({ keyHash, windowStartedAt: now, count: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: retryProofAdmissionBucketsTable.keyHash,
      set: {
        count: sql<number>`case
          when ${retryProofAdmissionBucketsTable.windowStartedAt} <= ${cutoff} then 1
          else ${retryProofAdmissionBucketsTable.count} + 1
        end`,
        windowStartedAt: sql<Date>`case
          when ${retryProofAdmissionBucketsTable.windowStartedAt} <= ${cutoff} then ${now}
          else ${retryProofAdmissionBucketsTable.windowStartedAt}
        end`,
        updatedAt: now,
      },
      setWhere: or(
        lt(retryProofAdmissionBucketsTable.windowStartedAt, cutoff),
        lt(retryProofAdmissionBucketsTable.count, limit),
      ),
    })
    .returning({ count: retryProofAdmissionBucketsTable.count });
  if (!bucket) {
    throw new HttpError("SESSION_RATE_LIMITED", "Too many anonymous lab sessions were created from this client. Try again later.", 429);
  }
}

async function consumeAdmission(req: Request): Promise<void> {
  const [clientKey, networkKey] = admissionKeys(req);
  await consumeAdmissionBucket(clientKey, ADMISSION_LIMIT);
  await consumeAdmissionBucket(networkKey, NETWORK_ADMISSION_LIMIT);
}

async function purgeExpiredState(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastPurgeAt < PURGE_INTERVAL_MS) return;
  if (purgePromise) return purgePromise;

  lastPurgeAt = now;
  const current = new Date(now);
  purgePromise = Promise.all([
    db.delete(retryProofSessionsTable).where(lt(retryProofSessionsTable.expiresAt, current)),
    db.delete(retryProofAdmissionBucketsTable).where(
      lt(retryProofAdmissionBucketsTable.windowStartedAt, new Date(now - (2 * ADMISSION_WINDOW_MS))),
    ),
  ]).then(() => undefined).finally(() => {
    purgePromise = null;
  });
  return purgePromise;
}

async function findSession(token: string): Promise<SessionRow | null> {
  const [row] = await db
    .select()
    .from(retryProofSessionsTable)
    .where(
      and(
        eq(retryProofSessionsTable.tokenHash, hmac(token)),
        gt(retryProofSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    state: row.state as RuntimeState,
    operationCounts: row.operationCounts ?? {},
  };
}

async function establish(req: Request, res: Response): Promise<{ row: SessionRow; token: string }> {
  const existingToken = cookieToken(req);
  if (existingToken) {
    const existing = await findSession(existingToken);
    if (existing) return { row: existing, token: existingToken };
  }

  await consumeAdmission(req);
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const [created] = await db
    .insert(retryProofSessionsTable)
    .values({
      tokenHash: hmac(token),
      csrfHash: hmac(csrfToken(token)),
      state: {},
      operationCounts: {},
      expiresAt: new Date(now.getTime() + TTL_MS),
    })
    .returning();
  if (!created) throw new Error("RetryProof could not establish a session.");
  setCookie(res, token);
  return {
    row: { ...created, state: {}, operationCounts: {} },
    token,
  };
}

async function requireSession(req: Request): Promise<{ row: SessionRow; token: string }> {
  const token = cookieToken(req);
  if (!token) throw new HttpError("SESSION_REQUIRED", "Establish a RetryProof session first.", 401);
  const row = await findSession(token);
  if (!row) throw new HttpError("SESSION_EXPIRED", "The anonymous lab session expired. Start again.", 401);
  return { row, token };
}

async function requireMutation(req: Request, operation: string): Promise<SessionRow> {
  const { row, token } = await requireSession(req);
  const supplied = req.get("x-csrf-token") ?? "";
  if (!supplied || !safeEqual(hmac(supplied), row.csrfHash) || !safeEqual(supplied, csrfToken(token))) {
    throw new HttpError("CSRF_INVALID", "The RetryProof request could not be verified.", 403);
  }
  const limit = OPERATION_LIMITS[operation] ?? MUTATION_LIMIT;
  const [updated] = await db
    .update(retryProofSessionsTable)
    .set({
      operationCounts: sql<Record<string, number>>`jsonb_set(
        ${retryProofSessionsTable.operationCounts},
        array[${operation}]::text[],
        to_jsonb(coalesce((${retryProofSessionsTable.operationCounts} ->> ${operation})::int, 0) + 1),
        true
      )`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(retryProofSessionsTable.id, row.id),
      sql`coalesce((${retryProofSessionsTable.operationCounts} ->> ${operation})::int, 0) < ${limit}`,
    ))
    .returning({ operationCounts: retryProofSessionsTable.operationCounts });
  if (!updated) {
    throw new HttpError("RATE_LIMITED", "This lab operation reached its session limit.", 429);
  }
  row.operationCounts = updated.operationCounts;
  return row;
}

async function save(row: SessionRow, state: RuntimeState): Promise<void> {
  row.state = state;
  await db
    .update(retryProofSessionsTable)
    .set({
      state: state as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(retryProofSessionsTable.id, row.id));
}

function ifMatch(req: Request): string {
  return (req.get("if-match") ?? "").replace(/^W\//, "").replace(/^"|"$/g, "");
}

function errorResponse(error: unknown): { status: number; body: { error: { code: string; message: string; details?: { paths: string[] } } } } {
  if (error instanceof RetryProofEngineError) {
    return {
      status: error.status,
      body: { error: {
        code: error.code,
        message: error.message,
        ...(error.secretPaths ? { details: { paths: error.secretPaths } } : {}),
      } },
    };
  }
  if (error instanceof HttpError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  }
  return {
    status: 500,
    body: { error: { code: "RETRYPROOF_INTERNAL_ERROR", message: "RetryProof could not complete the request." } },
  };
}

function respondError(error: unknown, res: Response): void {
  const mapped = errorResponse(error);
  res.status(mapped.status).json(mapped.body);
}

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error) => respondError(error, res));
  };
}

router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-RetryProof-Boundary", "deterministic-declared-scenarios-only");
  next();
});

router.get("/ready", route(async (_req, res) => {
  await purgeExpiredState(true);
  res.json({
    ready: true,
    storage: "postgres",
    schema: "retryproof_sessions",
    cachedJudgePath: true,
    customWorkflowPath: true,
    liveAnalysisConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    liveCodexConfigured: isLiveCodexWorkerConfigured(),
  });
}));

router.get("/session", route(async (req, res) => {
  await purgeExpiredState();
  const { row, token } = await establish(req, res);
  res.json({
    session: {
      csrfToken: csrfToken(token),
      expiresAt: row.expiresAt.toISOString(),
      retentionHours: 24,
      state: row.state,
    },
  });
}));

router.delete("/session", route(async (req, res) => {
  const row = await requireMutation(req, "delete-session");
  await db.delete(retryProofSessionsTable).where(eq(retryProofSessionsTable.id, row.id));
  res.clearCookie(COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  res.json({ deleted: true });
}));

router.post("/workflows", route(async (req, res) => {
  const row = await requireMutation(req, "import");
  const demo = req.body?.demo === true;
  const rawWorkflow = typeof req.body?.rawWorkflow === "string" ? req.body.rawWorkflow : null;
  if (!demo && !rawWorkflow) throw new HttpError("WORKFLOW_REQUIRED", "Choose the seeded demo or upload workflow JSON.", 400);
  const workflow = demo
    ? createSeededWorkflow()
    : importWorkflow(rawWorkflow!, { fixture: req.body?.fixture ?? { event: { id: "evt_example_1" } } });
  const state: RuntimeState = { workflow };
  await save(row, state);
  res.status(201).json({ workflow, fixture: workflow.fixture });
}));

router.post("/workflows/:workflowId/analyses", route(async (req, res) => {
  const row = await requireMutation(req, "analysis");
  const workflow = row.state.workflow;
  if (!workflow || workflow.id !== req.params.workflowId) throw new HttpError("WORKFLOW_NOT_FOUND", "Workflow not found in this session.", 404);
  const requestedMode = req.body?.mode;
  const mode = requestedMode === "live" || requestedMode === "cached" || requestedMode === "deterministic"
    ? requestedMode
    : "auto";
  if ((mode === "live" || mode === "auto") && process.env.OPENAI_API_KEY?.trim()) {
    const address = req.ip || req.socket.remoteAddress || "unknown";
    await consumeAdmissionBucket(hmac(`model-analysis:${address}`), MODEL_NETWORK_LIMIT);
  }
  const analysis = await analyzeWorkflowRisk({ workflow, mode, safetyIdentifier: hmac(`model:${row.id}`) });
  await save(row, { workflow, analysis });
  res.status(201).setHeader("ETag", `"${analysis.planHash}"`).json({ analysis });
}));

router.patch("/analyses/:analysisId/plan", route(async (req, res) => {
  const row = await requireMutation(req, "approval");
  const { workflow, analysis } = row.state;
  if (!workflow || !analysis || analysis.id !== req.params.analysisId) throw new HttpError("ANALYSIS_NOT_FOUND", "Analysis not found in this session.", 404);
  const approved = approveRiskPlan(analysis, {
    planHash: ifMatch(req),
    statement: typeof req.body?.statement === "string" ? req.body.statement : analysis.invariant.statement,
    approved: req.body?.approved === true,
  });
  await save(row, { workflow, analysis, approved });
  res.json({ analysis: approved });
}));

router.post("/analyses/:analysisId/scenarios", route(async (req, res) => {
  const row = await requireMutation(req, "scenarios");
  const { approved } = row.state;
  if (!approved || approved.id !== req.params.analysisId) throw new HttpError("APPROVAL_REQUIRED", "Approve the invariant before selecting scenarios.", 409);
  res.status(201).json({ scenarios: approved.scenarios });
}));

router.post("/analyses/:analysisId/executions", route(async (req, res) => {
  const row = await requireMutation(req, "execution");
  const { workflow, analysis, approved, before, repair, after, artifact } = row.state;
  if (!workflow || !analysis || !approved || approved.id !== req.params.analysisId) throw new HttpError("APPROVAL_REQUIRED", "Approve the invariant before execution.", 409);
  const phase = req.body?.phase === "after" ? "after" : "before";
  const seed = typeof req.body?.seed === "string" && req.body.seed ? req.body.seed : "demo-v1";
  if (Buffer.byteLength(seed, "utf8") > 128) {
    throw new HttpError("SEED_TOO_LONG", "The deterministic seed must be 128 bytes or fewer.", 422);
  }
  if (phase === "before" && before?.seed === seed) {
    res.json({ execution: before, replayed: true });
    return;
  }
  if (phase === "after" && after?.seed === seed) {
    res.json({ execution: after, replayed: true });
    return;
  }
  const execution = runDeterministicSuite({ workflow, approved, phase, seed, ...(phase === "after" ? { repair } : {}) });
  const next: RuntimeState = phase === "before"
    ? { workflow, analysis, approved, before: execution }
    : { workflow, analysis, approved, before, repair, after: execution, artifact };
  await save(row, next);
  res.status(201).json({ execution });
}));

router.post("/analyses/:analysisId/repairs", route(async (req, res) => {
  const row = await requireMutation(req, "repair");
  const { workflow, analysis, approved, before } = row.state;
  if (!workflow || !analysis || !approved || !before || approved.id !== req.params.analysisId) throw new HttpError("COUNTEREXAMPLE_REQUIRED", "Run the failing scenario before requesting a repair.", 409);
  const wantsLiveStream = req.body?.mode === "live"
    && String(req.get("accept") ?? "").includes("application/x-ndjson");
  if (req.body?.mode === "live") {
    const address = req.ip || req.socket.remoteAddress || "unknown";
    await consumeAdmissionBucket(hmac(`codex-repair:${address}`), CODEX_REPAIR_NETWORK_LIMIT);
  }
  if (wantsLiveStream) {
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const emit = (payload: unknown) => res.write(`${JSON.stringify(payload)}\n`);
    emit({
      type: "progress",
      stage: "request_authenticated",
      message: "RetryProof authenticated the session and bound this request to the approved failing proof.",
      elapsedMs: 0,
    });
    try {
      const candidate = await requestLiveCodexRepair({
        workflow,
        approved,
        before,
        onProgress: (progress) => emit({ type: "progress", ...progress }),
      });
      emit({
        type: "progress",
        stage: "candidate_received",
        message: "RetryProof received a signed, source-bound candidate from the isolated worker.",
        elapsedMs: null,
      });
      emit({
        type: "progress",
        stage: "deterministic_validation",
        message: "The deterministic gate is checking the exact patch, bindings, fixture, and replay contract.",
        elapsedMs: null,
      });
      const repair = createLiveCodexRepair({ workflow, approved, before, candidate });
      await save(row, { workflow, analysis, approved, before, repair });
      emit({ type: "complete", repair });
    } catch (error) {
      const mapped = errorResponse(error);
      emit({ type: "error", status: mapped.status, ...mapped.body });
    } finally {
      res.end();
    }
    return;
  }
  const repair = req.body?.mode === "live"
    ? createLiveCodexRepair({
        workflow,
        approved,
        before,
        candidate: await requestLiveCodexRepair({ workflow, approved, before }),
      })
    : createCachedRepair({ workflow, approved, before });
  await save(row, { workflow, analysis, approved, before, repair });
  res.status(201).json({ repair });
}));

router.post("/repairs/:repairId/recheck", route(async (req, res) => {
  const row = await requireMutation(req, "recheck");
  const { workflow, analysis, approved, before, repair } = row.state;
  if (!workflow || !analysis || !approved || !before || !repair || repair.id !== req.params.repairId) throw new HttpError("REPAIR_NOT_FOUND", "Validated repair not found in this session.", 404);
  const after = runDeterministicSuite({ workflow, approved, phase: "after", seed: before.seed, repair });
  const artifact = createEvidenceArtifact({ workflow, approved, before, repair, after });
  await save(row, { workflow, analysis, approved, before, repair, after, artifact });
  res.status(201).json({ execution: after, artifact });
}));

router.get("/artifacts/:artifactId", route(async (req, res) => {
  const { row } = await requireSession(req);
  const artifact = row.state.artifact;
  if (!artifact || artifact.id !== req.params.artifactId) throw new HttpError("ARTIFACT_NOT_FOUND", "Evidence artifact not found in this session.", 404);
  res.json({ artifact });
}));

router.get("/artifacts/:artifactId/receipt", route(async (req, res) => {
  const { row } = await requireSession(req);
  const artifact = row.state.artifact;
  if (!artifact || artifact.id !== req.params.artifactId) throw new HttpError("ARTIFACT_NOT_FOUND", "Evidence artifact not found in this session.", 404);
  const receipt = Buffer.from(serializeEvidenceReceipt(artifact.receipt), "utf8");
  res
    .status(200)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Content-Disposition", `attachment; filename="retryproof-receipt-${artifact.sha256.slice(0, 12)}.json"`)
    .setHeader("Content-Length", String(receipt.byteLength))
    .send(receipt);
}));

router.get("/artifacts/:artifactId/download", route(async (req, res) => {
  const { row } = await requireSession(req);
  const { workflow, approved, before, repair, after, artifact } = row.state;
  if (!workflow || !approved || !before || !repair || !after || !artifact || artifact.id !== req.params.artifactId) throw new HttpError("ARTIFACT_NOT_FOUND", "Evidence artifact not found in this session.", 404);
  const archiveFiles: Record<string, Uint8Array> = {
    "receipt.json": strToU8(serializeEvidenceReceipt(artifact.receipt)),
    "source-workflow.json": strToU8(JSON.stringify(workflow.canonical, null, 2)),
    "synthetic-fixture.json": strToU8(JSON.stringify(workflow.fixture, null, 2)),
    "risk-contract.json": strToU8(JSON.stringify(approved, null, 2)),
    "before.json": strToU8(JSON.stringify(before, null, 2)),
    "repair.json": strToU8(JSON.stringify(repair, null, 2)),
    "patched-workflow.json": strToU8(JSON.stringify(repair.patchedCanonical, null, 2)),
    "after.json": strToU8(JSON.stringify(after, null, 2)),
    "LIMITATIONS.txt": strToU8(artifact.receipt.limitations.join("\n")),
  };
  const manifest = {
    schemaVersion: "1",
    receiptSha256: artifact.sha256,
    limitation: "This manifest records the byte length and SHA-256 digest of each listed archive file so a consumer can verify archive consistency. It does not verify signer identity, exactly-once execution, or production safety.",
    entries: Object.keys(archiveFiles).sort().map((path) => ({
      path,
      byteLength: archiveFiles[path]!.byteLength,
      sha256: createHash("sha256").update(archiveFiles[path]!).digest("hex"),
    })),
  };
  const zip = zipSync({
    ...archiveFiles,
    "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
  });
  res
    .status(200)
    .setHeader("Content-Type", "application/zip")
    .setHeader("Content-Disposition", `attachment; filename="retryproof-evidence-${artifact.sha256.slice(0, 12)}.zip"`)
    .setHeader("Content-Length", String(zip.byteLength))
    .send(Buffer.from(zip));
}));

export default router;
