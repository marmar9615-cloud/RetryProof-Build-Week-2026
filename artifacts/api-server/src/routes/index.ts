import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import auditsRouter from "./audits";
import reportsRouter from "./reports";
import shareRouter from "./share";
import trialRouter from "./trial";
import billingRouter from "./billing";
import modelsRouter from "./models";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(trialRouter);
router.use(modelsRouter);
router.use(auditsRouter);
router.use(reportsRouter);
router.use(shareRouter);
router.use(billingRouter);
// NOTE: Stripe webhook is intentionally NOT mounted here. Stripe requires
// the unparsed raw body to verify the signature, but this router runs
// after express.json() in app.ts. The webhook is mounted directly in
// app.ts before any body parsers — see the comment block there.

export default router;
