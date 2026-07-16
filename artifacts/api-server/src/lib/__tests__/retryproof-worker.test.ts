import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  approveRiskPlan,
  createCachedRepair,
  createSeededWorkflow,
  proposeCachedRiskPlan,
  runDeterministicSuite,
} from "../retryproof-engine";
import { isLiveCodexWorkerConfigured, requestLiveCodexRepair, signWorkerMessage } from "../retryproof-worker";

function liveFixture() {
  const workflow = createSeededWorkflow();
  const analysis = proposeCachedRiskPlan(workflow);
  const approved = approveRiskPlan(analysis, {
    planHash: analysis.planHash,
    statement: analysis.invariant.statement,
    approved: true,
  });
  const before = runDeterministicSuite({ workflow, approved, phase: "before", seed: "worker-v1" });
  const bounded = createCachedRepair({ workflow, approved, before });
  return { workflow, approved, before, bounded };
}

describe("RetryProof live Codex worker client", () => {
  it("reports readiness only for a valid secret and production-safe worker URL", () => {
    expect(isLiveCodexWorkerConfigured({
      workerUrl: "https://worker.example",
      workerSecret: "worker-test-secret-that-is-long-enough",
      workerAccessToken: "replit-private-deployment-access-token",
      production: true,
    })).toBe(true);
    expect(isLiveCodexWorkerConfigured({
      workerUrl: "https://worker.example",
      workerSecret: "worker-test-secret-that-is-long-enough",
      production: true,
    })).toBe(false);
    expect(isLiveCodexWorkerConfigured({
      workerUrl: "http://worker.example",
      workerSecret: "worker-test-secret-that-is-long-enough",
      workerAccessToken: "replit-private-deployment-access-token",
      production: true,
    })).toBe(false);
    expect(isLiveCodexWorkerConfigured({
      workerUrl: "https://worker.example",
      workerSecret: "too-short",
      workerAccessToken: "replit-private-deployment-access-token",
      production: true,
    })).toBe(false);
  });

  it("sends a signed sanitized repair request and verifies the signed response", async () => {
    const { workflow, approved, before, bounded } = liveFixture();
    const secret = "worker-test-secret-that-is-long-enough";
    const accessToken = "replit-private-deployment-access-token";
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://worker.example/v1/repairs");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe(`Bearer ${accessToken}`);
      const timestamp = headers.get("x-retryproof-timestamp")!;
      const requestId = headers.get("x-retryproof-request-id")!;
      const body = String(init?.body);
      expect(headers.get("x-retryproof-signature")).toBe(signWorkerMessage(secret, timestamp, requestId, body));
      expect(body).not.toMatch(/credentials|api[_-]?key|authorization/i);

      const candidate = {
        schemaVersion: "1" as const,
        requestId,
        threadId: "thread_worker_123",
        attempts: 1,
        generatedAt: "2026-07-15T10:00:00.000Z",
        sourceHash: workflow.sourceHash,
        analysisId: approved.id,
        strategy: "durable_reservation_before_effect" as const,
        explanation: "Codex generated the bounded reservation repair.",
        patch: bounded.patch,
        changedNodeIds: bounded.changedNodeIds,
        regressionFixture: bounded.regressionFixture,
      };
      const responseBody = JSON.stringify({ candidate });
      return new Response(responseBody, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-retryproof-timestamp": timestamp,
          "x-retryproof-request-id": requestId,
          "x-retryproof-signature": signWorkerMessage(secret, timestamp, requestId, responseBody),
        },
      });
    });

    const candidate = await requestLiveCodexRepair({
      workflow,
      approved,
      before,
      workerUrl: "https://worker.example",
      workerSecret: secret,
      workerAccessToken: accessToken,
      fetchImpl,
      now: () => new Date("2026-07-15T10:00:00.000Z"),
      requestId: "repair_req_worker_123",
    });

    expect(candidate).toMatchObject({
      requestId: "repair_req_worker_123",
      threadId: "thread_worker_123",
      sourceHash: workflow.sourceHash,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("does not add an authorization header when no private-deployment token is configured", async () => {
    const { workflow, approved, before, bounded } = liveFixture();
    const secret = "worker-test-secret-that-is-long-enough";
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.has("authorization")).toBe(false);
      const timestamp = headers.get("x-retryproof-timestamp")!;
      const requestId = headers.get("x-retryproof-request-id")!;
      const candidate = {
        schemaVersion: "1" as const,
        requestId,
        threadId: "thread_worker_without_gateway_token",
        attempts: 1,
        generatedAt: timestamp,
        sourceHash: workflow.sourceHash,
        analysisId: approved.id,
        strategy: "durable_reservation_before_effect" as const,
        explanation: "Codex generated the bounded reservation repair.",
        patch: bounded.patch,
        changedNodeIds: bounded.changedNodeIds,
        regressionFixture: bounded.regressionFixture,
      };
      const responseBody = JSON.stringify({ candidate });
      return new Response(responseBody, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-retryproof-timestamp": timestamp,
          "x-retryproof-request-id": requestId,
          "x-retryproof-signature": signWorkerMessage(secret, timestamp, requestId, responseBody),
        },
      });
    });

    await expect(requestLiveCodexRepair({
      workflow,
      approved,
      before,
      workerUrl: "https://worker.example",
      workerSecret: secret,
      fetchImpl,
      now: () => new Date("2026-07-15T10:00:00.000Z"),
      requestId: "repair_req_without_gateway_token",
    })).resolves.toMatchObject({ threadId: "thread_worker_without_gateway_token" });
  });

  it("rejects a private-deployment token containing header delimiters before making a request", async () => {
    const { workflow, approved, before } = liveFixture();
    const fetchImpl = vi.fn();

    await expect(requestLiveCodexRepair({
      workflow,
      approved,
      before,
      workerUrl: "https://worker.example",
      workerSecret: "worker-test-secret-that-is-long-enough",
      workerAccessToken: "gateway-token\r\ninjected-header: value",
      fetchImpl,
    })).rejects.toMatchObject({ code: "CODEX_WORKER_NOT_CONFIGURED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an unsigned or tampered worker response", async () => {
    const { workflow, approved, before } = liveFixture();
    const secret = "worker-test-secret-that-is-long-enough";
    const responseBody = JSON.stringify({ candidate: {} });
    const fetchImpl = vi.fn(async () => new Response(responseBody, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-retryproof-timestamp": "2026-07-15T10:00:00.000Z",
        "x-retryproof-request-id": "repair_req_worker_123",
        "x-retryproof-signature": createHmac("sha256", secret).update("tampered").digest("base64url"),
      },
    }));

    await expect(requestLiveCodexRepair({
      workflow,
      approved,
      before,
      workerUrl: "https://worker.example",
      workerSecret: secret,
      fetchImpl,
      now: () => new Date("2026-07-15T10:00:00.000Z"),
      requestId: "repair_req_worker_123",
    })).rejects.toMatchObject({ code: "CODEX_WORKER_RESPONSE_INVALID" });
  });

  it("verifies signed worker progress and exposes it to the caller", async () => {
    const { workflow, approved, before, bounded } = liveFixture();
    const secret = "worker-test-secret-that-is-long-enough";
    const timestamp = "2026-07-15T10:00:00.000Z";
    const requestId = "repair_req_worker_stream";
    const candidate = {
      schemaVersion: "1" as const,
      requestId,
      threadId: "thread_worker_stream",
      attempts: 1,
      generatedAt: timestamp,
      sourceHash: workflow.sourceHash,
      analysisId: approved.id,
      strategy: "durable_reservation_before_effect" as const,
      explanation: "Codex generated the bounded reservation repair.",
      patch: bounded.patch,
      changedNodeIds: bounded.changedNodeIds,
      regressionFixture: bounded.regressionFixture,
    };
    const eventLine = (payload: unknown) => JSON.stringify({
      payload,
      timestamp,
      requestId,
      signature: signWorkerMessage(secret, timestamp, requestId, JSON.stringify(payload)),
    });
    const responseBody = [
      eventLine({ type: "progress", stage: "worker_accepted", message: "Worker authenticated the repair request.", elapsedMs: 0 }),
      eventLine({ type: "progress", stage: "codex_running", message: "Fresh Codex thread is running.", elapsedMs: 5_000 }),
      eventLine({ type: "candidate", candidate }),
    ].join("\n") + "\n";
    const fetchImpl = vi.fn(async () => new Response(responseBody, {
      status: 200,
      headers: { "content-type": "application/x-ndjson" },
    }));
    const onProgress = vi.fn();

    await expect(requestLiveCodexRepair({
      workflow,
      approved,
      before,
      workerUrl: "https://worker.example",
      workerSecret: secret,
      fetchImpl,
      now: () => new Date(timestamp),
      requestId,
      onProgress,
    })).resolves.toMatchObject({ requestId, threadId: "thread_worker_stream" });
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: "worker_accepted", elapsedMs: 0 }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: "codex_running", elapsedMs: 5_000 }));
  });

  it("preserves a valid signed terminal worker failure instead of mislabeling the stream as invalid", async () => {
    const { workflow, approved, before } = liveFixture();
    const secret = "worker-test-secret-that-is-long-enough";
    const timestamp = "2026-07-15T10:00:00.000Z";
    const requestId = "repair_req_worker_failure";
    const payload = {
      type: "error",
      code: "CODEX_REPAIR_FAILED",
      message: "Codex could not produce a repair inside the bounded worker.",
    };
    const responseBody = `${JSON.stringify({
      payload,
      timestamp,
      requestId,
      signature: signWorkerMessage(secret, timestamp, requestId, JSON.stringify(payload)),
    })}\n`;
    const fetchImpl = vi.fn(async () => new Response(responseBody, {
      status: 200,
      headers: { "content-type": "application/x-ndjson" },
    }));

    await expect(requestLiveCodexRepair({
      workflow,
      approved,
      before,
      workerUrl: "https://worker.example",
      workerSecret: secret,
      fetchImpl,
      now: () => new Date(timestamp),
      requestId,
    })).rejects.toMatchObject({
      code: "CODEX_WORKER_FAILED",
      message: "Codex could not produce a repair that passed the worker boundary.",
    });
  });
});
