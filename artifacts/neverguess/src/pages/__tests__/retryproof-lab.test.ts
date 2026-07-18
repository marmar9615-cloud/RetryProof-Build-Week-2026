import { describe, expect, it } from "vitest";

import {
  repairProvenanceLabel,
  scenarioProofRows,
  seededSyntheticStake,
  validatorCheckLabel,
  workflowPaths,
} from "../retryproof-proof-flight-recorder";
import { analysisBadgeLabel, stageFor } from "../retryproof-lab";

type ProgressState = Parameters<typeof stageFor>[0];

describe("RetryProof lab progress", () => {
  it("keeps a loaded workflow on the Import step until analysis finishes", () => {
    expect(stageFor({ workflow: {} } as ProgressState)).toBe(1);
  });

  it("advances only when each stage has produced its required artifact", () => {
    expect(stageFor({})).toBe(1);
    expect(stageFor({ analysis: {} } as ProgressState)).toBe(2);
    expect(stageFor({ approved: {} } as ProgressState)).toBe(3);
    expect(stageFor({ before: {} } as ProgressState)).toBe(4);
    expect(stageFor({ repair: {} } as ProgressState)).toBe(4);
    expect(stageFor({ artifact: {} } as ProgressState)).toBe(5);
  });

  it("does not call the not-yet-generated GPT proposal a fallback", () => {
    expect(analysisBadgeLabel()).toBe("Proposal only");
    expect(analysisBadgeLabel("live")).toBe("Live GPT-5.6");
    expect(analysisBadgeLabel("cached")).toBe("Seeded · cached");
    expect(analysisBadgeLabel("deterministic-fallback")).toBe("Grounded fallback");
  });

  it("derives the proof graph paths from canonical connections, including the repaired bypass", () => {
    const canonical = {
      nodes: [
        { id: "entry", name: "Webhook", type: "n8n-nodes-base.webhook", position: [0, 0] as [number, number], parameters: {} },
        { id: "gate", name: "Acquired?", type: "n8n-nodes-base.if", position: [1, 0] as [number, number], parameters: {} },
        { id: "effect", name: "Create refund", type: "n8n-nodes-base.httpRequest", position: [2, 0] as [number, number], parameters: {} },
        { id: "response", name: "Acknowledge", type: "n8n-nodes-base.respondToWebhook", position: [3, 0] as [number, number], parameters: {} },
      ],
      connections: {
        Webhook: { main: [[{ node: "Acquired?", type: "main", index: 0 }]] },
        "Acquired?": { main: [[{ node: "Create refund", type: "main", index: 0 }], [{ node: "Acknowledge", type: "main", index: 0 }]] },
        "Create refund": { main: [[{ node: "Acknowledge", type: "main", index: 0 }]] },
      },
    };

    expect(workflowPaths(canonical).map((path) => path.map((node) => node.name))).toEqual([
      ["Webhook", "Acquired?", "Create refund", "Acknowledge"],
      ["Webhook", "Acquired?", "Acknowledge"],
    ]);
  });

  it("bounds cyclic or malformed untrusted connection data without inventing graph nodes", () => {
    const canonical = {
      nodes: [
        { id: "entry", name: "Webhook", type: "n8n-nodes-base.webhook" },
        { id: "loop", name: "Loop", type: "n8n-nodes-base.set" },
      ],
      connections: {
        Webhook: { main: [[{ node: "Loop" }, null, { nope: "Missing" }]] },
        Loop: { main: [[{ node: "Webhook" }, { node: "Unknown" }]] },
      },
    };

    expect(workflowPaths(canonical)).toEqual([[canonical.nodes[0], canonical.nodes[1]]]);
  });

  it("caps adversarial branch fan-out at 32 rendered paths", () => {
    const leaves = Array.from({ length: 40 }, (_, index) => ({ id: `leaf-${index}`, name: `Leaf ${index}`, type: "n8n-nodes-base.set" }));
    const canonical = {
      nodes: [{ id: "entry", name: "Webhook", type: "n8n-nodes-base.webhook" }, ...leaves],
      connections: { Webhook: { main: leaves.map((leaf) => [{ node: leaf.name }]) } },
    };

    expect(workflowPaths(canonical)).toHaveLength(32);
  });

  it("pairs scenario results by stable scenario ID instead of presentation order", () => {
    const before = {
      scenarioResults: [
        { scenarioId: "retry", label: "Retry", faultPhase: "after_effect", passed: false, effectCount: 2, traces: [] },
        { scenarioId: "happy", label: "Happy", faultPhase: "none", passed: true, effectCount: 1, traces: [] },
      ],
    } as never;
    const after = {
      scenarioResults: [
        { scenarioId: "happy", label: "Happy", faultPhase: "none", passed: true, effectCount: 1, traces: [] },
        { scenarioId: "retry", label: "Retry", faultPhase: "after_effect", passed: true, effectCount: 1, traces: [] },
      ],
    } as never;

    expect(scenarioProofRows(before, after)).toEqual([
      expect.objectContaining({ scenarioId: "retry", beforeEffectCount: 2, afterEffectCount: 1 }),
      expect.objectContaining({ scenarioId: "happy", beforeEffectCount: 1, afterEffectCount: 1 }),
    ]);
  });

  it("renders a human validator label without changing the durable check ID", () => {
    expect(validatorCheckLabel("source_fixture_failed")).toBe("Red confirmed on source");
    expect(validatorCheckLabel("source_hash_bound")).toBe("Source hash bound");
  });

  it("labels repair provenance from the repair artifact itself", () => {
    expect(repairProvenanceLabel("live-codex")).toBe("Fresh Codex · validators live");
    expect(repairProvenanceLabel("cached")).toBe("Validated fallback · not a fresh Codex run");
    expect(repairProvenanceLabel("bounded-template")).toBe("Validated fallback · not a fresh Codex run");
  });

  it("shows the monetary stake only for a seeded synthetic fixture", () => {
    expect(seededSyntheticStake({ demoSeed: true, fixture: { event: { amount: 4200 } } })).toBe("$42");
    expect(seededSyntheticStake({ demoSeed: false, fixture: { event: { amount: 4200 } } })).toBeNull();
    expect(seededSyntheticStake({ demoSeed: true, fixture: { event: { amount: "4200" } } })).toBeNull();
  });
});
