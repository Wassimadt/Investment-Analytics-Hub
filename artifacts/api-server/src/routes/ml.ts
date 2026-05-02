import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, companiesTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";

const router = Router();

router.get("/ml/predictions", async (req, res) => {
  try {
    const projects = await db
      .select({
        id: projectsTable.id,
        name: projectsTable.name,
        irr: sql<number>`projects.irr::float`,
        progressPercent: sql<number>`projects.progress_percent::float`,
        status: projectsTable.status,
        riskLevel: projectsTable.riskLevel,
        startDate: projectsTable.startDate,
        endDate: projectsTable.endDate,
      })
      .from(projectsTable)
      .orderBy(desc(projectsTable.createdAt))
      .limit(20);

    const predictions = projects.map((p) => {
      const riskFactor = { low: 1.1, medium: 0.95, high: 0.8, critical: 0.6 }[p.riskLevel] ?? 0.9;
      const progressFactor = (p.progressPercent ?? 50) / 100;
      const baseIrr = p.irr ?? 8;
      const predictedIrr = baseIrr * riskFactor * (0.9 + progressFactor * 0.2);

      const successProbability = Math.min(
        95,
        Math.max(20, (progressFactor * 60 + riskFactor * 40))
      );

      const confidence = 65 + progressFactor * 20;

      const keyFactors: string[] = [];
      if (p.riskLevel === "low") keyFactors.push("Faible niveau de risque");
      if (p.riskLevel === "high" || p.riskLevel === "critical") keyFactors.push("Risque élevé identifié");
      if (progressFactor > 0.7) keyFactors.push("Avancement significatif");
      if (p.status === "active") keyFactors.push("Projet actif");
      if (p.irr && p.irr > 12) keyFactors.push("TRI historique élevé");
      if (keyFactors.length === 0) keyFactors.push("Données insuffisantes pour prédiction précise");

      let predictedCompletion: string | undefined;
      if (p.endDate) {
        predictedCompletion = p.endDate;
      } else {
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + Math.floor(12 + (1 - progressFactor) * 24));
        predictedCompletion = futureDate.toISOString().split("T")[0];
      }

      return {
        projectId: p.id,
        projectName: p.name,
        predictedIrr: Math.round(predictedIrr * 100) / 100,
        predictedCompletion,
        successProbability: Math.round(successProbability),
        confidence: Math.round(confidence),
        keyFactors,
      };
    });

    res.json(predictions);
  } catch (err) {
    req.log.error({ err }, "Error getting ML predictions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ml/risk-scores", async (req, res) => {
  try {
    const projects = await db
      .select({
        id: projectsTable.id,
        name: projectsTable.name,
        riskLevel: projectsTable.riskLevel,
        sector: projectsTable.sector,
        progressPercent: sql<number>`projects.progress_percent::float`,
        irr: sql<number>`projects.irr::float`,
      })
      .from(projectsTable);

    const companies = await db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        debtRatio: sql<number>`companies.debt_ratio::float`,
        growthRate: sql<number>`companies.growth_rate::float`,
        ebitda: sql<number>`companies.ebitda::float`,
      })
      .from(companiesTable);

    const riskLevelToScore = (level: string) =>
      ({ low: 20, medium: 45, high: 70, critical: 90 }[level] ?? 50);

    const projectScores = projects.map((p) => {
      const baseScore = riskLevelToScore(p.riskLevel);
      const marketRisk = Math.max(10, baseScore - 10 + Math.random() * 15);
      const financialRisk = Math.max(10, baseScore - 5 + Math.random() * 10);
      const operationalRisk = Math.max(10, baseScore + Math.random() * 10);
      const riskScore = (marketRisk + financialRisk + operationalRisk) / 3;

      return {
        entityId: p.id,
        entityType: "project" as const,
        entityName: p.name,
        riskScore: Math.round(riskScore),
        riskLevel: p.riskLevel,
        marketRisk: Math.round(marketRisk),
        financialRisk: Math.round(financialRisk),
        operationalRisk: Math.round(operationalRisk),
        updatedAt: new Date().toISOString(),
      };
    });

    const companyScores = companies.map((c) => {
      const debtFactor = c.debtRatio ? Math.min(80, c.debtRatio * 100) : 40;
      const growthFactor = c.growthRate ? Math.max(10, 50 - c.growthRate * 200) : 40;
      const marketRisk = (debtFactor + growthFactor) / 2;
      const financialRisk = debtFactor;
      const operationalRisk = growthFactor * 0.8 + 10;
      const riskScore = (marketRisk + financialRisk + operationalRisk) / 3;

      const riskLevel =
        riskScore < 30 ? "low" : riskScore < 50 ? "medium" : riskScore < 70 ? "high" : "critical";

      return {
        entityId: c.id,
        entityType: "company" as const,
        entityName: c.name,
        riskScore: Math.round(riskScore),
        riskLevel,
        marketRisk: Math.round(marketRisk),
        financialRisk: Math.round(financialRisk),
        operationalRisk: Math.round(operationalRisk),
        updatedAt: new Date().toISOString(),
      };
    });

    res.json([...projectScores, ...companyScores].sort((a, b) => b.riskScore - a.riskScore));
  } catch (err) {
    req.log.error({ err }, "Error getting risk scores");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ml/portfolio-forecast", async (req, res) => {
  try {
    const [stats] = await db
      .select({
        totalValue: sql<number>`coalesce(sum(current_value::numeric), 0)::float`,
        avgGrowth: sql<number>`coalesce(avg(irr::numeric / 100), 0.08)::float`,
      })
      .from(projectsTable);

    const baseValue = stats.totalValue || 5_000_000_000;
    const monthlyGrowth = (stats.avgGrowth || 0.08) / 12;

    const points = [];
    const now = new Date();

    for (let i = -6; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = date.toISOString().slice(0, 7);
      const isHistorical = i <= 0;
      const factor = Math.pow(1 + monthlyGrowth, i);
      const predictedValue = baseValue * factor;
      const variance = isHistorical ? 0.02 : 0.05 + i * 0.005;

      points.push({
        month,
        predictedValue: Math.round(predictedValue),
        optimistic: Math.round(predictedValue * (1 + variance)),
        pessimistic: Math.round(predictedValue * (1 - variance)),
        isHistorical,
      });
    }

    res.json(points);
  } catch (err) {
    req.log.error({ err }, "Error getting portfolio forecast");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
