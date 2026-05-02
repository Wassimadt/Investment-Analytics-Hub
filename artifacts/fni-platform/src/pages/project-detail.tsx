import { useGetProject, useGetMlPredictions, getGetProjectQueryKey, getGetMlPredictionsQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { AlertCircle, BrainCircuit, Activity, Calendar } from "lucide-react";

export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = parseInt(id || "0", 10);
  
  const { data: project, isLoading: isProjectLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  const { data: predictions, isLoading: isPredictionsLoading } = useGetMlPredictions({
    query: { queryKey: getGetMlPredictionsQueryKey() }
  });

  const prediction = predictions?.find(p => p.projectId === projectId);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-primary/20 text-primary border-primary/20';
      case 'completed': return 'bg-blue-500/20 text-blue-500 border-blue-500/20';
      case 'suspended': return 'bg-destructive/20 text-destructive border-destructive/20';
      case 'evaluation': return 'bg-accent/20 text-accent border-accent/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case 'low': return 'text-primary';
      case 'medium': return 'text-accent';
      case 'high': return 'text-orange-500';
      case 'critical': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  if (isProjectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!project) return <div>Project not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
          <p className="text-muted-foreground mt-1">{project.companyName} • {project.sector} • {project.region}</p>
        </div>
        <Badge variant="outline" className={getStatusColor(project.status)}>
          {project.status.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Investment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(project.investmentAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(project.currentValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">IRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{project.irr ? formatPercentage(project.irr) : '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risk Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold capitalize flex items-center ${getRiskColor(project.riskLevel)}`}>
              {project.riskLevel === 'critical' || project.riskLevel === 'high' ? <AlertCircle className="w-5 h-5 mr-2" /> : null}
              {project.riskLevel}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{project.description || "No description provided."}</p>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium">Progress</h4>
                  <span className="text-sm font-bold text-primary">{project.progressPercent}%</span>
                </div>
                <Progress value={project.progressPercent} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span className="text-muted-foreground mr-2">Start Date:</span>
                  <span className="font-medium">{new Date(project.startDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span className="text-muted-foreground mr-2">End Date:</span>
                  <span className="font-medium">{project.endDate ? new Date(project.endDate).toLocaleDateString() : 'TBD'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-accent">
                <BrainCircuit className="w-5 h-5 mr-2" />
                ML Insights
              </CardTitle>
              <CardDescription>AI-driven predictions for this project</CardDescription>
            </CardHeader>
            <CardContent>
              {isPredictionsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : prediction ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Predicted IRR</div>
                    <div className="text-xl font-bold text-foreground">{formatPercentage(prediction.predictedIrr)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Success Probability</div>
                    <div className="flex items-center">
                      <div className="text-xl font-bold text-primary mr-3">{formatPercentage(prediction.successProbability)}</div>
                      <Progress value={prediction.successProbability} className="h-1.5 flex-1" />
                    </div>
                  </div>
                  {prediction.keyFactors && prediction.keyFactors.length > 0 && (
                    <div className="pt-3 border-t border-accent/20">
                      <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Key Factors</div>
                      <ul className="space-y-1">
                        {prediction.keyFactors.map((factor, i) => (
                          <li key={i} className="text-xs text-foreground flex items-start">
                            <span className="text-accent mr-2">•</span> {factor}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No ML predictions available for this project.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}