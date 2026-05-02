import { pgTable, serial, text, numeric, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const valuationsTable = pgTable("valuations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  projectId: integer("project_id"),
  method: text("method").notNull(),
  valuationDate: date("valuation_date").notNull(),
  value: numeric("value", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("DZD"),
  assumptions: text("assumptions"),
  analyst: text("analyst"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertValuationSchema = createInsertSchema(valuationsTable).omit({ id: true, createdAt: true });
export type InsertValuation = z.infer<typeof insertValuationSchema>;
export type Valuation = typeof valuationsTable.$inferSelect;
