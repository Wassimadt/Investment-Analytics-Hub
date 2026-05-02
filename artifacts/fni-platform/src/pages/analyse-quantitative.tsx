import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  calculateNPV, calculateIRR, calculateEquivalentAnnuity,
  calculateExpectedNPV, calculateNPVVariance, coefficientOfVariation,
  formatPct, formatMillions,
} from "@/lib/finance";
import { Calculator, BarChart3, TrendingUp, Info, CheckCircle2, AlertTriangle, ShieldCheck, Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend } from "recharts";

function lcm(a: number, b: number): number {
  const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y);
  return (a * b) / gcd(a, b);
}

function replicateProject(cashFlows: number[], investment: number, times: number): { cfs: number[]; inv: number } {
  if (times <= 1) return { cfs: cashFlows, inv: investment };
  const n = cashFlows.length;
  const result: number[] = new Array(n * times).fill(0);
  for (let r = 0; r < times; r++) {
    cashFlows.forEach((cf, i) => {
      const idx = r * n + i;
      if (r > 0 && i === 0) result[idx] = (result[idx] || 0) + cf - investment;
      else result[idx] = (result[idx] || 0) + cf;
    });
  }
  return { cfs: result, inv: investment };
}

// ── Équivalent Certain VAN ───────────────────────────────────────────────────
function calculateCertaintyEquivalentNPV(cashFlows: number[], alphas: number[], riskFreeRate: number, investment: number): number {
  const pv = cashFlows.reduce((sum, cf, t) => sum + (alphas[t] ?? 1) * cf / Math.pow(1 + riskFreeRate, t + 1), 0);
  return pv - investment;
}

// ── RADR VAN ─────────────────────────────────────────────────────────────────
function calculateRADR_NPV(cashFlows: number[], riskFreeRate: number, riskPremium: number, investment: number): number {
  const k = riskFreeRate + riskPremium;
  return calculateNPV(cashFlows, k, investment);
}

// ── Reduced Duration VAN ─────────────────────────────────────────────────────
function calculateReducedDurationNPV(cashFlows: number[], riskFreeRate: number, penaltyYears: number, investment: number): number {
  const usable = cashFlows.slice(0, Math.max(1, cashFlows.length - penaltyYears));
  return calculateNPV(usable, riskFreeRate, investment);
}

const TABS = [
  "Comparaison de Projets",
  "Analyse sous Incertitude",
  "Distributions de Probabilités",
  "Gestion du Risque — RADR",
];

export default function AnalyseQuantitative() {
  const [activeTab, setActiveTab] = useState(0);

  // ── TAB 0 ────────────────────────────────────────────────────────────────
  const [discountRate, setDiscountRate] = useState(10);
  const [projectA, setProjectA] = useState({ name: "Projet A", investment: 100000, years: 4, cfs: [30000, 35000, 40000, 38000] });
  const [projectB, setProjectB] = useState({ name: "Projet B", investment: 80000, years: 6, cfs: [20000, 22000, 25000, 27000, 28000, 26000] });

  const rate = discountRate / 100;
  const computeProject = (p: typeof projectA) => ({
    npv: calculateNPV(p.cfs, rate, p.investment),
    irr: calculateIRR(p.cfs, p.investment),
    ae: calculateEquivalentAnnuity(calculateNPV(p.cfs, rate, p.investment), rate, p.years),
  });
  const resA = useMemo(() => computeProject(projectA), [projectA, rate]);
  const resB = useMemo(() => computeProject(projectB), [projectB, rate]);
  const commonHorizon = useMemo(() => Math.min(lcm(projectA.years, projectB.years), 30), [projectA.years, projectB.years]);
  const timesA = Math.round(commonHorizon / projectA.years);
  const timesB = Math.round(commonHorizon / projectB.years);
  const repA = useMemo(() => replicateProject(projectA.cfs, projectA.investment, timesA), [projectA, timesA]);
  const repB = useMemo(() => replicateProject(projectB.cfs, projectB.investment, timesB), [projectB, timesB]);
  const npvRepA = useMemo(() => calculateNPV(repA.cfs, rate, repA.inv), [repA, rate]);
  const npvRepB = useMemo(() => calculateNPV(repB.cfs, rate, repB.inv), [repB, rate]);

  const setProjectYears = (proj: "a" | "b", n: number) => {
    const t = Math.max(1, Math.min(15, n));
    if (proj === "a") setProjectA(p => ({ ...p, years: t, cfs: Array.from({ length: t }, (_, i) => p.cfs[i] ?? 20000) }));
    else setProjectB(p => ({ ...p, years: t, cfs: Array.from({ length: t }, (_, i) => p.cfs[i] ?? 20000) }));
  };
  const updateCF = (proj: "a" | "b", i: number, val: string) => {
    const v = parseFloat(val) || 0;
    if (proj === "a") setProjectA(p => { const c = [...p.cfs]; c[i] = v; return { ...p, cfs: c }; });
    else setProjectB(p => { const c = [...p.cfs]; c[i] = v; return { ...p, cfs: c }; });
  };
  const aeChartData = [
    { name: projectA.name, ae: Math.round(resA.ae), npv: Math.round(resA.npv) },
    { name: projectB.name, ae: Math.round(resB.ae), npv: Math.round(resB.npv) },
  ];
  const winner = resA.ae > resB.ae ? projectA.name : projectB.name;
  const winnerColor = resA.ae > resB.ae ? "text-primary" : "text-accent";

  // ── TAB 1 ────────────────────────────────────────────────────────────────
  const [scenarios2, setScenarios2] = useState([
    { label: "Pessimiste", probability: 0.25, cf1: 15000, cf2: 12000 },
    { label: "Moyen",      probability: 0.50, cf1: 25000, cf2: 22000 },
    { label: "Optimiste",  probability: 0.25, cf1: 35000, cf2: 32000 },
  ]);
  const [inv2, setInv2] = useState(50000);
  const [rate2, setRate2] = useState(10);
  const scenNpvs = useMemo(() => scenarios2.map(s => ({
    probability: s.probability,
    npv: calculateNPV([s.cf1, s.cf2], rate2 / 100, inv2),
    label: s.label,
  })), [scenarios2, inv2, rate2]);
  const eNpv2 = useMemo(() => calculateExpectedNPV(scenNpvs), [scenNpvs]);
  const var2 = useMemo(() => calculateNPVVariance(scenNpvs, eNpv2), [scenNpvs, eNpv2]);
  const sig2 = Math.sqrt(var2);
  const cv2 = coefficientOfVariation(sig2, eNpv2);
  const totalProb = scenarios2.reduce((s, r) => s + r.probability, 0);

  // ── TAB 2 ────────────────────────────────────────────────────────────────
  const [probRows, setProbRows]   = useState([{ cf: 16000, p: 0.2 }, { cf: 20000, p: 0.6 }, { cf: 24000, p: 0.2 }]);
  const [probRows2, setProbRows2] = useState([{ cf: 13000, p: 0.3 }, { cf: 15000, p: 0.4 }, { cf: 17000, p: 0.3 }]);
  const [invProb, setInvProb] = useState(25000);
  const [rateProb, setRateProb] = useState(10);
  const eCF1 = useMemo(() => probRows.reduce((s, r) => s + r.cf * r.p, 0), [probRows]);
  const eCF2 = useMemo(() => probRows2.reduce((s, r) => s + r.cf * r.p, 0), [probRows2]);
  const eVanProb = calculateNPV([eCF1, eCF2], rateProb / 100, invProb);
  const varCF1 = useMemo(() => probRows.reduce((s, r) => s + r.p * Math.pow(r.cf - eCF1, 2), 0), [probRows, eCF1]);
  const varCF2 = useMemo(() => probRows2.reduce((s, r) => s + r.p * Math.pow(r.cf - eCF2, 2), 0), [probRows2, eCF2]);
  const k2 = rateProb / 100;
  const varVanProb = varCF1 / Math.pow(1 + k2, 2) + varCF2 / Math.pow(1 + k2, 4);
  const sigVanProb = Math.sqrt(varVanProb);

  // ── TAB 3 — RADR ─────────────────────────────────────────────────────────
  const [riskCFs, setRiskCFs] = useState([80000, 80000, 80000, 80000, 80000]);
  const [riskInv, setRiskInv] = useState(250000);
  const [riskFreeRate, setRiskFreeRate] = useState(8);
  const [riskPremium, setRiskPremium] = useState(4);
  const [penaltyYears, setPenaltyYears] = useState(2);
  const [alphas, setAlphas] = useState([0.9, 0.8, 0.6, 0.5, 0.5]);
  const nRisk = riskCFs.length;

  const rf = riskFreeRate / 100;
  const rp = riskPremium / 100;
  const k_radr = rf + rp;

  // 1) VAN sans risque (taux sans risque, sans ajustement)
  const vanSansRisque = useMemo(() => calculateNPV(riskCFs, rf, riskInv), [riskCFs, rf, riskInv]);
  // 2) RADR
  const vanRADR = useMemo(() => calculateRADR_NPV(riskCFs, rf, rp, riskInv), [riskCFs, rf, rp, riskInv]);
  // 3) Équivalent certain
  const vanEC = useMemo(() => calculateCertaintyEquivalentNPV(riskCFs, alphas, rf, riskInv), [riskCFs, alphas, rf, riskInv]);
  // 4) Réduction de durée
  const vanRD = useMemo(() => calculateReducedDurationNPV(riskCFs, rf, penaltyYears, riskInv), [riskCFs, rf, penaltyYears, riskInv]);

  const penaliteRADR = vanSansRisque - vanRADR;
  const penaliteEC = vanSansRisque - vanEC;
  const penaliteRD = vanSansRisque - vanRD;

  // Details per year for EC table
  const ecDetails = riskCFs.map((cf, t) => {
    const alpha = alphas[t] ?? 1;
    const cfCertain = alpha * cf;
    const pv_risque = cf / Math.pow(1 + rf, t + 1);
    const pv_certain = cfCertain / Math.pow(1 + rf, t + 1);
    const pv_radr = cf / Math.pow(1 + k_radr, t + 1);
    return { t: t + 1, cf, alpha, cfCertain, pv_risque, pv_certain, pv_radr };
  });

  const updateRiskCF = (i: number, val: string) => {
    const c = [...riskCFs]; c[i] = parseFloat(val) || 0; setRiskCFs(c);
  };
  const updateAlpha = (i: number, val: string) => {
    const a = [...alphas]; a[i] = Math.min(1, Math.max(0, parseFloat(val) || 0)); setAlphas(a);
  };
  const setRiskYears = (n: number) => {
    const t = Math.max(1, Math.min(15, n));
    setRiskCFs(Array.from({ length: t }, (_, i) => riskCFs[i] ?? 80000));
    setAlphas(Array.from({ length: t }, (_, i) => alphas[i] ?? 0.5));
  };

  const methodResults = [
    { label: "Sans Risque (k = i)", van: vanSansRisque, penalite: 0, color: "text-muted-foreground", bgColor: "bg-muted/20", badge: "Référence" },
    { label: `RADR (k = i + ρ = ${formatPct(k_radr)})`, van: vanRADR, penalite: penaliteRADR, color: vanRADR >= 0 ? "text-primary" : "text-destructive", bgColor: vanRADR >= 0 ? "bg-primary/5" : "bg-destructive/5", badge: vanRADR >= 0 ? "Acceptable" : "Rejeté" },
    { label: `Équivalent Certain (α₁=${alphas[0]?.toFixed(1)})`, van: vanEC, penalite: penaliteEC, color: vanEC >= 0 ? "text-blue-400" : "text-destructive", bgColor: vanEC >= 0 ? "bg-blue-500/5" : "bg-destructive/5", badge: vanEC >= 0 ? "Acceptable" : "Rejeté" },
    { label: `Réduction de Durée (n − ${penaltyYears} ans)`, van: vanRD, penalite: penaliteRD, color: vanRD >= 0 ? "text-accent" : "text-destructive", bgColor: vanRD >= 0 ? "bg-accent/5" : "bg-destructive/5", badge: vanRD >= 0 ? "Acceptable" : "Rejeté" },
  ];

  const comparisonChartData = methodResults.map(m => ({
    name: m.label.split(" (")[0],
    van: Math.round(m.van),
    penalite: Math.round(m.penalite),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Analyse Quantitative des Investissements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          VAN · TRI · TRIM · Comparaison de projets · Risque sous incertitude · RADR · Équivalent Certain · Réduction de durée
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === i ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB 0 : Comparaison de projets ─────────────────────────────────── */}
      {activeTab === 0 && (
        <motion.div key="t0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Paramètres Communs</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="space-y-1.5">
                  <Label className="text-xs">Taux d'actualisation k (%)</Label>
                  <Input type="number" value={discountRate} onChange={e => setDiscountRate(parseFloat(e.target.value) || 0)} className="h-8 w-32" />
                </div>
                <div className="p-3 bg-muted/30 rounded-md text-xs text-muted-foreground flex items-start gap-2 max-w-lg">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Pour comparer des projets de durées différentes, on les duplique jusqu'au PPCM de leurs durées puis on compare leurs VAN sur l'horizon commun — ou on utilise l'annuité équivalente.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            {([
              { proj: projectA, setProj: setProjectA, k: "a" as const, res: resA, border: "border-primary/30", color: "text-primary" },
              { proj: projectB, setProj: setProjectB, k: "b" as const, res: resB, border: "border-accent/30", color: "text-accent" },
            ]).map(({ proj, setProj, k, res, border, color }) => (
              <Card key={k} className={`border-2 ${border}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Input value={proj.name} onChange={e => setProj(p => ({ ...p, name: e.target.value }))} className="h-7 text-sm font-bold w-36" />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>n =</span>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs" onClick={() => setProjectYears(k, proj.years - 1)}>-</Button>
                      <span className="w-5 text-center">{proj.years}</span>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs" onClick={() => setProjectYears(k, proj.years + 1)}>+</Button>
                      <span>ans</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">I₀ (DZD)</Label>
                    <Input type="number" value={proj.investment} onChange={e => setProj(p => ({ ...p, investment: parseFloat(e.target.value) || 0 }))} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">Cash-flows annuels</Label>
                    <div className="space-y-1">
                      {proj.cfs.map((cf, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-7">A{i + 1}</span>
                          <Input type="number" value={cf} onChange={e => updateCF(k, i, e.target.value)} className="h-7 text-xs font-mono" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-xs text-muted-foreground">VAN</p><p className={`text-lg font-bold ${res.npv >= 0 ? color : "text-destructive"}`}>{formatMillions(res.npv)}</p></div>
                    <div><p className="text-xs text-muted-foreground">TRI</p><p className={`text-lg font-bold ${color}`}>{res.irr !== null ? formatPct(res.irr) : "N/A"}</p></div>
                    <div className="col-span-2 bg-muted/30 rounded p-2">
                      <p className="text-xs text-muted-foreground">Annuité Équivalente</p>
                      <p className={`text-xl font-black ${color}`}>{formatMillions(res.ae)} DZD/an</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">VAN & Annuité Équivalente</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={aeChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatMillions(v)} />
                  <Tooltip formatter={(v: number, name: string) => [formatMillions(v), name === "ae" ? "Annuité Éq." : "VAN"]} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Bar dataKey="npv" name="VAN" fill="hsl(var(--primary))" opacity={0.5} radius={[3,3,0,0]} />
                  <Bar dataKey="ae" name="Annuité Éq." fill="hsl(var(--accent))" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className={`border-2 ${resA.ae >= resB.ae ? "border-primary/40" : "border-accent/40"}`}>
            <CardContent className="pt-5">
              <div className="flex items-start gap-4">
                <CheckCircle2 className={`h-6 w-6 shrink-0 mt-0.5 ${winnerColor}`} />
                <div className="space-y-2">
                  <p className="font-bold text-lg">Décision : <span className={winnerColor}>{winner}</span> est préféré</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Annuité équivalente :</strong> {projectA.name} → {formatMillions(resA.ae)} · {projectB.name} → {formatMillions(resB.ae)} DZD/an</p>
                    <p><strong>Horizon PPCM ({commonHorizon} ans) :</strong> {projectA.name} ×{timesA} → VAN = {formatMillions(npvRepA)} · {projectB.name} ×{timesB} → VAN = {formatMillions(npvRepB)}</p>
                    <p className="text-xs">Les deux méthodes convergent. L'annuité équivalente est recommandée pour sa simplicité.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 1 : Analyse sous incertitude ────────────────────────────────── */}
      {activeTab === 1 && (
        <motion.div key="t1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Analyse VAN sous Incertitude</CardTitle>
              <CardDescription>E(VAN) = Σ Pᵢ × VANᵢ · σ(VAN) = √(Σ Pᵢ × (VANᵢ − E(VAN))²)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <div className="space-y-1.5">
                  <Label className="text-xs">I₀ (DZD)</Label>
                  <Input type="number" value={inv2} onChange={e => setInv2(parseFloat(e.target.value) || 0)} className="h-8 w-36" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Taux sans risque k (%)</Label>
                  <Input type="number" value={rate2} onChange={e => setRate2(parseFloat(e.target.value) || 0)} className="h-8 w-28" />
                </div>
                {Math.abs(totalProb - 1) > 0.01 && (
                  <div className="flex items-center gap-2 text-destructive text-xs self-end mb-1">
                    <AlertTriangle className="h-4 w-4" /> Σ probabilités = {totalProb.toFixed(2)} ≠ 1
                  </div>
                )}
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {["Hypothèse","Pᵢ","CF A1","CF A2","VANᵢ","Pᵢ × VANᵢ"].map(h => (
                      <th key={h} className="text-right first:text-left py-2 px-3 text-xs text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {scenNpvs.map((s, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium text-sm">{s.label}</td>
                      <td className="py-1 px-3"><Input type="number" step="0.05" value={scenarios2[i].probability} onChange={e => { const sc=[...scenarios2]; sc[i]={...sc[i],probability:parseFloat(e.target.value)||0}; setScenarios2(sc); }} className="h-7 text-xs text-right w-20 ml-auto" /></td>
                      <td className="py-1 px-3"><Input type="number" value={scenarios2[i].cf1} onChange={e => { const sc=[...scenarios2]; sc[i]={...sc[i],cf1:parseFloat(e.target.value)||0}; setScenarios2(sc); }} className="h-7 text-xs text-right w-28 ml-auto" /></td>
                      <td className="py-1 px-3"><Input type="number" value={scenarios2[i].cf2} onChange={e => { const sc=[...scenarios2]; sc[i]={...sc[i],cf2:parseFloat(e.target.value)||0}; setScenarios2(sc); }} className="h-7 text-xs text-right w-28 ml-auto" /></td>
                      <td className={`py-2 px-3 text-right font-mono font-bold ${s.npv>=0?"text-primary":"text-destructive"}`}>{formatMillions(s.npv)}</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">{formatMillions(s.probability*s.npv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "E(VAN)", value: formatMillions(eNpv2), sub: eNpv2>=0?"✓ Rentable en espérance":"✗ Espérance négative", color: eNpv2>=0?"text-primary":"text-destructive" },
                  { label: "σ(VAN) — Risque", value: formatMillions(sig2), sub: "Écart-type de la VAN", color: "text-accent" },
                  { label: "σ²(VAN) — Variance", value: formatMillions(var2), sub: "Dispersion des VAN", color: "text-foreground" },
                  { label: "Coeff. Variation", value: isFinite(cv2)?cv2.toFixed(3):"∞", sub: cv2<=0.9?"✓ CV ≤ 0.9 → Acceptable":"✗ CV > 0.9 → Risque élevé", color: cv2<=0.9?"text-primary":"text-destructive" },
                ].map((m,i) => (
                  <div key={i} className="p-4 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{m.label}</p>
                    <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
                    <p className="text-xs mt-1 text-muted-foreground">{m.sub}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 2 : Distributions de probabilités ───────────────────────────── */}
      {activeTab === 2 && (
        <motion.div key="t2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flux Indépendants — Distribution Discrète</CardTitle>
              <CardDescription>E(VAN) = Σ E(CFₜ)/(1+k)ᵗ − I₀ · σ²(VAN) = Σ σ²(CFₜ)/(1+k)²ᵗ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex gap-4 flex-wrap">
                <div className="space-y-1.5"><Label className="text-xs">I₀ (DZD)</Label><Input type="number" value={invProb} onChange={e=>setInvProb(parseFloat(e.target.value)||0)} className="h-8 w-36"/></div>
                <div className="space-y-1.5"><Label className="text-xs">Taux (%)</Label><Input type="number" value={rateProb} onChange={e=>setRateProb(parseFloat(e.target.value)||0)} className="h-8 w-28"/></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {[
                  { label:"Période 1", rows:probRows, setRows:setProbRows, eCF:eCF1, varCF:varCF1 },
                  { label:"Période 2", rows:probRows2, setRows:setProbRows2, eCF:eCF2, varCF:varCF2 },
                ].map(({ label, rows, setRows, eCF, varCF }) => (
                  <div key={label} className="space-y-2">
                    <h4 className="text-sm font-semibold">{label}</h4>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border">
                        <th className="text-left py-1 px-2 text-xs text-muted-foreground">CF</th>
                        <th className="text-right py-1 px-2 text-xs text-muted-foreground">Pᵢ</th>
                        <th className="text-right py-1 px-2 text-xs text-muted-foreground">Pᵢ × CFᵢ</th>
                      </tr></thead>
                      <tbody className="divide-y divide-border/50">
                        {rows.map((r,i) => (
                          <tr key={i}>
                            <td className="py-1 px-2"><Input type="number" value={r.cf} onChange={e=>{const nr=[...rows];nr[i]={...nr[i],cf:parseFloat(e.target.value)||0};setRows(nr);}} className="h-6 text-xs font-mono"/></td>
                            <td className="py-1 px-2"><Input type="number" step="0.05" value={r.p} onChange={e=>{const nr=[...rows];nr[i]={...nr[i],p:parseFloat(e.target.value)||0};setRows(nr);}} className="h-6 text-xs text-right"/></td>
                            <td className="py-1 px-2 text-right text-xs font-mono text-muted-foreground">{formatMillions(r.cf*r.p)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex gap-4 p-2 bg-muted/30 rounded text-xs">
                      <span><strong>E(CF) = </strong>{formatMillions(eCF)}</span>
                      <span><strong>σ²(CF) = </strong>{formatMillions(varCF)}</span>
                      <span><strong>σ(CF) = </strong>{formatMillions(Math.sqrt(varCF))}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="text-xs h-6" onClick={()=>setRows(r=>[...r,{cf:15000,p:0.1}])}>+ Ajouter</Button>
                      {rows.length>1 && <Button variant="outline" size="sm" className="text-xs h-6" onClick={()=>setRows(r=>r.slice(0,-1))}>- Supprimer</Button>}
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label:"E(VAN)", value:formatMillions(eVanProb), color: eVanProb>=0?"text-primary":"text-destructive" },
                  { label:"σ(VAN)", value:formatMillions(sigVanProb), color:"text-accent" },
                  { label:"σ²(VAN)", value:formatMillions(varVanProb), color:"text-foreground" },
                  { label:"Décision", value: eVanProb>=0?"Acceptable":"À rejeter", color: eVanProb>=0?"text-primary":"text-destructive" },
                ].map((m,i) => (
                  <div key={i} className="p-4 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                    <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 p-3 rounded-md bg-muted/30 border border-border text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Pour des flux <strong>indépendants</strong> : σ²(VAN) = Σ σ²(CFₜ)/(1+k)²ᵗ. Pour des flux <strong>totalement dépendants</strong> : σ(VAN) = Σ σ(CFₜ)/(1+k)ᵗ (risque plus élevé). La probabilité P(VAN ≤ 0) = P(Z ≤ −E(VAN)/σ(VAN)) si distribution normale.</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 3 : Gestion du risque — RADR ────────────────────────────────── */}
      {activeTab === 3 && (
        <motion.div key="t3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Paramètres */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Méthodes d'Ajustement au Risque — Comparaison des 3 Approches
              </CardTitle>
              <CardDescription>
                Méthode du Taux Ajusté (RADR) · Équivalent Certain (αt) · Réduction de la Durée — comparées sur le même projet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">I₀ — Investissement (DZD)</Label>
                  <Input type="number" value={riskInv} onChange={e => setRiskInv(parseFloat(e.target.value)||0)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Taux sans risque i (%)</Label>
                  <Input type="number" value={riskFreeRate} onChange={e => setRiskFreeRate(parseFloat(e.target.value)||0)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prime de risque ρ (%)</Label>
                  <Input type="number" value={riskPremium} onChange={e => setRiskPremium(parseFloat(e.target.value)||0)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pénalité durée (années)</Label>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setPenaltyYears(p => Math.max(0, p-1))}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center font-bold">{penaltyYears}</span>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setPenaltyYears(p => Math.min(nRisk-1, p+1))}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Durée du projet :</span>
                <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs" onClick={() => setRiskYears(nRisk - 1)}>-</Button>
                <span className="w-6 text-center text-sm font-bold">{nRisk}</span>
                <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs" onClick={() => setRiskYears(nRisk + 1)}>+</Button>
                <span className="text-xs text-muted-foreground">ans</span>
                <span className="ml-4 text-xs bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 font-mono">
                  k (RADR) = {riskFreeRate}% + {riskPremium}% = {(k_radr * 100).toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Tableau des CF + coefficients αt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Cash-Flows & Coefficients d'Ajustement (αt)</CardTitle>
              <CardDescription>Les αt ∈ [0,1] convertissent des flux risqués en équivalents certains — plus la période est lointaine, plus αt est faible</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Paramètre</th>
                      {riskCFs.map((_, i) => <th key={i} className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">A{i+1}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    <tr>
                      <td className="py-2 px-3 text-xs text-muted-foreground">CFt (DZD)</td>
                      {riskCFs.map((cf, i) => (
                        <td key={i} className="py-1 px-2">
                          <Input type="number" value={cf} onChange={e => updateRiskCF(i, e.target.value)} className="h-7 text-xs text-right w-28 ml-auto font-mono" />
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-muted/10">
                      <td className="py-2 px-3 text-xs text-muted-foreground">Coeff. αt ∈ [0,1]</td>
                      {alphas.slice(0, nRisk).map((a, i) => (
                        <td key={i} className="py-1 px-2">
                          <Input type="number" step="0.05" min="0" max="1" value={a} onChange={e => updateAlpha(i, e.target.value)} className="h-7 text-xs text-right w-20 ml-auto" />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-xs text-muted-foreground">CFt × αt (certain)</td>
                      {ecDetails.map(d => (
                        <td key={d.t} className="py-2 px-3 text-right font-mono text-xs text-blue-400">{formatMillions(d.cfCertain)}</td>
                      ))}
                    </tr>
                    <tr className="bg-primary/5">
                      <td className="py-2 px-3 text-xs font-medium text-primary">PV (RADR, k={formatPct(k_radr)})</td>
                      {ecDetails.map(d => (
                        <td key={d.t} className="py-2 px-3 text-right font-mono text-xs text-primary">{formatMillions(d.pv_radr)}</td>
                      ))}
                    </tr>
                    <tr className="bg-blue-500/5">
                      <td className="py-2 px-3 text-xs font-medium text-blue-400">PV Éq. Certain (taux i)</td>
                      {ecDetails.map(d => (
                        <td key={d.t} className="py-2 px-3 text-right font-mono text-xs text-blue-400">{formatMillions(d.pv_certain)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Résultats comparatifs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {methodResults.map((m, i) => (
              <motion.div key={i} initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} transition={{ delay: i*0.07 }}
                className={`p-4 rounded-lg border border-border ${m.bgColor} space-y-2`}>
                <p className="text-xs text-muted-foreground font-medium leading-tight">{m.label}</p>
                <p className={`text-2xl font-black ${m.color}`}>{formatMillions(m.van)}</p>
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className={`text-xs ${m.van>=0 ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>{m.badge}</Badge>
                  {m.penalite > 0 && <span className="text-xs text-muted-foreground">Pén. {formatMillions(m.penalite)}</span>}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Comparaison des VAN par Méthode de Traitement du Risque</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={comparisonChartData} margin={{ top:5, right:20, bottom:5, left:10 }}>
                  <XAxis dataKey="name" tick={{ fontSize:11 }} />
                  <YAxis tick={{ fontSize:10 }} tickFormatter={v => formatMillions(v)} />
                  <Tooltip formatter={(v:number, name:string) => [formatMillions(v), name==="van" ? "VAN" : "Pénalité"]} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />
                  <Bar dataKey="van" name="VAN" radius={[3,3,0,0]}>
                    {comparisonChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.van >= 0 ? ["hsl(var(--muted-foreground))","hsl(var(--primary))","hsl(200,80%,60%)","hsl(var(--accent))"][i] : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Explications académiques */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "1. Taux Ajusté au Risque (RADR)",
                color: "border-primary/30",
                formula: "k = i + ρ",
                formulas: [`k = ${riskFreeRate}% + ${riskPremium}% = ${(k_radr*100).toFixed(1)}%`, `VAN = −I₀ + Σ CFₜ/(1+k)ᵗ`, `VAN = ${formatMillions(vanRADR)} DZD`],
                desc: "On ajoute une prime de risque ρ au taux sans risque. Plus le projet est risqué, plus ρ est élevé. Limite : l'ajustement est subjectif.",
                verdict: vanRADR >= 0,
              },
              {
                title: "2. Méthode de l'Équivalent Certain",
                color: "border-blue-500/30",
                formula: "VAN = −I₀ + Σ αt×CFt/(1+i)ᵗ",
                formulas: [`αt ∈ [0,1] — coefficients par période`, `Taux sans risque i = ${riskFreeRate}%`, `VAN = ${formatMillions(vanEC)} DZD`],
                desc: "On transforme les flux risqués en équivalents certains via αt. On actualise au taux sans risque. Limite : détermination des αt difficile.",
                verdict: vanEC >= 0,
              },
              {
                title: "3. Réduction de la Durée",
                color: "border-accent/30",
                formula: `VAN calculée sur n − ${penaltyYears} ans`,
                formulas: [`Durée initiale n = ${nRisk} ans`, `Pénalité = ${penaltyYears} dernières années`, `VAN = ${formatMillions(vanRD)} DZD`],
                desc: "On élimine les x dernières années (les plus risquées). On actualise au taux sans risque. Limite : très arbitraire, peut pénaliser les projets à retours tardifs.",
                verdict: vanRD >= 0,
              },
            ].map((m, i) => (
              <Card key={i} className={`border ${m.color}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{m.title}</CardTitle>
                  <code className="text-xs bg-muted/40 px-2 py-0.5 rounded font-mono">{m.formula}</code>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-1">
                    {m.formulas.map((f,j) => <p key={j} className="text-xs font-mono text-muted-foreground">{f}</p>)}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                  <Badge variant="outline" className={m.verdict ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                    {m.verdict ? "✓ Projet acceptable" : "✗ Projet rejeté"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/30 border border-border text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Comparaison des méthodes :</strong> Si le RADR et l'équivalent certain conduisent à la même décision, le résultat est robuste. La pénalité de l'équivalent certain ({formatMillions(penaliteEC)} DZD) vs RADR ({formatMillions(penaliteRADR)} DZD) représente la valeur attribuée au risque par chaque approche. Sur le plan théorique, l'équivalent certain est plus rigoureux car il sépare explicitement l'ajustement risque (αt) du taux d'actualisation (i).
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
