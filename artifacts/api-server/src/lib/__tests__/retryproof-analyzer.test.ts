import { afterEach, describe, expect, it, vi } from "vitest";

const { createResponse } = vi.hoisted(() => ({
  createResponse: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = { create: createResponse };
  },
}));

import { analyzeWorkflowRisk } from "../retryproof-analyzer";
import {
  createSeededWorkflow,
  proposeDeterministicRiskPlan,
} from "../retryproof-engine";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("RetryProof GPT-5.6 Sol analyzer", () => {
  it("uses the production Sol request envelope and a strict bounded output contract", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_ANALYSIS_MODEL", undefined);

    const workflow = createSeededWorkflow();
    const deterministic = proposeDeterministicRiskPlan(workflow);
    createResponse.mockResolvedValue({
      id: "resp_sol_contract",
      output_text: JSON.stringify({
        effectNodeId: deterministic.sideEffect.nodeId,
        businessKeyPath: deterministic.sideEffect.businessKeyPath,
        invariantStatement: deterministic.invariant.statement,
      }),
    });

    const analysis = await analyzeWorkflowRisk({
      workflow,
      mode: "live",
      safetyIdentifier: "rp_stable_user_hash",
    });

    expect(analysis.provenance).toMatchObject({
      mode: "live",
      model: "gpt-5.6-sol",
      requestId: "resp_sol_contract",
    });
    expect(createResponse).toHaveBeenCalledOnce();
    const request = createResponse.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      model: "gpt-5.6-sol",
      store: false,
      max_output_tokens: 800,
      reasoning: { effort: "medium" },
      safety_identifier: "rp_stable_user_hash",
      text: {
        format: {
          type: "json_schema",
          name: "retryproof_risk_contract",
          strict: true,
        },
      },
    });
    expect(request).not.toHaveProperty("user");
    expect(request.instructions).toContain("untrusted data");
    expect(request.instructions).toContain("Return only the required structured object");
  });
});
