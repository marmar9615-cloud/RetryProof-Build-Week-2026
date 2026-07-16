import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  RetryProofEngineError,
  type ApprovedRiskPlan,
  type ExecutionResult,
  type LiveCodexRepairCandidate,
  type RepairResource,
  type WorkflowResource,
} from "./retryproof-engine";

const RESPONSE_LIMIT_BYTES = 512 * 1024;
const WORKER_TIMEOUT_MS = 360_000;

export type LiveCodexWorkerProgress = {
  stage: "worker_accepted" | "codex_running";
  message: string;
  elapsedMs: number;
};

export function isLiveCodexWorkerConfigured(input: {
  workerUrl?: string;
  workerSecret?: string;
  workerAccessToken?: string;
  production?: boolean;
} = {}): boolean {
  const workerUrl = (input.workerUrl ?? process.env.RETRYPROOF_CODEX_WORKER_URL ?? "").trim().replace(/\/$/, "");
  const workerSecret = (input.workerSecret ?? process.env.RETRYPROOF_CODEX_WORKER_SECRET ?? "").trim();
  const workerAccessToken = (input.workerAccessToken ?? process.env.RETRYPROOF_CODEX_WORKER_ACCESS_TOKEN ?? "").trim();
  const production = input.production ?? process.env.NODE_ENV === "production";
  if (workerSecret.length < 32) return false;
  if (production && (!workerAccessToken || /[\r\n]/.test(workerAccessToken))) return false;
  try {
    const url = new URL(`${workerUrl}/v1/repairs`);
    return !production || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signWorkerMessage(secret: string, timestamp: string, requestId: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}\n${requestId}\n${body}`)
    .digest("base64url");
}

function parsePatch(value: unknown): RepairResource["patch"] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) {
    throw new Error("candidate patch must contain between 1 and 32 operations");
  }
  return value.map((entry) => {
    if (!isObject(entry) || (entry.op !== "add" && entry.op !== "replace") || typeof entry.path !== "string" || !("value" in entry)) {
      throw new Error("candidate patch contains an invalid operation");
    }
    if (!entry.path.startsWith("/") || entry.path.length > 512) {
      throw new Error("candidate patch contains an invalid path");
    }
    return { op: entry.op, path: entry.path, value: entry.value };
  });
}

function parseCandidate(value: unknown): LiveCodexRepairCandidate {
  if (!isObject(value)) throw new Error("worker response must contain a candidate object");
  const fixture = value.regressionFixture;
  if (!isObject(fixture) || typeof fixture.seed !== "string" || !Array.isArray(fixture.scenarioIds)
    || fixture.scenarioIds.some((id) => typeof id !== "string") || typeof fixture.invariantId !== "string"
    || typeof fixture.sourceSuiteHash !== "string") {
    throw new Error("candidate regression fixture is invalid");
  }
  if (value.schemaVersion !== "1" || typeof value.requestId !== "string" || typeof value.threadId !== "string"
    || typeof value.attempts !== "number" || typeof value.generatedAt !== "string" || typeof value.sourceHash !== "string"
    || typeof value.analysisId !== "string" || value.strategy !== "durable_reservation_before_effect"
    || typeof value.explanation !== "string" || !Array.isArray(value.changedNodeIds)
    || value.changedNodeIds.some((id) => typeof id !== "string")) {
    throw new Error("candidate metadata is invalid");
  }
  return {
    schemaVersion: "1",
    requestId: value.requestId,
    threadId: value.threadId,
    attempts: value.attempts,
    generatedAt: value.generatedAt,
    sourceHash: value.sourceHash,
    analysisId: value.analysisId,
    strategy: "durable_reservation_before_effect",
    explanation: value.explanation,
    patch: parsePatch(value.patch),
    changedNodeIds: value.changedNodeIds as string[],
    regressionFixture: {
      seed: fixture.seed,
      scenarioIds: fixture.scenarioIds as string[],
      invariantId: fixture.invariantId,
      sourceSuiteHash: fixture.sourceSuiteHash,
    },
  };
}

function parseProgress(value: unknown): LiveCodexWorkerProgress {
  if (!isObject(value) || value.type !== "progress"
    || (value.stage !== "worker_accepted" && value.stage !== "codex_running")
    || typeof value.message !== "string" || value.message.length < 1 || value.message.length > 256
    || typeof value.elapsedMs !== "number" || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0) {
    throw new Error("worker progress event is invalid");
  }
  return { stage: value.stage, message: value.message, elapsedMs: value.elapsedMs };
}

function verifyStreamEnvelope(input: {
  value: unknown;
  secret: string;
  requestId: string;
}): Record<string, unknown> {
  if (!isObject(input.value) || !isObject(input.value.payload)
    || typeof input.value.timestamp !== "string" || input.value.requestId !== input.requestId
    || typeof input.value.signature !== "string") {
    throw new Error("worker stream envelope is invalid");
  }
  const payloadBody = JSON.stringify(input.value.payload);
  const expected = signWorkerMessage(input.secret, input.value.timestamp, input.requestId, payloadBody);
  if (!safeEqual(input.value.signature, expected)) throw new Error("worker stream signature is invalid");
  return input.value.payload;
}

async function parseSignedStream(input: {
  response: Response;
  workerSecret: string;
  requestId: string;
  onProgress?: (progress: LiveCodexWorkerProgress) => void;
}): Promise<LiveCodexRepairCandidate> {
  if (!input.response.body) throw new Error("worker stream body is missing");
  const reader = input.response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let received = 0;
  let candidate: LiveCodexRepairCandidate | undefined;

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const payload = verifyStreamEnvelope({
      value: JSON.parse(line) as unknown,
      secret: input.workerSecret,
      requestId: input.requestId,
    });
    if (payload.type === "progress") {
      input.onProgress?.(parseProgress(payload));
      return;
    }
    if (payload.type === "candidate") {
      if (candidate) throw new Error("worker stream contains multiple candidates");
      candidate = parseCandidate(payload.candidate);
      return;
    }
    if (payload.type === "error") {
      if (payload.code !== "CODEX_REPAIR_FAILED"
        || typeof payload.message !== "string"
        || payload.message.length < 1
        || payload.message.length > 256) {
        throw new Error("worker error event is invalid");
      }
      throw new RetryProofEngineError(
        "CODEX_WORKER_FAILED",
        "Codex could not produce a repair that passed the worker boundary.",
        502,
      );
    }
    throw new Error("worker stream event type is invalid");
  };

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    received += chunk.value.byteLength;
    if (received > RESPONSE_LIMIT_BYTES) throw new Error("worker stream is oversized");
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
  if (!candidate) throw new Error("worker stream ended without a candidate");
  return candidate;
}

export async function requestLiveCodexRepair(input: {
  workflow: WorkflowResource;
  approved: ApprovedRiskPlan;
  before: ExecutionResult;
  workerUrl?: string;
  workerSecret?: string;
  workerAccessToken?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  requestId?: string;
  onProgress?: (progress: LiveCodexWorkerProgress) => void;
}): Promise<LiveCodexRepairCandidate> {
  const workerUrl = (input.workerUrl ?? process.env.RETRYPROOF_CODEX_WORKER_URL ?? "").trim().replace(/\/$/, "");
  const workerSecret = (input.workerSecret ?? process.env.RETRYPROOF_CODEX_WORKER_SECRET ?? "").trim();
  const workerAccessToken = (input.workerAccessToken ?? process.env.RETRYPROOF_CODEX_WORKER_ACCESS_TOKEN ?? "").trim();
  if (/[\r\n]/.test(workerAccessToken)) {
    throw new RetryProofEngineError("CODEX_WORKER_NOT_CONFIGURED", "The private worker access token is invalid.", 503);
  }
  if (!isLiveCodexWorkerConfigured({ workerUrl, workerSecret, workerAccessToken })) {
    throw new RetryProofEngineError("CODEX_WORKER_NOT_CONFIGURED", "Live Codex repair is not configured on this deployment.", 503);
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(`${workerUrl}/v1/repairs`);
  } catch {
    throw new RetryProofEngineError("CODEX_WORKER_NOT_CONFIGURED", "The live Codex worker URL is invalid.", 503);
  }
  if (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:") {
    throw new RetryProofEngineError("CODEX_WORKER_NOT_CONFIGURED", "The live Codex worker must use HTTPS in production.", 503);
  }

  const requestId = input.requestId ?? `repair_${randomUUID()}`;
  const timestamp = (input.now ?? (() => new Date()))().toISOString();
  const body = JSON.stringify({
    schemaVersion: "1",
    requestId,
    sourceHash: input.workflow.sourceHash,
    analysisId: input.approved.id,
    workflow: input.workflow.canonical,
    approvedContract: {
      sideEffect: input.approved.sideEffect,
      invariant: input.approved.invariant,
      scenarios: input.approved.scenarios,
    },
    failingTrace: input.before,
    regressionFixture: {
      seed: input.before.seed,
      scenarioIds: input.before.scenarioResults.map((result) => result.scenarioId),
      invariantId: input.approved.invariant.id,
      sourceSuiteHash: input.before.suiteHash,
    },
  });
  const signature = signWorkerMessage(workerSecret, timestamp, requestId, body);
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(parsedUrl, {
      method: "POST",
      headers: {
        accept: "application/x-ndjson",
        "content-type": "application/json",
        ...(workerAccessToken ? { authorization: `Bearer ${workerAccessToken}` } : {}),
        "x-retryproof-timestamp": timestamp,
        "x-retryproof-request-id": requestId,
        "x-retryproof-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    });
  } catch {
    throw new RetryProofEngineError("CODEX_WORKER_UNAVAILABLE", "The live Codex worker could not be reached. No repair was accepted.", 503);
  }

  if (response.ok && response.headers.get("content-type")?.includes("application/x-ndjson")) {
    try {
      const candidate = await parseSignedStream({
        response,
        workerSecret,
        requestId,
        onProgress: input.onProgress,
      });
      if (candidate.requestId !== requestId || candidate.sourceHash !== input.workflow.sourceHash || candidate.analysisId !== input.approved.id) {
        throw new Error("worker response is not bound to the requested repair");
      }
      return candidate;
    } catch (error) {
      if (error instanceof RetryProofEngineError) throw error;
      throw new RetryProofEngineError("CODEX_WORKER_RESPONSE_INVALID", "The live Codex worker returned an invalid signed event stream.", 502);
    }
  }

  const responseBody = await response.text();
  if (Buffer.byteLength(responseBody, "utf8") > RESPONSE_LIMIT_BYTES) {
    throw new RetryProofEngineError("CODEX_WORKER_RESPONSE_INVALID", "The live Codex worker returned an oversized response.", 502);
  }
  if (!response.ok) {
    throw new RetryProofEngineError(
      "CODEX_WORKER_FAILED",
      response.status === 429
        ? "The live Codex worker is busy. Try again shortly."
        : "Codex could not produce a repair that passed the worker boundary.",
      response.status === 429 ? 429 : 502,
    );
  }
  const responseTimestamp = response.headers.get("x-retryproof-timestamp") ?? "";
  const responseRequestId = response.headers.get("x-retryproof-request-id") ?? "";
  const responseSignature = response.headers.get("x-retryproof-signature") ?? "";
  const expectedSignature = signWorkerMessage(workerSecret, responseTimestamp, responseRequestId, responseBody);
  if (responseTimestamp !== timestamp || responseRequestId !== requestId || !responseSignature || !safeEqual(responseSignature, expectedSignature)) {
    throw new RetryProofEngineError("CODEX_WORKER_RESPONSE_INVALID", "The live Codex worker response could not be authenticated.", 502);
  }

  try {
    const decoded = JSON.parse(responseBody) as unknown;
    if (!isObject(decoded)) throw new Error("worker response is not an object");
    const candidate = parseCandidate(decoded.candidate);
    if (candidate.requestId !== requestId || candidate.sourceHash !== input.workflow.sourceHash || candidate.analysisId !== input.approved.id) {
      throw new Error("worker response is not bound to the requested repair");
    }
    return candidate;
  } catch {
    throw new RetryProofEngineError("CODEX_WORKER_RESPONSE_INVALID", "The live Codex worker returned an invalid repair candidate.", 502);
  }
}
