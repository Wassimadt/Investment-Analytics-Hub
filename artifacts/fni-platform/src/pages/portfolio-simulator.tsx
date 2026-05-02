import { useState, useMemo } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateNPV, calculateEquivalentAnnuity, formatPct, formatMillions } from "@/lib/finance";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  Cell, ScatterChart, Scatter, CartesianGrid, PieChart, Pie, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import { motion } from "framer-motion";
import {
  PieChart as PieIcon, TrendingUp, ShieldAlert, Layers, CheckSquare,
  Square, Info, Sparkles, AlertTriangle, BarChart2,
} from "lucide-react";

const TABS = ["Vue Portefeuille", "Optimisation Budgétaire", "Risque Consolidé", "Frontière Efficiente"];

const RISK_SIGMA: Record<string, number> = { low: 0.07, medium: 0.17, high: 0.30, critical: 0.45 };
const RISK_LABEL: Record<string, string> = { low: "Faible", medium: "Modéré", high: "Élevé", critical: "Critique" };
const RISK_COLOR: Record<string, string> = {
  low: "hsl(var(--primary))", medium: "hsl(var(--accent))",
  high: "#f97316", critical: "hsl(var(--destructive))",
};
const SECTOR_COLORS = ["hsl(var(--primary))","hsl(var(--accent))","#60a5fa","#f472b6","#fb923c","#a78bfa","#34d399","#fbbf24"];

interface ProjectCalc {
  id: number;
  name: string;
  sector: string;
  riskLevel: string;
  investment: number;
  irr: number | null;
  van: number;
  sigma: number;
  pi: number;
  years: number;
  ae: number;
  selected: boolean;
}

function estimateProjectCFs(investment: number, irr: number | null, years: number): number[] {
  const rate = (irr ?? 12) / 100;
  const cf = investment * rate * Math.pow(1 + rate, years) / (Math.pow(1 + rate, years) - 1);
  return Array.from({ length: years }, (_, i) => i === years - 1 ? cf + investment * 0.1 : cf);
}

export default function PortfolioSimulator() {
  const [activeTab, setActiveTab] = useState(0);
  const [discountRate, setDiscountRate] = useState(10);
  const [budget, setBudget] = useState(5000000000);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [correlation, setCorrelation] = useState<"independent" | "partial" | "total">("independent");
  const [rhoPartial, setRhoPartial] = useState(0.4);

  const { data: rawProjects, isLoading } = useListProjects();
  const k = discountRate / 100;

  const projects: ProjectCalc[] = useMemo(() => {
    if (!rawProjects) return [];
    return rawProjects.map(p => {
      const years = p.endDate && p.startDate
        ? Math.max(2, Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / (365.25 * 24 * 3600 * 1000)))
        : 5;
      const cfs = estimateProjectCFs(p.investmentAmount, p.irr, years);
      const van = calculateNPV(cfs, k, p.investmentAmount);
      const sigma = Math.abs(van) * (RISK_SIGMA[p.riskLevel] ?? 0.17);
      const pi = p.investmentAmount > 0 ? (van + p.investmentAmount) / p.investmentAmount : 1;
      const ae = calculateEquivalentAnnuity(van, k, years);
      return {
        id: p.id, name: p.name, sector: p.sector, riskLevel: p.riskLevel,
        investment: p.investmentAmount, irr: p.irr, van, sigma, pi, years, ae,
        selected: selectedIds.has(p.id),
      };
    });
  }, [rawProjects, k, selectedIds]);

  // Initialize all selected on first load
  useMemo(() => {
    if (rawProjects && selectedIds.size === 0) {
      setSelectedIds(new Set(rawProjects.map(p => p.id)));
    }
  }, [rawProjects]);

  const selected = projects.filter(p => selectedIds.has(p.id));
  const totalInvested = selected.reduce((s, p) => s + p.investment, 0);
  const weightedIRR = selected.length > 0 && totalInvested > 0
    ? selected.reduce((s, p) => s + (p.irr ?? 12) * p.investment, 0) / totalInvested : 0;
  const portfolioVAN = selected.reduce((s, p) => s + p.van, 0);

  const portfolioSigma = useMemo(() => {
    if (correlation === "independent") return Math.sqrt(selected.reduce((s, p) => s + p.sigma * p.sigma, 0));
    if (correlation === "total") return selected.reduce((s, p) => s + p.sigma, 0);
    const sumSq = selected.reduce((s, p) => s + p.sigma * p.sigma, 0);
    const n = selected.length;
    let crossTerms = 0;
    for (let i = 0; i < selected.length; i++)
      for (let j = i + 1; j < selected.length; j++)
        crossTerms += 2 * rhoPartial * selected[i].sigma * selected[j].sigma;
    return Math.sqrt(sumSq + crossTerms);
  }, [selected, correlation, rhoPartial]);

  const sigmaIndependent = Math.sqrt(selected.reduce((s, p) => s + p.sigma * p.sigma, 0));
  const sigmaCorrelated = selected.reduce((s, p) => s + p.sigma, 0);
  const diversificationBenefit = sigmaCorrelated > 0 ? (1 - sigmaIndependent / sigmaCorrelated) : 0;
  const cv = portfolioSigma !== 0 && portfolioVAN !== 0 ? Math.abs(portfolioSigma / portfolioVAN) : Infinity;

  // Sector breakdown
  const sectors = useMemo(() => {
    const map: Record<string, { investment: number; van: number; count: number }> = {};
    selected.forEach(p => {
      if (!map[p.sector]) map[p.sector] = { investment: 0, van: 0, count: 0 };
      map[p.sector].investment += p.investment;
      map[p.sector].van += p.van;
      map[p.sector].count += 1;
    });
    return Object.entries(map).map(([sector, d]) => ({ sector, ...d, pct: totalInvested > 0 ? d.investment / totalInvested * 100 : 0 }));
  }, [selected, totalInvested]);

  const riskBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    selected.forEach(p => { map[p.riskLevel] = (map[p.riskLevel] || 0) + p.investment; });
    return Object.entries(map).map(([risk, inv]) => ({ risk, label: RISK_LABEL[risk] ?? risk, inv, pct: totalInvested > 0 ? inv / totalInvested * 100 : 0 }));
  }, [selected, totalInvested]);

  // Budget optimization
  const sortedByPI = useMemo(() => [...projects].sort((a, b) => b.pi - a.pi), [projects]);
  const optimized = useMemo(() => {
    let remaining = budget;
    const chosen: ProjectCalc[] = [];
    for (const p of sortedByPI) {
      if (p.investment <= remaining) { chosen.push(p); remaining -= p.investment; }
    }
    return chosen;
  }, [sortedByPI, budget]);
  const optVAN = optimized.reduce((s, p) => s + p.van, 0);
  const optInvested = optimized.reduce((s, p) => s + p.investment, 0);

  // Scatter data for frontier
  const scatterData = projects.map(p => ({ name: p.name, x: p.sigma / 1e6, y: p.van / 1e6, r: p.investment / 1e8, sector: p.sector, selected: selectedIds.has(p.id) }));

  // Efficient frontier curve simulation
  const frontierPoints = useMemo(() => {
    const points: { sigma: number; van: number }[] = [];
    const sorted = [...projects].sort((a, b) => a.sigma - b.sigma);
    let cumVAN = 0, cumVar = 0;
    for (const p of sorted) {
      cumVAN += p.van;
      cumVar += p.sigma * p.sigma;
      points.push({ sigma: Math.round(Math.sqrt(cumVar) / 1e6), van: Math.round(cumVAN / 1e6) });
    }
    return points;
  }, [projects]);

  const toggleProject = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const kpiCards = [
    { label: "Montant Total Investi", value: `${formatMillions(totalInvested)} DZD`, sub: `${selected.length} projets sélectionnés`, color: "text-foreground" },
    { label: "VAN Portefeuille", value: `${formatMillions(portfolioVAN)} DZD`, sub: portfolioVAN >= 0 ? "✓ Portefeuille créateur de valeur" : "✗ Destruction de valeur", color: portfolioVAN >= 0 ? "text-primary" : "text-destructive" },
    { label: "TRI Moyen Pondéré", value: formatPct(weightedIRR / 100), sub: `vs taux d'actualisation ${discountRate}%`, color: weightedIRR / 100 > k ? "text-accent" : "text-destructive" },
    { label: "σ(VAN) Portefeuille", value: `${formatMillions(portfolioSigma)} DZD`, sub: `CV = ${isFinite(cv) ? cv.toFixed(2) : "∞"}`, color: cv <= 0.9 ? "text-primary" : "text-orange-400" },
  ];

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid grid-cols-4 gap-4">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-24"/>)}</div>
      <Skeleton className="h-64" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Simulateur de Portefeuille FNI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consolidation · Optimisation budgétaire · Risque portefeuille · Frontière efficiente
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Taux d'actualisation k (%)</Label>
            <Input type="number" value={discountRate} onChange={e => setDiscountRate(parseFloat(e.target.value)||0)} className="h-8 w-28 text-sm" />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((c, i) => (
          <motion.div key={i} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.07 }}>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{c.label}</p>
                <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab===i ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB 0: Vue Portefeuille ───────────────────────────────────────── */}
      {activeTab === 0 && (
        <motion.div key="t0" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Allocation sectorielle */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PieIcon className="h-4 w-4 text-primary"/>Allocation par Secteur</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sectors} dataKey="investment" nameKey="sector" cx="50%" cy="50%" outerRadius={80} label={({ sector, pct }) => `${sector} ${pct.toFixed(0)}%`} labelLine={false}>
                      {sectors.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatMillions(v) + " DZD"} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* VAN par secteur */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="h-4 w-4 text-accent"/>VAN & Investissement par Secteur</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sectors} margin={{ top:5, right:10, left:5, bottom:5 }}>
                    <XAxis dataKey="sector" tick={{ fontSize:10 }} />
                    <YAxis tick={{ fontSize:9 }} tickFormatter={v => formatMillions(v)} />
                    <Tooltip formatter={(v:number, name:string) => [formatMillions(v)+" DZD", name==="investment"?"Investissement":"VAN"]} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="investment" name="Investissement" fill="hsl(var(--primary))" opacity={0.4} radius={[3,3,0,0]} />
                    <Bar dataKey="van" name="VAN" radius={[3,3,0,0]}>
                      {sectors.map((s, i) => <Cell key={i} fill={s.van>=0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Répartition risque */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Répartition par Niveau de Risque</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {riskBreakdown.sort((a,b) => b.inv - a.inv).map((r, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium" style={{ color: RISK_COLOR[r.risk] }}>{r.label}</span>
                      <div className="flex gap-4 text-muted-foreground">
                        <span>{formatMillions(r.inv)} DZD</span>
                        <span className="w-10 text-right font-bold">{r.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ backgroundColor: RISK_COLOR[r.risk] }}
                        initial={{ width:0 }} animate={{ width:`${r.pct}%` }} transition={{ delay: i*0.1, duration:0.4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Project table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Projets du Portefeuille</CardTitle>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedIds(new Set(projects.map(p=>p.id)))} className="text-xs text-primary underline">Tout sélectionner</button>
                  <span className="text-muted-foreground text-xs">|</span>
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground underline">Tout désélectionner</button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["","Projet","Secteur","I₀","TRI","VAN","Indice R.","Annuité Éq.","Risque"].map(h => (
                        <th key={h} className="text-right first:text-left py-2 px-3 text-xs text-muted-foreground font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {projects.map(p => {
                      const isSelected = selectedIds.has(p.id);
                      return (
                        <tr key={p.id} className={`hover:bg-muted/20 transition-colors cursor-pointer ${isSelected ? "" : "opacity-40"}`} onClick={() => toggleProject(p.id)}>
                          <td className="py-2 px-3">
                            {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                          </td>
                          <td className="py-2 px-3 font-medium text-xs max-w-[160px] truncate">{p.name}</td>
                          <td className="py-2 px-3 text-xs text-muted-foreground">{p.sector}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{formatMillions(p.investment)}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{p.irr != null ? formatPct(p.irr/100) : "—"}</td>
                          <td className={`py-2 px-3 text-right font-mono text-xs font-bold ${p.van>=0?"text-primary":"text-destructive"}`}>{formatMillions(p.van)}</td>
                          <td className={`py-2 px-3 text-right font-mono text-xs ${p.pi>=1?"text-primary":"text-destructive"}`}>{p.pi.toFixed(3)}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-accent">{formatMillions(p.ae)}</td>
                          <td className="py-2 px-3 text-right">
                            <Badge variant="outline" className="text-xs" style={{ color: RISK_COLOR[p.riskLevel], borderColor: RISK_COLOR[p.riskLevel] + "40" }}>
                              {RISK_LABEL[p.riskLevel] ?? p.riskLevel}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-primary/30 bg-primary/5">
                      <td colSpan={3} className="py-2 px-3 text-xs font-bold">TOTAL ({selected.length} projets)</td>
                      <td className="py-2 px-3 text-right font-mono text-xs font-bold">{formatMillions(totalInvested)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs font-bold text-accent">{formatPct(weightedIRR/100)}</td>
                      <td className={`py-2 px-3 text-right font-mono text-xs font-bold ${portfolioVAN>=0?"text-primary":"text-destructive"}`}>{formatMillions(portfolioVAN)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 1: Optimisation budgétaire ───────────────────────────────── */}
      {activeTab === 1 && (
        <motion.div key="t1" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                Optimisation par Indice de Rentabilité (IR)
              </CardTitle>
              <CardDescription>
                Méthode gloutonne : sélectionner les projets par ordre décroissant d'IR = (VAN + I₀) / I₀ jusqu'à épuisement du budget
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Budget disponible (DZD)</Label>
                  <Input type="number" value={budget} onChange={e => setBudget(parseFloat(e.target.value)||0)} className="h-8 w-52" />
                </div>
                <div className="text-xs text-muted-foreground pb-1">
                  Enveloppe : <strong className="text-foreground">{formatMillions(budget)} DZD</strong>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Projets retenus</p>
                  <p className="text-2xl font-black text-primary">{optimized.length}</p>
                  <p className="text-xs text-muted-foreground">sur {projects.length} projets</p>
                </div>
                <div className="p-4 rounded-lg bg-accent/5 border border-accent/20 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Investissement utilisé</p>
                  <p className="text-2xl font-black text-accent">{formatMillions(optInvested)} DZD</p>
                  <p className="text-xs text-muted-foreground">{budget > 0 ? (optInvested/budget*100).toFixed(1) : 0}% du budget</p>
                </div>
                <div className={`p-4 rounded-lg border space-y-1 ${optVAN>=0?"bg-primary/5 border-primary/20":"bg-destructive/5 border-destructive/20"}`}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">VAN Optimisée</p>
                  <p className={`text-2xl font-black ${optVAN>=0?"text-primary":"text-destructive"}`}>{formatMillions(optVAN)} DZD</p>
                  <p className="text-xs text-muted-foreground">vs VAN totale {formatMillions(portfolioVAN)} DZD</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ranking table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Classement par Indice de Rentabilité</CardTitle>
              <CardDescription>IR = (VAN + I₀) / I₀ · Les projets cochés sont sélectionnés dans la limite du budget</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Rang","","Projet","I₀ (DZD)","VAN (DZD)","IR","Annuité Éq.","Budget cumulé","Statut"].map(h => (
                        <th key={h} className="text-right first:text-center py-2 px-2 text-xs text-muted-foreground font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {sortedByPI.map((p, rank) => {
                      const isOpt = optimized.some(o => o.id === p.id);
                      const cumInv = sortedByPI.slice(0, rank+1).filter(x => optimized.some(o=>o.id===x.id)).reduce((s,x) => s+x.investment, 0);
                      return (
                        <tr key={p.id} className={`transition-colors ${isOpt ? "bg-primary/5 hover:bg-primary/10" : "opacity-50 hover:opacity-70"}`}>
                          <td className="py-2 px-2 text-center text-xs font-bold text-muted-foreground">#{rank+1}</td>
                          <td className="py-2 px-2 text-center">
                            {isOpt ? <CheckSquare className="h-4 w-4 text-primary mx-auto" /> : <Square className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </td>
                          <td className="py-2 px-2 font-medium text-xs max-w-[150px] truncate">{p.name}</td>
                          <td className="py-2 px-2 text-right font-mono text-xs">{formatMillions(p.investment)}</td>
                          <td className={`py-2 px-2 text-right font-mono text-xs font-bold ${p.van>=0?"text-primary":"text-destructive"}`}>{formatMillions(p.van)}</td>
                          <td className={`py-2 px-2 text-right font-mono text-xs font-black ${p.pi>=1.5?"text-primary":p.pi>=1?"text-accent":"text-destructive"}`}>{p.pi.toFixed(3)}</td>
                          <td className="py-2 px-2 text-right font-mono text-xs text-accent">{formatMillions(p.ae)}</td>
                          <td className="py-2 px-2 text-right font-mono text-xs text-muted-foreground">{isOpt ? formatMillions(cumInv) : "—"}</td>
                          <td className="py-2 px-2 text-right">
                            <Badge variant="outline" className={`text-xs ${isOpt ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground"}`}>
                              {isOpt ? "✓ Retenu" : "Exclu (budget)"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-start gap-2 p-3 rounded-md bg-muted/30 border border-border text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  La méthode de l'indice de rentabilité est la méthode optimale pour le choix d'investissement sous contrainte budgétaire. Elle maximise la valeur créée par unité de capital investi. Attention : si un projet marginal ne peut être inclus entièrement, il peut être partiellement financé (hypothèse de divisibilité).
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 2: Risque Consolidé ───────────────────────────────────────── */}
      {activeTab === 2 && (
        <motion.div key="t2" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-accent" />
                Risque Consolidé du Portefeuille
              </CardTitle>
              <CardDescription>
                σ(VAN) portefeuille selon l'hypothèse de corrélation entre les projets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-6 flex-wrap">
                <div className="space-y-1.5">
                  <Label className="text-xs">Hypothèse de corrélation</Label>
                  <div className="flex gap-2">
                    {(["independent","partial","total"] as const).map(c => (
                      <button key={c} onClick={() => setCorrelation(c)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${correlation===c ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                        {c === "independent" ? "Indépendants" : c === "partial" ? "Partiellement corrélés" : "Totalement corrélés"}
                      </button>
                    ))}
                  </div>
                </div>
                {correlation === "partial" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Coefficient de corrélation ρ</Label>
                    <Input type="number" min="0" max="1" step="0.05" value={rhoPartial} onChange={e => setRhoPartial(parseFloat(e.target.value)||0)} className="h-8 w-24" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "E(VAN) Portefeuille", value: formatMillions(portfolioVAN), sub: portfolioVAN>=0?"✓ Rentable":"✗ Négatif", color: portfolioVAN>=0?"text-primary":"text-destructive" },
                  { label: `σ(VAN) — ${correlation==="independent"?"Flux indépendants":correlation==="total"?"Flux corrélés":"Corrélation ρ="+rhoPartial}`, value: formatMillions(portfolioSigma), sub: "Risque total du portefeuille", color: "text-accent" },
                  { label: "Coefficient de Variation", value: isFinite(cv)?cv.toFixed(3):"∞", sub: cv<=0.9?"✓ CV ≤ 0.9 — Acceptable":"✗ CV > 0.9 — Risque élevé", color: cv<=0.9?"text-primary":"text-destructive" },
                  { label: "Bénéfice Diversification", value: formatPct(diversificationBenefit), sub: `Réduction σ vs corr. totale`, color: "text-blue-400" },
                ].map((m,i) => (
                  <div key={i} className="p-4 rounded-lg bg-muted/30 border border-border space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider leading-tight">{m.label}</p>
                    <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
                    <p className="text-xs text-muted-foreground">{m.sub}</p>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Comparison: independent vs correlated */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Comparaison des hypothèses de corrélation</h4>
                {[
                  { label: "Flux indépendants", formula: "σ(P) = √(Σ σᵢ²)", sigma: sigmaIndependent, color: "bg-primary" },
                  { label: `Corrélation partielle (ρ = ${rhoPartial})`, formula: "σ(P) = √(Σ σᵢ² + 2ρ Σ σᵢσⱼ)", sigma: portfolioSigma, color: "bg-accent" },
                  { label: "Corrélation totale (ρ = 1)", formula: "σ(P) = Σ σᵢ", sigma: sigmaCorrelated, color: "bg-orange-500" },
                ].map((m, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <div>
                        <span className="font-medium">{m.label}</span>
                        <code className="ml-2 text-muted-foreground">{m.formula}</code>
                      </div>
                      <span className="font-mono font-bold">{formatMillions(m.sigma)} DZD</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div className={`h-full rounded-full ${m.color}`}
                        initial={{ width:0 }}
                        animate={{ width: sigmaCorrelated > 0 ? `${m.sigma/sigmaCorrelated*100}%` : "0%" }}
                        transition={{ delay: i*0.1, duration:0.4 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Risk per project */}
              <Card className="bg-muted/10">
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Contribution au Risque par Projet</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={selected.map(p => ({ name: p.name.length > 15 ? p.name.slice(0,15)+"…" : p.name, sigma: Math.round(p.sigma/1e6*10)/10, van: Math.round(p.van/1e6*10)/10 }))} margin={{top:5,right:10,bottom:5,left:5}}>
                      <XAxis dataKey="name" tick={{ fontSize:9 }} />
                      <YAxis tick={{ fontSize:9 }} tickFormatter={v=>`${v}M`} />
                      <Tooltip formatter={(v:number, n:string) => [`${v} M DZD`, n==="sigma"?"σ(VAN)":"VAN"]} />
                      <Bar dataKey="sigma" name="σ(VAN)" fill="hsl(var(--accent))" opacity={0.7} radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="flex items-start gap-2 p-3 rounded-md bg-muted/30 border border-border text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  La <strong>diversification</strong> réduit le risque total : avec des flux indépendants, σ(Portefeuille) = √(Σσᵢ²) &lt; Σσᵢ. Le bénéfice de diversification ici est de <strong>{formatPct(diversificationBenefit)}</strong>, soit une réduction de risque de {formatMillions(sigmaCorrelated - sigmaIndependent)} DZD vs corrélation totale.
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 3: Frontière Efficiente ───────────────────────────────────── */}
      {activeTab === 3 && (
        <motion.div key="t3" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Espace Risque / Rendement — Projets FNI
              </CardTitle>
              <CardDescription>
                Chaque point représente un projet : axe X = σ(VAN) en M DZD, axe Y = VAN en M DZD. Les projets en haut à gauche sont optimaux.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ top:20, right:20, bottom:20, left:20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="x" name="σ(VAN)" type="number" unit=" M" tick={{ fontSize:11 }} label={{ value:"σ(VAN) — Risque (M DZD)", position:"insideBottomRight", offset:-5, fontSize:11 }} />
                  <YAxis dataKey="y" name="VAN" type="number" unit=" M" tick={{ fontSize:11 }} label={{ value:"VAN (M DZD)", angle:-90, position:"insideLeft", fontSize:11 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="6 3" />
                  <Tooltip cursor={{ strokeDasharray:"3 3" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 text-xs space-y-1">
                          <p className="font-bold">{d?.name}</p>
                          <p>VAN : <span className={d?.y>=0?"text-primary":"text-destructive"}>{d?.y} M DZD</span></p>
                          <p>σ(VAN) : <span className="text-accent">{d?.x} M DZD</span></p>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatterData.filter(d=>d.selected)} fill="hsl(var(--primary))" opacity={0.8} />
                  <Scatter data={scatterData.filter(d=>!d.selected)} fill="hsl(var(--muted-foreground))" opacity={0.3} />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Frontier accumulation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Frontière Efficiente — Ajout Séquentiel des Projets</CardTitle>
              <CardDescription>VAN cumulée vs Risque cumulé en ajoutant les projets par ordre croissant de risque individuel</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={frontierPoints.map((p,i) => ({ ...p, name:`P${i+1}` }))} margin={{top:5,right:10,bottom:5,left:5}}>
                  <XAxis dataKey="name" tick={{ fontSize:10 }} />
                  <YAxis yAxisId="van" tick={{ fontSize:9 }} tickFormatter={v=>`${v}M`} />
                  <YAxis yAxisId="sigma" orientation="right" tick={{ fontSize:9 }} tickFormatter={v=>`${v}M`} />
                  <Tooltip formatter={(v:number, n:string) => [`${v} M DZD`, n==="van"?"VAN cumulée":"σ cumulée"]} />
                  <ReferenceLine yAxisId="van" y={0} stroke="hsl(var(--border))" />
                  <Bar yAxisId="van" dataKey="van" name="VAN cumulée" fill="hsl(var(--primary))" radius={[3,3,0,0]} opacity={0.7} />
                  <Bar yAxisId="sigma" dataKey="sigma" name="σ cumulée" fill="hsl(var(--accent))" radius={[3,3,0,0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Quadrant Optimal", desc: "VAN > 0 et σ faible — projets à prioriser absolument", icon: "✅", count: projects.filter(p=>p.van>0 && p.sigma < portfolioSigma/projects.length).length },
              { title: "Projets Risqués Rentables", desc: "VAN > 0 mais σ élevé — acceptable selon appétit au risque", icon: "⚠️", count: projects.filter(p=>p.van>0 && p.sigma >= portfolioSigma/projects.length).length },
              { title: "Projets Problématiques", desc: "VAN < 0 — à réviser ou exclure du portefeuille", icon: "❌", count: projects.filter(p=>p.van<0).length },
            ].map((q, i) => (
              <Card key={i} className="bg-muted/10">
                <CardContent className="pt-5">
                  <div className="text-2xl mb-2">{q.icon}</div>
                  <p className="text-sm font-semibold">{q.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{q.desc}</p>
                  <p className="text-3xl font-black text-foreground mt-3">{q.count}</p>
                  <p className="text-xs text-muted-foreground">projets</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
