import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  calculateNPV, calculateIRR, calculateMIRR, calculateCAFRow,
  calculatePayback, calculateProfitabilityIndex, calculateEquivalentAnnuity,
  calculateExpectedNPV, calculateNPVVariance, coefficientOfVariation,
  formatPct, formatMillions
} from "@/lib/finance";
import { TrendingUp, AlertTriangle, CheckCircle2, Calculator, BarChart3, Plus, Minus, Info } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

interface YearRow {
  ca: number;
  charges: number;
}

interface Props {
  investmentAmount: number;
  irrEstimate?: number;
  durationYears?: number;
}

const SCENARIO_FACTORS = {
  pessimiste: { ca: 0.80, charges: 1.10, label: "Pessimiste", color: "text-destructive" },
  moyen: { ca: 1.00, charges: 1.00, label: "Moyen", color: "text-accent" },
  optimiste: { ca: 1.20, charges: 0.90, label: "Optimiste", color: "text-primary" },
};

export function ProjectFinancialAnalysis({ investmentAmount, irrEstimate, durationYears = 5 }: Props) {
  const defaultCA = investmentAmount * 0.3;
  const defaultCharges = defaultCA * 0.55;
  const defaultDuration = Math.max(3, Math.min(10, durationYears));

  const [rows, setRows] = useState<YearRow[]>(
    Array.from({ length: defaultDuration }, (_, i) => ({
      ca: Math.round(defaultCA * (1 + i * 0.08)),
      charges: Math.round(defaultCharges * (1 + i * 0.04)),
    }))
  );
  const [tauxActu, setTauxActu] = useState(10);
  const [tauxReinvest, setTauxReinvest] = useState(8);
  const [dap, setDap] = useState(Math.round(investmentAmount / (defaultDuration * 10)));
  const [taxRate, setTaxRate] = useState(25);
  const [valeurResiduelle, setValeurResiduelle] = useState(Math.round(investmentAmount * 0.1));
  const [bfr, setBfr] = useState(Math.round(investmentAmount * 0.05));
  const [showCafTable, setShowCafTable] = useState(true);

  const n = rows.length;
  const rate = tauxActu / 100;
  const reinvest = tauxReinvest / 100;

  const cafRows = useMemo(() =>
    rows.map(r => calculateCAFRow(r.ca, r.charges, dap, taxRate / 100)),
    [rows, dap, taxRate]
  );

  const cashFlows = useMemo(() =>
    cafRows.map((c, i) => c.caf + (i === n - 1 ? valeurResiduelle + bfr : 0)),
    [cafRows, valeurResiduelle, bfr, n]
  );

  const van = useMemo(() => calculateNPV(cashFlows, rate, investmentAmount + bfr), [cashFlows, rate, investmentAmount, bfr]);
  const tri = useMemo(() => calculateIRR(cashFlows, investmentAmount + bfr), [cashFlows, investmentAmount, bfr]);
  const trim = useMemo(() => calculateMIRR(cashFlows, rate, reinvest, investmentAmount + bfr), [cashFlows, rate, reinvest, investmentAmount, bfr]);
  const payback = useMemo(() => calculatePayback(cashFlows, investmentAmount + bfr), [cashFlows, investmentAmount, bfr]);
  const pi = useMemo(() => calculateProfitabilityIndex(van, investmentAmount + bfr), [van, investmentAmount, bfr]);
  const annuiteEq = useMemo(() => calculateEquivalentAnnuity(van, rate, n), [van, rate, n]);

  const scenarios = useMemo(() => {
    return (Object.entries(SCENARIO_FACTORS) as [string, typeof SCENARIO_FACTORS.moyen][]).map(([key, f]) => {
      const scenCfs = rows.map((r, i) => {
        const { caf } = calculateCAFRow(r.ca * f.ca, r.charges * f.charges, dap, taxRate / 100);
        return caf + (i === n - 1 ? valeurResiduelle + bfr : 0);
      });
      const scenNpv = calculateNPV(scenCfs, rate, investmentAmount + bfr);
      const scenTri = calculateIRR(scenCfs, investmentAmount + bfr);
      return { key, label: f.label, color: f.color, npv: scenNpv, tri: scenTri, probability: key === "pessimiste" ? 0.25 : key === "moyen" ? 0.50 : 0.25 };
    });
  }, [rows, dap, taxRate, rate, investmentAmount, valeurResiduelle, bfr, n]);

  const eNpv = useMemo(() => calculateExpectedNPV(scenarios), [scenarios]);
  const varNpv = useMemo(() => calculateNPVVariance(scenarios, eNpv), [scenarios, eNpv]);
  const sigNpv = Math.sqrt(varNpv);
  const cv = coefficientOfVariation(sigNpv, eNpv);

  const isAcceptable = van > 0 && (tri !== null ? tri > rate : true);

  const setYears = (y: number) => {
    const target = Math.max(1, Math.min(15, y));
    if (target > rows.length) {
      const last = rows[rows.length - 1];
      setRows([...rows, ...Array.from({ length: target - rows.length }, () => ({ ...last }))]);
    } else {
      setRows(rows.slice(0, target));
    }
  };

  const updateRow = (i: number, field: keyof YearRow, val: string) => {
    const newRows = [...rows];
    newRows[i] = { ...newRows[i], [field]: parseFloat(val) || 0 };
    setRows(newRows);
  };

  const cafChartData = cashFlows.map((cf, i) => ({ year: `A${i + 1}`, caf: Math.round(cf) }));
  const cumulChartData = (() => {
    let cumul = -(investmentAmount + bfr);
    return [{ year: "A0", cumul }, ...cashFlows.map((cf, i) => {
      cumul += cf;
      return { year: `A${i + 1}`, cumul: Math.round(cumul) };
    })];
  })();

  return (
    <div className="space-y-6">
      {/* Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-primary" />
            Paramètres d'Analyse Financière
          </CardTitle>
          <CardDescription>Ajustez le taux d'actualisation, la durée et les hypothèses fiscales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Durée (années)</Label>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setYears(n - 1)}><Minus className="h-3 w-3" /></Button>
                <span className="w-8 text-center font-bold">{n}</span>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setYears(n + 1)}><Plus className="h-3 w-3" /></Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Taux d'actualisation k (%)</Label>
              <Input type="number" value={tauxActu} onChange={e => setTauxActu(parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Taux de réinvestissement (%)</Label>
              <Input type="number" value={tauxReinvest} onChange={e => setTauxReinvest(parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">DAP annuelle (DZD)</Label>
              <Input type="number" value={dap} onChange={e => setDap(parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">IBS (%)</Label>
              <Input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">BFR initial (DZD)</Label>
              <Input type="number" value={bfr} onChange={e => setBfr(parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CAF Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Tableau des Cash-Flows Prévisionnels</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowCafTable(!showCafTable)} className="text-xs">
              {showCafTable ? "Réduire" : "Afficher"}
            </Button>
          </div>
          <CardDescription>Saisissez le CA et les charges décaissées — la CAF est calculée automatiquement</CardDescription>
        </CardHeader>
        {showCafTable && (
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Période</th>
                    {rows.map((_, i) => <th key={i} className="text-right py-2 px-2 text-muted-foreground font-medium text-xs">A{i + 1}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr>
                    <td className="py-2 px-3 text-xs text-muted-foreground">CA prévisionnel</td>
                    {rows.map((r, i) => (
                      <td key={i} className="py-1 px-2">
                        <Input type="number" value={r.ca} onChange={e => updateRow(i, "ca", e.target.value)} className="h-7 text-xs text-right font-mono w-28 ml-auto" />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-xs text-muted-foreground">— Charges décaissées</td>
                    {rows.map((r, i) => (
                      <td key={i} className="py-1 px-2">
                        <Input type="number" value={r.charges} onChange={e => updateRow(i, "charges", e.target.value)} className="h-7 text-xs text-right font-mono w-28 ml-auto" />
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-muted/20">
                    <td className="py-2 px-3 text-xs text-muted-foreground">— DAP</td>
                    {rows.map((_, i) => <td key={i} className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">{formatMillions(dap)}</td>)}
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-xs text-muted-foreground">= Résultat avant impôt</td>
                    {cafRows.map((c, i) => (
                      <td key={i} className={`py-2 px-3 text-right font-mono text-xs font-medium ${c.resultatAvantImpot >= 0 ? "" : "text-destructive"}`}>
                        {formatMillions(c.resultatAvantImpot)}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-muted/20">
                    <td className="py-2 px-3 text-xs text-muted-foreground">— IBS {taxRate}%</td>
                    {cafRows.map((c, i) => <td key={i} className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">{formatMillions(c.impot)}</td>)}
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-xs font-medium">Résultat net</td>
                    {cafRows.map((c, i) => (
                      <td key={i} className={`py-2 px-3 text-right font-mono text-xs font-medium ${c.resultatNet >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatMillions(c.resultatNet)}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-muted/20">
                    <td className="py-2 px-3 text-xs text-muted-foreground">+ DAP</td>
                    {rows.map((_, i) => <td key={i} className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">{formatMillions(dap)}</td>)}
                  </tr>
                  <tr className="border-t-2 border-primary/30 bg-primary/5">
                    <td className="py-2 px-3 text-xs font-bold text-primary">CAF (Flux Net)</td>
                    {cafRows.map((c, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-xs font-bold text-primary">
                        {formatMillions(cashFlows[i])}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-xs text-muted-foreground">dont VR / BFR récupéré</td>
                    {rows.map((_, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-xs text-muted-foreground">
                        {i === n - 1 ? `+${formatMillions(valeurResiduelle + bfr)}` : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex gap-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Valeur résiduelle actifs (DZD)</Label>
                <Input type="number" value={valeurResiduelle} onChange={e => setValeurResiduelle(parseFloat(e.target.value) || 0)} className="h-8 text-sm w-40" />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cash-Flows Annuels</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={cafChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatMillions(v)} />
                <Tooltip formatter={(v: number) => [formatMillions(v), "CAF"]} />
                <Bar dataKey="caf" radius={[3, 3, 0, 0]}>
                  {cafChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.caf >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cumul de Trésorerie (Récupération)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={cumulChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatMillions(v)} />
                <Tooltip formatter={(v: number) => [formatMillions(v), "Cumul"]} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />
                <Bar dataKey="cumul" radius={[3, 3, 0, 0]}>
                  {cumulChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.cumul >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Critères de décision */}
      <Card className={`border-2 ${isAcceptable ? "border-primary/40" : "border-destructive/40"}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {isAcceptable
              ? <CheckCircle2 className="h-5 w-5 text-primary" />
              : <AlertTriangle className="h-5 w-5 text-destructive" />}
            Critères de Choix d'Investissement
          </CardTitle>
          <CardDescription>
            I₀ = {formatMillions(investmentAmount + bfr)} DZD · k = {tauxActu}% · n = {n} ans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-lg bg-muted/30 border border-border space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">VAN (Valeur Actuelle Nette)</p>
              <p className={`text-2xl font-black ${van >= 0 ? "text-primary" : "text-destructive"}`}>{formatMillions(van)} DZD</p>
              <p className="text-xs text-muted-foreground">{van >= 0 ? "✓ VAN ≥ 0 → Projet acceptable" : "✗ VAN < 0 → Projet à rejeter"}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }} className="p-4 rounded-lg bg-muted/30 border border-border space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">TRI (Taux de Rendement Interne)</p>
              <p className={`text-2xl font-black ${tri !== null && tri > rate ? "text-accent" : "text-destructive"}`}>
                {tri !== null ? formatPct(tri) : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                {tri !== null ? (tri > rate ? `✓ TRI ${formatPct(tri)} > k ${tauxActu}%` : `✗ TRI < k ${tauxActu}%`) : "Non calculable"}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.10 }} className="p-4 rounded-lg bg-muted/30 border border-border space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">TRIM (TRI Modifié)</p>
              <p className={`text-2xl font-black ${trim !== null && trim > rate ? "text-blue-400" : "text-destructive"}`}>
                {trim !== null ? formatPct(trim) : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">Taux de réinvest. {tauxReinvest}%</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} className="p-4 rounded-lg bg-muted/30 border border-border space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Délai de Récupération (DR)</p>
              <p className={`text-2xl font-black ${payback !== null && payback < n ? "text-primary" : "text-destructive"}`}>
                {payback !== null ? `${payback.toFixed(1)} ans` : "Non récupéré"}
              </p>
              <p className="text-xs text-muted-foreground">{payback !== null && payback < n ? `✓ Récupération avant fin projet` : "✗ Non récupéré"}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.20 }} className="p-4 rounded-lg bg-muted/30 border border-border space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Indice de Rentabilité (IR)</p>
              <p className={`text-2xl font-black ${pi >= 1 ? "text-primary" : "text-destructive"}`}>{pi.toFixed(3)}</p>
              <p className="text-xs text-muted-foreground">{pi >= 1 ? "✓ IR ≥ 1 → Projet créateur de valeur" : "✗ IR < 1"}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }} className="p-4 rounded-lg bg-muted/30 border border-border space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Annuité Équivalente</p>
              <p className="text-2xl font-black text-foreground">{formatMillions(annuiteEq)} DZD</p>
              <p className="text-xs text-muted-foreground">Permet comparaison projets durées ≠</p>
            </motion.div>
          </div>
        </CardContent>
      </Card>

      {/* Analyse sous incertitude */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-accent" />
            Analyse sous Incertitude — Scénarios
          </CardTitle>
          <CardDescription>
            Espérance mathématique et risque de la VAN selon 3 hypothèses (pessimiste 25% / moyen 50% / optimiste 25%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {scenarios.map(s => (
              <div key={s.key} className="p-4 rounded-lg border border-border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${s.color}`}>{s.label}</span>
                  <Badge variant="outline" className="text-xs">{(s.probability * 100).toFixed(0)}%</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">VAN</p>
                  <p className={`text-lg font-bold ${s.npv >= 0 ? "text-primary" : "text-destructive"}`}>
                    {formatMillions(s.npv)} DZD
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">TRI</p>
                  <p className="text-base font-semibold">{s.tri !== null ? formatPct(s.tri) : "N/A"}</p>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">E(VAN)</p>
              <p className={`text-xl font-bold ${eNpv >= 0 ? "text-primary" : "text-destructive"}`}>{formatMillions(eNpv)} DZD</p>
              <p className="text-xs text-muted-foreground">Espérance mathématique</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">σ(VAN)</p>
              <p className="text-xl font-bold text-accent">{formatMillions(sigNpv)} DZD</p>
              <p className="text-xs text-muted-foreground">Écart-type (risque)</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Variance σ²</p>
              <p className="text-xl font-bold text-foreground">{formatMillions(Math.sqrt(sigNpv))}</p>
              <p className="text-xs text-muted-foreground">Dispersion des VAN</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Coeff. Variation</p>
              <p className={`text-xl font-bold ${cv <= 0.9 ? "text-primary" : "text-destructive"}`}>
                {isFinite(cv) ? cv.toFixed(3) : "∞"}
              </p>
              <p className="text-xs text-muted-foreground">{cv <= 0.9 ? "✓ CV ≤ 0.9 → Acceptable" : "✗ CV > 0.9 → Risque élevé"}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/30 border border-border text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              L'espérance mathématique E(VAN) = Σ Pᵢ × VANᵢ mesure la rentabilité espérée.
              L'écart-type σ(VAN) mesure le risque de dispersion autour de cette valeur.
              Si E(VAN) &gt; 0 et le coefficient de variation est acceptable (CV ≤ 0.9), le projet peut être validé.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
