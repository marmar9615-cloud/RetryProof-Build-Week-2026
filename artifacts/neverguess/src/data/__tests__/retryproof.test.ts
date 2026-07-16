import { describe, expect, it } from "vitest";
import { RETRYPROOF, RETRYPROOF_JSON_LD } from "../retryproof";

describe("RetryProof product metadata", () => {
  it("uses public product, app, and source URLs", () => {
    expect(RETRYPROOF.productUrl).toBe("https://marmarlabs.com/retryproof");
    expect(RETRYPROOF.appUrl).toBe("https://marmarlabs.com/retryproof/lab");
    expect(RETRYPROOF.repositoryUrl).toBe(
      "https://github.com/marmar9615-cloud/Copilot-Checker",
    );
    expect(RETRYPROOF_JSON_LD.codeRepository).toBe(RETRYPROOF.repositoryUrl);
  });

  it("preserves the product's claim boundary", () => {
    expect(RETRYPROOF.boundary).toContain("approved invariants");
    expect(RETRYPROOF.boundary).toContain("declared fault models");
    expect(RETRYPROOF.boundary).toContain("does not claim exactly-once");
    expect(RETRYPROOF.boundary).toContain("production safety");
    expect(RETRYPROOF.labModeLabel).toBe("Synthetic execution");
    expect(RETRYPROOF.repairModeLabel).toBe("Live Codex · deterministic gate");
  });
});
