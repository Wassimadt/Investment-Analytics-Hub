import { useState } from "react";
import {
  useGetProject, useGetMlPredictions, useListValuations,
  getGetProjectQueryKey, getGetMlPredictionsQueryKey, getListValuationsQueryKey,
} from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatDZD, getProjectHealth, daysUntilDeadline } from "@/lib/utils";
import {
  AlertCircle, BrainCircuit, Activity, Calendar, ChevronDown, ChevronUp,
  Calculator, ArrowLeft, TrendingUp, MapPin, Building2, Clock, CheckCircle2,
  AlertTriangle, BarChart3, History, Target, Zap, ArrowUpRight, ArrowDownRight,
  Minus,
} from "lucide-react";
import { ProjectFinancialAnalysis } from "@/components/project-financial-analysis";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  active:    { label: "Actif",       cls: "bg-primary/15 text-primary border-primary/30" },
  completed: { label: "Terminé",     cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  suspended: { label: "Suspendu",    cls: "bg-destructive/15 text-destructive border-destructive/30" },
  evaluation:{ label: "Évaluation",  cls: "bg-accent/15 text-accent border-accent/30" },
  pipeline:  { label: "Pipeline",    cls: "bg-muted text-muted-foreground border-border" },
  on_hold:   { label: "En suspens",  cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
};
const RISK_CFG: Record<string, { label: string; color: string }> = {
  low:      { label: "Faible",   color: "text-primary" },
  medium:   { label: "Modéré",   color: "text-accent" },
  high:     { label: "Élevé",    color: "text-orange-400" },
  critical: { label: "Critique", color: "text-destructive" },
};
const HEALTH_CFG = {
  green: { icon: CheckCircle2, label: "Sain",      cls: "text-primary bg-primary/10 border-primary/25",      dot: "bg-primary" },
  amber: { icon: AlertTriangle, label: "Vigilance", cls: "text-accent bg-accent/10 border-accent/25",        dot: "bg-accent" },
  red:   { icon: AlertCircle,  label: "Alerte",    cls: "text-destructive bg-destructive/10 border-destructive/25", dot: "bg-destructive" },
};
const VALUATION_METHOD_LABEL: Record<string, string> = {
  dcf: "DCF", market_comp: "Comp. Marché", asset_based: "Actif Net",
  precedent: "Transac. Précédentes", book_value: "Valeur Comptable",
};

/* ─────────────────────────────────────────────────────────────────────────── */
export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = parseInt(id || "0", 10);
  const [showFinance, setShowFinance] = useState(false);
  const [, navigate] = useLocation();

  const { data: project, isLoading: isProjectLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });
  const { data: predictions, isLoading: isPredictionsLoading } = useGetMlPredictions({
    query: { queryKey: getGetMlPredictionsQueryKey() },
  });
  const { data: valuations, isLoading: isValuationsLoading } = useListValuations(
    { projectId },
    { query: { enabled: !!projectId, queryKey: getListValuationsQueryKey({ projectId }) } }
  );

  /* ── derived ────────────────────────────────────────────────────────────── */
  const prediction = predictions?.find(p => p.projectId === projectId);

  const durationYears = project?.startDate && project?.endDate
    ? Math.max(1, Math.round((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (365.25 * 24 * 3600 * 1000)))
    : 5;

  const timelineData = (() => {
    if (!project?.startDate || !project?.endDate) return null;
    const start   = new Date(project.startDate).getTime();
    const end     = new Date(project.endDate).getTime();
    const now     = Date.now();
    const total   = end - start;
    const elapsed = Math.min(total, Math.max(0, now - start));
    const timeElapsedPct = Math.round((elapsed / total) * 100);
    const expectedProgress = timeElapsedPct;
    const actual = project.progressPercent ?? 0;
    const delta  = actual - expectedProgress;
    const daysLeft = daysUntilDeadline(project.endDate);
    return { timeElapsedPct, expectedProgress, actual, delta, daysLeft, start, end, now };
  })();

  /* valuation history sorted by date */
  const sortedValuations = [...(valuations ?? [])].sort(
    (a, b) => new Date(a.valuationDate).getTime() - new Date(b.valuationDate).getTime()
  );
  const valuationChartData = sortedValuations.map(v => ({
    date: new Date(v.valuationDate).toLocaleDateString("fr-DZ", { month: "short", year: "2-digit" }),
    value: v.value,
    method: VALUATION_METHOD_LABEL[v.method] ?? v.method,
  }));

  /* ── loading ────────────────────────────────────────────────────────────── */
  if (isProjectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!project) return <div className="text-muted-foreground py-12 text-center">Projet introuvable.</div>;

  const health = getProjectHealth(project);
  const hcfg  = HEALTH_CFG[health];
  const HIcon = hcfg.icon;
  const status = STATUS_CFG[project.status] ?? { label: project.status, cls: "bg-muted text-muted-foreground border-border" };
  const risk   = RISK_CFG[project.riskLevel] ?? { label: project.riskLevel, color: "text-muted-foreground" };
  const valueDelta = project.currentValue > 0
    ? ((project.currentValue - project.investmentAmount) / project.investmentAmount) * 100
    : null;

  return (
    <div className="space-y-5">
      {/* ── Breadcrumb / Back ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => navigate("/projects")}
        >
          <ArrowLeft className="h-4 w-4" /> Projets
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium truncate max-w-[300px]">{project.name}</span>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-black text-foreground leading-tight">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            {project.companyName && (
              <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{project.companyName}</span>
            )}
            <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" />{project.sector}</span>
            {project.region && (
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{project.region}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-xs ${status.cls}`}>{status.label}</Badge>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${hcfg.cls}`}>
            <HIcon className="h-3.5 w-3.5" />
            {hcfg.label}
          </div>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: "Investissement Initial", icon: BarChart3, color: "text-foreground",
            value: formatDZD(project.investmentAmount), sub: null,
          },
          {
            label: "Valeur Actuelle", icon: TrendingUp, color: valueDelta !== null && valueDelta >= 0 ? "text-primary" : "text-destructive",
            value: formatDZD(project.currentValue),
            sub: valueDelta !== null
              ? { text: `${valueDelta >= 0 ? "+" : ""}${valueDelta.toFixed(1)}% vs I₀`, up: valueDelta >= 0 }
              : null,
          },
          {
            label: "TRI (Taux de Rendement Interne)", icon: Activity, color: "text-accent",
            value: project.irr != null ? `${project.irr.toFixed(1)}%` : "—",
            sub: project.irr != null ? { text: project.irr >= 10 ? "Supérieur au seuil" : "Sous le seuil 10%", up: project.irr >= 10 } : null,
          },
          {
            label: "Niveau de Risque", icon: AlertCircle, color: risk.color,
            value: risk.label, sub: null,
          },
          {
            label: "Avancement", icon: Target, color: "text-blue-400",
            value: `${project.progressPercent ?? 0}%`,
            sub: timelineData
              ? { text: `Attendu : ${timelineData.expectedProgress}%`, up: timelineData.delta >= 0 }
              : null,
          },
        ].map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="hover:border-primary/20 transition-colors">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider leading-tight pr-2">{card.label}</p>
                  <card.icon className={`h-3.5 w-3.5 shrink-0 ${card.color}`} />
                </div>
                <p className={`text-xl font-black ${card.color}`}>{card.value}</p>
                {card.sub && (
                  <div className="flex items-center gap-1 mt-1">
                    {card.sub.up ? <ArrowUpRight className="h-3 w-3 text-primary" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />}
                    <p className="text-xs text-muted-foreground">{card.sub.text}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Timeline visuel ─────────────────────────────────────────────── */}
      {timelineData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              Timeline & Avancement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dates row */}
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>{new Date(project.startDate).toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" })}</span>
              <span className="font-semibold text-primary">Aujourd'hui</span>
              {project.endDate && (
                <span>{new Date(project.endDate).toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" })}</span>
              )}
            </div>

            {/* Timeline bar */}
            <div className="relative h-6">
              {/* Background */}
              <div className="absolute inset-y-0 inset-x-0 rounded-full bg-muted/60 overflow-hidden">
                {/* Expected progress ghost */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary/20 transition-all"
                  style={{ width: `${timelineData.timeElapsedPct}%` }}
                />
                {/* Actual progress */}
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${health === "green" ? "bg-primary" : health === "amber" ? "bg-accent" : "bg-destructive"}`}
                  style={{ width: `${timelineData.actual}%` }}
                />
              </div>
              {/* Today marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/70 z-10"
                style={{ left: `${timelineData.timeElapsedPct}%` }}
              />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-lg font-black text-primary">{timelineData.actual}%</div>
                <div className="text-xs text-muted-foreground">Avancement réel</div>
              </div>
              <div className="text-center border-x border-border">
                <div className={`text-lg font-black ${timelineData.delta >= 0 ? "text-primary" : "text-destructive"}`}>
                  {timelineData.delta >= 0 ? "+" : ""}{timelineData.delta.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Écart vs attendu</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-black ${timelineData.daysLeft === null ? "text-muted-foreground" : timelineData.daysLeft < 0 ? "text-destructive" : timelineData.daysLeft <= 30 ? "text-accent" : "text-foreground"}`}>
                  {timelineData.daysLeft === null ? "—"
                    : timelineData.daysLeft < 0 ? `${Math.abs(timelineData.daysLeft)}j dépassé`
                    : timelineData.daysLeft === 0 ? "Aujourd'hui"
                    : `${timelineData.daysLeft}j`}
                </div>
                <div className="text-xs text-muted-foreground">Avant échéance</div>
              </div>
            </div>

            {/* Dérive alert */}
            {timelineData.delta < -10 && (
              <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${health === "red" ? "bg-destructive/10 border-destructive/25 text-destructive" : "bg-accent/10 border-accent/25 text-accent"}`}>
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Retard détecté :</strong> l'avancement réel est en retard de{" "}
                  <strong>{Math.abs(timelineData.delta).toFixed(0)} points</strong> par rapport au calendrier prévu.
                  {timelineData.daysLeft !== null && timelineData.daysLeft > 0 &&
                    ` Il reste ${timelineData.daysLeft} jours pour rattraper ce retard.`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — Description + Comparatif */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Aperçu & Description
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {project.description || "Aucune description renseignée pour ce projet."}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Date de début :</span>
                  <span className="font-semibold ml-1">{new Date(project.startDate).toLocaleDateString("fr-DZ")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Date de fin :</span>
                  <span className="font-semibold ml-1">{project.endDate ? new Date(project.endDate).toLocaleDateString("fr-DZ") : "À définir"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Durée totale :</span>
                  <span className="font-semibold ml-1">{durationYears} an{durationYears > 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Wilaya :</span>
                  <span className="font-semibold ml-1">{project.region}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparatif prévu vs réalisé */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" />
                Comparatif Prévu / Réalisé
              </CardTitle>
              <CardDescription className="text-xs">Analyse d'écart entre les objectifs initiaux et la situation actuelle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    label: "Avancement du projet",
                    expected: timelineData?.expectedProgress ?? 50,
                    actual: project.progressPercent ?? 0,
                    unit: "%",
                    format: (v: number) => `${v.toFixed(0)}%`,
                  },
                  {
                    label: "Rendement (TRI vs seuil 10%)",
                    expected: 10,
                    actual: project.irr ?? 0,
                    unit: "%",
                    format: (v: number) => `${v.toFixed(1)}%`,
                  },
                  {
                    label: "Valeur vs investissement initial",
                    expected: 100,
                    actual: project.investmentAmount > 0
                      ? (project.currentValue / project.investmentAmount) * 100
                      : 0,
                    unit: "%",
                    format: (v: number) => `${v.toFixed(0)}%`,
                  },
                ].map((row, i) => {
                  const delta = row.actual - row.expected;
                  const isGood = delta >= 0;
                  const maxVal = Math.max(row.expected, row.actual, 1);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{row.label}</span>
                        <div className="flex items-center gap-1">
                          {isGood ? <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
                          <span className={`text-xs font-bold ${isGood ? "text-primary" : "text-destructive"}`}>
                            {isGood ? "+" : ""}{delta.toFixed(1)}{row.unit}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16">Prévu</span>
                          <div className="flex-1 bg-muted/60 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-muted-foreground/50 h-full rounded-full" style={{ width: `${(row.expected / maxVal) * 100}%` }} />
                          </div>
                          <span className="text-xs font-mono w-12 text-right text-muted-foreground">{row.format(row.expected)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16">Réalisé</span>
                          <div className="flex-1 bg-muted/60 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isGood ? "bg-primary" : "bg-destructive"}`} style={{ width: `${(row.actual / maxVal) * 100}%` }} />
                          </div>
                          <span className={`text-xs font-mono w-12 text-right font-bold ${isGood ? "text-primary" : "text-destructive"}`}>{row.format(row.actual)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right — ML Insights */}
        <div className="space-y-5">
          <Card className="border-accent/25 bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-accent text-sm">
                <BrainCircuit className="h-4 w-4" />
                Prédictions ML
              </CardTitle>
              <CardDescription className="text-xs">Analyse IA — modèle FNI v2</CardDescription>
            </CardHeader>
            <CardContent>
              {isPredictionsLoading ? <Skeleton className="h-40 w-full" /> : prediction ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-card border border-accent/20 text-center">
                      <div className="text-xs text-muted-foreground mb-1">TRI Prédit</div>
                      <div className="text-2xl font-black text-accent">{prediction.predictedIrr.toFixed(1)}%</div>
                      {project.irr != null && (
                        <div className={`text-xs mt-1 flex items-center justify-center gap-0.5 ${prediction.predictedIrr >= project.irr ? "text-primary" : "text-destructive"}`}>
                          {prediction.predictedIrr >= project.irr ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {(prediction.predictedIrr - (project.irr ?? 0) >= 0 ? "+" : "")}{(prediction.predictedIrr - (project.irr ?? 0)).toFixed(1)}% vs actuel
                        </div>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-primary/20 text-center">
                      <div className="text-xs text-muted-foreground mb-1">P(Succès)</div>
                      <div className={`text-2xl font-black ${prediction.successProbability >= 60 ? "text-primary" : prediction.successProbability >= 40 ? "text-accent" : "text-destructive"}`}>
                        {prediction.successProbability.toFixed(0)}%
                      </div>
                      <Progress value={prediction.successProbability} className="h-1 mt-2" />
                    </div>
                  </div>
                  {prediction.keyFactors && prediction.keyFactors.length > 0 && (
                    <div className="pt-3 border-t border-accent/20">
                      <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Facteurs Clés</div>
                      <ul className="space-y-1.5">
                        {prediction.keyFactors.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <span className="text-accent mt-0.5 shrink-0">◆</span>
                            <span className="text-muted-foreground">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <BrainCircuit className="h-8 w-8 mx-auto mb-2 opacity-25" />
                  Aucune prédiction ML disponible.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Historique des Valorisations ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="h-4 w-4 text-primary" />
            Historique des Valorisations
          </CardTitle>
          <CardDescription className="text-xs">
            {isValuationsLoading ? "Chargement..." : `${sortedValuations.length} valorisation${sortedValuations.length !== 1 ? "s" : ""} enregistrée${sortedValuations.length !== 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isValuationsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : sortedValuations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <History className="h-8 w-8 opacity-20" />
              <p className="text-sm text-muted-foreground">Aucune valorisation enregistrée pour ce projet.</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/valuations/new")}>
                Ajouter une valorisation
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart */}
              {valuationChartData.length >= 2 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Évolution de la valeur</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={valuationChartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={v => formatDZD(v)} width={80} />
                      <RTooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number, _: string, p: any) => [formatDZD(v), p.payload.method]}
                      />
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} activeDot={{ r: 5 }} />
                      <ReferenceLine
                        y={project.investmentAmount}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="4 4"
                        label={{ value: "I₀", position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Table */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Détail des valorisations</div>
                <div className="space-y-2">
                  {sortedValuations.map((v, i) => {
                    const delta = v.value - project.investmentAmount;
                    const isUp  = delta >= 0;
                    return (
                      <motion.div
                        key={v.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {VALUATION_METHOD_LABEL[v.method] ?? v.method}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(v.valuationDate).toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            {v.analyst && <span className="text-xs text-muted-foreground">· {v.analyst}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`font-mono font-bold text-sm ${isUp ? "text-primary" : "text-destructive"}`}>{formatDZD(v.value)}</div>
                          <div className={`text-xs flex items-center justify-end gap-0.5 ${isUp ? "text-primary" : "text-destructive"}`}>
                            {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {isUp ? "+" : ""}{((delta / project.investmentAmount) * 100).toFixed(1)}% vs I₀
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Analyse Financière ──────────────────────────────────────────── */}
      <div>
        <Button
          variant="outline"
          className="w-full justify-between gap-2 h-12 text-base font-semibold border-primary/20 hover:border-primary/40"
          onClick={() => setShowFinance(!showFinance)}
        >
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Analyse Financière — VAN · TRI · TRIM · CAF · Analyse du Risque
          </div>
          {showFinance ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5" />}
        </Button>
        {showFinance && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <ProjectFinancialAnalysis
              investmentAmount={project.investmentAmount}
              irrEstimate={project.irr ?? undefined}
              durationYears={durationYears}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
