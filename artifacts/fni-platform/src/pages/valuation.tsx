import { useListValuations, useListCompanies, useListProjects } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useLocation } from "wouter";
import { Plus, Calculator } from "lucide-react";
import { motion } from "framer-motion";

const METHOD_LABELS: Record<string, string> = {
  dcf: "DCF",
  comparables: "Comparables",
  asset_based: "Actif Net",
  market: "Marché",
  book_value: "Val. Comptable",
};

const METHOD_COLORS: Record<string, string> = {
  dcf: "bg-primary/20 text-primary border-primary/20",
  comparables: "bg-accent/20 text-accent border-accent/20",
  asset_based: "bg-blue-500/20 text-blue-500 border-blue-500/20",
  market: "bg-purple-500/20 text-purple-400 border-purple-500/20",
  book_value: "bg-muted text-muted-foreground border-border",
};

export default function Valuation() {
  const { data: valuations, isLoading } = useListValuations();
  const { data: companies } = useListCompanies();
  const { data: projects } = useListProjects();
  const [, navigate] = useLocation();

  const getEntityName = (v: { companyId?: number | null; projectId?: number | null }) => {
    if (v.companyId && companies) {
      const c = companies.find(c => c.id === v.companyId);
      return c ? c.name : `Entreprise #${v.companyId}`;
    }
    if (v.projectId && projects) {
      const p = projects.find(p => p.id === v.projectId);
      return p ? p.name : `Projet #${v.projectId}`;
    }
    return "—";
  };

  const getEntityType = (v: { companyId?: number | null; projectId?: number | null }) => {
    if (v.companyId) return { label: "Entreprise", color: "bg-primary/10 text-primary border-primary/20" };
    if (v.projectId) return { label: "Projet", color: "bg-accent/10 text-accent border-accent/20" };
    return { label: "—", color: "" };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Registre des Valorisations</h1>
          <p className="text-sm text-muted-foreground mt-1">Valorisations officielles des entités du portefeuille FNI</p>
        </div>
        <Button onClick={() => navigate("/valuation/new")} className="gap-2" size="lg">
          <Plus className="h-4 w-4" /> Nouvelle Valorisation
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Date</TableHead>
                <TableHead>Entité</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
                <TableHead>Analyste</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : valuations && valuations.length > 0 ? (
                valuations.map((valuation, idx) => {
                  const entityType = getEntityType(valuation);
                  return (
                    <motion.tr
                      key={valuation.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="hover:bg-muted/50 transition-colors border-b border-border"
                    >
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {new Date(valuation.valuationDate).toLocaleDateString("fr-DZ")}
                      </TableCell>
                      <TableCell className="font-medium">{getEntityName(valuation)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={entityType.color}>{entityType.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={METHOD_COLORS[valuation.method] ?? "bg-muted text-muted-foreground"}>
                          {METHOD_LABELS[valuation.method] ?? valuation.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-accent">
                        {formatCurrency(valuation.value, valuation.currency)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{valuation.analyst || "—"}</TableCell>
                    </motion.tr>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Calculator className="h-8 w-8 opacity-30" />
                      <div>
                        <p className="font-medium">Aucune valorisation enregistrée</p>
                        <p className="text-sm">Créez la première valorisation du registre</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate("/valuation/new")} className="gap-2">
                        <Plus className="h-3 w-3" /> Nouvelle valorisation
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
