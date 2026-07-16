import { and, eq, ne, sql } from "drizzle-orm";
import {
  db,
  auditsTable,
  type IngestedRepo,
} from "@workspace/db";
import {
  GitHubIngestError,
  GitHubRateLimitError,
  ingestGitHubRepo,
  parseGitHubUrl,
} from "./github-ingest";
import { detectTechStack } from "./tech-detect";
import { DEMO_REPO } from "./demo-repo";
import { logger } from "./logger";
import { enqueueAnalysis } from "./analysis-runner";
import { publishAuditEvent } from "./sse-bus";
import { refundTrialAuditSlot } from "./trial-access";

const MAX_CONCURRENT_INGESTIONS = 3;
let activeIngestions = 0;

async function setRunning(id: string) {
  await db
    .update(auditsTable)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(auditsTable.id, id));
}

async function persistResults(
  id: string,
  source: "github" | "demo",
  repo: IngestedRepo,
  ingestionError: string | null,
) {
  const detection = detectTechStack(repo);
  await db
    .update(auditsTable)
    .set({
      status: "ingested",
      ingestionSource: source,
      detectedFramework: detection.framework,
      detectedPackageManager: detection.packageManager,
      detectedDbLayer: detection.dbLayer,
      detectedAuthLayer: detection.authLayer,
      routesFolder: detection.routesFolder,
      deploymentClues: detection.deploymentClues,
      rawFilesJson: repo,
      ingestionError,
      updatedAt: new Date(),
    })
    .where(eq(auditsTable.id, id));
}

/**
 * Hand back the quota charge for an audit that failed during ingestion,
 * before any model tokens were spent. Trial visitors get their single
 * anonymous slot back; authenticated users get the NEWEST audit_run_events
 * ledger row charged to this audit deleted (rows with a null audit_id
 * predate refunds and never match). Newest-only matters: an audit can carry
 * one ledger row per execution (create + each rerun), and a failed rerun
 * must not also refund the earlier successful run's charge. Best-effort: a
 * refund failure must never mask the original ingestion error, so this logs
 * and swallows.
 */
export async function refundAuditCharge(
  auditId: string,
  userId: string,
): Promise<void> {
  try {
    if (userId.startsWith("trial_")) {
      await refundTrialAuditSlot(userId);
      return;
    }
    await db.execute(sql`
      DELETE FROM audit_run_events
      WHERE id = (
        SELECT id FROM audit_run_events
        WHERE audit_id = ${auditId}
        ORDER BY triggered_at DESC, id DESC
        LIMIT 1
      )
    `);
  } catch (err) {
    logger.warn(
      { auditId, userId, err: err instanceof Error ? err.message : err },
      "Failed to refund audit charge after ingestion failure",
    );
  }
}

async function markErrored(id: string, message: string) {
  // Only rows actually transitioning into the error state match — repeated
  // calls (crash-then-retry, sweeper overlap) must not refund twice.
  const [transitioned] = await db
    .update(auditsTable)
    .set({
      status: "error",
      ingestionError: message,
      updatedAt: new Date(),
    })
    .where(and(eq(auditsTable.id, id), ne(auditsTable.status, "error")))
    .returning({ userId: auditsTable.userId });
  if (transitioned) {
    await refundAuditCharge(id, transitioned.userId);
  }
}

export async function runIngestion(
  auditId: string,
  githubUrl: string | null,
  userGithubToken?: string | null,
) {
  if (activeIngestions >= MAX_CONCURRENT_INGESTIONS) {
    logger.warn(
      { auditId, activeIngestions },
      "Ingestion concurrency limit reached — dropping job",
    );
    try {
      await markErrored(
        auditId,
        "Server busy; too many concurrent ingestion jobs. Please retry later.",
      );
    } catch {
      // best-effort
    }
    return;
  }
  activeIngestions++;
  try {
    await setRunning(auditId);
    publishAuditEvent(auditId, "ingesting", "Fetching repository contents…");

    // No GitHub URL was provided at all — surface the bundled demo so the
    // user still gets a working report to read.
    if (!githubUrl) {
      logger.info({ auditId }, "No GitHub URL — using demo fixture");
      publishAuditEvent(auditId, "ingesting", "No GitHub URL — loading bundled demo fixture.");
      await persistResults(auditId, "demo", DEMO_REPO, null);
      publishAuditEvent(auditId, "detecting-stack", "Detected stack from bundled demo fixture.");
      publishAuditEvent(auditId, "detecting-stack", `Indexed ${DEMO_REPO.fileTree.length} demo files.`);
      return;
    }

    publishAuditEvent(auditId, "ingesting", `Resolving repository: ${githubUrl.replace("https://github.com/", "")}`);

    if (!parseGitHubUrl(githubUrl)) {
      logger.warn({ auditId }, "GitHub URL did not parse — marking errored");
      const msg = "That doesn't look like a valid GitHub repository URL.";
      await markErrored(auditId, msg);
      publishAuditEvent(auditId, "error", msg);
      return;
    }

    try {
      publishAuditEvent(auditId, "ingesting", userGithubToken ? "Authenticating with provided GitHub token…" : "Reading repository as anonymous (public) viewer…");
      const repo = await ingestGitHubRepo(githubUrl, userGithubToken ?? null);
      publishAuditEvent(auditId, "ingesting", `Pulled ${repo.fileTree.length} files from default branch.`);
      await persistResults(auditId, "github", repo, null);
      publishAuditEvent(auditId, "detecting-stack", `Detected stack from ${repo.fileTree.length} files.`);
      publishAuditEvent(auditId, "detecting-stack", "Sniffing framework, package manager, db and auth layers…");
    } catch (err) {
      const isRateLimit = err instanceof GitHubRateLimitError;
      const reason =
        err instanceof GitHubIngestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      logger.warn(
        { auditId, isRateLimit, reason },
        "GitHub ingest failed — surfacing error to user",
      );

      // Surface the real failure rather than silently swapping in demo data.
      // Public repo + rate-limit is the most common case; tell the user to
      // either wait or paste their own GitHub personal access token.
      const friendly = isRateLimit
        ? "GitHub rate limit reached. Wait an hour or paste your own GitHub personal access token in Advanced options and retry."
        : reason;
      await markErrored(auditId, friendly);
      publishAuditEvent(auditId, "error", friendly);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error";
    logger.error({ auditId, reason }, "Ingestion runner crashed");
    try {
      await markErrored(auditId, reason);
    } catch (innerErr) {
      logger.error({ auditId, innerErr }, "Failed to mark audit as error");
    }
  } finally {
    activeIngestions--;
  }
}

export function enqueueIngestion(
  auditId: string,
  githubUrl: string | null,
  userGithubToken?: string | null,
) {
  setImmediate(() => {
    void runIngestion(auditId, githubUrl, userGithubToken).then(async () => {
      const [row] = await db
        .select({ status: auditsTable.status })
        .from(auditsTable)
        .where(eq(auditsTable.id, auditId));
      if (row?.status === "ingested") {
        enqueueAnalysis(auditId);
      } else {
        logger.warn(
          { auditId, status: row?.status },
          "Skipping analysis — ingestion did not complete successfully",
        );
      }
    });
  });
}
