import OpenAI from "openai";

let cached: OpenAI | null = null;

export function isAiConfigured(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL &&
      process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
  );
}

export function getOpenRouter(): OpenAI {
  if (cached) return cached;
  if (!isAiConfigured()) {
    throw new Error("OpenRouter integration not configured");
  }
  cached = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY!,
    baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL!,
  });
  return cached;
}
