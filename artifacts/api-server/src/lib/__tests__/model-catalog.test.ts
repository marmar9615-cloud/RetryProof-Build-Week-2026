import { afterEach, describe, expect, it, vi } from "vitest";

// The catalog reads OPENROUTER_MODEL / OPENROUTER_REASONING_EFFORT from the
// environment, so every test imports a fresh module copy with the env pinned.
// This keeps assertions deterministic regardless of the shell running vitest.
async function loadCatalog(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  vi.stubEnv("OPENROUTER_MODEL", undefined);
  vi.stubEnv("OPENROUTER_REASONING_EFFORT", undefined);
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return await import("../model-catalog");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("validateModelChoice", () => {
  it("accepts a null/omitted model for every caller kind", async () => {
    const { validateModelChoice } = await loadCatalog();
    for (const kind of ["trial", "free", "pro"] as const) {
      expect(validateModelChoice(null, { kind })).toEqual({
        ok: true,
        id: null,
      });
      expect(validateModelChoice(undefined, { kind })).toEqual({
        ok: true,
        id: null,
      });
    }
  });

  it("rejects unknown model ids with a 400", async () => {
    const { validateModelChoice } = await loadCatalog();
    const result = validateModelChoice("openai/not-a-real-model", {
      kind: "pro",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.code).toBeUndefined();
    }
  });

  it("blocks trial callers from any non-default model", async () => {
    const { validateModelChoice } = await loadCatalog();
    const result = validateModelChoice("anthropic/claude-sonnet-5", {
      kind: "trial",
    });
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: "MODEL_REQUIRES_SIGN_IN",
    });
  });

  it("lets trial callers name the default model explicitly", async () => {
    const { validateModelChoice, DEFAULT_MODEL_ID } = await loadCatalog();
    expect(validateModelChoice(DEFAULT_MODEL_ID, { kind: "trial" })).toEqual({
      ok: true,
      id: DEFAULT_MODEL_ID,
    });
  });

  it("blocks free callers from proOnly models", async () => {
    const { validateModelChoice } = await loadCatalog();
    const result = validateModelChoice("openai/gpt-5.5-pro", { kind: "free" });
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: "MODEL_REQUIRES_PRO",
    });
  });

  it("lets free callers use standard models", async () => {
    const { validateModelChoice } = await loadCatalog();
    expect(
      validateModelChoice("anthropic/claude-haiku-4.5", { kind: "free" }),
    ).toEqual({ ok: true, id: "anthropic/claude-haiku-4.5" });
  });

  it("lets pro callers use premium models", async () => {
    const { validateModelChoice } = await loadCatalog();
    expect(
      validateModelChoice("anthropic/claude-fable-5", { kind: "pro" }),
    ).toEqual({ ok: true, id: "anthropic/claude-fable-5" });
  });
});

describe("resolveModel", () => {
  it("resolves a catalog id to its own analysis envelope", async () => {
    const { resolveModel } = await loadCatalog();
    expect(resolveModel("anthropic/claude-haiku-4.5")).toEqual({
      id: "anthropic/claude-haiku-4.5",
      timeoutMs: 90_000,
      reasoningEffort: "medium",
    });
    expect(resolveModel("openai/gpt-5.5-pro")).toEqual({
      id: "openai/gpt-5.5-pro",
      timeoutMs: 240_000,
      reasoningEffort: "medium",
    });
  });

  it("falls back to the default model for null (legacy rows)", async () => {
    const { resolveModel } = await loadCatalog();
    expect(resolveModel(null)).toEqual({
      id: "openai/gpt-5.5",
      timeoutMs: 120_000,
      reasoningEffort: "medium",
    });
  });

  it("falls back to the default model for ids no longer in the catalog", async () => {
    const { resolveModel } = await loadCatalog();
    expect(resolveModel("openai/removed-model").id).toBe("openai/gpt-5.5");
  });

  it("uses the standard envelope when OPENROUTER_MODEL is outside the catalog", async () => {
    const { resolveModel, DEFAULT_MODEL_ID } = await loadCatalog({
      OPENROUTER_MODEL: "custom/self-hosted-model",
    });
    expect(DEFAULT_MODEL_ID).toBe("custom/self-hosted-model");
    expect(resolveModel(null)).toEqual({
      id: "custom/self-hosted-model",
      timeoutMs: 120_000,
      reasoningEffort: "medium",
    });
  });

  it("honors OPENROUTER_REASONING_EFFORT as a global override", async () => {
    const { resolveModel } = await loadCatalog({
      OPENROUTER_REASONING_EFFORT: "high",
    });
    expect(resolveModel("openai/gpt-5.5").reasoningEffort).toBe("high");
    expect(resolveModel(null).reasoningEffort).toBe("high");
  });
});
