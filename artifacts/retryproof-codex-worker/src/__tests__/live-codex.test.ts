import { describe, expect, it } from "vitest";
import { createServer as createHttpServer } from "node:http";
import { AddressInfo } from "node:net";

import {
  approveRiskPlan,
  createLiveCodexRepair,
  createSeededWorkflow,
  proposeCachedRiskPlan,
  runDeterministicSuite,
} from "../../../api-server/src/lib/retryproof-engine";
import { requestLiveCodexRepair } from "../../../api-server/src/lib/retryproof-worker";
import { runCodexCandidate } from "../codex-runner";
import { createWorkerServer } from "../server";

const describeLive = process.env.OPENAI_API_KEY ? describe : describe.skip;

describeLive("live Codex SDK repair", () => {
  it("creates a fresh Codex candidate that the production validator replays green", async () => {
    const workflow = createSeededWorkflow();
    const analysis = proposeCachedRiskPlan(workflow);
    const approved = approveRiskPlan(analysis, {
      planHash: analysis.planHash,
      statement: analysis.invariant.statement,
      approved: true,
    });
    const before = runDeterministicSuite({ workflow, approved, phase: "before", seed: "live-worker-e2e" });
    const workerSecret = "live-worker-test-secret-that-is-long-enough";
    const server = createHttpServer(createWorkerServer({ secret: workerSecret, runCandidate: runCodexCandidate }));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const progress: string[] = [];
    let candidate: Awaited<ReturnType<typeof requestLiveCodexRepair>>;
    try {
      candidate = await requestLiveCodexRepair({
        workflow,
        approved,
        before,
        workerUrl: `http://127.0.0.1:${port}`,
        workerSecret,
        requestId: "repair_live_worker_e2e",
        onProgress: (event) => progress.push(event.stage),
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const repair = createLiveCodexRepair({ workflow, approved, before, candidate });
    const after = runDeterministicSuite({ workflow, approved, phase: "after", seed: before.seed, repair });

    expect(candidate).toMatchObject({
      requestId: "repair_live_worker_e2e",
      sourceHash: workflow.sourceHash,
      analysisId: approved.id,
      attempts: 1,
    });
    expect(progress).toContain("worker_accepted");
    expect(progress).toContain("codex_running");
    expect(repair.provenance).toMatchObject({ mode: "live-codex", generatedBy: "codex" });
    expect(before).toMatchObject({ passed: false, effectCount: 2 });
    expect(after).toMatchObject({ passed: true, effectCount: 1 });
  }, 390_000);
});
