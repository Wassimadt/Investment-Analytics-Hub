import { useState, useMemo } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDZD, getProjectHealth, daysUntilDeadline } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  Plus, Search, Filter, TrendingUp, AlertCircle, CheckCircle2,
  AlertTriangle, Clock, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { motion } from "framer-motion";

type SortKey = "name" | "investment" | "irr" | "progress" | "health";
type SortDir = "asc" | "desc";

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  active:    { label: "Actif",      cls: "bg-primary/15 text-primary border-primary/20" },
  completed: { label: "Terminé",    cls: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  suspended: { label: "Suspendu",   cls: "bg-destructive/15 text-destructive border-destructive/20" },
  evaluation:{ label: "Évaluation", cls: "bg-accent/15 text-accent border-accent/20" },
  pipeline:  { label: "Pipeline",   cls: "bg-muted text-muted-foreground border-border" },
  on_hold:   { label: "En suspens", cls: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  review:    { label: "Révision",   cls: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
};

const RISK_CFG: Record<string, { label: string; color: string }> = {
  low:      { label: "Faible",   color: "text-primary" },
  medium:   { label: "Modéré",   color: "text-accent" },
  high:     { label: "Élevé",    color: "text-orange-400" },
  critical: { label: "Critique", color: "text-destructive" },
};

const HEALTH_CFG = {
  green: { icon: CheckCircle2, label: "Sain",     cls: "text-primary bg-primary/10 border-primary/20" },
  amber: { icon: AlertTriangle,label: "Vigilance", cls: "text-accent bg-accent/10 border-accent/20" },
  red:   { icon: AlertCircle,  label: "Alerte",   cls: "text-destructive bg-destructive/10 border-destructive/20" },
};

function SortIcon({ k, sortKey, sortDir }: { k: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
  return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
}

export default function Projects() {
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [riskFilter, setRisk]     = useState("all");
  const [healthFilter, setHealth] = useState("all");
  const [sortKey, setSortKey]     = useState<SortKey>("name");
  const [sortDir, setSortDir]     = useState<SortDir>("asc");
  const [, navigate] = useLocation();

  const { data: rawProjects, isLoading } = useListProjects({
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    search: search || undefined,
  });

  const projects = useMemo(() => {
    if (!rawProjects) return [];
    let list = rawProjects
      .filter(p => riskFilter === "all" || p.riskLevel === riskFilter)
      .map(p => ({ ...p, health: getProjectHealth(p), days: daysUntilDeadline(p.endDate) }));

    if (healthFilter !== "all") list = list.filter(p => p.health === healthFilter);

    list.sort((a, b) => {
      let diff = 0;
      if (sortKey === "name")       diff = a.name.localeCompare(b.name);
      else if (sortKey === "investment") diff = a.investmentAmount - b.investmentAmount;
      else if (sortKey === "irr")   diff = (a.irr ?? 0) - (b.irr ?? 0);
      else if (sortKey === "progress") diff = a.progressPercent - b.progressPercent;
      else if (sortKey === "health") {
        const ord = { red: 0, amber: 1, green: 2 } as const;
        diff = ord[a.health] - ord[b.health];
      }
      return sortDir === "asc" ? diff : -diff;
    });
    return list;
  }, [rawProjects, riskFilter, healthFilter, sortKey, sortDir]);

  const toggle = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const counts = useMemo(() => {
    const c = { total: projects.length, green: 0, amber: 0, red: 0 };
    projects.forEach(p => c[p.health]++);
    return c;
  }, [projects]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Projets d'Investissement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Chargement..." : `${counts.total} projet${counts.total > 1 ? "s" : ""} · `}
            {!isLoading && <span className="text-primary">{counts.green} sains</span>}
            {!isLoading && <span className="mx-1 text-muted-foreground">·</span>}
            {!isLoading && <span className="text-accent">{counts.amber} vigilance</span>}
            {!isLoading && <span className="mx-1 text-muted-foreground">·</span>}
            {!isLoading && <span className="text-destructive">{counts.red} alertes</span>}
          </p>
        </div>
        <Button onClick={() => navigate("/projects/new")} className="gap-2" size="lg">
          <Plus className="h-4 w-4" /> Nouveau Projet
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-40 h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="evaluation">Évaluation</SelectItem>
            <SelectItem value="pipeline">Pipeline</SelectItem>
            <SelectItem value="completed">Terminé</SelectItem>
            <SelectItem value="suspended">Suspendu</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRisk}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Risque" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout risque</SelectItem>
            <SelectItem value="low">Faible</SelectItem>
            <SelectItem value="medium">Modéré</SelectItem>
            <SelectItem value="high">Élevé</SelectItem>
            <SelectItem value="critical">Critique</SelectItem>
          </SelectContent>
        </Select>
        <Select value={healthFilter} onValueChange={setHealth}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Santé" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute santé</SelectItem>
            <SelectItem value="green">Sain</SelectItem>
            <SelectItem value="amber">Vigilance</SelectItem>
            <SelectItem value="red">Alerte</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>
                  <button className="flex items-center text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors" onClick={() => toggle("name")}>
                    Projet <SortIcon k="name" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Secteur</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Statut</TableHead>
                <TableHead>
                  <button className="flex items-center text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors ml-auto" onClick={() => toggle("investment")}>
                    Investissement <SortIcon k="investment" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors ml-auto" onClick={() => toggle("irr")}>
                    TRI <SortIcon k="irr" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Risque</TableHead>
                <TableHead>
                  <button className="flex items-center text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors" onClick={() => toggle("progress")}>
                    Avancement <SortIcon k="progress" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors" onClick={() => toggle("health")}>
                    Santé <SortIcon k="health" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Échéance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : projects.length > 0 ? (
                projects.map((p, idx) => {
                  const hcfg = HEALTH_CFG[p.health];
                  const HIcon = hcfg.icon;
                  const status = STATUS_CFG[p.status] ?? { label: p.status, cls: "bg-muted text-muted-foreground" };
                  const risk = RISK_CFG[p.riskLevel] ?? { label: p.riskLevel, color: "text-muted-foreground" };
                  const daysLeft = p.days;

                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/60 group"
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <TableCell className="py-3">
                        <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{p.name}</div>
                        {p.companyName && (
                          <div className="text-xs text-muted-foreground mt-0.5">{p.companyName} · {p.region}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.sector}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${status.cls}`}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatDZD(p.investmentAmount)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono font-bold text-sm ${(p.irr ?? 0) >= 10 ? "text-accent" : "text-muted-foreground"}`}>
                          {p.irr != null ? `${p.irr.toFixed(1)}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${risk.color}`}>{risk.label}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[90px]">
                          <Progress value={p.progressPercent ?? 0} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right font-mono">{p.progressPercent ?? 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold ${hcfg.cls}`}>
                          <HIcon className="h-3 w-3" />
                          {hcfg.label}
                        </div>
                      </TableCell>
                      <TableCell>
                        {daysLeft !== null ? (
                          <div className={`flex items-center gap-1 text-xs font-medium ${
                            daysLeft < 0 ? "text-destructive" : daysLeft <= 30 ? "text-accent" : "text-muted-foreground"
                          }`}>
                            <Clock className="h-3 w-3" />
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}j dépassé` : daysLeft === 0 ? "Aujourd'hui" : `${daysLeft}j`}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </motion.tr>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center h-32 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <TrendingUp className="h-8 w-8 opacity-25" />
                      <div>
                        <p className="font-medium">Aucun projet trouvé</p>
                        <p className="text-sm">Modifiez les filtres ou créez un nouveau projet</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate("/projects/new")} className="gap-2">
                        <Plus className="h-3.5 w-3.5" /> Nouveau projet
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
