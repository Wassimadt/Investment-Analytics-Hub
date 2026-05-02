import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import projectsRouter from "./projects";
import companiesRouter from "./companies";
import valuationsRouter from "./valuations";
import mlRouter from "./ml";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(projectsRouter);
router.use(companiesRouter);
router.use(valuationsRouter);
router.use(mlRouter);

export default router;
