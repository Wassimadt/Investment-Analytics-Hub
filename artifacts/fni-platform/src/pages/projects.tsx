import { useState } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { useLocation } from "wouter";
import { Plus, Search, Filter, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export default function Projects() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [, navigate] = useLocation();

  const { data: projects, isLoading } = useListProjects({
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    search: search || undefined,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-primary/20 text-primary hover:bg-primary/30 border-primary/20";
      case "completed": return "bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 border-blue-500/20";
      case "suspended": return "bg-destructive/20 text-destructive hover:bg-destructive/30 border-destructive/20";
      case "evaluation": return "bg-accent/20 text-accent hover:bg-accent/30 border-accent/20";
      case "pipeline": return "bg-muted text-muted-foreground border-border";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (s: string) => ({ active: "Actif", completed: "Terminé", suspended: "Suspendu", evaluation: "Évaluation", pipeline: "Pipeline" }[s] ?? s);
  const getRiskColor = (r: string) => ({ low: "text-primary", medium: "text-accent", high: "text-orange-500", critical: "text-destructive" }[r] ?? "text-muted-foreground");
  const getRiskLabel = (r: string) => ({ low: "Faible", medium: "Modéré", high: "Élevé", critical: "Critique" }[r] ?? r);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Projets d'Investissement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects ? `${projects.length} projet${projects.length > 1 ? "s" : ""} dans le portefeuille` : "Chargement..."}
          </p>
        </div>
        <Button onClick={() => navigate("/projects/new")} className="gap-2" size="lg">
          <Plus className="h-4 w-4" /> Nouveau Projet
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un projet..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
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
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Projet</TableHead>
                <TableHead>Secteur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Investissement</TableHead>
                <TableHead className="text-right">TRI</TableHead>
                <TableHead>Risque</TableHead>
                <TableHead>Avancement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : projects && projects.length > 0 ? (
                projects.map((project, idx) => (
                  <motion.tr
                    key={project.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="cursor-pointer hover:bg-muted/50 transition-colors border-b border-border"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{project.name}</div>
                      {project.companyName && (
                        <div className="text-xs text-muted-foreground mt-0.5">{project.companyName} · {project.region}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{project.sector}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(project.status)}>
                        {getStatusLabel(project.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(project.investmentAmount, "DZD")}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-accent">
                      {project.irr ? `${project.irr.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${getRiskColor(project.riskLevel)}`}>{getRiskLabel(project.riskLevel)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <Progress value={project.progressPercent ?? 0} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{project.progressPercent ?? 0}%</span>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <TrendingUp className="h-8 w-8 opacity-30" />
                      <div>
                        <p className="font-medium">Aucun projet trouvé</p>
                        <p className="text-sm">Créez votre premier projet d'investissement</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate("/projects/new")} className="gap-2">
                        <Plus className="h-3 w-3" /> Nouveau projet
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
