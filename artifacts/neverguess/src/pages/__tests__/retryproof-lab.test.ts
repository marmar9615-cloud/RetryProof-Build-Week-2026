import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  decisiveTraceDelta,
  repairProvenanceLabel,
  scenarioProofRows,
  seededSyntheticStake,
  validatorCheckLabel,
  workflowPaths,
} from "../retryproof-proof-flight-recorder";
import {
  analysisBadgeLabel,
  formatRepairElapsed,
  labLayoutClasses,
  LiveRepairAnnouncementRegion,
  liveRepairAnnouncement,
  RAW_PATCH_CONTAINMENT_CLASSES,
  stageFor,
} from "../retryproof-lab";

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

  it("finds the seeded decisive trace divergence without inventing replay data", () => {
    const shared = [
      { delivery: 1, event: "effect_committed", detail: "Mock refund recorded.", effectCount: 1 },
      { delivery: 1, event: "timeout_injected", detail: "Response lost; retry scheduled.", effectCount: 1 },
    ];
    const before = {
      scenarioResults: [{
        scenarioId: "timeout_after_refund",
        label: "Refund succeeds, response times out, platform retries",
        faultPhase: "after_effect_before_response",
        passed: false,
        effectCount: 2,
        traces: [...shared, { delivery: 2, event: "effect_replayed", detail: "Retry records a second mock refund effect.", effectCount: 2 }],
      }],
    } as never;
    const after = {
      scenarioResults: [{
        scenarioId: "timeout_after_refund",
        label: "Refund succeeds, response times out, platform retries",
        faultPhase: "after_effect_before_response",
        passed: true,
        effectCount: 1,
        traces: [...shared, { delivery: 2, event: "reservation_conflict", detail: "Durable reservation suppresses the duplicate effect.", effectCount: 1 }],
      }],
    } as never;

    expect(decisiveTraceDelta(before, after)).toEqual(expect.objectContaining({
      scenarioId: "timeout_after_refund",
      traceIndex: 2,
      before: expect.objectContaining({ delivery: 2, event: "effect_replayed", effectCount: 2 }),
      after: expect.objectContaining({ delivery: 2, event: "reservation_conflict", effectCount: 1 }),
    }));
  });

  it("handles unequal and identical trace sequences explicitly", () => {
    const trace = { delivery: 1, event: "effect_committed", detail: "Mock effect recorded.", effectCount: 1 };
    const result = (traces: typeof trace[]) => ({
      scenarioResults: [{ scenarioId: "happy", label: "Happy path", faultPhase: "none", passed: true, effectCount: 1, traces }],
    }) as never;

    expect(decisiveTraceDelta(result([trace, { ...trace, delivery: 2 }]), result([trace]))).toEqual(expect.objectContaining({
      traceIndex: 1,
      before: expect.objectContaining({ delivery: 2 }),
      after: null,
    }));
    expect(decisiveTraceDelta(result([trace]), result([trace]))).toBeNull();
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

  it("contains raw patch intrinsic width inside a local horizontal scroller", () => {
    expect(RAW_PATCH_CONTAINMENT_CLASSES.grid).toContain("min-w-0");
    expect(RAW_PATCH_CONTAINMENT_CLASSES.details).toContain("min-w-0");
    expect(RAW_PATCH_CONTAINMENT_CLASSES.details).toContain("overflow-hidden");
    expect(RAW_PATCH_CONTAINMENT_CLASSES.pre).toContain("max-w-full");
    expect(RAW_PATCH_CONTAINMENT_CLASSES.pre).toContain("overflow-x-auto");
    expect(RAW_PATCH_CONTAINMENT_CLASSES.code).toContain("w-max");
  });

  it("gives completed evidence the full content width and reflows trust cards", () => {
    expect(labLayoutClasses(false).shell).toContain("lg:grid-cols-[minmax(0,1fr)_340px]");
    expect(labLayoutClasses(false).aside).toContain("lg:sticky");
    expect(labLayoutClasses(true).shell).not.toContain("lg:grid-cols-[minmax(0,1fr)_340px]");
    expect(labLayoutClasses(true).aside).toContain("xl:grid-cols-[1fr_2fr_1fr_auto]");
  });

  it("formats live elapsed time against the visible six-minute budget", () => {
    expect(formatRepairElapsed(0)).toBe("0:00 elapsed · 6:00 request limit");
    expect(formatRepairElapsed(49_930)).toBe("0:49 elapsed · 6:00 request limit");
    expect(formatRepairElapsed(389_000)).toBe("6:29 elapsed · 6:00 request limit");
  });

  it("announces only signed stage transitions and terminal status", () => {
    expect(liveRepairAnnouncement("running", undefined, undefined)).toBe("Live repair started.");
    expect(liveRepairAnnouncement("running", "worker_accepted", "Private worker accepted the request.")).toBe("Worker accepted: Private worker accepted the request.");
    expect(liveRepairAnnouncement("complete", "deterministic_validation", "Gate complete.")).toBe("Live repair accepted by the deterministic gate.");
    expect(liveRepairAnnouncement("failed", "codex_running", "Codex is working.")).toBe("Live repair stopped safely. No candidate was accepted.");
  });

  it("renders a persistent polite status region for start and terminal announcements", () => {
    const started = renderToStaticMarkup(createElement(LiveRepairAnnouncementRegion, { announcement: "Live repair started." }));
    const accepted = renderToStaticMarkup(createElement(LiveRepairAnnouncementRegion, { announcement: "Live repair accepted by the deterministic gate." }));

    expect(started).toContain('role="status"');
    expect(started).toContain('aria-live="polite"');
    expect(started).toContain("Live repair started.");
    expect(accepted).toContain("Live repair accepted by the deterministic gate.");
  });
});
