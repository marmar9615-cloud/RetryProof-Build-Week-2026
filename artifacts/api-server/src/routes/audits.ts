import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, inArray, notInArray, count, sql } from "drizzle-orm";
import {
  db,
  auditsTable,
  auditRunEventsTable,
  reportsTable,
  reportRunHistoryTable,
  type Audit,
} from "@workspace/db";
import {
  CreateAuditBody,
  GetAuditParams,
  GetAuditResponse,
  ListAuditRunsResponse,
  ListAuditsResponse,
  RerunAuditBody,
} from "@workspace/api-zod";
import { enqueueIngestion } from "../lib/ingest-runner";
import { DEMO_USER_ID } from "../lib/seed-demo";
import {
  claimTrialAuditSlot,
  getTrialUserId,
  TrialLimitError,
} from "../lib/trial-access";
import {
  getBufferedEvents,
  subscribeAuditEvents,
  resetAuditEvents,
} from "../lib/sse-bus";
import {
  getEntitlementForUser,
  getMonthlyAuditsUsed,
} from "../lib/entitlement";
import { validateModelChoice } from "../lib/model-catalog";

// Concurrent in-flight audits a free user is allowed at once. Pro users
// get a higher cap from getEntitlementForUser (see lib/entitlement.ts).
// Trial (anonymous) users are gated separately at MAX_ACTIVE_TRIAL_AUDITS.
const ACTIVE_AUDIT_STATUSES = [
  "pending",
  "running",
  "ingested",
  "analyzing",
] as const;

const router: IRouter = Router();

const FILE_TREE_SAMPLE_LIMIT = 60;
const MAX_ACTIVE_TRIAL_AUDITS = 1;
// Superseded-report snapshots kept per audit. The history table is a receipt
// trail for the run-history strip, not an archive — older rows are trimmed
// at snapshot time.
const RUN_HISTORY_KEEP = 5;

function serializeAudit(
  audit: Audit,
  report?: { riskScore: number | null; verdict: string | null } | null,
  opts?: { isDemo?: boolean },
) {
  const tree = audit.rawFilesJson?.fileTree ?? null;
  const { rawFilesJson: _omit, ...rest } = audit;
  return {
    ...rest,
    fileTreeSample: tree ? tree.slice(0, FILE_TREE_SAMPLE_LIMIT) : null,
    fileCount: tree ? tree.length : null,
    riskScore: report?.riskScore ?? null,
    verdict: report?.verdict ?? null,
    // Only stamped for anonymous list responses; omitted elsewhere so
    // authenticated payloads keep their existing shape.
    ...(opts?.isDemo !== undefined ? { isDemo: opts.isDemo } : {}),
  };
}

async function canReadAudit(req: Request, audit: Audit): Promise<boolean> {
  if (req.isAuthenticated() && audit.userId === req.user.id) return true;
  if (audit.userId === DEMO_USER_ID) return true;
  const trialUserId = await getTrialUserId(req);
  return trialUserId === audit.userId;
}

router.get("/audits", async (req: Request, res: Response): Promise<void> => {
  // Authenticated callers see their own audits. Anonymous callers see the
  // read-only demo gallery — plus their own trial audit when the signed
  // HttpOnly trial cookie resolves, so a returning trial visitor can find
  // the audit they ran before signing up.
  const trialUserId = req.isAuthenticated() ? null : await getTrialUserId(req);
  const visibleUserIds = req.isAuthenticated()
    ? [req.user.id]
    : trialUserId
      ? [trialUserId, DEMO_USER_ID]
      : [DEMO_USER_ID];

  const rows = await db
    .select({
      audit: auditsTable,
      riskScore: reportsTable.riskScore,
      verdict: reportsTable.verdict,
    })
    .from(auditsTable)
    .leftJoin(reportsTable, eq(reportsTable.auditId, auditsTable.id))
    .where(inArray(auditsTable.userId, visibleUserIds))
    .orderBy(
      // Trial-owned rows sort above the demo gallery so the visitor's own
      // audit is the first thing they see when they come back.
      ...(trialUserId
        ? [
            sql`case when ${auditsTable.userId} = ${trialUserId} then 0 else 1 end`,
          ]
        : []),
      desc(auditsTable.createdAt),
    );

  res.json(
    ListAuditsResponse.parse(
      rows.map((r) =>
        serializeAudit(
          r.audit,
          { riskScore: r.riskScore, verdict: r.verdict },
          // isDemo is only meaningful for anonymous callers: it lets the
          // dashboard tell the visitor's own trial audit apart from the
          // demo gallery rows sharing the list.
          req.isAuthenticated()
            ? undefined
            : { isDemo: r.audit.userId === DEMO_USER_ID },
        ),
      ),
    ),
  );
});

router.post("/audits", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateAuditBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid audit body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Per-request, optional GitHub personal access token. Held only in memory
  // for this single ingestion job, never persisted to the DB, never logged.
  const userGithubToken =
    req.isAuthenticated() &&
    typeof parsed.data.githubToken === "string" &&
    parsed.data.githubToken.trim().length > 0
      ? parsed.data.githubToken.trim()
      : null;

  let actor:
    | { kind: "authenticated"; userId: string; maxActiveAudits: number }
    | { kind: "trial"; userId: string; maxActiveAudits: number };
  let monthlyAuditLimit: number | null = null;
  // Catalog model id this audit's analysis will run on. Null = server default.
  let chosenModel: string | null = null;

  if (req.isAuthenticated()) {
    // Pull the current Pro/Free cap from the entitlement table. This is
    // the source of truth that the Stripe webhook updates on subscription
    // lifecycle events. Falls back to Free defaults if no row exists.
    const ent = await getEntitlementForUser(req.user.id);
    // Gate the requested model on the same entitlement: premium (proOnly)
    // models are rejected for free users before any quota is consumed.
    const modelCheck = validateModelChoice(parsed.data.model ?? null, {
      kind: ent.tier,
    });
    if (!modelCheck.ok) {
      res.status(modelCheck.status).json({
        error: modelCheck.error,
        ...(modelCheck.code ? { code: modelCheck.code } : {}),
      });
      return;
    }
    chosenModel = modelCheck.id;
    actor = {
      kind: "authenticated",
      userId: req.user.id,
      maxActiveAudits: ent.maxActiveAudits,
    };
    monthlyAuditLimit = ent.monthlyAuditLimit;
  } else {
    // Validate the model BEFORE claiming the trial slot so a rejected model
    // choice does not burn the visitor's single anonymous audit.
    const modelCheck = validateModelChoice(parsed.data.model ?? null, {
      kind: "trial",
    });
    if (!modelCheck.ok) {
      res.status(modelCheck.status).json({
        error: modelCheck.error,
        ...(modelCheck.code ? { code: modelCheck.code } : {}),
      });
      return;
    }
    chosenModel = modelCheck.id;
    try {
      const trial = await claimTrialAuditSlot(req, res);
      actor = {
        kind: "trial",
        userId: trial.userId,
        maxActiveAudits: MAX_ACTIVE_TRIAL_AUDITS,
      };
    } catch (err) {
      if (err instanceof TrialLimitError) {
        res.status(err.status).json({
          error: err.message,
          code: err.code,
        });
        return;
      }
      throw err;
    }
  }

  const createResult = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"audit-quota:" + actor.userId}, 0))`,
    );

    if (actor.kind === "authenticated" && monthlyAuditLimit !== null) {
      // Count from the append-only ledger, not from audits rows. This prevents
      // a delete-then-recreate loop from resetting the monthly tally and ensures
      // every execution (create or rerun) is counted individually. The helper
      // reads outside this transaction, which is safe here: the advisory lock
      // above serializes same-user executions, so every competing ledger write
      // has already committed (and is visible) by the time we hold the lock.
      const monthlyCount = await getMonthlyAuditsUsed(actor.userId);

      if (monthlyCount >= monthlyAuditLimit) {
        return {
          kind: "limit" as const,
          status: 429,
          log: { userId: actor.userId, monthlyCount, monthlyAuditLimit },
          body: {
            error: `You have used ${monthlyCount} of ${monthlyAuditLimit} audit${monthlyAuditLimit === 1 ? "" : "s"} for this month. Upgrade or wait until next month to run more.`,
            code: "MONTHLY_AUDIT_LIMIT_REACHED",
          },
        };
      }
    }

    const [{ activeCount }] = await tx
      .select({ activeCount: count() })
      .from(auditsTable)
      .where(
        and(
          eq(auditsTable.userId, actor.userId),
          inArray(auditsTable.status, [...ACTIVE_AUDIT_STATUSES]),
        ),
      );

    if (activeCount >= actor.maxActiveAudits) {
      return {
        kind: "limit" as const,
        status: 429,
        log: { userId: actor.userId, activeCount, actorKind: actor.kind },
        body: {
          error: `You already have ${activeCount} audit${activeCount === 1 ? "" : "s"} in progress. Wait for them to finish before creating more.`,
        },
      };
    }

    const now = new Date();
    const [audit] = await tx
      .insert(auditsTable)
      .values({
        userId: actor.userId,
        githubUrl: parsed.data.githubUrl ?? null,
        liveUrl: parsed.data.liveUrl ?? null,
        requestedChange: parsed.data.requestedChange,
        model: chosenModel,
        lastRunAt: now,
      })
      .returning();

    // Record execution in the append-only ledger. Must happen in the same
    // transaction as quota enforcement so parallel requests cannot all pass
    // the precheck before any ledger row exists. auditId links the charge to
    // this execution so an ingestion-phase failure can refund it.
    if (actor.kind === "authenticated") {
      await tx
        .insert(auditRunEventsTable)
        .values({ userId: actor.userId, auditId: audit.id });
    }

    return { kind: "ok" as const, audit };
  });

  if (createResult.kind === "limit") {
    req.log.warn(createResult.log, "Audit creation rejected by quota gate");
    res.status(createResult.status).json(createResult.body);
    return;
  }

  const audit = createResult.audit;

  enqueueIngestion(audit.id, audit.githubUrl, userGithubToken);

  res.status(201).json(GetAuditResponse.parse(serializeAudit(audit)));
});

router.get(
  "/audits/:id",
  async (req: Request, res: Response): Promise<void> => {
    const params = GetAuditParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [audit] = await db
      .select()
      .from(auditsTable)
      .where(eq(auditsTable.id, params.data.id));

    if (!audit) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    // Owners can view their audits. Anyone can view demo audits. Trial visitors
    // can only view audits tied to their own anonymous trial cookie.
    if (!(await canReadAudit(req, audit))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    res.json(GetAuditResponse.parse(serializeAudit(audit)));
  },
);

// Verdict receipts from reports this audit's re-runs replaced, newest first.
// Empty for audits that were never re-run. Same visibility as the audit row.
router.get(
  "/audits/:id/runs",
  async (req: Request, res: Response): Promise<void> => {
    const params = GetAuditParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [audit] = await db
      .select()
      .from(auditsTable)
      .where(eq(auditsTable.id, params.data.id));

    if (!audit) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }
    if (!(await canReadAudit(req, audit))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const rows = await db
      .select({
        id: reportRunHistoryTable.id,
        model: reportRunHistoryTable.model,
        verdict: reportRunHistoryTable.verdict,
        riskScore: reportRunHistoryTable.riskScore,
        createdAt: reportRunHistoryTable.createdAt,
      })
      .from(reportRunHistoryTable)
      .where(eq(reportRunHistoryTable.auditId, audit.id))
      .orderBy(
        desc(reportRunHistoryTable.createdAt),
        desc(reportRunHistoryTable.id),
      );

    res.json(ListAuditRunsResponse.parse(rows));
  },
);

router.delete(
  "/audits/:id",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const params = GetAuditParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const deleteResult = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${"audit-quota:" + req.user.id}, 0))`,
      );

      const [audit] = await tx
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, params.data.id));

      if (!audit || audit.userId !== req.user.id) {
        return {
          kind: "error" as const,
          status: 404,
          body: { error: "Audit not found" },
        };
      }

      // Refuse to delete an in-flight audit. Background workers (ingestion,
      // analysis, smoke testing) hold a reference to the row and continue
      // consuming GitHub API budget, OpenRouter tokens, and browser capacity
      // after deletion. Deleting would also remove the row from active quota
      // accounting, letting the user bypass concurrent-audit limits.
      if ((ACTIVE_AUDIT_STATUSES as readonly string[]).includes(audit.status)) {
        return {
          kind: "limit" as const,
          status: 409,
          log: { userId: req.user.id, auditId: audit.id, status: audit.status },
          body: {
            error:
              "This audit is still running. Wait for it to finish (or reach an error state) before deleting it.",
          },
        };
      }

      await tx.delete(auditsTable).where(eq(auditsTable.id, audit.id));
      return { kind: "ok" as const, auditId: audit.id };
    });

    if (deleteResult.kind === "error") {
      res.status(deleteResult.status).json(deleteResult.body);
      return;
    }
    if (deleteResult.kind === "limit") {
      req.log.warn(deleteResult.log, "Delete rejected: audit is still in-flight");
      res.status(deleteResult.status).json(deleteResult.body);
      return;
    }

    resetAuditEvents(deleteResult.auditId);

    res.status(200).json({ success: true });
  },
);

// Re-run ingestion + analysis on an existing audit. Owner only.
// We require the audit to be in a terminal state (done|error) to avoid
// stomping a job that's already running.
router.post(
  "/audits/:id/rerun",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const params = GetAuditParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    // Optional body: { model } switches the audit to a different catalog
    // model for this rerun. Older clients send no body at all.
    const body = RerunAuditBody.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    // Apply the same quota gates as audit creation so reruns cannot be used
    // to bypass monthly or concurrent-audit limits.
    const ent = await getEntitlementForUser(req.user.id);

    // Same catalog/plan gating as audit creation. Rerun is owner-only, so
    // the caller is free or pro — never trial. Omitted/null keeps the
    // audit's existing model.
    let modelUpdate: string | undefined;
    if (body.data.model != null) {
      const modelCheck = validateModelChoice(body.data.model, {
        kind: ent.tier,
      });
      if (!modelCheck.ok) {
        res.status(modelCheck.status).json({
          error: modelCheck.error,
          ...(modelCheck.code ? { code: modelCheck.code } : {}),
        });
        return;
      }
      modelUpdate = modelCheck.id ?? undefined;
    }

    const rerunResult = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${"audit-quota:" + req.user.id}, 0))`,
      );

      const [audit] = await tx
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, params.data.id));
      if (!audit || audit.userId !== req.user.id) {
        return {
          kind: "error" as const,
          status: 404,
          body: { error: "Audit not found" },
        };
      }
      if (audit.status !== "done" && audit.status !== "error") {
        return {
          kind: "error" as const,
          status: 409,
          body: {
            error:
              "Audit is still running. Wait for it to finish before re-running.",
          },
        };
      }

      // Monthly limit: count from the append-only ledger so that repeated reruns
      // of the same audit row each consume a quota unit, and deleting a completed
      // audit does not erase its historical usage from this month's tally.
      // (Reads outside the tx; safe under the advisory lock — see POST /audits.)
      const monthlyCount = await getMonthlyAuditsUsed(req.user.id);

      if (monthlyCount >= ent.monthlyAuditLimit) {
        return {
          kind: "limit" as const,
          status: 429,
          log: {
            userId: req.user.id,
            monthlyCount,
            monthlyAuditLimit: ent.monthlyAuditLimit,
          },
          body: {
            error: `You have used ${monthlyCount} of ${ent.monthlyAuditLimit} audit${ent.monthlyAuditLimit === 1 ? "" : "s"} for this month. Upgrade or wait until next month to run more.`,
            code: "MONTHLY_AUDIT_LIMIT_REACHED",
          },
        };
      }

      // Concurrent active-audit limit: the rerun will immediately place this
      // audit back into an active state, so count it against the cap.
      const [{ activeCount }] = await tx
        .select({ activeCount: count() })
        .from(auditsTable)
        .where(
          and(
            eq(auditsTable.userId, req.user.id),
            inArray(auditsTable.status, [...ACTIVE_AUDIT_STATUSES]),
          ),
        );

      if (activeCount >= ent.maxActiveAudits) {
        return {
          kind: "limit" as const,
          status: 429,
          log: { userId: req.user.id, activeCount },
          body: {
            error: `You already have ${activeCount} audit${activeCount === 1 ? "" : "s"} in progress. Wait for them to finish before re-running.`,
          },
        };
      }

      // Snapshot the report this rerun is about to replace. Powers the
      // run-history strip on audit detail, and preserves the share slug:
      // analysis-runner re-attaches the newest non-null slug from this table
      // when the new report persists, so /r/<slug> links and README badges
      // survive reruns.
      const [previousReport] = await tx
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.auditId, audit.id));

      if (previousReport) {
        await tx.insert(reportRunHistoryTable).values({
          auditId: audit.id,
          model: previousReport.analysisUsage?.model ?? audit.model ?? null,
          verdict: previousReport.verdict,
          riskScore: previousReport.riskScore,
          source: previousReport.source,
          analysisUsage: previousReport.analysisUsage,
          payload: previousReport,
          shareSlug: previousReport.shareSlug,
        });

        // Trim to the newest few snapshots — this is a receipt trail, not an
        // archive. The newest row always carries the preserved share slug (the
        // snapshot above includes it), so trimming never loses the slug.
        const newestKept = tx
          .select({ id: reportRunHistoryTable.id })
          .from(reportRunHistoryTable)
          .where(eq(reportRunHistoryTable.auditId, audit.id))
          .orderBy(
            desc(reportRunHistoryTable.createdAt),
            desc(reportRunHistoryTable.id),
          )
          .limit(RUN_HISTORY_KEEP);
        await tx
          .delete(reportRunHistoryTable)
          .where(
            and(
              eq(reportRunHistoryTable.auditId, audit.id),
              notInArray(reportRunHistoryTable.id, newestKept),
            ),
          );
      }

      // Drop the previous report (cascade-safe: audit.id FK).
      await tx.delete(reportsTable).where(eq(reportsTable.auditId, audit.id));

      // Reset the audit row back to a fresh-pending state. We keep the original
      // requestedChange + URLs because that's what the user wants to re-analyze.
      // lastRunAt records this execution time; the quota unit itself is the
      // audit_run_events ledger row inserted below.
      const [reset] = await tx
        .update(auditsTable)
        .set({
          status: "pending",
          // Only switch models when the rerun body asked for it.
          ...(modelUpdate !== undefined ? { model: modelUpdate } : {}),
          ingestionSource: null,
          detectedFramework: null,
          detectedPackageManager: null,
          detectedDbLayer: null,
          detectedAuthLayer: null,
          routesFolder: null,
          deploymentClues: null,
          rawFilesJson: null,
          ingestionError: null,
          updatedAt: new Date(),
          lastRunAt: new Date(),
        })
        .where(eq(auditsTable.id, audit.id))
        .returning();

      // Record the rerun in the append-only ledger. This is the quota unit that
      // prevents unlimited reruns of the same audit row and survives audit
      // row deletion. auditId links the charge to this execution so an
      // ingestion-phase failure can refund it.
      await tx
        .insert(auditRunEventsTable)
        .values({ userId: req.user.id, auditId: audit.id });

      return { kind: "ok" as const, audit: reset };
    });

    if (rerunResult.kind === "error") {
      res.status(rerunResult.status).json(rerunResult.body);
      return;
    }
    if (rerunResult.kind === "limit") {
      req.log.warn(rerunResult.log, "Audit rerun rejected by quota gate");
      res.status(rerunResult.status).json(rerunResult.body);
      return;
    }

    const reset = rerunResult.audit;

    // Wipe the SSE buffer so the next subscriber doesn't see stale phases.
    resetAuditEvents(reset.id);

    enqueueIngestion(reset.id, reset.githubUrl, null);

    res.status(200).json(GetAuditResponse.parse(serializeAudit(reset)));
  },
);

router.get(
  "/audits/:id/events",
  async (req: Request, res: Response): Promise<void> => {
    const params = GetAuditParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [audit] = await db
      .select()
      .from(auditsTable)
      .where(eq(auditsTable.id, params.data.id));
    if (!audit) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }
    if (!(await canReadAudit(req, audit))) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const send = (event: { ts: number; phase: string; message: string }) => {
      res.write(`event: phase\ndata: ${JSON.stringify(event)}\n\n`);
    };

    for (const ev of getBufferedEvents(params.data.id)) send(ev);

    if (audit.status === "done" || audit.status === "error") {
      res.write(`event: end\ndata: {}\n\n`);
      res.end();
      return;
    }

    const unsubscribe = subscribeAuditEvents(params.data.id, (ev) => {
      send(ev);
      if (ev.phase === "done" || ev.phase === "error") {
        res.write(`event: end\ndata: {}\n\n`);
        res.end();
      }
    });

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        // ignore
      }
    }, 15_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  },
);

export default router;
