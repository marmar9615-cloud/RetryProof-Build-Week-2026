import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import {
  approveRiskPlan,
  createCachedRepair,
  createEvidenceArtifact,
  createLiveCodexRepair,
  createSeededWorkflow,
  importWorkflow,
  proposeCachedRiskPlan,
  proposeDeterministicRiskPlan,
  proposeGroundedLiveRiskPlan,
  runDeterministicSuite,
  serializeEvidenceReceipt,
} from "../retryproof-engine";

describe("RetryProof deterministic engine", () => {
  it("runs a compatible uploaded workflow end to end with a bound synthetic fixture", () => {
    const workflow = importWorkflow(JSON.stringify({
      name: "Send welcome email safely",
      nodes: [
        { id: "email_webhook", name: "Signup webhook", type: "n8n-nodes-base.webhook", position: [0, 0], parameters: { path: "signup", httpMethod: "POST" } },
        { id: "shape_message", name: "Shape message", type: "n8n-nodes-base.set", position: [200, 0], parameters: { assignments: { assignments: [{ id: "message", name: "message", type: "object", value: "={{ $json.message }}" }] } } },
        { id: "send_email", name: "Send welcome email", type: "n8n-nodes-base.httpRequest", position: [400, 0], parameters: { method: "POST", url: "mock://emails", body: { message_id: "={{ $json.message.id }}", recipient: "={{ $json.message.to }}" } } },
        { id: "email_response", name: "Acknowledge signup", type: "n8n-nodes-base.respondToWebhook", position: [600, 0], parameters: { respondWith: "json" } },
      ],
      connections: {
        "Signup webhook": { main: [[{ node: "Shape message", type: "main", index: 0 }]] },
        "Shape message": { main: [[{ node: "Send welcome email", type: "main", index: 0 }]] },
        "Send welcome email": { main: [[{ node: "Acknowledge signup", type: "main", index: 0 }]] },
      },
    }), {
      fixture: { message: { id: "msg_welcome_42", to: "person@example.test" } },
    });

    const analysis = proposeDeterministicRiskPlan(workflow);
    expect(analysis.provenance).toMatchObject({ mode: "deterministic-fallback" });
    expect(analysis.sideEffect).toMatchObject({
      nodeId: "send_email",
      effectId: "emails",
      businessKeyPath: "$.message.id",
    });
    expect(analysis.scenarios).toHaveLength(4);
    const live = proposeGroundedLiveRiskPlan(workflow, {
      effectNodeId: "send_email",
      businessKeyPath: "$.message.id",
      invariantStatement: "For each message.id, create at most one emails effect across retries.",
    }, { model: "gpt-5.6-sol", requestId: "resp_test" });
    expect(live.provenance).toMatchObject({ mode: "live", requestId: "resp_test" });
    expect(() => proposeGroundedLiveRiskPlan(workflow, {
      effectNodeId: "invented_effect",
      businessKeyPath: "$.message.id",
      invariantStatement: "Invented claim",
    }, { model: "gpt-5.6-sol", requestId: "resp_bad" })).toThrowError(
      expect.objectContaining({ code: "UNGROUNDED_MODEL_OUTPUT" }),
    );
    const approved = approveRiskPlan(analysis, {
      planHash: analysis.planHash,
      statement: analysis.invariant.statement,
      approved: true,
    });

    const before = runDeterministicSuite({ workflow, approved, phase: "before", seed: "custom-v1" });
    expect(before.passed).toBe(false);
    expect(before.effectKey).toBe("msg_welcome_42");
    expect(before.scenarioResults.map((result) => result.effectCount)).toEqual([2, 2, 1, 2]);

    const repair = createCachedRepair({ workflow, approved, before });
    expect(repair.patchedCanonical.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "retryproof_bind_key" }),
      expect.objectContaining({ id: "retryproof_reserve_key" }),
      expect.objectContaining({ id: "retryproof_reservation_acquired" }),
    ]));
    expect(repair.changedNodeIds).toContain("send_email");

    const after = runDeterministicSuite({ workflow, approved, phase: "after", seed: before.seed, repair });
    expect(after.passed).toBe(true);
    expect(after.effectKey).toBe(before.effectKey);
    expect(after.scenarioResults.map((result) => result.effectCount)).toEqual([1, 1, 0, 1]);

    const artifact = createEvidenceArtifact({ workflow, approved, before, repair, after });
    expect(artifact.receipt.workflow.name).toBe("Send welcome email safely");
    expect(artifact.receipt.modelArtifacts.analysis).toBe("deterministic-fallback");
  });

  it("reproduces the duplicate effect, validates the bounded repair, and passes the identical suite", () => {
    const workflow = createSeededWorkflow();
    const analysis = proposeCachedRiskPlan(workflow);
    expect(analysis.provenance.sourceCommit).toBe("2dd084ccae57f54300e959ff444ba976f5d1b78f");
    const approved = approveRiskPlan(analysis, {
      planHash: analysis.planHash,
      statement: analysis.invariant.statement,
      approved: true,
    });

    const before = runDeterministicSuite({
      workflow,
      approved,
      phase: "before",
      seed: "demo-v1",
    });
    expect(before.passed).toBe(false);
    expect(before.effectCount).toBe(2);

    const repair = createCachedRepair({ workflow, approved, before });
    expect(repair.provenance).toMatchObject({ mode: "cached", generatedBy: "cached-template" });
    expect(repair.validation.checks).toContain("credential_scan_clear");
    expect(repair.patch).toHaveLength(8);
    expect(repair.changedNodeIds).toEqual([
      "check_event",
      "http_refund",
      "retryproof_bind_key",
      "retryproof_reservation_acquired",
      "retryproof_reserve_key",
    ]);
    expect(repair.patchedCanonical.connections).toMatchObject({
      "Check event": { main: [[{ node: "RetryProof · Bind reservation key" }]] },
      "RetryProof · Bind reservation key": { main: [[{ node: "RetryProof · Reserve business key" }]] },
      "RetryProof · Reserve business key": { main: [[{ node: "RetryProof · Reservation acquired?" }]] },
      "RetryProof · Reservation acquired?": {
        main: [[{ node: "Create refund" }], [{ node: "Acknowledge" }]],
      },
    });

    const after = runDeterministicSuite({
      workflow,
      approved,
      phase: "after",
      seed: before.seed,
      repair,
    });
    expect(after.passed).toBe(true);
    expect(after.effectCount).toBe(1);
    expect(after.scenarioId).toBe(before.scenarioId);

    const artifact = createEvidenceArtifact({ workflow, approved, before, repair, after });
    expect(artifact.receipt.before.effectCount).toBe(2);
    expect(artifact.receipt.after.effectCount).toBe(1);
    expect(artifact.receipt.limitations.join(" ")).toMatch(/not.*exactly-once/i);
    expect(artifact.sha256).toBe(
      createHash("sha256").update(serializeEvidenceReceipt(artifact.receipt)).digest("hex"),
    );

    const tampered = structuredClone(repair);
    const branch = tampered.patchedCanonical.connections["RetryProof · Reservation acquired?"] as {
      main: Array<Array<{ node: string }>>;
    };
    branch.main[0]![0]!.node = "Acknowledge";
    expect(() => runDeterministicSuite({
      workflow,
      approved,
      phase: "after",
      seed: before.seed,
      repair: tampered,
    })).toThrowError(expect.objectContaining({ code: "REPAIR_VALIDATION_FAILED" }));
  });

  it("accepts a fresh Codex candidate only when it exactly satisfies the bounded repair contract", () => {
    const workflow = createSeededWorkflow();
    const analysis = proposeCachedRiskPlan(workflow);
    const approved = approveRiskPlan(analysis, {
      planHash: analysis.planHash,
      statement: analysis.invariant.statement,
      approved: true,
    });
    const before = runDeterministicSuite({ workflow, approved, phase: "before", seed: "live-codex-v1" });
    const bounded = createCachedRepair({ workflow, approved, before });

    const repair = createLiveCodexRepair({
      workflow,
      approved,
      before,
      candidate: {
        schemaVersion: "1",
        requestId: "repair_req_123",
        threadId: "thread_123",
        attempts: 1,
        generatedAt: "2026-07-15T10:00:00.000Z",
        sourceHash: workflow.sourceHash,
        analysisId: approved.id,
        strategy: "durable_reservation_before_effect",
        explanation: "Codex derived the durable reservation repair from the approved invariant and failing trace.",
        patch: bounded.patch,
        changedNodeIds: bounded.changedNodeIds,
        regressionFixture: bounded.regressionFixture,
      },
    });

    expect(repair.provenance).toMatchObject({
      mode: "live-codex",
      generatedBy: "codex",
      requestId: "repair_req_123",
      threadId: "thread_123",
      attempts: 1,
    });
    const after = runDeterministicSuite({ workflow, approved, phase: "after", seed: before.seed, repair });
    expect(after).toMatchObject({ passed: true, effectCount: 1 });

    const tamperedPatch = structuredClone(bounded.patch);
    tamperedPatch[0]!.path = "/nodes/0";
    expect(() => createLiveCodexRepair({
      workflow,
      approved,
      before,
      candidate: {
        schemaVersion: "1",
        requestId: "repair_req_tampered",
        threadId: "thread_tampered",
        attempts: 1,
        generatedAt: "2026-07-15T10:00:00.000Z",
        sourceHash: workflow.sourceHash,
        analysisId: approved.id,
        strategy: "durable_reservation_before_effect",
        explanation: "Tampered candidate",
        patch: tamperedPatch,
        changedNodeIds: bounded.changedNodeIds,
        regressionFixture: bounded.regressionFixture,
      },
    })).toThrowError(expect.objectContaining({ code: "REPAIR_VALIDATION_FAILED" }));
  });

  it("produces identical repaired hashes and suites for identical source, seed, and contract", () => {
    const run = () => {
      const workflow = createSeededWorkflow();
      const analysis = proposeCachedRiskPlan(workflow);
      const approved = approveRiskPlan(analysis, {
        planHash: analysis.planHash,
        statement: analysis.invariant.statement,
        approved: true,
      });
      const before = runDeterministicSuite({ workflow, approved, phase: "before", seed: "repro-v1" });
      const repair = createCachedRepair({ workflow, approved, before });
      const after = runDeterministicSuite({ workflow, approved, phase: "after", seed: "repro-v1", repair });
      return { workflow, before, repair, after };
    };

    const first = run();
    const second = run();
    expect(first.workflow.sourceHash).toBe(second.workflow.sourceHash);
    expect(first.before.suiteHash).toBe(second.before.suiteHash);
    expect(first.repair.repairedWorkflowHash).toBe(second.repair.repairedWorkflowHash);
    expect(first.after.suiteHash).toBe(second.after.suiteHash);
  });

  it("rejects inline secrets without returning secret values", () => {
    const raw = JSON.stringify({
      name: "Unsafe upload",
      nodes: [
        {
          id: "http",
          name: "Create refund",
          type: "n8n-nodes-base.httpRequest",
          position: [0, 0],
          parameters: { url: "mock://refunds", apiKey: "sk-do-not-echo-this" },
        },
      ],
      connections: {},
    });

    expect(() => importWorkflow(raw)).toThrowError(
      expect.objectContaining({
        code: "INLINE_SECRET_DETECTED",
        secretPaths: ["$.nodes[0].parameters.apiKey"],
      }),
    );
    try {
      importWorkflow(raw);
    } catch (error) {
      expect(String(error)).not.toContain("sk-do-not-echo-this");
    }
  });

  it("rejects inline fixture secrets before the sanitized session state can be created", () => {
    const raw = JSON.stringify({
      name: "Safe workflow, unsafe fixture",
      nodes: [{ id: "set", name: "Set", type: "n8n-nodes-base.set", position: [0, 0], parameters: {} }],
      connections: {},
    });
    expect(() => importWorkflow(raw, { fixture: { event: { id: "evt_1" }, api_key: "do-not-store" } })).toThrowError(
      expect.objectContaining({ code: "INLINE_SECRET_DETECTED", secretPaths: ["$.api_key"] }),
    );
  });

  it("rejects secret header name/value pairs without returning the value", () => {
    const secretValue = "Basic c2VjcmV0LXVzZXI6c2VjcmV0LXBhc3M=";
    const raw = JSON.stringify({
      name: "Unsafe header upload",
      nodes: [
        {
          id: "http",
          name: "Create refund",
          type: "n8n-nodes-base.httpRequest",
          position: [0, 0],
          parameters: {
            url: "mock://refunds",
            headerParameters: {
              parameters: [{ name: "Authorization", value: secretValue }],
            },
          },
        },
      ],
      connections: {},
    });

    expect(() => importWorkflow(raw)).toThrowError(
      expect.objectContaining({
        code: "INLINE_SECRET_DETECTED",
        secretPaths: ["$.nodes[0].parameters.headerParameters.parameters[0].value"],
      }),
    );
    try {
      importWorkflow(raw);
    } catch (error) {
      expect(String(error)).not.toContain(secretValue);
    }
  });

  it.each([
    ["secret query parameter", "https://api.example.test/refund?api_key=opaque-value-one"],
    ["percent-encoded secret query parameter", "https://api.example.test/refund?api%5Fkey=opaque-value-two"],
    ["URL user-info", "https://service-user:opaque-value-three@api.example.test/refund"],
    ["OAuth secret fragment", "https://api.example.test/callback#access_token=opaque-value-four"],
    ["routed OAuth secret fragment", "https://api.example.test/callback#/complete?refresh_token=opaque-value-five"],
  ])("rejects %s without returning the URL", (_label, url) => {
    const raw = JSON.stringify({
      name: "Unsafe URL upload",
      nodes: [{
        id: "http",
        name: "Create refund",
        type: "n8n-nodes-base.httpRequest",
        position: [0, 0],
        parameters: { url },
      }],
      connections: {},
    });

    expect(() => importWorkflow(raw)).toThrowError(
      expect.objectContaining({
        code: "INLINE_SECRET_DETECTED",
        secretPaths: ["$.nodes[0].parameters.url"],
      }),
    );
    try {
      importWorkflow(raw);
    } catch (error) {
      expect(String(error)).not.toContain(url);
      expect(String(error)).not.toContain("opaque-value");
    }
  });

  it.each([
    "sk-abcdefghijklmnop123456",
    "secret-opaque-value-four",
  ])("rejects a credential-shaped property name without reflecting it", (credentialKey) => {
    const raw = JSON.stringify({
      name: "Unsafe key upload",
      nodes: [{
        id: "set",
        name: "Set value",
        type: "n8n-nodes-base.set",
        position: [0, 0],
        parameters: { [credentialKey]: "benign" },
      }],
      connections: {},
    });

    expect(() => importWorkflow(raw)).toThrowError(
      expect.objectContaining({
        code: "INLINE_SECRET_DETECTED",
        secretPaths: ["$.nodes[0].parameters.<redacted-credential-key>"],
      }),
    );
    try {
      importWorkflow(raw);
    } catch (error) {
      expect(String(error)).not.toContain(credentialKey);
      expect(String(error)).not.toContain("opaque-value-four");
    }
  });

  it("rejects excessively nested workflows with a bounded validation error", () => {
    let nested: Record<string, unknown> = { value: "leaf" };
    for (let index = 0; index < 100; index += 1) nested = { child: nested };
    const raw = JSON.stringify({
      name: "Deep workflow",
      nodes: [{ id: "x", name: "x", type: "n8n-nodes-base.set", parameters: nested }],
      connections: {},
    });

    expect(() => importWorkflow(raw)).toThrowError(
      expect.objectContaining({ code: "WORKFLOW_TOO_COMPLEX", status: 422 }),
    );
  });

  it("keeps ambiguous or unmodeled uploaded graphs diagnosis-only", () => {
    const duplicate = JSON.stringify({
      name: "Ambiguous",
      nodes: [
        { id: "same", name: "Same", type: "n8n-nodes-base.webhook", position: [0, 0], parameters: {} },
        { id: "same", name: "Other", type: "n8n-nodes-base.respondToWebhook", position: [1, 0], parameters: {} },
      ],
      connections: {},
    });
    expect(() => importWorkflow(duplicate)).toThrowError(expect.objectContaining({ code: "DUPLICATE_NODE_IDENTITY" }));

    const unmodeled = importWorkflow(JSON.stringify({
      name: "Unmodeled branch",
      nodes: [
        { id: "hook", name: "Hook", type: "n8n-nodes-base.webhook", position: [0, 0], parameters: {} },
        { id: "branch", name: "Branch", type: "n8n-nodes-base.if", position: [1, 0], parameters: {} },
      ],
      connections: {},
    }));
    expect(unmodeled.compatibility).toMatchObject({ canExecute: false, unsupportedNodeIds: ["branch"] });
  });

  it("does not traverse prototype-like fixture paths", () => {
    const workflow = importWorkflow(JSON.stringify({
      name: "Prototype path",
      nodes: [
        { id: "hook", name: "Hook", type: "n8n-nodes-base.webhook", position: [0, 0], parameters: {} },
        { id: "effect", name: "Effect", type: "n8n-nodes-base.httpRequest", position: [1, 0], parameters: { method: "POST", url: "mock://effects", body: { id: "={{ $json.constructor.id }}" } } },
        { id: "response", name: "Response", type: "n8n-nodes-base.respondToWebhook", position: [2, 0], parameters: {} },
      ],
      connections: {},
    }), { fixture: JSON.parse('{"constructor":{"id":"unsafe"}}') });
    expect(() => proposeDeterministicRiskPlan(workflow)).toThrowError(expect.objectContaining({ code: "BUSINESS_KEY_REQUIRED" }));
  });

  it("requires a matching plan hash and explicit approval", () => {
    const analysis = proposeCachedRiskPlan(createSeededWorkflow());
    expect(() =>
      approveRiskPlan(analysis, {
        planHash: "stale",
        statement: analysis.invariant.statement,
        approved: true,
      }),
    ).toThrow(/changed/i);
    expect(() =>
      approveRiskPlan(analysis, {
        planHash: analysis.planHash,
        statement: analysis.invariant.statement,
        approved: false,
      }),
    ).toThrow(/approve/i);
    expect(() =>
      approveRiskPlan(analysis, {
        planHash: analysis.planHash,
        statement: "A different claim that is not bound to the tested oracle.",
        approved: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVARIANT_CHANGED", status: 409 }));
  });
});
