import { useState, useMemo } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatDZD, getProjectHealth, daysUntilDeadline } from "@/lib/utils";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, Tooltip as RTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Cell,
} from "recharts";
import {
  CheckCircle2, AlertTriangle, AlertCircle, X, Plus, TrendingUp,
  BarChart3, ArrowUpRight, ArrowDownRight, Scale,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  { stroke: "#16a34a", fill: "#16a34a22", badge: "bg-primary/15 text-primary border-primary/30" },
  { stroke: "#ca8a04", fill: "#ca8a0422", badge: "bg-accent/15 text-accent border-accent/30" },
  { stroke: "#2563eb", fill: "#2563eb22", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { stroke: "#db2777", fill: "#db277722", badge: "bg-pink-500/15 text-pink-400 border-pink-500/30" },
];

const HEALTH_CFG = {
  green: { icon: CheckCircle2, label: "Sain",      cls: "text-primary bg-primary/10 border-primary/20" },
  amber: { icon: AlertTriangle, label: "Vigilance", cls: "text-accent bg-accent/10 border-accent/20" },
  red:   { icon: AlertCircle,  label: "Alerte",    cls: "text-destructive bg-destructive/10 border-destructive/20" },
};
const RISK_ORDER: Record<string, number> = { low: 25, medium: 50, high: 75, critical: 100 };
const RISK_LABEL: Record<string, string> = { low: "Faible", medium: "Modéré", high: "Élevé", critical: "Critique" };

export default function Comparison() {
  const { data: allProjects, isLoading } = useListProjects();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const MAX_SELECT = 4;

  const toggle = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < MAX_SELECT ? [...prev, id] : prev
    );
  };

  const selected = useMemo(() =>
    (allProjects ?? [])
      .filter(p => selectedIds.includes(p.id))
      .map(p => ({
        ...p,
        health: getProjectHealth(p),
        days:   daysUntilDeadline(p.endDate),
      })),
    [allProjects, selectedIds]
  );

  /* ── Radar data (normalise each axis 0–100) ─────────────────────────── */
  const radarData = useMemo(() => {
    if (selected.length < 2) return [];
    const maxIRR  = Math.max(...selected.map(p => p.irr ?? 0), 1);
    const maxInv  = Math.max(...selected.map(p => p.investmentAmount), 1);
    const maxVal  = Math.max(...selected.map(p => p.currentValue), 1);

    const axes = [
      { label: "TRI (%)",     key: "tri" },
      { label: "Avancement",  key: "avancement" },
      { label: "Risque (inv)", key: "securite" },
      { label: "Valeur/I₀",   key: "valeur" },
      { label: "Santé",       key: "sante" },
    ];

    return axes.map(a => {
      const row: Record<string, number | string> = { subject: a.label };
      selected.forEach(p => {
        if (a.key === "tri")        row[p.name] = ((p.irr ?? 0) / maxIRR) * 100;
        if (a.key === "avancement") row[p.name] = p.progressPercent ?? 0;
        if (a.key === "securite")   row[p.name] = 100 - (RISK_ORDER[p.riskLevel] ?? 50);
        if (a.key === "valeur")     row[p.name] = Math.min(100, (p.currentValue / p.investmentAmount) * 50);
        if (a.key === "sante")      row[p.name] = p.health === "green" ? 100 : p.health === "amber" ? 55 : 20;
      });
      return row;
    });
  }, [selected]);

  /* ── Bar comparison data ─────────────────────────────────────────────── */
  const investBar = selected.map((p, i) => ({ name: p.name.slice(0, 14), inv: p.investmentAmount, val: p.currentValue, color: COLORS[i].stroke }));
  const triBar    = selected.map((p, i) => ({ name: p.name.slice(0, 14), tri: p.irr ?? 0, color: COLORS[i].stroke }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Comparaison de Projets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sélectionnez jusqu'à {MAX_SELECT} projets à comparer — {selectedIds.length}/{MAX_SELECT} choisis
        </p>
      </div>

      {/* ── Project picker ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Sélection des projets à comparer
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-36" />)}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(allProjects ?? []).map((p, i) => {
                const isSelected = selectedIds.includes(p.id);
                const idx = selectedIds.indexOf(p.id);
                const disabled = !isSelected && selectedIds.length >= MAX_SELECT;
                const health = getProjectHealth(p);
                const hcfg = HEALTH_CFG[health];
                return (
                  <motion.button
                    key={p.id}
                    whileHover={{ scale: disabled ? 1 : 1.02 }}
                    whileTap={{ scale: disabled ? 1 : 0.97 }}
                    onClick={() => !disabled && toggle(p.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? `border-2 shadow-sm ${COLORS[idx % COLORS.length].badge}`
                        : disabled
                        ? "border-border text-muted-foreground/40 cursor-not-allowed"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {isSelected && (
                      <span className="h-4 w-4 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: COLORS[idx % COLORS.length].stroke, color: "#fff" }}>
                        {idx + 1}
                      </span>
                    )}
                    <hcfg.icon className={`h-3 w-3 ${hcfg.cls.split(" ")[0]}`} />
                    <span className="max-w-[160px] truncate">{p.name}</span>
                    {isSelected && <X className="h-3 w-3 ml-1 opacity-60" />}
                  </motion.button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Comparison content ──────────────────────────────────────────── */}
      <AnimatePresence>
        {selected.length < 2 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl bg-muted/10"
          >
            <Scale className="h-12 w-12 opacity-20 mb-4" />
            <p className="text-muted-foreground font-medium">Sélectionnez au moins 2 projets pour démarrer la comparaison</p>
            <p className="text-xs text-muted-foreground mt-1">jusqu'à {MAX_SELECT} projets simultanément</p>
          </motion.div>
        ) : (
          <motion.div key="comparison" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* ── Mini header cards ─────────────────────────────────────── */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${selected.length}, 1fr)` }}>
              {selected.map((p, i) => {
                const hcfg = HEALTH_CFG[p.health];
                const HIcon = hcfg.icon;
                return (
                  <Card key={p.id} className="border-2" style={{ borderColor: COLORS[i].stroke + "44" }}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between mb-2">
                        <span className="h-5 w-5 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: COLORS[i].stroke }}>{i + 1}</span>
                        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold ${hcfg.cls}`}>
                          <HIcon className="h-3 w-3" />
                          {hcfg.label}
                        </div>
                      </div>
                      <p className="font-bold text-sm leading-tight mt-2">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.sector} · {p.region}</p>
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Avancement</span>
                          <span className="font-mono font-bold">{p.progressPercent}%</span>
                        </div>
                        <Progress value={p.progressPercent} className="h-1" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ── Radar + Bar charts ────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Radar Multi-Dimensionnel
                  </CardTitle>
                  <CardDescription className="text-xs">Comparaison normalisée sur 5 axes (0–100)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <RTooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [`${v.toFixed(0)}/100`]}
                      />
                      <Legend formatter={(name) => <span style={{ fontSize: 11 }}>{name}</span>} />
                      {selected.map((p, i) => (
                        <Radar key={p.id} name={p.name} dataKey={p.name}
                          stroke={COLORS[i].stroke} fill={COLORS[i].stroke} fillOpacity={0.18} strokeWidth={2}
                        />
                      ))}
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">TRI par Projet (%)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={110}>
                      <BarChart data={triBar} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={9} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                        <YAxis hide />
                        <RTooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                          formatter={(v: number) => [`${v.toFixed(1)}%`, "TRI"]}
                        />
                        <Bar dataKey="tri" radius={[4, 4, 0, 0]} maxBarSize={40}>
                          {triBar.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Investi vs Valeur Actuelle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selected.map((p, i) => {
                        const delta = ((p.currentValue - p.investmentAmount) / p.investmentAmount) * 100;
                        return (
                          <div key={p.id} className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[i].stroke }} />
                            <span className="text-xs text-muted-foreground truncate flex-1">{p.name.slice(0, 16)}</span>
                            <div className={`flex items-center gap-0.5 text-xs font-bold ${delta >= 0 ? "text-primary" : "text-destructive"}`}>
                              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {delta.toFixed(1)}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* ── Comparison table ──────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tableau Comparatif Détaillé</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40">Indicateur</th>
                        {selected.map((p, i) => (
                          <th key={p.id} className="text-right px-5 py-3 font-bold" style={{ color: COLORS[i].stroke }}>
                            {p.name.slice(0, 20)}{p.name.length > 20 ? "…" : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Secteur",        render: (p: typeof selected[0]) => p.sector },
                        { label: "Statut",         render: (p: typeof selected[0]) => p.status },
                        { label: "Investissement", render: (p: typeof selected[0]) => <span className="font-mono font-bold">{formatDZD(p.investmentAmount)}</span> },
                        { label: "Valeur Actuelle",render: (p: typeof selected[0]) => {
                          const d = ((p.currentValue - p.investmentAmount) / p.investmentAmount) * 100;
                          return <span className={`font-mono font-bold ${d >= 0 ? "text-primary" : "text-destructive"}`}>{formatDZD(p.currentValue)}</span>;
                        }},
                        { label: "TRI (%)",        render: (p: typeof selected[0]) => {
                          const best = Math.max(...selected.map(x => x.irr ?? 0));
                          const isBest = (p.irr ?? 0) === best;
                          return <span className={`font-mono font-bold ${isBest ? "text-accent" : ""}`}>{p.irr != null ? `${p.irr.toFixed(1)}%` : "—"}{isBest ? " ★" : ""}</span>;
                        }},
                        { label: "Risque",         render: (p: typeof selected[0]) => {
                          const worst = Math.max(...selected.map(x => RISK_ORDER[x.riskLevel] ?? 0));
                          const isBad = (RISK_ORDER[p.riskLevel] ?? 0) === worst && worst > 25;
                          return <span className={isBad ? "text-destructive font-bold" : ""}>{RISK_LABEL[p.riskLevel] ?? p.riskLevel}</span>;
                        }},
                        { label: "Avancement",     render: (p: typeof selected[0]) => {
                          const best = Math.max(...selected.map(x => x.progressPercent ?? 0));
                          const isBest = (p.progressPercent ?? 0) === best;
                          return (
                            <div className="flex items-center gap-2 justify-end">
                              <Progress value={p.progressPercent} className="h-1 w-14" />
                              <span className={`font-mono font-bold ${isBest ? "text-primary" : ""}`}>{p.progressPercent}%{isBest ? " ★" : ""}</span>
                            </div>
                          );
                        }},
                        { label: "Santé RAG",      render: (p: typeof selected[0]) => {
                          const hcfg = HEALTH_CFG[p.health];
                          const HIcon = hcfg.icon;
                          return (
                            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-semibold ${hcfg.cls}`}>
                              <HIcon className="h-3 w-3" />
                              {hcfg.label}
                            </div>
                          );
                        }},
                        { label: "Échéance",       render: (p: typeof selected[0]) => {
                          if (p.days === null) return <span className="text-muted-foreground">—</span>;
                          const cls = p.days < 0 ? "text-destructive font-bold" : p.days <= 30 ? "text-accent font-bold" : "text-muted-foreground";
                          return <span className={`font-mono ${cls}`}>{p.days < 0 ? `${Math.abs(p.days)}j dépassé` : `${p.days}j`}</span>;
                        }},
                        { label: "Région",         render: (p: typeof selected[0]) => p.region },
                      ].map((row, ri) => (
                        <tr key={ri} className={`border-b border-border/50 ${ri % 2 === 0 ? "bg-muted/10" : ""} hover:bg-muted/30 transition-colors`}>
                          <td className="px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{row.label}</td>
                          {selected.map(p => (
                            <td key={p.id} className="px-5 py-2.5 text-right text-sm">{row.render(p)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* ── Winner summary ────────────────────────────────────────── */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-primary mb-1">Synthèse comparative</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {(() => {
                        const bestTRI = selected.reduce((a, b) => (a.irr ?? 0) > (b.irr ?? 0) ? a : b);
                        const bestProg = selected.reduce((a, b) => (a.progressPercent ?? 0) > (b.progressPercent ?? 0) ? a : b);
                        const bestHealth = selected.find(p => p.health === "green") ?? selected.find(p => p.health === "amber") ?? selected[0];
                        return `Meilleur TRI : ${bestTRI.name} (${bestTRI.irr?.toFixed(1) ?? "—"}%). `
                          + `Avancement le plus avancé : ${bestProg.name} (${bestProg.progressPercent}%). `
                          + `Meilleure santé : ${bestHealth.name} (${HEALTH_CFG[bestHealth.health].label}).`;
                      })()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
