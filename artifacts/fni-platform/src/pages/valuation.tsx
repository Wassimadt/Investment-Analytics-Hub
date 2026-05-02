import { useState } from "react";
import { useListValuations, useListCompanies, useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDZD } from "@/lib/utils";
import { useLocation } from "wouter";
import { Plus, Calculator, Search, TrendingUp, Building2, Briefcase, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";

const METHOD_CFG: Record<string, { label: string; color: string }> = {
  dcf:         { label: "DCF",            color: "bg-primary/15 text-primary border-primary/25" },
  market_comp: { label: "Comp. Marché",   color: "bg-accent/15 text-accent border-accent/25" },
  asset_based: { label: "Actif Net",      color: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  precedent:   { label: "Trans. Précéd.", color: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
  book_value:  { label: "Val. Comptable", color: "bg-muted text-muted-foreground border-border" },
  comparables: { label: "Comparables",    color: "bg-accent/15 text-accent border-accent/25" },
  market:      { label: "Marché",         color: "bg-accent/15 text-accent border-accent/25" },
};

export default function Valuation() {
  const { data: valuations, isLoading } = useListValuations();
  const { data: companies }             = useListCompanies();
  const { data: projects  }             = useListProjects();
  const [, navigate] = useLocation();
  const [search, setSearch]     = useState("");
  const [methodFilter, setMethod] = useState("all");

  const getEntityName = (v: { companyId?: number | null; projectId?: number | null }) => {
    if (v.companyId && companies) return companies.find(c => c.id === v.companyId)?.name ?? `Entreprise #${v.companyId}`;
    if (v.projectId && projects)  return projects.find(p => p.id === v.projectId)?.name  ?? `Projet #${v.projectId}`;
    return "—";
  };
  const getEntityType = (v: { companyId?: number | null; projectId?: number | null }) => {
    if (v.companyId) return { label: "Entreprise", Icon: Building2, color: "bg-primary/10 text-primary border-primary/20" };
    if (v.projectId) return { label: "Projet",     Icon: Briefcase, color: "bg-accent/10 text-accent border-accent/20" };
    return { label: "—", Icon: Building2, color: "" };
  };
  const getRefValue = (v: { companyId?: number | null; projectId?: number | null }) => {
    if (v.projectId && projects) return projects.find(p => p.id === v.projectId)?.investmentAmount ?? null;
    return null;
  };

  const filtered = (valuations ?? []).filter(v => {
    const name = getEntityName(v).toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || (v.analyst?.toLowerCase() ?? "").includes(search.toLowerCase());
    const matchMethod = methodFilter === "all" || v.method === methodFilter;
    return matchSearch && matchMethod;
  }).sort((a, b) => new Date(b.valuationDate).getTime() - new Date(a.valuationDate).getTime());

  /* ── KPI summary ──────────────────────────────────────────────────── */
  const totalValue = filtered.reduce((s, v) => s + v.value, 0);
  const methods    = [...new Set(filtered.map(v => v.method))];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Registre des Valorisations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Chargement..." : `${filtered.length} valorisation${filtered.length > 1 ? "s" : ""} · ${[...new Set(filtered.map(v => getEntityName(v)))].length} entités`}
          </p>
        </div>
        <Button onClick={() => navigate("/valuation/new")} className="gap-2" size="lg">
          <Plus className="h-4 w-4" /> Nouvelle Valorisation
        </Button>
      </div>

      {/* KPI strip */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total valorisé</p>
              <p className="text-xl font-black text-primary mt-1">{formatDZD(totalValue)}</p>
              <p className="text-xs text-muted-foreground">{filtered.length} évaluations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Méthodes utilisées</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {methods.map(m => (
                  <Badge key={m} variant="outline" className={`text-xs ${METHOD_CFG[m]?.color ?? ""}`}>
                    {METHOD_CFG[m]?.label ?? m}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Dernière valorisation</p>
              {filtered[0] && (
                <>
                  <p className="text-sm font-bold mt-1 truncate">{getEntityName(filtered[0])}</p>
                  <p className="text-xs text-muted-foreground">{new Date(filtered[0].valuationDate).toLocaleDateString("fr-DZ")}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={methodFilter} onValueChange={setMethod}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les méthodes</SelectItem>
            {Object.entries(METHOD_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Entité</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Type</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Méthode</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Valeur</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Δ vs I₀</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Analyste</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((v, idx) => {
                  const et    = getEntityType(v);
                  const mCfg  = METHOD_CFG[v.method] ?? { label: v.method, color: "bg-muted text-muted-foreground" };
                  const ref   = getRefValue(v);
                  const delta = ref && ref > 0 ? ((v.value - ref) / ref) * 100 : null;
                  return (
                    <motion.tr
                      key={v.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="hover:bg-muted/40 transition-colors border-b border-border/60"
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {new Date(v.valuationDate).toLocaleDateString("fr-DZ")}
                      </TableCell>
                      <TableCell className="font-semibold text-sm max-w-[180px] truncate">
                        {getEntityName(v)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${et.color}`}>
                          <et.Icon className="h-3 w-3 mr-1" />{et.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${mCfg.color}`}>{mCfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-accent text-sm">
                        {formatDZD(v.value)}
                      </TableCell>
                      <TableCell className="text-right">
                        {delta !== null ? (
                          <div className={`flex items-center justify-end gap-0.5 text-xs font-bold ${delta >= 0 ? "text-primary" : "text-destructive"}`}>
                            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{v.analyst || "—"}</TableCell>
                    </motion.tr>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Calculator className="h-8 w-8 opacity-25" />
                      <div>
                        <p className="font-medium">Aucune valorisation trouvée</p>
                        <p className="text-sm">Modifiez les filtres ou créez une nouvelle valorisation</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate("/valuation/new")} className="gap-2">
                        <Plus className="h-3.5 w-3.5" /> Nouvelle valorisation
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
