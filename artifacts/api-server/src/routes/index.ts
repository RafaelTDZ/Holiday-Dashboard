import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import employeesRouter from "./employees";
import vacationsRouter from "./vacations";
import dashboardRouter from "./dashboard";
import meRouter from "./me";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(meRouter);
router.use(employeesRouter);
router.use(vacationsRouter);
router.use(dashboardRouter);

export default router;
