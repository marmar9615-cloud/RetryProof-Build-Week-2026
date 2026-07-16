import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, isNotNull, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, auditsTable, reportsTable } from "@workspace/db";
import {
  CreateReportShareLinkParams,
  GetPublicReportParams,
  RevokeReportShareLinkParams,
} from "@workspace/api-zod";
import { renderVerdictBadge } from "../lib/badge-svg";
import { normalizePromptPack } from "../lib/prompt-pack";
import { DEMO_USER_ID } from "../lib/seed-demo";

const router: IRouter = Router();

function makeSlug(): string {
  return randomBytes(9).toString("base64url");
}

function publicBaseUrl(req: Request): string {
  // Prefer an explicitly configured canonical origin to avoid host-header
  // poisoning. Only fall back to request headers in development.
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      if (process.env.NODE_ENV === "production") {
        throw new Error("PUBLIC_APP_URL must be a valid URL in production.");
      }
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("PUBLIC_APP_URL is required in production.");
  }
  const replitDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (replitDomain) {
    return `https://${replitDomain}`;
  }
  const fwdProto = req.get("x-forwarded-proto");
  const proto = fwdProto?.split(",")[0]?.trim() || req.protocol;
  const host = req.get("host") || "localhost";
  return `${proto}://${host}`;
}

router.post(
  "/reports/:id/share",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const params = CreateReportShareLinkParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const reportId = params.data.id;

    const [report] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.id, reportId));
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    const [audit] = await db
      .select()
      .from(auditsTable)
      .where(eq(auditsTable.id, report.auditId));
    if (!audit || audit.userId !== req.user.id) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    let slug = report.shareSlug;
    if (!slug) {
      // Try a few times to avoid the (extremely unlikely) collision.
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = makeSlug();
        try {
          const updated = await db
            .update(reportsTable)
            .set({ shareSlug: candidate })
            .where(eq(reportsTable.id, report.id))
            .returning({ shareSlug: reportsTable.shareSlug });
          if (updated[0]?.shareSlug) {
            slug = updated[0].shareSlug;
            break;
          }
        } catch (err) {
          if (attempt === 4) throw err;
        }
      }
    }
    if (!slug) {
      res.status(500).json({ error: "Could not generate share slug" });
      return;
    }

    res.json({
      shareSlug: slug,
      shareUrl: `${publicBaseUrl(req)}/r/${slug}`,
    });
  },
);

router.delete(
  "/reports/:id/share",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const params = RevokeReportShareLinkParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const reportId = params.data.id;

    const [report] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.id, reportId));
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    const [audit] = await db
      .select()
      .from(auditsTable)
      .where(eq(auditsTable.id, report.auditId));
    if (!audit || audit.userId !== req.user.id) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    if (report.shareSlug) {
      await db
        .update(reportsTable)
        .set({ shareSlug: null })
        .where(eq(reportsTable.id, report.id));
    }

    res.json({ success: true });
  },
);

// Reserved sub-paths under /r/ that have their own dedicated handlers below.
// Express matches in declaration order, so without this guard a request to
// /r/gallery would be captured here as `slug = "gallery"` and 404.
const RESERVED_R_PATHS = new Set(["gallery"]);

router.get(
  "/r/:slug",
  async (req: Request, res: Response, next): Promise<void> => {
    const slugParam = typeof req.params.slug === "string" ? req.params.slug : "";
    if (RESERVED_R_PATHS.has(slugParam)) {
      next();
      return;
    }
    const params = GetPublicReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const slug = params.data.slug;
    const [report] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.shareSlug, slug));
    if (!report) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [audit] = await db
      .select()
      .from(auditsTable)
      .where(eq(auditsTable.id, report.auditId));
    if (!audit) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({
      report: {
        id: report.id,
        auditId: report.auditId,
        source: report.source,
        architectureSummary: report.architectureSummary,
        mermaidGraph: report.mermaidGraph,
        riskyAssumptions: report.riskyAssumptions,
        acceptanceCriteria: report.acceptanceCriteria,
        promptPack: normalizePromptPack(report.promptPack),
        rolloutNotes: report.rolloutNotes,
        smokeTestResults: report.smokeTestResults ?? null,
        smokeScreenshotUrl: report.smokeScreenshotUrl ?? null,
        analysisUsage: report.analysisUsage ?? null,
        affectedAreas: report.affectedAreas ?? null,
        shareSlug: report.shareSlug ?? null,
        riskScore: report.riskScore,
        verdict: report.verdict,
        testPlan: report.testPlan ?? null,
        createdAt: report.createdAt.toISOString(),
      },
      audit: {
        requestedChange: audit.requestedChange,
        githubUrl: audit.githubUrl,
        liveUrl: audit.liveUrl,
        detectedFramework: audit.detectedFramework,
        detectedPackageManager: audit.detectedPackageManager,
        detectedDbLayer: audit.detectedDbLayer,
        detectedAuthLayer: audit.detectedAuthLayer,
        createdAt: audit.createdAt.toISOString(),
      },
    });
  },
);

router.get(
  "/r/:slug/badge.svg",
  async (req: Request, res: Response): Promise<void> => {
    const params = GetPublicReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    const slug = params.data.slug;
    const [report] = await db
      .select({
        verdict: reportsTable.verdict,
        riskScore: reportsTable.riskScore,
      })
      .from(reportsTable)
      .where(eq(reportsTable.shareSlug, slug));
    if (!report) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    const svg = renderVerdictBadge({
      verdict: report.verdict,
      score: report.riskScore,
    });
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    // Allow CDNs (and GitHub camo) to cache for a few minutes; verdicts are stable.
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.send(svg);
  },
);

/**
 * GET /api/r/gallery
 *
 * Returns demo reports for the marketing site's "Built with NeverGuess" strip.
 * Owner-created share links are intentionally link-only until the product has a
 * separate opt-in field for publishing a report to the gallery.
 *
 * The actual data is fetched fresh on every request — no DB caching, but
 * res-level cache header lets a CDN absorb the load.
 */
router.get(
  "/r/gallery",
  async (_req: Request, res: Response): Promise<void> => {
    const limit = 6;
    const rows = await db
      .select({
        slug: reportsTable.shareSlug,
        verdict: reportsTable.verdict,
        riskScore: reportsTable.riskScore,
        requestedChange: auditsTable.requestedChange,
        githubUrl: auditsTable.githubUrl,
        createdAt: reportsTable.createdAt,
      })
      .from(reportsTable)
      .innerJoin(auditsTable, eq(auditsTable.id, reportsTable.auditId))
      .where(
        and(
          isNotNull(reportsTable.shareSlug),
          eq(auditsTable.userId, DEMO_USER_ID),
        ),
      )
      .orderBy(desc(reportsTable.createdAt))
      .limit(limit);

    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
    res.json({
      reports: rows
        .filter((r) => r.slug !== null)
        .map((r) => ({
          slug: r.slug!,
          verdict: r.verdict,
          riskScore: r.riskScore,
          requestedChange: r.requestedChange,
          githubRepo: r.githubUrl ? safeRepoPath(r.githubUrl) : null,
          createdAt: r.createdAt.toISOString(),
        })),
    });
  },
);

function safeRepoPath(githubUrl: string): string | null {
  try {
    const url = new URL(githubUrl);
    return url.pathname.replace(/^\//, "");
  } catch {
    return null;
  }
}

export default router;
