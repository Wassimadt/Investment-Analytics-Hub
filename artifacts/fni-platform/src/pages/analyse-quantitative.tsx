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
import { Calculator, BarChart3, TrendingUp, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

function lcm(a: number, b: number): number {
  const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y);
  return (a * b) / gcd(a, b);
}

function replicateProject(cashFlows: number[], investment: number, times: number): { cfs: number[], inv: number } {
  if (times <= 1) return { cfs: cashFlows, inv: investment };
  const n = cashFlows.length;
  const totalN = n * times;
  const result: number[] = new Array(totalN).fill(0);
  for (let r = 0; r < times; r++) {
    const offset = r * n;
    cashFlows.forEach((cf, i) => {
      if (r > 0 && i === 0) {
        result[offset] = (result[offset] || 0) + cf - investment;
      } else {
        result[offset + i] = (result[offset + i] || 0) + cf;
      }
    });
  }
  return { cfs: result, inv: investment };
}

const TABS = ["Comparaison de Projets", "Analyse sous Incertitude", "Méthode des Probabilités"];

export default function AnalyseQuantitative() {
  const [activeTab, setActiveTab] = useState(0);

  const [discountRate, setDiscountRate] = useState(10);
  const [projectA, setProjectA] = useState({ name: "Projet A", investment: 100000, years: 4, cfs: [30000, 35000, 40000, 38000] });
  const [projectB, setProjectB] = useState({ name: "Projet B", investment: 80000, years: 6, cfs: [20000, 22000, 25000, 27000, 28000, 26000] });

  const rate = discountRate / 100;

  const computeProject = (p: typeof projectA) => {
    const npv = calculateNPV(p.cfs, rate, p.investment);
    const irr = calculateIRR(p.cfs, p.investment);
    const ae = calculateEquivalentAnnuity(npv, rate, p.years);
    const commonN = lcm(p.years, 1);
    return { npv, irr, ae };
  };

  const resA = useMemo(() => computeProject(projectA), [projectA, rate]);
  const resB = useMemo(() => computeProject(projectB), [projectB, rate]);

  const commonHorizon = useMemo(() => {
    const l = lcm(projectA.years, projectB.years);
    return Math.min(l, 30);
  }, [projectA.years, projectB.years]);

  const timesA = Math.round(commonHorizon / projectA.years);
  const timesB = Math.round(commonHorizon / projectB.years);

  const repA = useMemo(() => replicateProject(projectA.cfs, projectA.investment, timesA), [projectA, timesA]);
  const repB = useMemo(() => replicateProject(projectB.cfs, projectB.investment, timesB), [projectB, timesB]);
  const npvRepA = useMemo(() => calculateNPV(repA.cfs, rate, repA.inv), [repA, rate]);
  const npvRepB = useMemo(() => calculateNPV(repB.cfs, rate, repB.inv), [repB, rate]);

  const winner = resA.ae > resB.ae ? projectA.name : projectB.name;
  const winnerColor = resA.ae > resB.ae ? "text-primary" : "text-accent";

  const updateCF = (proj: "a" | "b", i: number, val: string) => {
    const v = parseFloat(val) || 0;
    if (proj === "a") {
      const cfs = [...projectA.cfs];
      cfs[i] = v;
      setProjectA(p => ({ ...p, cfs }));
    } else {
      const cfs = [...projectB.cfs];
      cfs[i] = v;
      setProjectB(p => ({ ...p, cfs }));
    }
  };

  const setProjectYears = (proj: "a" | "b", n: number) => {
    const target = Math.max(1, Math.min(15, n));
    if (proj === "a") {
      const cfs = Array.from({ length: target }, (_, i) => projectA.cfs[i] ?? 20000);
      setProjectA(p => ({ ...p, years: target, cfs }));
    } else {
      const cfs = Array.from({ length: target }, (_, i) => projectB.cfs[i] ?? 20000);
      setProjectB(p => ({ ...p, years: target, cfs }));
    }
  };

  // Tab 2 - Uncertainty
  const [scenarios2, setScenarios2] = useState([
    { label: "Pessimiste", probability: 0.25, cf1: 15000, cf2: 12000 },
    { label: "Moyen", probability: 0.50, cf1: 25000, cf2: 22000 },
    { label: "Optimiste", probability: 0.25, cf1: 35000, cf2: 32000 },
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
  const probValid = Math.abs(totalProb - 1) < 0.01;

  // Tab 3 - Probability (E(CF))
  const [probRows, setProbRows] = useState([
    { cf: 16000, p: 0.2 },
    { cf: 20000, p: 0.6 },
    { cf: 24000, p: 0.2 },
  ]);
  const [probRows2, setProbRows2] = useState([
    { cf: 13000, p: 0.3 },
    { cf: 15000, p: 0.4 },
    { cf: 17000, p: 0.3 },
  ]);
  const [invProb, setInvProb] = useState(25000);
  const [rateProb, setRateProb] = useState(10);

  const eCF1 = useMemo(() => probRows.reduce((s, r) => s + r.cf * r.p, 0), [probRows]);
  const eCF2 = useMemo(() => probRows2.reduce((s, r) => s + r.cf * r.p, 0), [probRows2]);
  const eVanProb = calculateNPV([eCF1, eCF2], rateProb / 100, invProb);

  const varCF1 = useMemo(() => probRows.reduce((s, r) => s + r.p * Math.pow(r.cf - eCF1, 2), 0), [probRows, eCF1]);
  const varCF2 = useMemo(() => probRows2.reduce((s, r) => s + r.p * Math.pow(r.cf - eCF2, 2), 0), [probRows2, eCF2]);
  const varVanProb = varCF1 / Math.pow(1 + rateProb / 100, 2) + varCF2 / Math.pow(1 + rateProb / 100, 4);
  const sigVanProb = Math.sqrt(varVanProb);

  const aeChartData = [
    { name: projectA.name, ae: Math.round(resA.ae), npv: Math.round(resA.npv) },
    { name: projectB.name, ae: Math.round(resB.ae), npv: Math.round(resB.npv) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Analyse Quantitative des Investissements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Outils de décision : VAN, TRI, comparaison, probabilités — fondés sur les critères académiques de choix d'investissement
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        {TABS.map((t, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === i ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab 1 - Comparaison */}
      {activeTab === 0 && (
        <motion.div key="tab0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Paramètres Communs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="space-y-1.5">
                  <Label className="text-xs">Taux d'actualisation k (%)</Label>
                  <Input type="number" value={discountRate} onChange={e => setDiscountRate(parseFloat(e.target.value) || 0)} className="h-8 w-32" />
                </div>
                <div className="p-3 bg-muted/30 rounded-md text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Pour comparer des projets de durées différentes, on duplique chacun jusqu'au PPCM (Plus Petit Commun Multiple) de leurs durées, puis on compare leurs VAN sur cet horizon commun — ou on utilise l'annuité équivalente.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            {[
              { proj: projectA, setProj: setProjectA, key: "a" as const, res: resA, color: "text-primary", borderColor: "border-primary/30" },
              { proj: projectB, setProj: setProjectB, key: "b" as const, res: resB, color: "text-accent", borderColor: "border-accent/30" },
            ].map(({ proj, setProj, key, res, color, borderColor }) => (
              <Card key={key} className={`border-2 ${borderColor}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Input value={proj.name} onChange={e => setProj(p => ({ ...p, name: e.target.value }))} className="h-7 text-sm font-bold w-36" />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>Durée:</span>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs" onClick={() => setProjectYears(key, proj.years - 1)}>-</Button>
                      <span className="w-6 text-center">{proj.years}</span>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs" onClick={() => setProjectYears(key, proj.years + 1)}>+</Button>
                      <span>ans</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Investissement initial I₀ (DZD)</Label>
                    <Input type="number" value={proj.investment} onChange={e => setProj(p => ({ ...p, investment: parseFloat(e.target.value) || 0 }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">Cash-flows annuels (DZD)</Label>
                    <div className="space-y-1">
                      {proj.cfs.map((cf, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-8">A{i + 1}</span>
                          <Input type="number" value={cf} onChange={e => updateCF(key, i, e.target.value)} className="h-7 text-xs font-mono" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">VAN</p>
                      <p className={`text-lg font-bold ${res.npv >= 0 ? color : "text-destructive"}`}>{formatMillions(res.npv)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">TRI</p>
                      <p className={`text-lg font-bold ${color}`}>{res.irr !== null ? formatPct(res.irr) : "N/A"}</p>
                    </div>
                    <div className="col-span-2 bg-muted/30 rounded p-2">
                      <p className="text-xs text-muted-foreground">Annuité Équivalente</p>
                      <p className={`text-xl font-black ${color}`}>{formatMillions(res.ae)} DZD/an</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Comparaison VAN & Annuité Équivalente</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={aeChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatMillions(v)} />
                  <Tooltip formatter={(v: number, name: string) => [formatMillions(v), name === "ae" ? "Annuité Éq." : "VAN"]} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Bar dataKey="npv" name="VAN" fill="hsl(var(--primary))" opacity={0.5} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="ae" name="Annuité Éq." fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Verdict */}
          <Card className={`border-2 ${resA.ae >= resB.ae ? "border-primary/40" : "border-accent/40"}`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <CheckCircle2 className={`h-6 w-6 shrink-0 mt-0.5 ${winnerColor}`} />
                <div className="space-y-2">
                  <p className="font-bold text-lg">
                    Décision : <span className={winnerColor}>{winner}</span> est préféré
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Méthode de l'annuité équivalente :</strong> {projectA.name} → {formatMillions(resA.ae)} DZD/an · {projectB.name} → {formatMillions(resB.ae)} DZD/an</p>
                    <p><strong>Horizon commun PPCM ({commonHorizon} ans) :</strong> {projectA.name} repliqué ×{timesA} → VAN = {formatMillions(npvRepA)} · {projectB.name} repliqué ×{timesB} → VAN = {formatMillions(npvRepB)}</p>
                    <p className="text-xs">Les deux méthodes convergent vers le même choix. L'annuité équivalente est recommandée pour sa simplicité.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tab 2 - Uncertainty */}
      {activeTab === 1 && (
        <motion.div key="tab1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Analyse VAN sous Incertitude — Équivalent Certain</CardTitle>
              <CardDescription>
                Méthode : on calcule la VAN pour chaque hypothèse, puis E(VAN) = Σ Pᵢ × VANᵢ et σ(VAN) = √(Σ Pᵢ × (VANᵢ − E(VAN))²)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Investissement I₀ (DZD)</Label>
                  <Input type="number" value={inv2} onChange={e => setInv2(parseFloat(e.target.value) || 0)} className="h-8 w-36" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Taux sans risque k (%)</Label>
                  <Input type="number" value={rate2} onChange={e => setRate2(parseFloat(e.target.value) || 0)} className="h-8 w-28" />
                </div>
                {!probValid && (
                  <div className="flex items-center gap-2 text-destructive text-xs">
                    <AlertTriangle className="h-4 w-4" />
                    Les probabilités doivent sommer à 1 (total: {totalProb.toFixed(2)})
                  </div>
                )}
              </div>

              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Hypothèse</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Probabilité Pᵢ</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">CF Année 1</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">CF Année 2</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">VANᵢ</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Pᵢ × VANᵢ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {scenNpvs.map((s, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{s.label}</td>
                      <td className="py-1 px-3">
                        <Input type="number" step="0.05" value={scenarios2[i].probability} onChange={e => {
                          const sc = [...scenarios2];
                          sc[i] = { ...sc[i], probability: parseFloat(e.target.value) || 0 };
                          setScenarios2(sc);
                        }} className="h-7 text-xs text-right w-20 ml-auto" />
                      </td>
                      <td className="py-1 px-3">
                        <Input type="number" value={scenarios2[i].cf1} onChange={e => {
                          const sc = [...scenarios2];
                          sc[i] = { ...sc[i], cf1: parseFloat(e.target.value) || 0 };
                          setScenarios2(sc);
                        }} className="h-7 text-xs text-right w-28 ml-auto" />
                      </td>
                      <td className="py-1 px-3">
                        <Input type="number" value={scenarios2[i].cf2} onChange={e => {
                          const sc = [...scenarios2];
                          sc[i] = { ...sc[i], cf2: parseFloat(e.target.value) || 0 };
                          setScenarios2(sc);
                        }} className="h-7 text-xs text-right w-28 ml-auto" />
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-bold ${s.npv >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatMillions(s.npv)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {formatMillions(s.probability * s.npv)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">E(VAN)</p>
                  <p className={`text-2xl font-black ${eNpv2 >= 0 ? "text-primary" : "text-destructive"}`}>{formatMillions(eNpv2)}</p>
                  <p className="text-xs mt-1 text-muted-foreground">{eNpv2 >= 0 ? "✓ Projet rentable en espérance" : "✗ Espérance négative"}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">σ(VAN) — Risque</p>
                  <p className="text-2xl font-black text-accent">{formatMillions(sig2)}</p>
                  <p className="text-xs mt-1 text-muted-foreground">Écart-type de la VAN</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">σ²(VAN) — Variance</p>
                  <p className="text-2xl font-black text-foreground">{formatMillions(var2)}</p>
                  <p className="text-xs mt-1 text-muted-foreground">Variance de la distribution</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Coeff. Variation</p>
                  <p className={`text-2xl font-black ${cv2 <= 0.9 ? "text-primary" : "text-destructive"}`}>
                    {isFinite(cv2) ? cv2.toFixed(3) : "∞"}
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground">{cv2 <= 0.9 ? "✓ Acceptable (≤ 0.9)" : "✗ Risque élevé (> 0.9)"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tab 3 - Probability distribution */}
      {activeTab === 2 && (
        <motion.div key="tab2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flux Indépendants — Distribution de Probabilités</CardTitle>
              <CardDescription>
                Calcul de E(VAN) = Σ E(CFₜ)/(1+k)ᵗ − I₀ et σ²(VAN) = Σ σ²(CFₜ)/(1+k)²ᵗ pour flux indépendants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">I₀ (DZD)</Label>
                  <Input type="number" value={invProb} onChange={e => setInvProb(parseFloat(e.target.value) || 0)} className="h-8 w-36" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Taux d'actualisation (%)</Label>
                  <Input type="number" value={rateProb} onChange={e => setRateProb(parseFloat(e.target.value) || 0)} className="h-8 w-28" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {[
                  { label: "Période 1", rows: probRows, setRows: setProbRows, eCF: eCF1, varCF: varCF1 },
                  { label: "Période 2", rows: probRows2, setRows: setProbRows2, eCF: eCF2, varCF: varCF2 },
                ].map(({ label, rows, setRows, eCF, varCF }) => (
                  <div key={label} className="space-y-2">
                    <h4 className="text-sm font-semibold">{label}</h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-1 px-2 text-xs text-muted-foreground">CF (DZD)</th>
                          <th className="text-right py-1 px-2 text-xs text-muted-foreground">Pᵢ</th>
                          <th className="text-right py-1 px-2 text-xs text-muted-foreground">Pᵢ × CFᵢ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td className="py-1 px-2">
                              <Input type="number" value={r.cf} onChange={e => {
                                const nr = [...rows];
                                nr[i] = { ...nr[i], cf: parseFloat(e.target.value) || 0 };
                                setRows(nr);
                              }} className="h-6 text-xs font-mono" />
                            </td>
                            <td className="py-1 px-2">
                              <Input type="number" step="0.05" value={r.p} onChange={e => {
                                const nr = [...rows];
                                nr[i] = { ...nr[i], p: parseFloat(e.target.value) || 0 };
                                setRows(nr);
                              }} className="h-6 text-xs text-right" />
                            </td>
                            <td className="py-1 px-2 text-right text-xs font-mono text-muted-foreground">
                              {formatMillions(r.cf * r.p)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex gap-4 p-2 bg-muted/30 rounded text-xs">
                      <span><strong>E(CF) = </strong>{formatMillions(eCF)}</span>
                      <span><strong>σ²(CF) = </strong>{formatMillions(varCF)}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="text-xs h-6" onClick={() => setRows(r => [...r, { cf: 15000, p: 0.1 }])}>+ Ajouter</Button>
                      {rows.length > 1 && <Button variant="outline" size="sm" className="text-xs h-6" onClick={() => setRows(r => r.slice(0, -1))}>- Supprimer</Button>}
                    </div>
                  </div>
                ))}
              </div>

              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">E(VAN)</p>
                  <p className={`text-2xl font-black ${eVanProb >= 0 ? "text-primary" : "text-destructive"}`}>{formatMillions(eVanProb)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">σ(VAN) — Risque</p>
                  <p className="text-2xl font-black text-accent">{formatMillions(sigVanProb)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">σ²(VAN) — Variance</p>
                  <p className="text-2xl font-black text-foreground">{formatMillions(varVanProb)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Décision</p>
                  <p className={`text-lg font-black ${eVanProb >= 0 ? "text-primary" : "text-destructive"}`}>
                    {eVanProb >= 0 ? "Acceptable" : "À rejeter"}
                  </p>
                  <p className="text-xs text-muted-foreground">E(VAN) {eVanProb >= 0 ? "≥" : "<"} 0</p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-md bg-muted/30 border border-border text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Pour des flux indépendants : σ²(VAN) = Σ σ²(CFₜ)/(1+k)²ᵗ.
                  Si la distribution est approximativement normale, on peut calculer la probabilité que la VAN soit négative avec P(VAN ≤ 0) = P(Z ≤ -E(VAN)/σ(VAN)).
                  Un coefficient de variation σ/E(VAN) inférieur à 0.9 indique un risque acceptable.
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
