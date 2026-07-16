import { createServer as createHttpServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createWorkerServer, signWorkerMessage, type WorkerRepairCandidate } from "../server";

const secret = "worker-test-secret-that-is-long-enough";
const timestamp = "2026-07-15T10:00:00.000Z";
const requestId = "repair_req_worker_123";
const requestBody = JSON.stringify({
  schemaVersion: "1",
  requestId,
  sourceHash: "a".repeat(64),
  analysisId: "analysis_123",
  workflow: { nodes: [], connections: {} },
  approvedContract: {
    sideEffect: { nodeId: "http", businessKeyPath: "$.event.id" },
    invariant: { id: "inv_1", approved: true },
    scenarios: [],
  },
  failingTrace: { passed: false, suiteHash: "b".repeat(64) },
  regressionFixture: {
    seed: "demo-v1",
    scenarioIds: ["timeout_after_effect"],
    invariantId: "inv_1",
    sourceSuiteHash: "b".repeat(64),
  },
});

const candidate: WorkerRepairCandidate = {
  schemaVersion: "1",
  requestId,
  threadId: "thread_123",
  attempts: 1,
  generatedAt: timestamp,
  sourceHash: "a".repeat(64),
  analysisId: "analysis_123",
  strategy: "durable_reservation_before_effect",
  explanation: "Codex generated the bounded repair.",
  patch: [{ op: "add", path: "/nodes/-", value: { id: "repair" } }],
  changedNodeIds: ["http", "repair"],
  regressionFixture: {
    seed: "demo-v1",
    scenarioIds: ["timeout_after_effect"],
    invariantId: "inv_1",
    sourceSuiteHash: "b".repeat(64),
  },
};

let server: Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

async function listen(runCandidate = vi.fn(async () => candidate)) {
  server = createHttpServer(createWorkerServer({
    secret,
    now: () => new Date(timestamp),
    runCandidate,
  }));
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, runCandidate };
}

describe("RetryProof Codex worker boundary", () => {
  it("authenticates the request, runs one bounded candidate, and signs the response", async () => {
    const { baseUrl, runCandidate } = await listen();
    const response = await fetch(`${baseUrl}/v1/repairs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-retryproof-timestamp": timestamp,
        "x-retryproof-request-id": requestId,
        "x-retryproof-signature": signWorkerMessage(secret, timestamp, requestId, requestBody),
      },
      body: requestBody,
    });

    expect(response.status).toBe(200);
    const responseBody = await response.text();
    expect(response.headers.get("x-retryproof-signature")).toBe(
      signWorkerMessage(secret, timestamp, requestId, responseBody),
    );
    expect(JSON.parse(responseBody)).toEqual({ candidate });
    expect(runCandidate).toHaveBeenCalledOnce();
  });

  it("streams signed progress heartbeats before the signed candidate", async () => {
    let releaseCandidate!: () => void;
    const candidateReady = new Promise<void>((resolve) => {
      releaseCandidate = resolve;
    });
    const { baseUrl } = await listen(async () => {
      await candidateReady;
      return candidate;
    });
    const responsePromise = fetch(`${baseUrl}/v1/repairs`, {
      method: "POST",
      headers: {
        accept: "application/x-ndjson",
        "content-type": "application/json",
        "x-retryproof-timestamp": timestamp,
        "x-retryproof-request-id": requestId,
        "x-retryproof-signature": signWorkerMessage(secret, timestamp, requestId, requestBody),
      },
      body: requestBody,
    });

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    const reader = response.body!.getReader();
    const firstChunk = await reader.read();
    const firstLine = new TextDecoder().decode(firstChunk.value).trim();
    const firstEvent = JSON.parse(firstLine) as {
      payload: { type: string; stage: string };
      timestamp: string;
      requestId: string;
      signature: string;
    };
    expect(firstEvent.payload).toMatchObject({ type: "progress", stage: "worker_accepted" });
    expect(firstEvent.signature).toBe(signWorkerMessage(
      secret,
      firstEvent.timestamp,
      firstEvent.requestId,
      JSON.stringify(firstEvent.payload),
    ));

    releaseCandidate();
    let rest = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      rest += new TextDecoder().decode(chunk.value);
    }
    const events = rest.trim().split("\n").map((line) => JSON.parse(line) as { payload: { type: string; candidate?: WorkerRepairCandidate } });
    expect(events.some((event) => event.payload.type === "candidate")).toBe(true);
    expect(events.find((event) => event.payload.type === "candidate")?.payload.candidate).toEqual(candidate);
  });

  it("streams a signed top-level error contract when Codex cannot produce a candidate", async () => {
    const { baseUrl } = await listen(async () => {
      throw new Error("candidate rejected");
    });
    const response = await fetch(`${baseUrl}/v1/repairs`, {
      method: "POST",
      headers: {
        accept: "application/x-ndjson",
        "content-type": "application/json",
        "x-retryproof-timestamp": timestamp,
        "x-retryproof-request-id": requestId,
        "x-retryproof-signature": signWorkerMessage(secret, timestamp, requestId, requestBody),
      },
      body: requestBody,
    });

    expect(response.status).toBe(200);
    const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line) as {
      payload: Record<string, unknown>;
      timestamp: string;
      requestId: string;
      signature: string;
    });
    const errorEvent = events.find((event) => event.payload.type === "error");
    expect(errorEvent?.payload).toEqual({
      type: "error",
      code: "CODEX_REPAIR_FAILED",
      message: "Codex did not produce an acceptable repair candidate.",
    });
    expect(errorEvent?.signature).toBe(signWorkerMessage(
      secret,
      errorEvent!.timestamp,
      errorEvent!.requestId,
      JSON.stringify(errorEvent!.payload),
    ));
  });

  it("rejects invalid signatures and replayed request IDs before running Codex", async () => {
    const { baseUrl, runCandidate } = await listen();
    const headers = {
      "content-type": "application/json",
      "x-retryproof-timestamp": timestamp,
      "x-retryproof-request-id": requestId,
      "x-retryproof-signature": signWorkerMessage(secret, timestamp, requestId, requestBody),
    };
    const invalid = await fetch(`${baseUrl}/v1/repairs`, {
      method: "POST",
      headers: { ...headers, "x-retryproof-signature": "invalid" },
      body: requestBody,
    });
    expect(invalid.status).toBe(401);

    const first = await fetch(`${baseUrl}/v1/repairs`, { method: "POST", headers, body: requestBody });
    const replay = await fetch(`${baseUrl}/v1/repairs`, { method: "POST", headers, body: requestBody });
    expect(first.status).toBe(200);
    expect(replay.status).toBe(409);
    expect(runCandidate).toHaveBeenCalledOnce();
  });

  it("exposes only a non-sensitive readiness response", async () => {
    const { baseUrl } = await listen();
    const response = await fetch(`${baseUrl}/ready`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ready: true,
      service: "retryproof-codex-worker",
      liveCodex: true,
    });
  });
});
