import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const REPLAY_TTL_MS = 10 * 60 * 1000;

type JsonObject = Record<string, unknown>;

export type WorkerRepairCandidate = {
  schemaVersion: "1";
  requestId: string;
  threadId: string;
  attempts: number;
  generatedAt: string;
  sourceHash: string;
  analysisId: string;
  strategy: "durable_reservation_before_effect";
  explanation: string;
  patch: Array<{ op: "add" | "replace"; path: string; value: unknown }>;
  changedNodeIds: string[];
  regressionFixture: {
    seed: string;
    scenarioIds: string[];
    invariantId: string;
    sourceSuiteHash: string;
  };
};

export type WorkerRepairRequest = {
  schemaVersion: "1";
  requestId: string;
  sourceHash: string;
  analysisId: string;
  workflow: JsonObject;
  approvedContract: JsonObject;
  failingTrace: JsonObject;
  regressionFixture: WorkerRepairCandidate["regressionFixture"];
};

export function signWorkerMessage(secret: string, timestamp: string, requestId: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}\n${requestId}\n${body}`)
    .digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseRequest(value: unknown): WorkerRepairRequest {
  if (!isObject(value) || value.schemaVersion !== "1" || typeof value.requestId !== "string"
    || typeof value.sourceHash !== "string" || typeof value.analysisId !== "string"
    || !isObject(value.workflow) || !isObject(value.approvedContract) || !isObject(value.failingTrace)
    || !isObject(value.regressionFixture)) {
    throw new Error("invalid repair request");
  }
  const fixture = value.regressionFixture;
  if (typeof fixture.seed !== "string" || !Array.isArray(fixture.scenarioIds)
    || fixture.scenarioIds.some((id) => typeof id !== "string") || typeof fixture.invariantId !== "string"
    || typeof fixture.sourceSuiteHash !== "string") {
    throw new Error("invalid regression fixture");
  }
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(value.requestId) || !/^[a-f0-9]{64}$/i.test(value.sourceHash)
    || !value.analysisId || value.analysisId.length > 128) {
    throw new Error("invalid request binding");
  }
  return {
    schemaVersion: "1",
    requestId: value.requestId,
    sourceHash: value.sourceHash,
    analysisId: value.analysisId,
    workflow: value.workflow,
    approvedContract: value.approvedContract,
    failingTrace: value.failingTrace,
    regressionFixture: {
      seed: fixture.seed,
      scenarioIds: fixture.scenarioIds as string[],
      invariantId: fixture.invariantId,
      sourceSuiteHash: fixture.sourceSuiteHash,
    },
  };
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += bytes.byteLength;
    if (received > MAX_REQUEST_BYTES) throw new Error("request too large");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(response: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.byteLength(body)),
    "cache-control": "no-store",
    ...headers,
  });
  response.end(body);
}

function writeSignedStreamEvent(input: {
  response: ServerResponse;
  secret: string;
  timestamp: string;
  requestId: string;
  payload: unknown;
}): void {
  const payloadBody = JSON.stringify(input.payload);
  input.response.write(`${JSON.stringify({
    payload: input.payload,
    timestamp: input.timestamp,
    requestId: input.requestId,
    signature: signWorkerMessage(input.secret, input.timestamp, input.requestId, payloadBody),
  })}\n`);
}

export function createWorkerServer(options: {
  secret: string;
  runCandidate: (request: WorkerRepairRequest) => Promise<WorkerRepairCandidate>;
  now?: () => Date;
  maxConcurrent?: number;
}) {
  if (options.secret.length < 32) throw new Error("RETRYPROOF_CODEX_WORKER_SECRET must be at least 32 characters.");
  const now = options.now ?? (() => new Date());
  const maxConcurrent = options.maxConcurrent ?? 1;
  const seenRequestIds = new Map<string, number>();
  let activeRuns = 0;

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (request.method === "GET" && request.url === "/ready") {
      writeJson(response, 200, { ready: true, service: "retryproof-codex-worker", liveCodex: true });
      return;
    }
    if (request.method !== "POST" || request.url !== "/v1/repairs") {
      writeJson(response, 404, { error: { code: "NOT_FOUND", message: "Not found." } });
      return;
    }

    let rawBody = "";
    try {
      rawBody = await readBody(request);
    } catch {
      writeJson(response, 413, { error: { code: "REQUEST_TOO_LARGE", message: "Repair request is too large." } });
      return;
    }
    const timestamp = String(request.headers["x-retryproof-timestamp"] ?? "");
    const requestId = String(request.headers["x-retryproof-request-id"] ?? "");
    const suppliedSignature = String(request.headers["x-retryproof-signature"] ?? "");
    const requestTime = Date.parse(timestamp);
    const expectedSignature = signWorkerMessage(options.secret, timestamp, requestId, rawBody);
    if (!timestamp || !requestId || !suppliedSignature || Number.isNaN(requestTime)
      || Math.abs(now().getTime() - requestTime) > MAX_CLOCK_SKEW_MS
      || !safeEqual(suppliedSignature, expectedSignature)) {
      writeJson(response, 401, { error: { code: "AUTH_INVALID", message: "Worker request could not be authenticated." } });
      return;
    }

    const cutoff = now().getTime() - REPLAY_TTL_MS;
    for (const [id, seenAt] of seenRequestIds) if (seenAt < cutoff) seenRequestIds.delete(id);
    if (seenRequestIds.has(requestId)) {
      writeJson(response, 409, { error: { code: "REQUEST_REPLAYED", message: "Worker request ID was already used." } });
      return;
    }
    if (activeRuns >= maxConcurrent) {
      writeJson(response, 429, { error: { code: "WORKER_BUSY", message: "Worker is processing another repair." } });
      return;
    }

    let parsed: WorkerRepairRequest;
    try {
      parsed = parseRequest(JSON.parse(rawBody) as unknown);
      if (parsed.requestId !== requestId) throw new Error("request ID mismatch");
    } catch {
      writeJson(response, 422, { error: { code: "REQUEST_INVALID", message: "Repair request is invalid." } });
      return;
    }

    seenRequestIds.set(requestId, now().getTime());
    activeRuns += 1;
    const wantsStream = String(request.headers.accept ?? "").includes("application/x-ndjson");
    const startedAt = now().getTime();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    try {
      if (wantsStream) {
        response.writeHead(200, {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-store, no-transform",
          "x-content-type-options": "nosniff",
        });
        response.flushHeaders();
        writeSignedStreamEvent({
          response,
          secret: options.secret,
          timestamp: now().toISOString(),
          requestId,
          payload: {
            type: "progress",
            stage: "worker_accepted",
            message: "The isolated worker authenticated and accepted the repair request.",
            elapsedMs: 0,
          },
        });
        heartbeat = setInterval(() => {
          writeSignedStreamEvent({
            response,
            secret: options.secret,
            timestamp: now().toISOString(),
            requestId,
            payload: {
              type: "progress",
              stage: "codex_running",
              message: "A fresh Codex thread is still working inside the isolated repair workspace.",
              elapsedMs: Math.max(0, now().getTime() - startedAt),
            },
          });
        }, 5_000);
        heartbeat.unref();
      }
      const candidate = await options.runCandidate(parsed);
      if (candidate.requestId !== parsed.requestId || candidate.sourceHash !== parsed.sourceHash
        || candidate.analysisId !== parsed.analysisId) {
        throw new Error("candidate binding mismatch");
      }
      if (heartbeat) clearInterval(heartbeat);
      if (wantsStream) {
        writeSignedStreamEvent({
          response,
          secret: options.secret,
          timestamp: now().toISOString(),
          requestId,
          payload: { type: "candidate", candidate },
        });
        response.end();
        return;
      }
      const body = JSON.stringify({ candidate });
      writeJson(response, 200, { candidate }, {
        "x-retryproof-timestamp": timestamp,
        "x-retryproof-request-id": requestId,
        "x-retryproof-signature": signWorkerMessage(options.secret, timestamp, requestId, body),
      });
    } catch {
      if (heartbeat) clearInterval(heartbeat);
      if (wantsStream && response.headersSent) {
        writeSignedStreamEvent({
          response,
          secret: options.secret,
          timestamp: now().toISOString(),
          requestId,
          payload: {
            type: "error",
            code: "CODEX_REPAIR_FAILED",
            message: "Codex did not produce an acceptable repair candidate.",
          },
        });
        response.end();
      } else {
        writeJson(response, 422, { error: { code: "CODEX_REPAIR_FAILED", message: "Codex did not produce an acceptable repair candidate." } });
      }
    } finally {
      activeRuns -= 1;
    }
  };
}
