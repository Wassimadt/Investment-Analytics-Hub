import { Router } from "express";
import { db } from "@workspace/db";
import { valuationsTable, activityTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CreateValuationBody, ListValuationsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/valuations", async (req, res) => {
  try {
    const parsed = ListValuationsQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};

    const conditions = [];
    if (params.companyId) conditions.push(eq(valuationsTable.companyId, params.companyId));
    if (params.projectId) conditions.push(eq(valuationsTable.projectId, params.projectId));

    const valuations = await db
      .select()
      .from(valuationsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(valuationsTable.valuationDate));

    res.json(valuations.map((v) => ({ ...v, value: parseFloat(v.value as unknown as string) })));
  } catch (err) {
    req.log.error({ err }, "Error listing valuations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/valuations", async (req, res) => {
  try {
    const body = CreateValuationBody.parse(req.body);
    const [valuation] = await db
      .insert(valuationsTable)
      .values({
        companyId: body.companyId,
        projectId: body.projectId,
        method: body.method,
        valuationDate: body.valuationDate instanceof Date ? body.valuationDate.toISOString().split("T")[0] : body.valuationDate,
        value: String(body.value),
        currency: body.currency,
        assumptions: body.assumptions,
        analyst: body.analyst,
      })
      .returning();

    await db.insert(activityTable).values({
      type: "valuation_added",
      title: `Nouvelle valorisation (${body.method.toUpperCase()})`,
      description: `Valeur: ${body.value.toLocaleString()} ${body.currency}`,
      entityId: valuation.id,
      entityType: "valuation",
    });

    res.status(201).json({ ...valuation, value: parseFloat(valuation.value as unknown as string) });
  } catch (err) {
    req.log.error({ err }, "Error creating valuation");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/valuations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [valuation] = await db
      .select()
      .from(valuationsTable)
      .where(eq(valuationsTable.id, id));

    if (!valuation) return res.status(404).json({ error: "Not found" });
    res.json({ ...valuation, value: parseFloat(valuation.value as unknown as string) });
  } catch (err) {
    req.log.error({ err }, "Error getting valuation");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
