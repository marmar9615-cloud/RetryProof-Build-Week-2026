import type { PromptPack } from "@workspace/db";

export function normalizePromptPack(value: unknown): PromptPack {
  const pack =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const replit = typeof pack.replit === "string" ? pack.replit : "";
  const cursor = typeof pack.cursor === "string" ? pack.cursor : replit;
  const copilot = typeof pack.copilot === "string" ? pack.copilot : cursor;
  return {
    replit,
    cursor,
    copilot,
    claudeCode: typeof pack.claudeCode === "string" ? pack.claudeCode : replit,
    codex: typeof pack.codex === "string" ? pack.codex : cursor,
  };
}
