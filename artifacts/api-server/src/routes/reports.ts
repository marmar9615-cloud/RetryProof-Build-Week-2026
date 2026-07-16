import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, auditsTable, reportsTable } from "@workspace/db";
import { GetAuditParams, GetReportResponse } from "@workspace/api-zod";
import { DEMO_USER_ID } from "../lib/seed-demo";
import { normalizePromptPack } from "../lib/prompt-pack";
import { getTrialUserId } from "../lib/trial-access";

const router: IRouter = Router();

router.get(
  "/audits/:id/report",
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

    const isOwner = req.isAuthenticated() && audit.userId === req.user.id;
    const isDemo = audit.userId === DEMO_USER_ID;
    const isTrialOwner = (await getTrialUserId(req)) === audit.userId;
    if (!isOwner && !isDemo && !isTrialOwner) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    const [report] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.auditId, audit.id));

    if (!report) {
      res.status(404).json({ error: "Report not ready" });
      return;
    }

    res.json(GetReportResponse.parse({
      ...report,
      promptPack: normalizePromptPack(report.promptPack),
    }));
  },
);

export default router;
