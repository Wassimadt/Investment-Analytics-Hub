import { useMemo, useEffect } from "react";
import { useListProjects, useGetDashboardSummary } from "@workspace/api-client-react";
import { calculateNPV, calculateEquivalentAnnuity, calculateIRR, formatPct, formatMillions } from "@/lib/finance";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, FileText } from "lucide-react";

/* ── shared constants ──────────────────────────────────────────────────────── */
const RISK_SIGMA: Record<string, number> = { low: 0.07, medium: 0.17, high: 0.30, critical: 0.45 };
const RISK_LABEL: Record<string, string> = { low: "Faible", medium: "Modéré", high: "Élevé", critical: "Critique" };
const RISK_COLOR_HEX: Record<string, string> = { low: "#16a34a", medium: "#ca8a04", high: "#ea580c", critical: "#dc2626" };
const STATUS_LABEL: Record<string, string> = { active: "Actif", pending: "En attente", completed: "Terminé", review: "En révision", on_hold: "En suspens" };

const DISC = 0.10;

function estimateCFs(investment: number, irr: number | null, years: number): number[] {
  const rate = (irr ?? 12) / 100;
  const cf = investment * rate * Math.pow(1 + rate, years) / (Math.pow(1 + rate, years) - 1);
  return Array.from({ length: years }, (_, i) => i === years - 1 ? cf + investment * 0.1 : cf);
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + " Md";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + " M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + " k";
  return n.toFixed(0);
}

/* ── print styles injected into <head> ────────────────────────────────────── */
const PRINT_STYLE = `
@media print {
  @page { margin: 18mm 14mm; size: A4; }
  body { background: #fff !important; color: #111 !important; }
  .no-print { display: none !important; }
  .page-break { page-break-before: always; break-before: page; }
  .avoid-break { page-break-inside: avoid; break-inside: avoid; }
}
`;

/* ── mini bar component ────────────────────────────────────────────────────── */
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 6, background: "#e5e7eb", borderRadius: 4, overflow: "hidden", width: "100%" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color, borderRadius: 4 }} />
    </div>
  );
}

/* ── small stat box ────────────────────────────────────────────────────────── */
function StatBox({ label, value, sub, color = "#111" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", background: "#fafafa" }}>
      <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function PortfolioReport() {
  const [, navigate] = useLocation();
  const { data: rawProjects } = useListProjects();
  const { data: summary } = useGetDashboardSummary();

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = PRINT_STYLE;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  const projects = useMemo(() => {
    if (!rawProjects) return [];
    return rawProjects.map(p => {
      const years = p.endDate && p.startDate
        ? Math.max(2, Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / (365.25 * 24 * 3600 * 1000)))
        : 5;
      const cfs = estimateCFs(p.investmentAmount, p.irr, years);
      const van = calculateNPV(cfs, DISC, p.investmentAmount);
      const sigma = Math.abs(van) * (RISK_SIGMA[p.riskLevel] ?? 0.17);
      const pi = p.investmentAmount > 0 ? (van + p.investmentAmount) / p.investmentAmount : 1;
      const ae = calculateEquivalentAnnuity(van, DISC, years);
      return { ...p, van, sigma, pi, ae, years, cfs };
    });
  }, [rawProjects]);

  const totalInvested = projects.reduce((s, p) => s + p.investmentAmount, 0);
  const portfolioVAN = projects.reduce((s, p) => s + p.van, 0);
  const weightedIRR = totalInvested > 0 ? projects.reduce((s, p) => s + (p.irr ?? 12) * p.investmentAmount, 0) / totalInvested : 0;
  const sigmaIndep = Math.sqrt(projects.reduce((s, p) => s + p.sigma * p.sigma, 0));
  const sigmaCorr = projects.reduce((s, p) => s + p.sigma, 0);
  const diversif = sigmaCorr > 0 ? (1 - sigmaIndep / sigmaCorr) * 100 : 0;
  const cv = sigmaIndep !== 0 && portfolioVAN !== 0 ? Math.abs(sigmaIndep / portfolioVAN) : Infinity;

  const sectorMap: Record<string, { inv: number; van: number; count: number }> = {};
  projects.forEach(p => {
    if (!sectorMap[p.sector]) sectorMap[p.sector] = { inv: 0, van: 0, count: 0 };
    sectorMap[p.sector].inv += p.investmentAmount;
    sectorMap[p.sector].van += p.van;
    sectorMap[p.sector].count += 1;
  });
  const sectors = Object.entries(sectorMap).map(([s, d]) => ({ sector: s, ...d, pct: totalInvested > 0 ? d.inv / totalInvested * 100 : 0 })).sort((a, b) => b.inv - a.inv);

  const riskMap: Record<string, number> = {};
  projects.forEach(p => { riskMap[p.riskLevel] = (riskMap[p.riskLevel] || 0) + p.investmentAmount; });
  const riskBreak = Object.entries(riskMap).map(([r, inv]) => ({ r, label: RISK_LABEL[r] ?? r, inv, pct: totalInvested > 0 ? inv / totalInvested * 100 : 0, color: RISK_COLOR_HEX[r] ?? "#6b7280" })).sort((a, b) => b.inv - a.inv);

  const byPI = [...projects].sort((a, b) => b.pi - a.pi);
  const optimal = projects.filter(p => p.van > 0 && p.sigma < sigmaIndep / projects.length);
  const risky = projects.filter(p => p.van > 0 && p.sigma >= sigmaIndep / projects.length);
  const problematic = projects.filter(p => p.van < 0);

  const today = new Date().toLocaleDateString("fr-DZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const todayShort = new Date().toLocaleDateString("fr-DZ", { year: "numeric", month: "long", day: "numeric" });

  const SECTOR_COLORS_HEX = ["#16a34a","#ca8a04","#2563eb","#db2777","#ea580c","#7c3aed","#0891b2","#d97706"];

  /* ── shared table style ─────────────────────────────────────────────────── */
  const TH: React.CSSProperties = { padding: "7px 10px", fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, borderBottom: "1.5px solid #e5e7eb", textAlign: "right" };
  const TD: React.CSSProperties = { padding: "6px 10px", fontSize: 10, borderBottom: "1px solid #f3f4f6", textAlign: "right", verticalAlign: "middle" };

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: "#111", background: "#fff", minHeight: "100vh" }}>

      {/* ── Toolbar (hidden on print) ───────────────────────────────────────── */}
      <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "#0f172a", borderBottom: "1px solid #1e293b", padding: "10px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate("/portfolio")} className="text-slate-300 hover:text-white gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour au Simulateur
        </Button>
        <div style={{ flex: 1 }} />
        <span style={{ color: "#94a3b8", fontSize: 12 }}>Rapport de Synthèse Portefeuille FNI — {todayShort}</span>
        <Button size="sm" onClick={() => window.print()} className="gap-2 bg-green-600 hover:bg-green-500 text-white">
          <Printer className="h-4 w-4" /> Imprimer / Exporter PDF
        </Button>
      </div>

      {/* ── Report body ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: "0 auto", paddingTop: 72, paddingBottom: 60 }} className="no-print-padding">

        {/* ══════════════════════════ PAGE 1 — COVER ═══════════════════════ */}
        <div className="avoid-break" style={{ minHeight: 500, display: "flex", flexDirection: "column", justifyContent: "space-between", borderBottom: "3px solid #16a34a", paddingBottom: 40, marginBottom: 40 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 52, height: 52, background: "#16a34a", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>FNI</span>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#111" }}>Fonds National d'Investissement</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Direction des Investissements — Algérie</div>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 10, color: "#9ca3af" }}>
              <div>Confidentiel — Usage interne</div>
              <div>{today}</div>
              <div style={{ marginTop: 4, color: "#16a34a", fontWeight: 600 }}>Réf. RPT-{new Date().getFullYear()}-{String(new Date().getMonth()+1).padStart(2,"0")}</div>
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: "center", padding: "60px 0 40px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16 }}>
              <FileText size={28} color="#16a34a" />
              <div style={{ fontSize: 28, fontWeight: 900, color: "#111", lineHeight: 1.1 }}>Rapport de Synthèse</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Portefeuille d'Investissements FNI</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Analyse quantitative — Exercice {new Date().getFullYear()}</div>
          </div>

          {/* Executive KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <StatBox label="Montant Total Investi" value={`${fmt(totalInvested)} DZD`} sub={`${projects.length} projets`} />
            <StatBox label="VAN Portefeuille" value={`${fmt(portfolioVAN)} DZD`} sub={portfolioVAN>=0?"Portefeuille créateur":"Destruction de valeur"} color={portfolioVAN>=0?"#16a34a":"#dc2626"} />
            <StatBox label="TRI Moyen Pondéré" value={formatPct(weightedIRR/100)} sub={`Taux actualisation k = ${(DISC*100).toFixed(0)}%`} color={weightedIRR/100>DISC?"#ca8a04":"#dc2626"} />
            <StatBox label="σ(VAN) Portefeuille" value={`${fmt(sigmaIndep)} DZD`} sub={`CV = ${isFinite(cv)?cv.toFixed(2):"∞"}`} color={cv<=0.9?"#16a34a":"#ea580c"} />
          </div>

          {/* Prepared by */}
          <div style={{ marginTop: 40, padding: "12px 16px", background: "#f9fafb", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Préparé par</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Wassim AIDAT</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Directeur d'Investissement — FNI</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Généré le</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{todayShort}</div>
              <div style={{ fontSize: 10, color: "#9ca3af" }}>Plateforme d'Investissement FNI v2</div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════ PAGE 2 — RÉPARTITIONS ════════════════ */}
        <div className="page-break" />
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 7, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Section 1</div>
          <div style={{ fontSize: 17, fontWeight: 800, borderBottom: "2px solid #16a34a", paddingBottom: 6, marginBottom: 20 }}>Répartition du Portefeuille</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
          {/* Sector table */}
          <div className="avoid-break">
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: "#374151" }}>Allocation par Secteur</div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th style={{ ...TH, textAlign: "left" }}>Secteur</th>
                    <th style={TH}>Projets</th>
                    <th style={TH}>Investi</th>
                    <th style={TH}>Part %</th>
                    <th style={TH}>VAN</th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map((s, i) => (
                    <tr key={s.sector}>
                      <td style={{ ...TD, textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: SECTOR_COLORS_HEX[i % SECTOR_COLORS_HEX.length], flexShrink: 0 }} />
                          <span style={{ fontWeight: 600 }}>{s.sector}</span>
                        </div>
                      </td>
                      <td style={{ ...TD, color: "#6b7280" }}>{s.count}</td>
                      <td style={TD}>{fmt(s.inv)}</td>
                      <td style={TD}><span style={{ fontWeight: 700, color: SECTOR_COLORS_HEX[i % SECTOR_COLORS_HEX.length] }}>{s.pct.toFixed(1)}%</span></td>
                      <td style={{ ...TD, fontWeight: 700, color: s.van>=0?"#16a34a":"#dc2626" }}>{fmt(s.van)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f0fdf4" }}>
                    <td style={{ ...TD, textAlign: "left", fontWeight: 800 }}>TOTAL</td>
                    <td style={{ ...TD, fontWeight: 700 }}>{projects.length}</td>
                    <td style={{ ...TD, fontWeight: 800 }}>{fmt(totalInvested)}</td>
                    <td style={{ ...TD, fontWeight: 700 }}>100%</td>
                    <td style={{ ...TD, fontWeight: 800, color: portfolioVAN>=0?"#16a34a":"#dc2626" }}>{fmt(portfolioVAN)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk breakdown */}
          <div className="avoid-break">
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: "#374151" }}>Répartition par Niveau de Risque</div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th style={{ ...TH, textAlign: "left" }}>Niveau</th>
                    <th style={TH}>Investi</th>
                    <th style={TH}>Part %</th>
                  </tr>
                </thead>
                <tbody>
                  {riskBreak.map(r => (
                    <tr key={r.r}>
                      <td style={{ ...TD, textAlign: "left" }}>
                        <span style={{ fontWeight: 700, color: r.color }}>{r.label}</span>
                      </td>
                      <td style={TD}>{fmt(r.inv)} DZD</td>
                      <td style={{ ...TD, fontWeight: 700 }}>{r.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: "#374151" }}>Bars de répartition</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {riskBreak.map(r => (
                <div key={r.r}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 3 }}>
                    <span style={{ color: r.color, fontWeight: 600 }}>{r.label}</span>
                    <span style={{ color: "#6b7280" }}>{r.pct.toFixed(1)}%</span>
                  </div>
                  <MiniBar pct={r.pct} color={r.color} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sector bars */}
        <div className="avoid-break" style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: "#374151" }}>Poids sectoriel (% du capital investi)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sectors.map((s, i) => (
              <div key={s.sector}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>{s.sector}</span>
                  <span style={{ color: "#6b7280" }}>{fmt(s.inv)} DZD · {s.pct.toFixed(1)}%</span>
                </div>
                <MiniBar pct={s.pct} color={SECTOR_COLORS_HEX[i % SECTOR_COLORS_HEX.length]} />
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════ PAGE 3 — TABLEAU PROJETS ═════════════ */}
        <div className="page-break" />
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 7, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Section 2</div>
          <div style={{ fontSize: 17, fontWeight: 800, borderBottom: "2px solid #16a34a", paddingBottom: 6, marginBottom: 20 }}>Tableau de Bord des Projets</div>
        </div>

        <div className="avoid-break" style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <th style={{ ...TH, textAlign: "left" }}>Projet</th>
                <th style={{ ...TH, textAlign: "left" }}>Secteur</th>
                <th style={TH}>I₀ (DZD)</th>
                <th style={TH}>TRI</th>
                <th style={TH}>VAN (k=10%)</th>
                <th style={TH}>IR</th>
                <th style={TH}>Annuité Éq.</th>
                <th style={TH}>σ(VAN)</th>
                <th style={{ ...TH, textAlign: "center" }}>Risque</th>
                <th style={{ ...TH, textAlign: "center" }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {byPI.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ ...TD, textAlign: "left", fontWeight: 600, maxWidth: 150 }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{p.name}</div>
                  </td>
                  <td style={{ ...TD, textAlign: "left", color: "#6b7280", fontSize: 9 }}>{p.sector}</td>
                  <td style={{ ...TD, fontFamily: "monospace" }}>{fmt(p.investmentAmount)}</td>
                  <td style={{ ...TD, fontFamily: "monospace", color: (p.irr ?? 0) > DISC * 100 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                    {p.irr != null ? formatPct(p.irr/100) : "—"}
                  </td>
                  <td style={{ ...TD, fontFamily: "monospace", fontWeight: 800, color: p.van>=0?"#16a34a":"#dc2626" }}>{fmt(p.van)}</td>
                  <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700, color: p.pi>=1.3?"#16a34a":p.pi>=1?"#ca8a04":"#dc2626" }}>{p.pi.toFixed(3)}</td>
                  <td style={{ ...TD, fontFamily: "monospace", fontSize: 9, color: "#374151" }}>{fmt(p.ae)}</td>
                  <td style={{ ...TD, fontFamily: "monospace", fontSize: 9, color: "#ca8a04" }}>{fmt(p.sigma)}</td>
                  <td style={{ textAlign: "center", padding: "4px 6px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" }}>
                    <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: (RISK_COLOR_HEX[p.riskLevel] ?? "#6b7280") + "22", color: RISK_COLOR_HEX[p.riskLevel] ?? "#6b7280" }}>
                      {RISK_LABEL[p.riskLevel] ?? p.riskLevel}
                    </span>
                  </td>
                  <td style={{ textAlign: "center", padding: "4px 6px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" }}>
                    <span style={{ fontSize: 8, fontWeight: 600, padding: "2px 5px", borderRadius: 4, background: "#f3f4f6", color: "#374151" }}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f0fdf4", borderTop: "2px solid #16a34a" }}>
                <td colSpan={2} style={{ ...TD, textAlign: "left", fontWeight: 900, color: "#111" }}>TOTAL PORTEFEUILLE</td>
                <td style={{ ...TD, fontWeight: 900 }}>{fmt(totalInvested)}</td>
                <td style={{ ...TD, fontWeight: 900, color: "#ca8a04" }}>{formatPct(weightedIRR/100)}</td>
                <td style={{ ...TD, fontWeight: 900, color: portfolioVAN>=0?"#16a34a":"#dc2626" }}>{fmt(portfolioVAN)}</td>
                <td colSpan={3} style={TD}></td>
                <td colSpan={2} style={TD}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ══════════════════════════ PAGE 4 — OPTIMISATION + RISQUE ══════ */}
        <div className="page-break" />
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 7, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Section 3</div>
          <div style={{ fontSize: 17, fontWeight: 800, borderBottom: "2px solid #16a34a", paddingBottom: 6, marginBottom: 20 }}>Analyse Risque & Optimisation du Portefeuille</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
          {/* Risk metrics */}
          <div className="avoid-break">
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 12, color: "#374151" }}>Indicateurs de Risque Consolidés</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <StatBox label="E(VAN) Portefeuille" value={`${fmt(portfolioVAN)} DZD`} color={portfolioVAN>=0?"#16a34a":"#dc2626"} />
              <StatBox label="σ(VAN) Indépendants" value={`${fmt(sigmaIndep)} DZD`} color="#ca8a04" />
              <StatBox label="σ(VAN) Corrélés (ρ=1)" value={`${fmt(sigmaCorr)} DZD`} color="#ea580c" />
              <StatBox label="Bénéfice Diversif." value={`${diversif.toFixed(1)}%`} sub="Réduction du risque" color="#2563eb" />
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 14px", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 8 }}>Comparaison des hypothèses de corrélation</div>
              {[
                { label: "Flux indépendants", sigma: sigmaIndep, color: "#16a34a" },
                { label: "Corrélation partielle (ρ=0.4)", sigma: Math.sqrt(projects.reduce((s,p)=>s+p.sigma*p.sigma,0) + 2*0.4*projects.reduce((s,p,_,arr)=>{ let x=0; arr.forEach((q,j)=>{ if(q!==p) x+=p.sigma*q.sigma; }); return s+x/2; },0)), color: "#ca8a04" },
                { label: "Corrélation totale (ρ=1)", sigma: sigmaCorr, color: "#dc2626" },
              ].map(m => (
                <div key={m.label} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 3 }}>
                    <span>{m.label}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(m.sigma)} DZD</span>
                  </div>
                  <MiniBar pct={sigmaCorr > 0 ? m.sigma / sigmaCorr * 100 : 0} color={m.color} />
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 9, color: "#6b7280", fontStyle: "italic" }}>
                La diversification sectorielle réduit le risque de <strong style={{ color: "#2563eb" }}>{diversif.toFixed(1)}%</strong> par rapport à la corrélation totale, soit une économie de risque de {fmt(sigmaCorr - sigmaIndep)} DZD.
              </div>
            </div>
          </div>

          {/* IR Ranking */}
          <div className="avoid-break">
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 12, color: "#374151" }}>Classement par Indice de Rentabilité</div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th style={{ ...TH, textAlign: "center", width: 28 }}>#</th>
                    <th style={{ ...TH, textAlign: "left" }}>Projet</th>
                    <th style={TH}>VAN</th>
                    <th style={TH}>IR</th>
                    <th style={{ ...TH, textAlign: "center" }}>Priorité</th>
                  </tr>
                </thead>
                <tbody>
                  {byPI.slice(0, 10).map((p, i) => (
                    <tr key={p.id} style={{ background: i < 3 ? "#f0fdf4" : undefined }}>
                      <td style={{ ...TD, textAlign: "center", fontWeight: 800, color: i < 3 ? "#16a34a" : "#9ca3af" }}>#{i+1}</td>
                      <td style={{ ...TD, textAlign: "left", fontSize: 9, maxWidth: 110 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      </td>
                      <td style={{ ...TD, fontWeight: 700, fontSize: 9, color: p.van>=0?"#16a34a":"#dc2626" }}>{fmt(p.van)}</td>
                      <td style={{ ...TD, fontWeight: 900, color: p.pi>=1.3?"#16a34a":p.pi>=1?"#ca8a04":"#dc2626" }}>{p.pi.toFixed(3)}</td>
                      <td style={{ textAlign: "center", padding: "4px", borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{ fontSize: 8, padding: "2px 5px", borderRadius: 4, background: i<3?"#dcfce7":i<6?"#fef9c3":"#f3f4f6", color: i<3?"#16a34a":i<6?"#ca8a04":"#9ca3af", fontWeight: 700 }}>
                          {i<3?"Prioritaire":i<6?"Recommandé":"Optionnel"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quadrant analysis */}
        <div className="avoid-break" style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 12, color: "#374151" }}>Analyse Quadrantielle — Espace Risque/Rendement</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { icon: "✅", title: "Quadrant Optimal", color: "#16a34a", bg: "#f0fdf4", projects: optimal, desc: "VAN > 0, risque maîtrisé — À financer en priorité" },
              { icon: "⚠️", title: "Projets Risqués Rentables", color: "#ca8a04", bg: "#fefce8", projects: risky, desc: "VAN > 0, σ élevé — Monitoring rapproché requis" },
              { icon: "❌", title: "Projets Problématiques", color: "#dc2626", bg: "#fef2f2", projects: problematic, desc: "VAN < 0 — À réviser, restructurer ou exclure" },
            ].map(q => (
              <div key={q.title} style={{ border: `1px solid ${q.color}33`, borderRadius: 8, padding: "14px", background: q.bg }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{q.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 11, color: q.color, marginBottom: 4 }}>{q.title}</div>
                <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 10 }}>{q.desc}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: q.color }}>{q.projects.length}</div>
                <div style={{ fontSize: 9, color: "#9ca3af" }}>projet{q.projects.length !== 1 ? "s" : ""}</div>
                {q.projects.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 8, color: "#374151" }}>
                    {q.projects.slice(0, 3).map(p => p.name.slice(0, 22)).join(" · ")}
                    {q.projects.length > 3 && ` +${q.projects.length - 3} autres`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════ PAGE 5 — CONCLUSIONS ═════════════════ */}
        <div className="page-break" />
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 7, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Section 4</div>
          <div style={{ fontSize: 17, fontWeight: 800, borderBottom: "2px solid #16a34a", paddingBottom: 6, marginBottom: 20 }}>Synthèse Exécutive & Recommandations</div>
        </div>

        <div className="avoid-break" style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: "#374151" }}>Évaluation Globale du Portefeuille</div>
              {[
                { label: "Création de valeur", ok: portfolioVAN > 0, detail: `VAN = ${fmt(portfolioVAN)} DZD — ${portfolioVAN>0?"Acceptable, le portefeuille crée de la valeur":"À revoir, destruction de valeur"}` },
                { label: "Performance TRI", ok: weightedIRR/100 > DISC, detail: `TRI = ${formatPct(weightedIRR/100)} vs k = ${(DISC*100).toFixed(0)}% — ${weightedIRR/100>DISC?"Surperformance":"Sous-performance"}` },
                { label: "Risque maîtrisé", ok: cv <= 0.9, detail: `CV = ${isFinite(cv)?cv.toFixed(3):"∞"} — ${cv<=0.9?"Risque acceptable (CV ≤ 0.9)":"Risque élevé (CV > 0.9)"}` },
                { label: "Diversification", ok: diversif > 15, detail: `Bénéfice de diversification : ${diversif.toFixed(1)}% — ${diversif>15?"Portefeuille bien diversifié":"Diversification insuffisante"}` },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", gap: 10, marginBottom: 10, padding: "8px 10px", borderRadius: 6, background: item.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${item.ok?"#bbf7d0":"#fecaca"}` }}>
                  <div style={{ fontSize: 14, lineHeight: 1 }}>{item.ok ? "✅" : "⚠️"}</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: item.ok ? "#16a34a" : "#dc2626" }}>{item.label}</div>
                    <div style={{ fontSize: 9, color: "#374151", marginTop: 2 }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: "#374151" }}>Recommandations Stratégiques</div>
              {[
                { n: "01", titre: "Prioriser les projets à IR élevé", detail: `Concentrer le capital sur les ${Math.min(3, byPI.filter(p=>p.pi>1.2).length)} projets à IR > 1.2 qui génèrent le plus de valeur par unité investie.` },
                { n: "02", titre: "Restructurer les projets à VAN négative", detail: `${problematic.length} projet${problematic.length!==1?"s":""} présente${problematic.length!==1?"nt":""} une VAN négative — révision du modèle financier ou sortie recommandée.` },
                { n: "03", titre: "Renforcer la diversification sectorielle", detail: `L'allocation sectorielle réduit le risque de ${diversif.toFixed(0)}%. Maintenir une diversification entre ${sectors.length} secteurs.` },
                { n: "04", titre: "Suivi du Coefficient de Variation", detail: `CV = ${isFinite(cv)?cv.toFixed(2):"∞"} — ${cv<=0.9?"Risque sous contrôle.":"Réduire l'exposition aux projets critiques."} Réévaluer à chaque trimestre.` },
              ].map(r => (
                <div key={r.n} style={{ display: "flex", gap: 10, marginBottom: 10, padding: "8px 10px", borderRadius: 6, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#16a34a", lineHeight: 1.2, minWidth: 20 }}>{r.n}</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700 }}>{r.titre}</div>
                    <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2, lineHeight: 1.4 }}>{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Methodology note */}
        <div className="avoid-break" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, color: "#374151" }}>Note Méthodologique</div>
          <div style={{ fontSize: 9, color: "#6b7280", lineHeight: 1.6 }}>
            Les calculs de VAN utilisent un taux d'actualisation k = {(DISC*100).toFixed(0)}%. Les cash-flows sont estimés à partir du TRI et du montant investi via la formule d'annuité : CF = I₀ × k(1+k)ⁿ / ((1+k)ⁿ−1). L'écart-type σ(VAN) est estimé comme un pourcentage de |VAN| selon le niveau de risque (Faible: 7%, Modéré: 17%, Élevé: 30%, Critique: 45%). La VAN portefeuille est calculée sous hypothèse d'indépendance des flux. Le Coefficient de Variation CV = σ(VAN)/E(VAN) est le critère de risque relatif retenu.
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 8, color: "#9ca3af" }}>
          <span>FNI — Fonds National d'Investissement · Rapport Confidentiel</span>
          <span>Généré le {todayShort} · Plateforme FNI v2 · Wassim AIDAT</span>
        </div>
      </div>
    </div>
  );
}
