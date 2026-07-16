import { describe, expect, it } from "vitest";
import { normalizePromptPack } from "../prompt-pack";

describe("normalizePromptPack", () => {
  it("preserves all five prompt tools when present", () => {
    expect(
      normalizePromptPack({
        replit: "r",
        cursor: "cu",
        copilot: "co",
        claudeCode: "cc",
        codex: "cx",
      }),
    ).toEqual({
      replit: "r",
      cursor: "cu",
      copilot: "co",
      claudeCode: "cc",
      codex: "cx",
    });
  });

  it("backfills new prompt tools for older reports", () => {
    expect(
      normalizePromptPack({
        replit: "replit prompt",
        cursor: "cursor prompt",
        copilot: "copilot prompt",
      }),
    ).toEqual({
      replit: "replit prompt",
      cursor: "cursor prompt",
      copilot: "copilot prompt",
      claudeCode: "replit prompt",
      codex: "cursor prompt",
    });
  });
});
