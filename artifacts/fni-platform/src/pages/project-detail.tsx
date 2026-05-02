import { useState } from "react";
import { useGetProject, useGetMlPredictions, getGetProjectQueryKey, getGetMlPredictionsQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { AlertCircle, BrainCircuit, Activity, Calendar, ChevronDown, ChevronUp, Calculator } from "lucide-react";
import { ProjectFinancialAnalysis } from "@/components/project-financial-analysis";

export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = parseInt(id || "0", 10);
  const [showFinance, setShowFinance] = useState(false);

  const { data: project, isLoading: isProjectLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  const { data: predictions, isLoading: isPredictionsLoading } = useGetMlPredictions({
    query: { queryKey: getGetMlPredictionsQueryKey() }
  });

  const prediction = predictions?.find(p => p.projectId === projectId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-primary/20 text-primary border-primary/20';
      case 'completed': return 'bg-blue-500/20 text-blue-500 border-blue-500/20';
      case 'suspended': return 'bg-destructive/20 text-destructive border-destructive/20';
      case 'evaluation': return 'bg-accent/20 text-accent border-accent/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (s: string) => ({ active: "Actif", completed: "Terminé", suspended: "Suspendu", evaluation: "Évaluation", pipeline: "Pipeline" }[s] ?? s);
  const getRiskColor = (r: string) => ({ low: "text-primary", medium: "text-accent", high: "text-orange-500", critical: "text-destructive" }[r] ?? "text-muted-foreground");
  const getRiskLabel = (r: string) => ({ low: "Faible", medium: "Modéré", high: "Élevé", critical: "Critique" }[r] ?? r);

  if (isProjectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!project) return <div className="text-muted-foreground">Projet introuvable.</div>;

  const durationYears = project.startDate && project.endDate
    ? Math.max(1, Math.round((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (365.25 * 24 * 3600 * 1000)))
    : 5;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {project.companyName && <span>{project.companyName} ·</span>}
            <span>{project.sector}</span>
            {project.region && <><span>·</span><span>{project.region}</span></>}
          </p>
        </div>
        <Badge variant="outline" className={getStatusColor(project.status)}>
          {getStatusLabel(project.status)}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Investissement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(project.investmentAmount, "DZD")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valeur Actuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary">{formatCurrency(project.currentValue, "DZD")}</div>
            {project.currentValue > project.investmentAmount
              ? <div className="text-xs text-primary mt-0.5">+{(((project.currentValue - project.investmentAmount) / project.investmentAmount) * 100).toFixed(1)}% vs investissement</div>
              : <div className="text-xs text-destructive mt-0.5">{(((project.currentValue - project.investmentAmount) / project.investmentAmount) * 100).toFixed(1)}% vs investissement</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">TRI (IRR)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-accent">{project.irr ? `${project.irr.toFixed(1)}%` : '—'}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Taux de rendement interne</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Niveau de Risque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold flex items-center gap-2 ${getRiskColor(project.riskLevel)}`}>
              {(project.riskLevel === 'critical' || project.riskLevel === 'high') && <AlertCircle className="w-4 h-4" />}
              {getRiskLabel(project.riskLevel)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overview */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Aperçu du Projet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Description</h4>
                <p className="text-sm leading-relaxed">{project.description || "Aucune description renseignée."}</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Avancement</h4>
                  <span className="text-sm font-bold text-primary">{project.progressPercent ?? 0}%</span>
                </div>
                <Progress value={project.progressPercent ?? 0} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Début :</span>
                  <span className="font-medium">{new Date(project.startDate).toLocaleDateString("fr-DZ")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Fin :</span>
                  <span className="font-medium">{project.endDate ? new Date(project.endDate).toLocaleDateString("fr-DZ") : 'À définir'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ML Insights */}
        <div className="space-y-6">
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-accent text-base">
                <BrainCircuit className="w-5 h-5 mr-2" />
                ML Insights
              </CardTitle>
              <CardDescription>Prédictions IA pour ce projet</CardDescription>
            </CardHeader>
            <CardContent>
              {isPredictionsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : prediction ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">TRI Prédit</div>
                    <div className="text-2xl font-bold">{prediction.predictedIrr.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Probabilité de Succès</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-bold text-primary">{prediction.successProbability.toFixed(0)}%</div>
                      <Progress value={prediction.successProbability} className="h-1.5 flex-1" />
                    </div>
                  </div>
                  {prediction.keyFactors && prediction.keyFactors.length > 0 && (
                    <div className="pt-3 border-t border-accent/20">
                      <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Facteurs Clés</div>
                      <ul className="space-y-1">
                        {prediction.keyFactors.map((factor, i) => (
                          <li key={i} className="text-xs flex items-start">
                            <span className="text-accent mr-2">•</span> {factor}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Aucune prédiction ML disponible.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Financial Analysis Section */}
      <div>
        <Button
          variant="outline"
          className="w-full justify-between gap-2 h-12 text-base font-semibold"
          onClick={() => setShowFinance(!showFinance)}
        >
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Analyse Financière — VAN · TRI · TRIM · CAF · Analyse du Risque
          </div>
          {showFinance ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </Button>

        {showFinance && (
          <div className="mt-4">
            <ProjectFinancialAnalysis
              investmentAmount={project.investmentAmount}
              irrEstimate={project.irr ?? undefined}
              durationYears={durationYears}
            />
          </div>
        )}
      </div>
    </div>
  );
}
