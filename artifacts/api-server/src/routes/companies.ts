import { Router } from "express";
import { db } from "@workspace/db";
import { companiesTable, projectsTable, activityTable } from "@workspace/db";
import { eq, sql, ilike, and, desc, inArray } from "drizzle-orm";
import {
  CreateCompanyBody,
  UpdateCompanyBody,
  ListCompaniesQueryParams,
  CompareCompaniesQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/companies/compare", async (req, res) => {
  try {
    const parsed = CompareCompaniesQueryParams.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "ids parameter required" });
    const ids = parsed.data.ids.split(",").map((id) => parseInt(id.trim())).filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ error: "No valid ids" });

    const companies = await db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        sector: companiesTable.sector,
        revenue: sql<number>`companies.revenue::float`,
        currentValuation: sql<number>`companies.current_valuation::float`,
        ebitda: sql<number>`companies.ebitda::float`,
        debtRatio: sql<number>`companies.debt_ratio::float`,
        growthRate: sql<number>`companies.growth_rate::float`,
        employees: companiesTable.employees,
        activeProjects: sql<number>`count(projects.id) filter (where projects.status = 'active')::int`,
        irr: sql<number>`coalesce(avg(projects.irr::numeric), 0)::float`,
        riskScore: sql<number>`
          case
            when avg(case projects.risk_level when 'low' then 1 when 'medium' then 2 when 'high' then 3 when 'critical' then 4 end) is null then 50
            else (avg(case projects.risk_level when 'low' then 1 when 'medium' then 2 when 'high' then 3 when 'critical' then 4 end) / 4.0 * 100)::float
          end
        `,
      })
      .from(companiesTable)
      .leftJoin(projectsTable, eq(projectsTable.companyId, companiesTable.id))
      .where(inArray(companiesTable.id, ids))
      .groupBy(companiesTable.id);

    res.json(companies);
  } catch (err) {
    req.log.error({ err }, "Error comparing companies");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/companies", async (req, res) => {
  try {
    const parsed = ListCompaniesQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};

    const conditions = [];
    if (params.status) conditions.push(eq(companiesTable.status, params.status));
    if (params.sector) conditions.push(eq(companiesTable.sector, params.sector));
    if (params.search) conditions.push(ilike(companiesTable.name, `%${params.search}%`));

    const companies = await db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        sector: companiesTable.sector,
        status: companiesTable.status,
        revenue: sql<number>`companies.revenue::float`,
        employees: companiesTable.employees,
        foundedYear: companiesTable.foundedYear,
        region: companiesTable.region,
        description: companiesTable.description,
        totalInvestmentReceived: sql<number>`companies.total_investment_received::float`,
        currentValuation: sql<number>`companies.current_valuation::float`,
        ebitda: sql<number>`companies.ebitda::float`,
        debtRatio: sql<number>`companies.debt_ratio::float`,
        growthRate: sql<number>`companies.growth_rate::float`,
        activeProjects: sql<number>`count(projects.id) filter (where projects.status = 'active')::int`,
        createdAt: companiesTable.createdAt,
        updatedAt: companiesTable.updatedAt,
      })
      .from(companiesTable)
      .leftJoin(projectsTable, eq(projectsTable.companyId, companiesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(companiesTable.id)
      .orderBy(desc(companiesTable.createdAt));

    res.json(companies);
  } catch (err) {
    req.log.error({ err }, "Error listing companies");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/companies", async (req, res) => {
  try {
    const body = CreateCompanyBody.parse(req.body);
    const [company] = await db
      .insert(companiesTable)
      .values({
        name: body.name,
        sector: body.sector,
        status: body.status,
        revenue: body.revenue !== undefined ? String(body.revenue) : null,
        employees: body.employees,
        foundedYear: body.foundedYear,
        region: body.region,
        description: body.description,
        ebitda: body.ebitda !== undefined ? String(body.ebitda) : null,
        debtRatio: body.debtRatio !== undefined ? String(body.debtRatio) : null,
        growthRate: body.growthRate !== undefined ? String(body.growthRate) : null,
      })
      .returning();

    await db.insert(activityTable).values({
      type: "company_added",
      title: `Nouvelle entreprise: ${company.name}`,
      description: `Secteur: ${company.sector}, Région: ${company.region}`,
      entityId: company.id,
      entityType: "company",
    });

    res.status(201).json(company);
  } catch (err) {
    req.log.error({ err }, "Error creating company");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [company] = await db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        sector: companiesTable.sector,
        status: companiesTable.status,
        revenue: sql<number>`companies.revenue::float`,
        employees: companiesTable.employees,
        foundedYear: companiesTable.foundedYear,
        region: companiesTable.region,
        description: companiesTable.description,
        totalInvestmentReceived: sql<number>`companies.total_investment_received::float`,
        currentValuation: sql<number>`companies.current_valuation::float`,
        ebitda: sql<number>`companies.ebitda::float`,
        debtRatio: sql<number>`companies.debt_ratio::float`,
        growthRate: sql<number>`companies.growth_rate::float`,
        activeProjects: sql<number>`count(projects.id) filter (where projects.status = 'active')::int`,
        createdAt: companiesTable.createdAt,
        updatedAt: companiesTable.updatedAt,
      })
      .from(companiesTable)
      .leftJoin(projectsTable, eq(projectsTable.companyId, companiesTable.id))
      .where(eq(companiesTable.id, id))
      .groupBy(companiesTable.id);

    if (!company) return res.status(404).json({ error: "Not found" });
    res.json(company);
  } catch (err) {
    req.log.error({ err }, "Error getting company");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/companies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateCompanyBody.parse(req.body);
    const [company] = await db
      .update(companiesTable)
      .set({
        name: body.name,
        sector: body.sector,
        status: body.status,
        revenue: body.revenue !== undefined ? String(body.revenue) : undefined,
        employees: body.employees,
        foundedYear: body.foundedYear,
        region: body.region,
        description: body.description,
        ebitda: body.ebitda !== undefined ? String(body.ebitda) : undefined,
        debtRatio: body.debtRatio !== undefined ? String(body.debtRatio) : undefined,
        growthRate: body.growthRate !== undefined ? String(body.growthRate) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(companiesTable.id, id))
      .returning();

    if (!company) return res.status(404).json({ error: "Not found" });
    res.json(company);
  } catch (err) {
    req.log.error({ err }, "Error updating company");
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
