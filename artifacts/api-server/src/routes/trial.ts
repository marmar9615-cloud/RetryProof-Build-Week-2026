import { Router, type IRouter, type Request, type Response } from "express";
import { GetTrialStatusResponse } from "@workspace/api-zod";
import { getTrialStatus, TRIAL_AUDIT_LIMIT } from "../lib/trial-access";

const router: IRouter = Router();

router.get("/trial/status", async (req: Request, res: Response): Promise<void> => {
  if (req.isAuthenticated()) {
    res.json(
      GetTrialStatusResponse.parse({
        authenticated: true,
        trialEligible: false,
        used: 0,
        limit: TRIAL_AUDIT_LIMIT,
        remaining: 0,
      }),
    );
    return;
  }

  res.json(GetTrialStatusResponse.parse(await getTrialStatus(req)));
});

export default router;
