import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, companiesTable, activityTable } from "@workspace/db";
import { eq, sql, ilike, and, desc } from "drizzle-orm";
import {
  CreateProjectBody,
  UpdateProjectBody,
  ListProjectsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/projects/stats", async (req, res) => {
  try {
    const byStatus = await db
      .select({
        status: projectsTable.status,
        count: sql<number>`count(*)::int`,
        value: sql<number>`coalesce(sum(current_value::numeric), 0)::float`,
      })
      .from(projectsTable)
      .groupBy(projectsTable.status);

    const bySector = await db
      .select({
        sector: projectsTable.sector,
        count: sql<number>`count(*)::int`,
        value: sql<number>`coalesce(sum(current_value::numeric), 0)::float`,
      })
      .from(projectsTable)
      .groupBy(projectsTable.sector);

    const byRisk = await db
      .select({
        risk: projectsTable.riskLevel,
        count: sql<number>`count(*)::int`,
      })
      .from(projectsTable)
      .groupBy(projectsTable.riskLevel);

    const monthlyInvestment = await db.execute(sql`
      SELECT
        to_char(date_trunc('month', start_date::date), 'YYYY-MM') as month,
        sum(investment_amount::numeric)::float as amount
      FROM projects
      WHERE start_date IS NOT NULL
      GROUP BY date_trunc('month', start_date::date)
      ORDER BY date_trunc('month', start_date::date) DESC
      LIMIT 12
    `);

    res.json({
      byStatus,
      bySector,
      byRisk,
      monthlyInvestment: (monthlyInvestment.rows as { month: string; amount: number }[]).reverse(),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting project stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects", async (req, res) => {
  try {
    const parsed = ListProjectsQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};

    const conditions = [];
    if (params.status) conditions.push(eq(projectsTable.status, params.status));
    if (params.sector) conditions.push(eq(projectsTable.sector, params.sector));
    if (params.search) conditions.push(ilike(projectsTable.name, `%${params.search}%`));

    const projects = await db
      .select({
        id: projectsTable.id,
        name: projectsTable.name,
        description: projectsTable.description,
        sector: projectsTable.sector,
        status: projectsTable.status,
        investmentAmount: sql<number>`projects.investment_amount::float`,
        currentValue: sql<number>`projects.current_value::float`,
        irr: sql<number>`projects.irr::float`,
        startDate: projectsTable.startDate,
        endDate: projectsTable.endDate,
        companyId: projectsTable.companyId,
        companyName: companiesTable.name,
        region: projectsTable.region,
        riskLevel: projectsTable.riskLevel,
        progressPercent: sql<number>`projects.progress_percent::float`,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      })
      .from(projectsTable)
      .leftJoin(companiesTable, eq(projectsTable.companyId, companiesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(projectsTable.createdAt));

    res.json(projects);
  } catch (err) {
    req.log.error({ err }, "Error listing projects");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const body = CreateProjectBody.parse(req.body);
    const [project] = await db
      .insert(projectsTable)
      .values({
        name: body.name,
        description: body.description,
        sector: body.sector,
        status: body.status,
        investmentAmount: String(body.investmentAmount),
        currentValue: String(body.currentValue ?? body.investmentAmount),
        irr: body.irr !== undefined ? String(body.irr) : null,
        startDate: body.startDate ? new Date(body.startDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
endDate: body.endDate ? new Date(body.endDate).toISOString().split("T")[0] : null,
        companyId: body.companyId,
        region: body.region,
        riskLevel: body.riskLevel,
        progressPercent: String(body.progressPercent ?? 0),
      })
      .returning();

    await db.insert(activityTable).values({
      type: "project_created",
      title: `Nouveau projet: ${project.name}`,
      description: `Projet ${project.sector} créé dans la région ${project.region}`,
      entityId: project.id,
      entityType: "project",
    });

    res.status(201).json(project);
  } catch (err) {
    req.log.error({ err }, "Error creating project");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [project] = await db
      .select({
        id: projectsTable.id,
        name: projectsTable.name,
        description: projectsTable.description,
        sector: projectsTable.sector,
        status: projectsTable.status,
        investmentAmount: sql<number>`projects.investment_amount::float`,
        currentValue: sql<number>`projects.current_value::float`,
        irr: sql<number>`projects.irr::float`,
        startDate: projectsTable.startDate,
        endDate: projectsTable.endDate,
        companyId: projectsTable.companyId,
        companyName: companiesTable.name,
        region: projectsTable.region,
        riskLevel: projectsTable.riskLevel,
        progressPercent: sql<number>`projects.progress_percent::float`,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      })
      .from(projectsTable)
      .leftJoin(companiesTable, eq(projectsTable.companyId, companiesTable.id))
      .where(eq(projectsTable.id, id));

    if (!project) return res.status(404).json({ error: "Not found" });
    res.json(project);
  } catch (err) {
    req.log.error({ err }, "Error getting project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateProjectBody.parse(req.body);
    const [project] = await db
      .update(projectsTable)
      .set({
        name: body.name,
        description: body.description,
        sector: body.sector,
        status: body.status,
        investmentAmount: String(body.investmentAmount),
        currentValue: body.currentValue !== undefined ? String(body.currentValue) : undefined,
        irr: body.irr !== undefined ? String(body.irr) : undefined,
        startDate: body.startDate instanceof Date ? body.startDate.toISOString().split("T")[0] : body.startDate,
        endDate: body.endDate
          ? body.endDate instanceof Date
            ? body.endDate.toISOString().split("T")[0]
            : body.endDate
          : null,
        companyId: body.companyId,
        region: body.region,
        riskLevel: body.riskLevel,
        progressPercent: body.progressPercent !== undefined ? String(body.progressPercent) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, id))
      .returning();

    if (!project) return res.status(404).json({ error: "Not found" });

    await db.insert(activityTable).values({
      type: "project_updated",
      title: `Projet mis à jour: ${project.name}`,
      description: `Statut: ${project.status}, Risque: ${project.riskLevel}`,
      entityId: project.id,
      entityType: "project",
    });

    res.json(project);
  } catch (err) {
    req.log.error({ err }, "Error updating project");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting project");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
