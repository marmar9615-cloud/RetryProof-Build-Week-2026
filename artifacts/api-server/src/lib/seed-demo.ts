import { eq, sql } from "drizzle-orm";
import {
  db,
  auditsTable,
  reportsTable,
  usersTable,
} from "@workspace/db";
import { DEMO_REPORT } from "./demo-report";
import { DEMO_REPO } from "./demo-repo";
import { detectTechStack } from "./tech-detect";
import { logger } from "./logger";
import { SAMPLE_AUDITS } from "./sample-audits";
import { computeRiskScore } from "./risk-score";

export const DEMO_USER_ID = "demo-user";
export const DEMO_SHARE_SLUG = "demo";

export async function seedDemoIfMissing(): Promise<{
  userId: string;
  auditId: string;
  reportId: string;
  shareSlug: string;
}> {
  // 1. Demo user
  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, DEMO_USER_ID));
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({
        id: DEMO_USER_ID,
        email: "demo@neverguess.app",
        firstName: "NeverGuess",
        lastName: "Demo",
      })
      .returning();
  }

  // 2. Demo report (look up via shareSlug — that's our idempotency key)
  const [existingReport] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.shareSlug, DEMO_SHARE_SLUG));
  if (existingReport) {
    // Backfill risk/verdict/testPlan onto the pre-existing demo report so
    // older rows seeded before these columns existed still surface a TL;DR
    // pill and a Test Plan tab.
    const { score, verdict } = computeRiskScore(DEMO_REPORT.riskyAssumptions);
    await db
      .update(reportsTable)
      .set({
        riskScore: score,
        verdict,
        testPlan: DEMO_REPORT.testPlan ?? null,
        affectedAreas: DEMO_REPORT.affectedAreas ?? null,
      })
      .where(eq(reportsTable.id, existingReport.id));
    await seedSampleGallery(user.id);
    return {
      userId: user.id,
      auditId: existingReport.auditId,
      reportId: existingReport.id,
      shareSlug: DEMO_SHARE_SLUG,
    };
  }

  // 3. Demo audit
  const detection = detectTechStack(DEMO_REPO);
  const [audit] = await db
    .insert(auditsTable)
    .values({
      userId: user.id,
      githubUrl: "https://github.com/demo/sample-fullstack-app",
      liveUrl: null,
      requestedChange:
        "Add per-user rate limiting on the audits POST endpoint without breaking existing dashboard polling.",
      status: "done",
      ingestionSource: "demo",
      detectedFramework: detection.framework,
      detectedPackageManager: detection.packageManager,
      detectedDbLayer: detection.dbLayer,
      detectedAuthLayer: detection.authLayer,
      routesFolder: detection.routesFolder,
      deploymentClues: detection.deploymentClues,
      rawFilesJson: DEMO_REPO,
    })
    .returning();

  // 4. Demo report
  const { score: demoScore, verdict: demoVerdict } = computeRiskScore(
    DEMO_REPORT.riskyAssumptions,
  );
  const [report] = await db
    .insert(reportsTable)
    .values({
      auditId: audit.id,
      source: "demo",
      architectureSummary: DEMO_REPORT.architectureSummary,
      mermaidGraph: DEMO_REPORT.mermaidGraph,
      riskyAssumptions: DEMO_REPORT.riskyAssumptions,
      acceptanceCriteria: DEMO_REPORT.acceptanceCriteria,
      promptPack: DEMO_REPORT.promptPack,
      rolloutNotes: DEMO_REPORT.rolloutNotes,
      riskScore: demoScore,
      verdict: demoVerdict,
      testPlan: DEMO_REPORT.testPlan ?? null,
      affectedAreas: DEMO_REPORT.affectedAreas ?? null,
      shareSlug: DEMO_SHARE_SLUG,
    })
    .returning();

  logger.info(
    { userId: user.id, auditId: audit.id, reportId: report.id },
    "Seeded demo audit + report",
  );

  await seedSampleGallery(user.id);

  return {
    userId: user.id,
    auditId: audit.id,
    reportId: report.id,
    shareSlug: DEMO_SHARE_SLUG,
  };
}

async function seedSampleGallery(userId: string): Promise<void> {
  for (const sample of SAMPLE_AUDITS) {
    const { score, verdict } = computeRiskScore(sample.report.riskyAssumptions);
    const [existing] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.shareSlug, sample.shareSlug));
    if (existing) {
      await db
        .update(reportsTable)
        .set({
          architectureSummary: sample.report.architectureSummary,
          mermaidGraph: sample.report.mermaidGraph,
          riskyAssumptions: sample.report.riskyAssumptions,
          acceptanceCriteria: sample.report.acceptanceCriteria,
          promptPack: sample.report.promptPack,
          rolloutNotes: sample.report.rolloutNotes,
          riskScore: score,
          verdict,
          testPlan: sample.report.testPlan ?? null,
        })
        .where(eq(reportsTable.id, existing.id));
      continue;
    }
    const [sampleAudit] = await db
      .insert(auditsTable)
      .values({
        userId,
        githubUrl: sample.audit.githubUrl,
        liveUrl: sample.audit.liveUrl,
        requestedChange: sample.audit.requestedChange,
        status: "done",
        ingestionSource: "demo",
        detectedFramework: sample.audit.detectedFramework,
        detectedPackageManager: sample.audit.detectedPackageManager,
        detectedDbLayer: sample.audit.detectedDbLayer,
        detectedAuthLayer: sample.audit.detectedAuthLayer,
        routesFolder: sample.audit.routesFolder,
        deploymentClues: sample.audit.deploymentClues,
        rawFilesJson: DEMO_REPO,
      })
      .returning();
    await db.insert(reportsTable).values({
      auditId: sampleAudit.id,
      source: "demo",
      architectureSummary: sample.report.architectureSummary,
      mermaidGraph: sample.report.mermaidGraph,
      riskyAssumptions: sample.report.riskyAssumptions,
      acceptanceCriteria: sample.report.acceptanceCriteria,
      promptPack: sample.report.promptPack,
      rolloutNotes: sample.report.rolloutNotes,
      shareSlug: sample.shareSlug,
      riskScore: score,
      verdict,
      testPlan: sample.report.testPlan ?? null,
    });
    logger.info(
      { auditId: sampleAudit.id, shareSlug: sample.shareSlug },
      "Seeded sample gallery audit",
    );
  }
}

export async function maybeSeedDemoOnBoot(): Promise<void> {
  // Seed when explicitly requested OR on first boot (DB empty of audits),
  // unless explicitly disabled with SEED_DEMO=false.
  const flag = process.env.SEED_DEMO;
  if (flag === "false") return;

  try {
    let shouldSeed = flag === "true";
    if (!shouldSeed) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditsTable);
      if (Number(count) === 0) {
        shouldSeed = true;
        logger.info("First boot detected (no audits) — seeding demo");
      }
    }
    if (shouldSeed) {
      await seedDemoIfMissing();
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "Demo seed failed (continuing boot)",
    );
  }
}
