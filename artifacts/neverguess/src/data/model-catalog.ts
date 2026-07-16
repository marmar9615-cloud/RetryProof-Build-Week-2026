// Static mirror of the server's curated model catalog. Used two ways:
//  1. As placeholderData for GET /models so the selector renders instantly
//     (and in static preview mode where no API is mounted).
//  2. As the display-name lookup for model ids echoed across the app
//     (dashboard chips, audit-detail header, report receipt, public report).
//
// Deliberately carries NO pricing or context-window numbers — those are live
// metadata that only the server's OpenRouter-enriched response may provide.
// Keep ids in sync with artifacts/api-server/src/lib/model-catalog.ts.

export type ModelProvider = "anthropic" | "openai" | "google" | "x-ai";
export type ModelTier = "standard" | "premium";

export type StaticModelEntry = {
  id: string;
  displayName: string;
  provider: ModelProvider;
  tier: ModelTier;
  proOnly: boolean;
  isDefault: boolean;
  /** Capability-based one-liner. No benchmark or speed claims. */
  blurb: string;
};

export const DEFAULT_MODEL_ID = "openai/gpt-5.5";

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  "x-ai": "xAI",
};

export const STATIC_MODEL_CATALOG: StaticModelEntry[] = [
  // ---- Anthropic ----------------------------------------------------------
  {
    id: "anthropic/claude-fable-5",
    displayName: "Claude Fable 5",
    provider: "anthropic",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "Anthropic's Claude 5 flagship.",
  },
  {
    id: "anthropic/claude-sonnet-5",
    displayName: "Claude Sonnet 5",
    provider: "anthropic",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "Claude 5 family, balanced cost and capability.",
  },
  {
    id: "anthropic/claude-opus-4.8",
    displayName: "Claude Opus 4.8",
    provider: "anthropic",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "Anthropic's Opus 4.8.",
  },
  {
    id: "anthropic/claude-opus-4.8-fast",
    displayName: "Claude Opus 4.8 (Fast)",
    provider: "anthropic",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "Opus 4.8 served with faster output.",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "Anthropic's small, low-cost model.",
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
  },
  {
    id: "openai/gpt-5.6-luna-pro",
    displayName: "GPT-5.6 Luna Pro",
    provider: "openai",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "Luna with extended reasoning.",
  },
  {
    id: "openai/gpt-5.6-terra",
    displayName: "GPT-5.6 Terra",
    provider: "openai",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "GPT-5.6 family, mid variant.",
  },
  {
    id: "openai/gpt-5.6-terra-pro",
    displayName: "GPT-5.6 Terra Pro",
    provider: "openai",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "Terra with extended reasoning.",
  },
  {
    id: "openai/gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    provider: "openai",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "GPT-5.6 family, largest standard variant.",
  },
  {
    id: "openai/gpt-5.6-sol-pro",
    displayName: "GPT-5.6 Sol Pro",
    provider: "openai",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "Sol with extended reasoning.",
  },
  {
    id: "openai/gpt-5.5",
    displayName: "GPT-5.5",
    provider: "openai",
    tier: "standard",
    proOnly: false,
    isDefault: true,
    blurb: "The NeverGuess default.",
  },
  {
    id: "openai/gpt-5.5-pro",
    displayName: "GPT-5.5 Pro",
    provider: "openai",
    tier: "premium",
    proOnly: true,
    isDefault: false,
    blurb: "GPT-5.5 with extended reasoning.",
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
  },
  {
    id: "google/gemini-3.1-pro-preview",
    displayName: "Gemini 3.1 Pro (Preview)",
    provider: "google",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "Gemini Pro line, preview release.",
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
  },
  {
    id: "x-ai/grok-4.20",
    displayName: "Grok 4.20",
    provider: "x-ai",
    tier: "standard",
    proOnly: false,
    isDefault: false,
    blurb: "Grok with a 2M-token context window.",
  },
];

const byId = new Map(STATIC_MODEL_CATALOG.map((m) => [m.id, m]));

export function modelEntryFor(id: string | null | undefined): StaticModelEntry | null {
  if (!id) return null;
  return byId.get(id) ?? null;
}

/**
 * Human display name for a model id. Falls back to the id's tail segment so
 * unknown ids (env overrides, future models) still render as something
 * readable, e.g. "openai/gpt-6-new" -> "gpt-6-new".
 */
export function displayNameFor(id: string | null | undefined): string | null {
  if (!id) return null;
  return byId.get(id)?.displayName ?? id.split("/").pop() ?? id;
}
