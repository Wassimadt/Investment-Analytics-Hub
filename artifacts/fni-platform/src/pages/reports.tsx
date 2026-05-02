import { useState, useMemo, useEffect } from "react";
import { useListProjects, useGetDashboardSummary, useGetSectorBreakdown } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDZD, getProjectHealth } from "@/lib/utils";
import { calculateNPV, calculateEquivalentAnnuity } from "@/lib/finance";
import {
  FileText, Printer, CheckSquare, Square, Calendar,
  TrendingUp, BarChart3, Shield, BookOpen, Building2,
  Download, Eye, Loader2,
} from "lucide-react";
import { motion } from "framer-motion";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const DISC = 0.10;
const RISK_SIGMA: Record<string, number>  = { low: 0.07, medium: 0.17, high: 0.30, critical: 0.45 };
const RISK_LABEL: Record<string, string>  = { low: "Faible", medium: "Modéré", high: "Élevé", critical: "Critique" };
const RISK_COLOR:  Record<string, string> = { low: "#16a34a", medium: "#ca8a04", high: "#ea580c", critical: "#dc2626" };
const HEALTH_CFG = {
  green: { label: "Sain",      color: "#16a34a" },
  amber: { label: "Vigilance", color: "#ca8a04" },
  red:   { label: "Alerte",    color: "#dc2626" },
};

function estimateCFs(inv: number, irr: number | null, years: number) {
  const r = (irr ?? 12) / 100;
  const cf = inv * r * Math.pow(1 + r, years) / (Math.pow(1 + r, years) - 1);
  return Array.from({ length: years }, (_, i) => i === years - 1 ? cf + inv * 0.1 : cf);
}
function fmtDZD(n: number) {
  const a = Math.abs(n);
  const s = n < 0 ? "−" : "";
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)} Md DZD`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)} M DZD`;
  return `${s}${a.toFixed(0)} DZD`;
}

const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth(); // 0-indexed

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const QUARTERS   = ["T1 (Jan–Mar)","T2 (Avr–Jun)","T3 (Jul–Sep)","T4 (Oct–Déc)"];

const PRINT_STYLE = `
@media print {
  @page { margin: 18mm 14mm; size: A4; }
  body { background: #fff !important; color: #111 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .page-break { page-break-before: always; break-before: page; }
  .avoid-break { page-break-inside: avoid; break-inside: avoid; }
}
`;

/* ── Section definitions ──────────────────────────────────────────────────── */
const ALL_SECTIONS = [
  { key: "cover",          label: "Page de couverture",       icon: FileText,  always: true },
  { key: "kpis",           label: "KPIs & Vue d'ensemble",    icon: TrendingUp },
  { key: "projects",       label: "Tableau des projets",      icon: BarChart3 },
  { key: "sectors",        label: "Répartition sectorielle",  icon: Building2 },
  { key: "risk",           label: "Analyse des risques",      icon: Shield },
  { key: "recommendations",label: "Recommandations",          icon: BookOpen },
] as const;
type SectionKey = typeof ALL_SECTIONS[number]["key"];

/* ───────────────────────────────────────────────────────────────────────── */
export default function Reports() {
  const { data: projects, isLoading: isLoadingProjects } = useListProjects();
  const { data: summary,  isLoading: isLoadingSummary  } = useGetDashboardSummary();
  const { data: sectors                                 } = useGetSectorBreakdown();

  const [reportType,  setReportType]  = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [selectedMonth,  setMonth]    = useState(String(CURRENT_MONTH));
  const [selectedQuarter, setQuarter] = useState("0");
  const [selectedYear,   setYear]     = useState(String(CURRENT_YEAR));
  const [sections, setSections]       = useState<Set<SectionKey>>(
    new Set(ALL_SECTIONS.map(s => s.key))
  );
  const [previewing, setPreviewing]   = useState(false);
  const [printing, setPrinting]       = useState(false);

  useEffect(() => {
    const el = document.getElementById("fni-print-style-reports");
    if (!el) {
      const style = document.createElement("style");
      style.id = "fni-print-style-reports";
      style.innerHTML = PRINT_STYLE;
      document.head.appendChild(style);
    }
  }, []);

  const toggleSection = (k: SectionKey) => {
    if (k === "cover") return;
    setSections(prev => {
      const s = new Set(prev);
      s.has(k) ? s.delete(k) : s.add(k);
      return s;
    });
  };

  /* ── Computed report data ─────────────────────────────────────────────── */
  const reportData = useMemo(() => {
    if (!projects) return null;
    const enriched = projects.map(p => {
      const years = p.startDate && p.endDate
        ? Math.max(1, Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / (365.25 * 24 * 3600 * 1e3)))
        : 5;
      const cfs = estimateCFs(p.investmentAmount, p.irr ?? null, years);
      const npv = calculateNPV(cfs, p.investmentAmount, DISC);
      const sigma = p.investmentAmount * (RISK_SIGMA[p.riskLevel] ?? 0.17);
      const health = getProjectHealth(p);
      return { ...p, years, npv, sigma, health };
    });

    const totalInv   = enriched.reduce((s, p) => s + p.investmentAmount, 0);
    const totalNPV   = enriched.reduce((s, p) => s + p.npv, 0);
    const avgIRR     = enriched.filter(p => p.irr).reduce((s, p, _, a) => s + (p.irr ?? 0) / a.length, 0);
    const healthCounts = { green: 0, amber: 0, red: 0 };
    enriched.forEach(p => healthCounts[p.health]++);

    // sector aggregation
    const sectorMap: Record<string, { count: number; inv: number; npv: number }> = {};
    enriched.forEach(p => {
      if (!sectorMap[p.sector]) sectorMap[p.sector] = { count: 0, inv: 0, npv: 0 };
      sectorMap[p.sector].count++;
      sectorMap[p.sector].inv += p.investmentAmount;
      sectorMap[p.sector].npv += p.npv;
    });
    const sectorRows = Object.entries(sectorMap)
      .map(([s, v]) => ({ sector: s, ...v, pct: (v.inv / totalInv) * 100 }))
      .sort((a, b) => b.inv - a.inv);

    // risk aggregation
    const riskMap: Record<string, { count: number; inv: number }> = {};
    enriched.forEach(p => {
      if (!riskMap[p.riskLevel]) riskMap[p.riskLevel] = { count: 0, inv: 0 };
      riskMap[p.riskLevel].count++;
      riskMap[p.riskLevel].inv += p.investmentAmount;
    });

    return { enriched, totalInv, totalNPV, avgIRR, healthCounts, sectorRows, riskMap };
  }, [projects]);

  /* ── Period label ─────────────────────────────────────────────────────── */
  const periodLabel = useMemo(() => {
    if (reportType === "monthly")   return `${MONTHS_FR[+selectedMonth]} ${selectedYear}`;
    if (reportType === "quarterly") return `${QUARTERS[+selectedQuarter].split(" ")[0]} ${selectedYear}`;
    return `Exercice ${selectedYear}`;
  }, [reportType, selectedMonth, selectedQuarter, selectedYear]);

  const reportTitle = useMemo(() => {
    if (reportType === "monthly")   return "Rapport Mensuel";
    if (reportType === "quarterly") return "Rapport Trimestriel";
    return "Rapport Annuel";
  }, [reportType]);

  const refCode = useMemo(() => {
    const prefix = { monthly: "RPM", quarterly: "RPT", annual: "RPA" }[reportType];
    return `${prefix}-${selectedYear}-${String(+selectedMonth + 1).padStart(2, "0")}`;
  }, [reportType, selectedYear, selectedMonth]);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 300);
  };

  const isLoading = isLoadingProjects || isLoadingSummary;

  /* ── MiniBar ────────────────────────────────────────────────────────── */
  const MiniBar = ({ pct, color }: { pct: number; color: string }) => (
    <div style={{ height: 5, background: "#e5e7eb", borderRadius: 3, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: color, borderRadius: 3 }} />
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold">Rapports Périodiques</h1>
        <p className="text-sm text-muted-foreground mt-1">Générez et exportez des rapports de portefeuille en PDF</p>
      </div>

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 no-print">
        {/* Type & Period */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Paramètres du Rapport
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-1 p-1 bg-muted/30 rounded-lg">
              {(["monthly","quarterly","annual"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setReportType(t)}
                  className={`py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    reportType === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "monthly" ? "Mensuel" : t === "quarterly" ? "Trimestriel" : "Annuel"}
                </button>
              ))}
            </div>

            <div className="flex gap-3 flex-wrap">
              {reportType === "monthly" && (
                <Select value={selectedMonth} onValueChange={setMonth}>
                  <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS_FR.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {reportType === "quarterly" && (
                <Select value={selectedQuarter} onValueChange={setQuarter}>
                  <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUARTERS.map((q, i) => <SelectItem key={i} value={String(i)}>{q}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Select value={selectedYear} onValueChange={setYear}>
                <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Rapport généré</p>
                <p className="text-sm font-bold">{reportTitle} — {periodLabel}</p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">{refCode}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Sections */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-accent" />
              Sections à inclure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {ALL_SECTIONS.map(s => {
                const checked = sections.has(s.key);
                return (
                  <div
                    key={s.key}
                    onClick={() => toggleSection(s.key)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
                      s.always ? "opacity-60 cursor-default" : "cursor-pointer hover:bg-muted/40"
                    }`}
                  >
                    {checked
                      ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                    <s.icon className={`h-3.5 w-3.5 shrink-0 ${checked ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                    {s.always && <span className="ml-auto text-xs text-muted-foreground/50">obligatoire</span>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Action buttons ────────────────────────────────────────────── */}
      <div className="flex gap-3 no-print">
        <Button
          variant="outline"
          onClick={() => setPreviewing(v => !v)}
          className="gap-2"
        >
          <Eye className="h-4 w-4" />
          {previewing ? "Masquer l'aperçu" : "Aperçu du rapport"}
        </Button>
        <Button onClick={handlePrint} className="gap-2" disabled={printing || isLoading}>
          {printing
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Printer className="h-4 w-4" />
          }
          Imprimer / Exporter PDF
        </Button>
      </div>

      {/* ── Report preview / print area ───────────────────────────────── */}
      {(previewing || printing) && !isLoading && reportData ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          id="report-print-area"
          style={{ background: "#fff", color: "#111", fontFamily: "system-ui, sans-serif", borderRadius: 12, overflow: "hidden" }}
          className="border border-border shadow-lg"
        >
          {/* ── Cover ─────────────────────────────────────────────────── */}
          <div className="avoid-break" style={{ padding: "32px 40px 24px", borderBottom: "3px solid #16a34a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, background: "#16a34a", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontWeight: 900, fontSize: 13 }}>FNI</span>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Fonds National d'Investissement</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Direction des Investissements — Algérie</div>
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 11, color: "#6b7280" }}>
                <div>Confidentiel — Usage interne</div>
                <div>{new Date().toLocaleDateString("fr-DZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
                <div style={{ color: "#16a34a", fontWeight: 700 }}>Réf. {refCode}</div>
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: 32, marginBottom: 24 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#111" }}>📋 {reportTitle}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a", marginTop: 6 }}>
                Portefeuille d'Investissements FNI — {periodLabel}
              </div>
            </div>

            {sections.has("kpis") && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { label: "MONTANT TOTAL INVESTI", val: fmtDZD(reportData.totalInv), sub: `${reportData.enriched.length} projets`, color: "#111" },
                  { label: "VAN PORTEFEUILLE",      val: fmtDZD(reportData.totalNPV), sub: reportData.totalNPV >= 0 ? "Créateur de valeur" : "Destructeur de valeur", color: reportData.totalNPV >= 0 ? "#16a34a" : "#dc2626" },
                  { label: "TRI MOYEN PONDÉRÉ",     val: `${reportData.avgIRR.toFixed(1)}%`, sub: "Taux d'actualisation 10%", color: "#ca8a04" },
                  { label: "PROJETS EN ALERTE",     val: String(reportData.healthCounts.red), sub: `${reportData.healthCounts.amber} en vigilance`, color: reportData.healthCounts.red > 0 ? "#dc2626" : "#16a34a" },
                ].map((k, i) => (
                  <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>{k.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: k.color, marginTop: 4 }}>{k.val}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{k.sub}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, fontSize: 11, color: "#9ca3af", borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
              <div><strong style={{ color: "#111" }}>Wassim AIDAT</strong><br />Directeur d'Investissement — FNI</div>
              <div style={{ textAlign: "right" }}>Généré le {new Date().toLocaleDateString("fr-DZ")}<br />Plateforme FNI v2</div>
            </div>
          </div>

          {/* ── Sector section ────────────────────────────────────────── */}
          {sections.has("sectors") && (
            <div className="avoid-break" style={{ padding: "24px 40px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>SECTION — RÉPARTITION</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>Répartition Sectorielle</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #16a34a" }}>
                    {["Secteur","Projets","Investi","Part %","VAN"].map(h => (
                      <th key={h} style={{ textAlign: h === "Secteur" ? "left" : "right", padding: "6px 8px", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.sectorRows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                      <td style={{ padding: "7px 8px", fontWeight: 600 }}>{row.sector}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>{row.count}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "monospace" }}>{fmtDZD(row.inv)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                          <div style={{ height: 5, width: 60, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${row.pct}%`, height: "100%", background: "#16a34a" }} />
                          </div>
                          {row.pct.toFixed(1)}%
                        </div>
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "monospace", color: row.npv >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>{fmtDZD(row.npv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Projects table ────────────────────────────────────────── */}
          {sections.has("projects") && (
            <div className="page-break avoid-break" style={{ padding: "24px 40px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>SECTION — PROJETS</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>Tableau des Projets</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #16a34a", background: "#f9fafb" }}>
                    {["Projet","Secteur","I₀","TRI","VAN","Santé","Avancement"].map(h => (
                      <th key={h} style={{ textAlign: h === "Projet" || h === "Secteur" ? "left" : "right", padding: "6px 8px", fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.enriched.map((p, i) => {
                    const hcfg = HEALTH_CFG[p.health];
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 600, maxWidth: 160 }}>{p.name}</td>
                        <td style={{ padding: "6px 8px", color: "#6b7280" }}>{p.sector}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>{fmtDZD(p.investmentAmount)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#ca8a04" }}>{p.irr != null ? `${p.irr.toFixed(1)}%` : "—"}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", color: p.npv >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>{fmtDZD(p.npv)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>
                          <span style={{ background: hcfg.color + "22", color: hcfg.color, border: `1px solid ${hcfg.color}44`, borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 700 }}>{hcfg.label}</span>
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                            <div style={{ height: 4, width: 48, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ width: `${p.progressPercent}%`, height: "100%", background: "#16a34a" }} />
                            </div>
                            {p.progressPercent}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Risk section ──────────────────────────────────────────── */}
          {sections.has("risk") && (
            <div className="avoid-break" style={{ padding: "24px 40px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>SECTION — RISQUE</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>Analyse des Risques</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>RÉPARTITION PAR NIVEAU DE RISQUE</div>
                  {Object.entries(reportData.riskMap).map(([level, v]) => (
                    <div key={level} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{RISK_LABEL[level] ?? level}</span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>{v.count} projets · {fmtDZD(v.inv)}</span>
                      </div>
                      <div style={{ height: 6, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${(v.count / reportData.enriched.length) * 100}%`, height: "100%", background: RISK_COLOR[level] ?? "#6b7280", borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>SANTÉ RAG DU PORTEFEUILLE</div>
                  {(["green","amber","red"] as const).map(h => {
                    const hcfg = HEALTH_CFG[h];
                    const n = reportData.healthCounts[h];
                    const pct = (n / reportData.enriched.length) * 100;
                    return (
                      <div key={h} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: hcfg.color }}>{hcfg.label}</span>
                          <span style={{ fontSize: 11, color: "#6b7280" }}>{n} projets ({pct.toFixed(0)}%)</span>
                        </div>
                        <div style={{ height: 6, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: hcfg.color, borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Recommendations ───────────────────────────────────────── */}
          {sections.has("recommendations") && (
            <div className="avoid-break" style={{ padding: "24px 40px" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>SECTION — SYNTHÈSE</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>Recommandations Stratégiques</div>
              {[
                {
                  n: 1, color: "#16a34a",
                  title: "Renforcer les projets à fort TRI",
                  body: `${reportData.enriched.filter(p => (p.irr ?? 0) >= 12).length} projets affichent un TRI ≥ 12% — prioriser leur financement et accélération.`,
                },
                {
                  n: 2, color: "#ca8a04",
                  title: "Plan de redressement pour les projets en alerte",
                  body: `${reportData.healthCounts.red} projet(s) en statut "Alerte" nécessitent un plan d'action correctif immédiat.`,
                },
                {
                  n: 3, color: "#2563eb",
                  title: "Diversification sectorielle",
                  body: `Le portefeuille est concentré sur ${reportData.sectorRows[0]?.sector ?? "un secteur dominant"} (${reportData.sectorRows[0]?.pct.toFixed(0) ?? ""}% de l'investissement). Envisager une diversification.`,
                },
                {
                  n: 4, color: "#7c3aed",
                  title: "Optimisation budgétaire",
                  body: `La VAN consolidée est de ${fmtDZD(reportData.totalNPV)}. Réallouer les budgets des projets à VAN négative vers les projets performants.`,
                },
              ].map(r => (
                <div key={r.n} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 24, height: 24, background: r.color, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: "#fff", fontWeight: 900, fontSize: 12 }}>{r.n}</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{r.body}</div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 24, padding: "12px 16px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 10, color: "#9ca3af" }}>
                <strong style={{ color: "#6b7280" }}>Note méthodologique :</strong> Les calculs de VAN utilisent un taux d'actualisation de {(DISC * 100).toFixed(0)}%. Le TRI est estimé sur la durée contractuelle. Les projections ne constituent pas une garantie de performance.
              </div>
            </div>
          )}
        </motion.div>
      ) : previewing && isLoading ? (
        <Card><CardContent className="py-12 text-center"><Skeleton className="h-64 w-full" /></CardContent></Card>
      ) : null}
    </div>
  );
}
