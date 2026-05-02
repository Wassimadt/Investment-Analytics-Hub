import { useGetDashboardSummary, useGetDashboardActivity, useGetSectorBreakdown, useGetMlPortfolioForecast, useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import {
  Activity, TrendingUp, AlertCircle, Briefcase, ChevronRight,
  Building2, ShieldAlert, CheckCircle2, Clock, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Minus, Zap, Calendar,
} from "lucide-react";
import { formatDZD, formatPercentage, getProjectHealth, daysUntilDeadline } from "@/lib/utils";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

const SECTOR_COLORS = ["#16a34a","#ca8a04","#2563eb","#db2777","#ea580c","#7c3aed","#0891b2","#d97706"];

const HEALTH_CONFIG = {
  green: { label: "En bonne santé", color: "text-primary",   bg: "bg-primary/10",   border: "border-primary/20",   dot: "bg-primary",     icon: CheckCircle2 },
  amber: { label: "À surveiller",   color: "text-accent",    bg: "bg-accent/10",    border: "border-accent/20",    dot: "bg-accent",      icon: AlertTriangle },
  red:   { label: "En alerte",      color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", dot: "bg-destructive", icon: AlertCircle },
};

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  project_created: Briefcase, project_updated: Activity,
  company_added: Building2, valuation_added: TrendingUp, default: Zap,
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: activity, isLoading: isActivityLoading } = useGetDashboardActivity();
  const { data: sectorData, isLoading: isSectorLoading } = useGetSectorBreakdown();
  const { data: forecast, isLoading: isForecastLoading } = useGetMlPortfolioForecast();
  const { data: projects } = useListProjects();

  /* ── Alert lists computed from live projects ─────────────────────────── */
  const alertProjects = projects
    ?.map(p => ({ ...p, health: getProjectHealth(p), days: daysUntilDeadline(p.endDate) }))
    .filter(p => p.health !== "green" || (p.days !== null && p.days <= 30))
    .sort((a, b) => {
      const order = { red: 0, amber: 1, green: 2 } as const;
      return order[a.health] - order[b.health];
    })
    .slice(0, 5) ?? [];

  const healthCounts = projects?.reduce((acc, p) => {
    const h = getProjectHealth(p);
    acc[h] = (acc[h] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  /* ── KPI cards ────────────────────────────────────────────────────────── */
  const kpiCards = summary ? [
    {
      label: "Valeur Totale du Portefeuille",
      value: formatDZD(summary.totalPortfolioValue),
      delta: `+${summary.portfolioGrowthPercent?.toFixed(1) ?? "0"}% ce mois`,
      deltaUp: true,
      icon: Briefcase,
      color: "text-primary",
    },
    {
      label: "TRI Moyen Pondéré",
      value: formatPercentage(summary.averageIrr),
      delta: `Sur ${summary.totalProjects} projets`,
      deltaUp: null,
      icon: TrendingUp,
      color: "text-accent",
    },
    {
      label: "Projets Actifs",
      value: String(summary.activeProjects),
      delta: `${summary.totalProjects - summary.activeProjects} inactifs`,
      deltaUp: null,
      icon: Activity,
      color: "text-blue-400",
    },
    {
      label: "Projets en Alerte",
      value: String(summary.projectsAtRisk),
      delta: summary.projectsAtRisk > 0 ? "Attention requise" : "Tout est sous contrôle",
      deltaUp: summary.projectsAtRisk === 0 ? true : false,
      icon: AlertCircle,
      color: summary.projectsAtRisk > 0 ? "text-destructive" : "text-primary",
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isSummaryLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          : kpiCards.map((card, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <Card className="relative overflow-hidden hover:border-primary/30 transition-colors">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight pr-2">{card.label}</p>
                    <div className={`p-1.5 rounded-md bg-muted/40`}>
                      <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-black tracking-tight ${card.color}`}>{card.value}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {card.deltaUp === true && <ArrowUpRight className="h-3 w-3 text-primary" />}
                    {card.deltaUp === false && <ArrowDownRight className="h-3 w-3 text-destructive" />}
                    {card.deltaUp === null && <Minus className="h-3 w-3 text-muted-foreground" />}
                    <p className="text-xs text-muted-foreground">{card.delta}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        }
      </div>

      {/* ── Health overview bar ──────────────────────────────────────────── */}
      {projects && projects.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Santé du Portefeuille</span>
                  {(["green","amber","red"] as const).map(h => {
                    const cfg = HEALTH_CONFIG[h];
                    const n = healthCounts[h] ?? 0;
                    return (
                      <div key={h} className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                        <span className={`text-sm font-bold ${cfg.color}`}>{n}</span>
                        <span className="text-xs text-muted-foreground">{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex h-2 w-40 rounded-full overflow-hidden gap-px">
                  {(["green","amber","red"] as const).map(h => {
                    const pct = ((healthCounts[h] ?? 0) / projects.length) * 100;
                    return pct > 0 ? (
                      <div key={h} style={{ width: `${pct}%` }} className={`${HEALTH_CONFIG[h].dot} transition-all`} />
                    ) : null;
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forecast chart */}
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Prévision du Portefeuille
            </CardTitle>
            <CardDescription>Projection ML sur 12 mois — valeur estimée en DZD</CardDescription>
          </CardHeader>
          <CardContent>
            {isForecastLoading ? <Skeleton className="h-64" /> : forecast && forecast.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={forecast} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => formatDZD(v)} width={90} />
                  <RechartsTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [formatDZD(v), "Valeur prévue"]}
                  />
                  <Area type="monotone" dataKey="predictedValue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gForecast)" dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Aucune prévision disponible</div>
            )}
          </CardContent>
        </Card>

        {/* Sector breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent" />
              Répartition Sectorielle
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSectorLoading ? <Skeleton className="h-64" /> : sectorData && sectorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={sectorData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="sector" type="category" width={90} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [formatDZD(v), "Valeur"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {sectorData.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Aucune donnée</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Alert panel + Activity ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <Card className="border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Alertes & Projets à Surveiller
              {alertProjects.length > 0 && (
                <Badge variant="outline" className="ml-auto text-destructive border-destructive/30 bg-destructive/10 font-bold">
                  {alertProjects.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <CheckCircle2 className="h-10 w-10 text-primary opacity-50" />
                <div className="text-center">
                  <p className="text-sm font-medium">Portefeuille en bonne santé</p>
                  <p className="text-xs text-muted-foreground">Aucune alerte active</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {alertProjects.map((p, i) => {
                  const cfg = HEALTH_CONFIG[p.health];
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${cfg.bg} ${cfg.border}`}
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{p.sector}</span>
                          {p.days !== null && (
                            <span className={`text-xs font-medium flex items-center gap-0.5 ${p.days < 0 ? "text-destructive" : p.days <= 30 ? "text-accent" : "text-muted-foreground"}`}>
                              <Clock className="h-2.5 w-2.5" />
                              {p.days < 0 ? `${Math.abs(p.days)}j dépassé` : `${p.days}j restants`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                        <div className="flex items-center gap-1">
                          <Progress value={p.progressPercent} className="h-1 w-16" />
                          <span className="text-xs text-muted-foreground">{p.progressPercent}%</span>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Activité Récente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {isActivityLoading
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)
                : activity && activity.length > 0 ? activity.map((item, i) => {
                  const Icon = ACTIVITY_ICONS[item.type] ?? ACTIVITY_ICONS.default;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="mt-0.5 h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono shrink-0 flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.createdAt).toLocaleDateString("fr-DZ", { day: "2-digit", month: "short" })}
                      </div>
                    </motion.div>
                  );
                }) : (
                  <div className="text-sm text-muted-foreground py-8 text-center">Aucune activité récente</div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
