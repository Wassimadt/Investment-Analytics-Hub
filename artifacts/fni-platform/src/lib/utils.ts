import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDZD(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)} Bn DZD`;
  if (abs >= 1e9)  return `${sign}${(abs / 1e9).toFixed(2)} Md DZD`;
  if (abs >= 1e6)  return `${sign}${(abs / 1e6).toFixed(1)} M DZD`;
  if (abs >= 1e3)  return `${sign}${(abs / 1e3).toFixed(0)} k DZD`;
  return `${sign}${abs.toFixed(0)} DZD`;
}

export function formatPercentage(value: number) {
  return new Intl.NumberFormat("fr-DZ", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/** RAG health score for a project */
export function getProjectHealth(project: {
  startDate: string;
  endDate?: string | null;
  progressPercent: number;
  riskLevel: string;
  status: string;
}): "green" | "amber" | "red" {
  if (project.status === "suspended" || project.status === "on_hold") return "red";
  if (project.riskLevel === "critical") return "red";

  let expectedProgress = 50; // fallback
  if (project.startDate && project.endDate) {
    const start = new Date(project.startDate).getTime();
    const end   = new Date(project.endDate).getTime();
    const now   = Date.now();
    if (end > start) expectedProgress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  }

  const delta = project.progressPercent - expectedProgress;
  if (delta >= -5 && project.riskLevel !== "high") return "green";
  if (delta >= -20 || project.riskLevel === "high") return "amber";
  return "red";
}

export function daysUntilDeadline(endDate?: string | null): number | null {
  if (!endDate) return null;
  return Math.round((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
