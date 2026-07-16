// Curated catalog of analysis models an audit can run on, plus the gating
// and per-model analysis envelope (timeout + reasoning effort) the runner
// uses. This is the server-side source of truth; the frontend keeps a static
// mirror in artifacts/neverguess/src/data/model-catalog.ts — keep ids and
// blurbs in sync.

export type ModelProvider = "anthropic" | "openai" | "google" | "x-ai";
export type ModelTier = "standard" | "premium";
export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export type CatalogModel = {
  id: string;
  displayName: string;
  provider: ModelProvider;
  tier: ModelTier;
  /** Premium models are only selectable on a Pro plan. */
  proOnly: boolean;
  isDefault: boolean;
  /** Capability-based one-liner. No benchmark or speed claims. */
  blurb: string;
  /** How long one analysis completion may run before the client times out. */
  timeoutMs: number;
  /** Default reasoning effort. OPENROUTER_REASONING_EFFORT overrides globally. */
  reasoningEffort: ReasoningEffort;
};

// Analysis envelopes. Premium extended-reasoning models can sit in reasoning
// for minutes on a structured-output prompt; small/fast models finish well
// inside 90s; everything else gets the standard middle envelope.
const PREMIUM_TIMEOUT_MS = 240_000;
const STANDARD_TIMEOUT_MS = 120_000;
const FAST_TIMEOUT_MS = 90_000;

/**
 * Catalog id used when an audit row has no explicit model (legacy rows and
 * users who never touch the selector). OPENROUTER_MODEL may point outside
 * the curated catalog — resolveModel() still honors it with the standard
 * envelope.
 */
export const DEFAULT_MODEL_ID =
  process.env.OPENROUTER_MODEL ?? "openai/gpt-5.5";

export const MODEL_CATALOG: CatalogModel[] = [
  // ---- Anthropic ----------------------------------------------------------
  {
    id: "anthropic/claude-fable-5",
    displayName: "Claude Fable 5",
    provider: "anthropic",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "Anthropic's Claude 5 flagship.",
    timeoutMs: PREMIUM_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "anthropic/claude-sonnet-5",
    displayName: "Claude Sonnet 5",
    provider: "anthropic",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "Claude 5 family, balanced cost and capability.",
    timeoutMs: STANDARD_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "anthropic/claude-opus-4.8",
    displayName: "Claude Opus 4.8",
    provider: "anthropic",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "Anthropic's Opus 4.8.",
    timeoutMs: STANDARD_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "anthropic/claude-opus-4.8-fast",
    displayName: "Claude Opus 4.8 (Fast)",
    provider: "anthropic",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "Opus 4.8 served with faster output.",
    timeoutMs: PREMIUM_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "Anthropic's small, low-cost model.",
    timeoutMs: FAST_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  // ---- OpenAI -------------------------------------------------------------
  {
    id: "openai/gpt-5.6-luna",
    displayName: "GPT-5.6 Luna",
    provider: "openai",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "GPT-5.6 family, lightest variant.",
    timeoutMs: FAST_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "openai/gpt-5.6-luna-pro",
    displayName: "GPT-5.6 Luna Pro",
    provider: "openai",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "Luna with extended reasoning.",
    timeoutMs: PREMIUM_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "openai/gpt-5.6-terra",
    displayName: "GPT-5.6 Terra",
    provider: "openai",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "GPT-5.6 family, mid variant.",
    timeoutMs: STANDARD_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "openai/gpt-5.6-terra-pro",
    displayName: "GPT-5.6 Terra Pro",
    provider: "openai",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "Terra with extended reasoning.",
    timeoutMs: PREMIUM_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "openai/gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    provider: "openai",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "GPT-5.6 family, largest standard variant.",
    timeoutMs: STANDARD_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "openai/gpt-5.6-sol-pro",
    displayName: "GPT-5.6 Sol Pro",
    provider: "openai",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "Sol with extended reasoning.",
    timeoutMs: PREMIUM_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "openai/gpt-5.5",
    displayName: "GPT-5.5",
    provider: "openai",
    tier: "standard",
    proOnly: false,
    isDefault: true,
    blurb: "The NeverGuess default.",
    timeoutMs: STANDARD_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "openai/gpt-5.5-pro",
    displayName: "GPT-5.5 Pro",
    provider: "openai",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "GPT-5.5 with extended reasoning.",
    timeoutMs: PREMIUM_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  // ---- Google -------------------------------------------------------------
  {
    id: "google/gemini-3.5-flash",
    displayName: "Gemini 3.5 Flash",
    provider: "google",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "Google's fast Gemini tier.",
    timeoutMs: FAST_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "google/gemini-3.1-pro-preview",
    displayName: "Gemini 3.1 Pro (Preview)",
    provider: "google",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "Gemini Pro line, preview release.",
    timeoutMs: STANDARD_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  // ---- xAI ----------------------------------------------------------------
  {
    id: "x-ai/grok-4.5",
    displayName: "Grok 4.5",
    provider: "x-ai",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "xAI's current Grok generation.",
    timeoutMs: STANDARD_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
  {
    id: "x-ai/grok-4.20",
    displayName: "Grok 4.20",
    provider: "x-ai",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "Grok with a 2M-token context window.",
    timeoutMs: STANDARD_TIMEOUT_MS,
    reasoningEffort: "medium",
  },
];

const byId = new Map(MODEL_CATALOG.map((m) => [m.id, m]));

export function getCatalogModel(id: string): CatalogModel | null {
  return byId.get(id) ?? null;
}

// The analysis runner picks a sensible per-model default effort that still
// finishes inside the model's timeout. OPENROUTER_REASONING_EFFORT remains
// a global override, read at call time so redeploys/tests can change it.
function envReasoningEffort(): ReasoningEffort | undefined {
  return process.env.OPENROUTER_REASONING_EFFORT as
    | ReasoningEffort
    | undefined;
}

export type ResolvedModel = {
  id: string;
  timeoutMs: number;
  reasoningEffort: ReasoningEffort;
};

/**
 * Resolve an audit row's model column to the id + analysis envelope the
 * runner should use. Null (legacy rows, selector untouched) and ids no
 * longer in the catalog fall back to DEFAULT_MODEL_ID. If the env default
 * itself is outside the catalog, it runs with the standard envelope.
 */
export function resolveModel(auditModel: string | null): ResolvedModel {
  const entry = byId.get(auditModel ?? "") ?? byId.get(DEFAULT_MODEL_ID);
  if (!entry) {
    return {
      id: DEFAULT_MODEL_ID,
      timeoutMs: STANDARD_TIMEOUT_MS,
      reasoningEffort: envReasoningEffort() ?? "medium",
    };
  }
  return {
    id: entry.id,
    timeoutMs: entry.timeoutMs,
    reasoningEffort: envReasoningEffort() ?? entry.reasoningEffort,
  };
}

export type ModelCaller =
  | { kind: "trial" }
  | { kind: "free" }
  | { kind: "pro" };

export type ModelChoiceResult =
  | { ok: true; id: string | null }
  | {
      ok: false;
      status: 400 | 403;
      code?: "MODEL_REQUIRES_SIGN_IN" | "MODEL_REQUIRES_PRO";
      error: string;
    };

/**
 * Gate a requested model id against the catalog and the caller's plan.
 * Null/omitted always passes (server default). Anonymous trial audits may
 * only run the default model; premium (proOnly) models require Pro.
 */
export function validateModelChoice(
  model: string | null | undefined,
  caller: ModelCaller,
): ModelChoiceResult {
  if (model == null) return { ok: true, id: null };

  const entry = byId.get(model);
  if (!entry) {
    return {
      ok: false,
      status: 400,
      error: `Unknown model "${model}". Choose one of the ids returned by GET /models.`,
    };
  }

  if (caller.kind === "trial" && entry.id !== DEFAULT_MODEL_ID) {
    return {
      ok: false,
      status: 403,
      code: "MODEL_REQUIRES_SIGN_IN",
      error:
        "Anonymous trial audits run on the default model. Sign in to choose a different one.",
    };
  }

  if (caller.kind === "free" && entry.proOnly) {
    return {
      ok: false,
      status: 403,
      code: "MODEL_REQUIRES_PRO",
      error: `${entry.displayName} is available on the Pro plan. Upgrade to run audits on it.`,
    };
  }

  return { ok: true, id: entry.id };
}
