import { Router, type IRouter, type Request, type Response } from "express";
import { ListModelsResponse } from "@workspace/api-zod";
import { getEntitlementForUser } from "../lib/entitlement";
import { DEFAULT_MODEL_ID, MODEL_CATALOG } from "../lib/model-catalog";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Public OpenRouter catalog. Metadata only (context windows, pricing) and
// needs no API key, so we always hit the public host — even when
// AI_INTEGRATIONS_OPENROUTER_BASE_URL points at the Replit modelfarm proxy,
// which does not serve this listing.
const OPENROUTER_CATALOG_URL = "https://openrouter.ai/api/v1/models";
// Serve cached enrichment for 10 minutes; after a failure, wait a minute
// before retrying so every request doesn't eat the full fetch timeout.
const ENRICHMENT_TTL_MS = 10 * 60 * 1000;
const ENRICHMENT_FAILURE_TTL_MS = 60 * 1000;
// GET /models must stay snappy — give the upstream catalog 3s, then serve
// the static catalog with null live fields.
const ENRICHMENT_FETCH_TIMEOUT_MS = 3_000;

type ModelEnrichment = {
  contextLength: number | null;
  promptPricePerMTok: number | null;
  completionPricePerMTok: number | null;
};

let enrichmentCache: {
  fetchedAt: number;
  ttlMs: number;
  /** null = last fetch failed; serve null live fields until the TTL lapses. */
  byId: Map<string, ModelEnrichment> | null;
} | null = null;

/** OpenRouter prices are per-token strings ("0.000005") — convert to $/M, 2dp. */
function perMTok(perToken: unknown): number | null {
  const n =
    typeof perToken === "string"
      ? Number(perToken)
      : typeof perToken === "number"
        ? perToken
        : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1e6 * 100) / 100;
}

async function getEnrichment(): Promise<Map<string, ModelEnrichment> | null> {
  const now = Date.now();
  if (enrichmentCache && now - enrichmentCache.fetchedAt < enrichmentCache.ttlMs) {
    return enrichmentCache.byId;
  }
  try {
    const res = await fetch(OPENROUTER_CATALOG_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(ENRICHMENT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter catalog responded ${res.status}`);
    }
    const body = (await res.json()) as {
      data?: Array<{
        id?: string;
        context_length?: number | null;
        pricing?: {
          prompt?: string | number | null;
          completion?: string | number | null;
        } | null;
      }>;
    };
    const byId = new Map<string, ModelEnrichment>();
    for (const model of body.data ?? []) {
      if (!model?.id) continue;
      byId.set(model.id, {
        contextLength:
          typeof model.context_length === "number" ? model.context_length : null,
        promptPricePerMTok: perMTok(model.pricing?.prompt),
        completionPricePerMTok: perMTok(model.pricing?.completion),
      });
    }
    enrichmentCache = { fetchedAt: now, ttlMs: ENRICHMENT_TTL_MS, byId };
    return byId;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "OpenRouter catalog enrichment failed — serving static catalog",
    );
    enrichmentCache = {
      fetchedAt: now,
      ttlMs: ENRICHMENT_FAILURE_TTL_MS,
      byId: null,
    };
    return null;
  }
}

router.get("/models", async (req: Request, res: Response): Promise<void> => {
  // Anonymous visitors are trial callers: only the default model is
  // selectable. Authenticated callers split into free/pro via entitlement.
  let callerKind: "trial" | "free" | "pro" = "trial";
  if (req.isAuthenticated()) {
    const ent = await getEntitlementForUser(req.user.id);
    callerKind = ent.tier;
  }

  const enrichment = await getEnrichment();

  const models = MODEL_CATALOG.map((m) => {
    const locked =
      callerKind === "trial"
        ? m.id !== DEFAULT_MODEL_ID
        : callerKind === "free" && m.proOnly;
    const live = enrichment?.get(m.id) ?? null;
    return {
      id: m.id,
      displayName: m.displayName,
      provider: m.provider,
      tier: m.tier,
      proOnly: m.proOnly,
      isDefault: m.id === DEFAULT_MODEL_ID,
      available: !locked,
      lockReason: locked
        ? callerKind === "trial"
          ? "sign-in-required"
          : "pro-required"
        : null,
      blurb: m.blurb,
      contextLength: live?.contextLength ?? null,
      promptPricePerMTok: live?.promptPricePerMTok ?? null,
      completionPricePerMTok: live?.completionPricePerMTok ?? null,
    };
  });

  res.json(
    ListModelsResponse.parse({
      models,
      defaultModel: DEFAULT_MODEL_ID,
      live: enrichment !== null,
    }),
  );
});

export default router;
