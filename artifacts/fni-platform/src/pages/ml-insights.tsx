import { useGetMlPredictions, useGetMlRiskScores } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatPercentage } from "@/lib/utils";
import { BrainCircuit, AlertTriangle, ShieldCheck } from "lucide-react";

export default function MlInsights() {
  const { data: predictions, isLoading: isPredictionsLoading } = useGetMlPredictions();
  const { data: risks, isLoading: isRisksLoading } = useGetMlRiskScores();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <BrainCircuit className="w-6 h-6 mr-2 text-primary" />
            ML Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Predictive analytics and risk modeling</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Project Success Probability</CardTitle>
            <CardDescription>AI-driven likelihood of meeting target IRR</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isPredictionsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between"><Skeleton className="h-4 w-32"/><Skeleton className="h-4 w-12"/></div>
                  <Skeleton className="h-2 w-full"/>
                </div>
              ))
            ) : predictions && predictions.length > 0 ? (
              predictions.slice(0, 5).map((pred) => (
                <div key={pred.projectId} className="space-y-2">
                  <div className="flex justify-between items-end text-sm">
                    <span className="font-medium">{pred.projectName}</span>
                    <span className="font-mono font-bold text-primary">{formatPercentage(pred.successProbability)}</span>
                  </div>
                  <Progress value={pred.successProbability} className="h-2 bg-muted" indicatorClassName={pred.successProbability > 75 ? "bg-primary" : pred.successProbability > 50 ? "bg-accent" : "bg-destructive"} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Predicted IRR: {formatPercentage(pred.predictedIrr)}</span>
                    <span>Confidence: {pred.confidence}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">No prediction data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
              Risk Heatmap
            </CardTitle>
            <CardDescription>Multi-factor entity risk scoring</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isRisksLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full"/>)
              ) : risks && risks.length > 0 ? (
                risks.slice(0, 5).map((risk) => (
                  <div key={`${risk.entityType}-${risk.entityId}`} className="flex flex-col p-3 border border-border rounded-lg bg-card/50">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium text-sm">{risk.entityName}</div>
                      <div className={`text-xs font-bold px-2 py-0.5 rounded ${
                        risk.riskScore > 75 ? 'bg-destructive/20 text-destructive' :
                        risk.riskScore > 50 ? 'bg-orange-500/20 text-orange-500' :
                        risk.riskScore > 25 ? 'bg-accent/20 text-accent' :
                        'bg-primary/20 text-primary'
                      }`}>
                        Score: {risk.riskScore}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Market</div>
                        <div className="text-sm font-mono">{risk.marketRisk}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Financial</div>
                        <div className="text-sm font-mono">{risk.financialRisk}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Operational</div>
                        <div className="text-sm font-mono">{risk.operationalRisk}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">No risk data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}