import { useState } from "react";
import { useListCompanies } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { useLocation } from "wouter";
import { Plus, Search, Filter, Building2, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

export default function Companies() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [, navigate] = useLocation();

  const { data: companies, isLoading } = useListCompanies({
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    search: search || undefined,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-primary/20 text-primary border-primary/20";
      case "inactive": return "bg-muted text-muted-foreground";
      case "watchlist": return "bg-accent/20 text-accent border-accent/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (s: string) => ({ active: "Actif", inactive: "Inactif", watchlist: "Surveillance" }[s] ?? s);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Entreprises du Portefeuille</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {companies ? `${companies.length} entreprise${companies.length > 1 ? "s" : ""} suivies` : "Chargement..."}
          </p>
        </div>
        <Button onClick={() => navigate("/companies/new")} className="gap-2" size="lg">
          <Plus className="h-4 w-4" /> Nouvelle Entreprise
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher une entreprise..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="watchlist">Sous surveillance</SelectItem>
            <SelectItem value="inactive">Inactif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Entreprise</TableHead>
                <TableHead>Secteur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Valorisation</TableHead>
                <TableHead className="text-right">Chiffre d'Affaires</TableHead>
                <TableHead className="text-right">Croissance</TableHead>
                <TableHead className="text-right">Employés</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : companies && companies.length > 0 ? (
                companies.map((company, idx) => (
                  <motion.tr
                    key={company.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="cursor-pointer hover:bg-muted/50 transition-colors border-b border-border"
                    onClick={() => navigate(`/companies/${company.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{company.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{company.region}{company.foundedYear ? ` · Fondée ${company.foundedYear}` : ""}</div>
                    </TableCell>
                    <TableCell className="text-sm">{company.sector}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(company.status)}>
                        {getStatusLabel(company.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {company.currentValuation ? formatCurrency(company.currentValuation, "DZD") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {company.revenue ? formatCurrency(company.revenue, "DZD") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {company.growthRate != null ? (
                        <span className={`font-mono font-bold flex items-center justify-end gap-1 ${Number(company.growthRate) >= 0 ? "text-primary" : "text-destructive"}`}>
                          {Number(company.growthRate) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {(Number(company.growthRate) * 100).toFixed(1)}%
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {company.employees ? company.employees.toLocaleString() : "—"}
                    </TableCell>
                  </motion.tr>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Building2 className="h-8 w-8 opacity-30" />
                      <div>
                        <p className="font-medium">Aucune entreprise trouvée</p>
                        <p className="text-sm">Ajoutez une entreprise au portefeuille</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate("/companies/new")} className="gap-2">
                        <Plus className="h-3 w-3" /> Nouvelle entreprise
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
