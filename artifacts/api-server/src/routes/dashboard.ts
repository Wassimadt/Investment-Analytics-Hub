import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, companiesTable, valuationsTable, activityTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const [projectStats] = await db
      .select({
        totalProjects: sql<number>`count(*)::int`,
        activeProjects: sql<number>`count(*) filter (where status = 'active')::int`,
        projectsAtRisk: sql<number>`count(*) filter (where risk_level in ('high','critical'))::int`,
        totalInvested: sql<number>`coalesce(sum(investment_amount::numeric), 0)::float`,
        totalCurrentValue: sql<number>`coalesce(sum(current_value::numeric), 0)::float`,
        averageIrr: sql<number>`coalesce(avg(irr::numeric), 0)::float`,
      })
      .from(projectsTable);

    const [companyStats] = await db
      .select({ totalCompanies: sql<number>`count(*)::int` })
      .from(companiesTable);

    const totalPortfolioValue = projectStats.totalCurrentValue || 0;
    const totalInvested = projectStats.totalInvested || 0;
    const portfolioGrowthPercent =
      totalInvested > 0
        ? ((totalPortfolioValue - totalInvested) / totalInvested) * 100
        : 0;

    res.json({
      totalPortfolioValue,
      totalProjects: projectStats.totalProjects,
      activeProjects: projectStats.activeProjects,
      totalCompanies: companyStats.totalCompanies,
      averageIrr: projectStats.averageIrr,
      totalInvested,
      portfolioGrowthPercent,
      projectsAtRisk: projectStats.projectsAtRisk,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/activity", async (req, res) => {
  try {
    const activities = await db
      .select()
      .from(activityTable)
      .orderBy(desc(activityTable.createdAt))
      .limit(20);
    res.json(activities);
  } catch (err) {
    req.log.error({ err }, "Error getting activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/sector-breakdown", async (req, res) => {
  try {
    const breakdown = await db
      .select({
        sector: projectsTable.sector,
        count: sql<number>`count(*)::int`,
        value: sql<number>`coalesce(sum(current_value::numeric), 0)::float`,
      })
      .from(projectsTable)
      .groupBy(projectsTable.sector)
      .orderBy(sql`sum(current_value::numeric) desc`);

    const total = breakdown.reduce((acc, r) => acc + r.value, 0);
    const result = breakdown.map((r) => ({
      ...r,
      percentage: total > 0 ? (r.value / total) * 100 : 0,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting sector breakdown");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
