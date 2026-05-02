import { pgTable, serial, text, numeric, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sector: text("sector").notNull(),
  status: text("status").notNull().default("active"),
  investmentAmount: numeric("investment_amount", { precision: 18, scale: 2 }).notNull(),
  currentValue: numeric("current_value", { precision: 18, scale: 2 }).notNull().default("0"),
  irr: numeric("irr", { precision: 8, scale: 4 }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  companyId: integer("company_id"),
  region: text("region").notNull(),
  riskLevel: text("risk_level").notNull().default("medium"),
  progressPercent: numeric("progress_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
