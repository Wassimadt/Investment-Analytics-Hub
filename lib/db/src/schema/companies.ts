import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  status: text("status").notNull().default("active"),
  revenue: numeric("revenue", { precision: 18, scale: 2 }),
  employees: integer("employees"),
  foundedYear: integer("founded_year"),
  region: text("region").notNull(),
  description: text("description"),
  totalInvestmentReceived: numeric("total_investment_received", { precision: 18, scale: 2 }).default("0"),
  currentValuation: numeric("current_valuation", { precision: 18, scale: 2 }),
  ebitda: numeric("ebitda", { precision: 18, scale: 2 }),
  debtRatio: numeric("debt_ratio", { precision: 8, scale: 4 }),
  growthRate: numeric("growth_rate", { precision: 8, scale: 4 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
