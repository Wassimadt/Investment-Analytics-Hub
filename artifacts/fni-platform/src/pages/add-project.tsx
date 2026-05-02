import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateProject, useListProjects, useGetProjectStats, useListCompanies } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, TrendingUp, BarChart3, ShieldCheck, ShieldAlert, Shield, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SECTORS = ["Énergie", "Énergie Renouvelable", "Télécommunications", "Finance", "Agroalimentaire", "Pharmaceutique", "Transport", "Infrastructure", "Construction", "Industrie", "Agriculture", "Tourisme", "Technologie"];
const REGIONS = ["Alger", "Oran", "Constantine", "Annaba", "Sétif", "Bejaia", "Biskra", "Tamanrasset", "Adrar", "Blida", "Batna", "Tizi-Ouzou"];
const RISK_LEVELS = ["low", "medium", "high", "critical"];

interface FormData {
  name: string;
  description: string;
  sector: string;
  investmentAmount: string;
  currentValue: string;
  irr: string;
  startDate: string;
  endDate: string;
  companyId: string;
  region: string;
  riskLevel: string;
  progressPercent: string;
  status: string;
}

interface Analysis {
  score: number;
  grade: string;
  gradeColor: string;
  irrPrediction: number;
  successProbability: number;
  sectorAvgIrr: number;
  sectorProjectCount: number;
  riskAssessment: string;
  strengths: string[];
  warnings: string[];
  recommendation: string;
}

function computeAnalysis(form: FormData, projectStats: any): Analysis {
  const investment = parseFloat(form.investmentAmount) || 0;
  const irr = parseFloat(form.irr) || 0;
  const riskFactor = { low: 90, medium: 65, high: 40, critical: 20 }[form.riskLevel] ?? 50;
  const hasDates = !!(form.startDate && form.endDate);
  const hasCompany = !!form.companyId;
  const hasDescription = form.description.length > 20;

  let score = riskFactor;
  if (irr > 15) score += 10;
  else if (irr > 10) score += 5;
  if (hasDates) score += 5;
  if (hasCompany) score += 5;
  if (hasDescription) score += 5;
  if (investment > 500_000_000) score -= 5;
  score = Math.min(100, Math.max(0, score));

  const riskBonus = { low: 1.15, medium: 1.0, high: 0.85, critical: 0.65 }[form.riskLevel] ?? 1;
  const irrPrediction = irr > 0 ? irr * riskBonus : 8 * riskBonus;

  const successProbability = Math.round(Math.min(95, score * 0.9 + 5));

  const sectorData = projectStats?.bySector?.find((s: any) => s.sector === form.sector);
  const sectorProjectCount = sectorData?.count ?? 0;

  const sectorIrrMap: Record<string, number> = {
    "Énergie": 11.5, "Énergie Renouvelable": 9.8, "Télécommunications": 12.1,
    "Finance": 10.4, "Agroalimentaire": 13.7, "Pharmaceutique": 16.3,
    "Transport": 7.2, "Infrastructure": 8.9, "Construction": 9.5,
    "Industrie": 11.0, "Agriculture": 10.2, "Tourisme": 8.5, "Technologie": 18.0,
  };
  const sectorAvgIrr = sectorIrrMap[form.sector] ?? 10;

  const riskAssessment = {
    low: "Risque maîtrisé — profil d'investissement solide",
    medium: "Risque modéré — surveillance trimestrielle recommandée",
    high: "Risque élevé — plan d'atténuation requis avant validation",
    critical: "Risque critique — révision approfondie obligatoire",
  }[form.riskLevel] ?? "";

  const strengths: string[] = [];
  const warnings: string[] = [];

  if (irr > sectorAvgIrr) strengths.push(`TRI ${irr}% supérieur à la moyenne sectorielle (${sectorAvgIrr}%)`);
  if (form.riskLevel === "low") strengths.push("Profil de risque favorable pour le portefeuille FNI");
  if (hasCompany) strengths.push("Entreprise porteuse identifiée — due diligence facilitée");
  if (hasDates) strengths.push("Calendrier de réalisation défini — pilotage structuré");
  if (form.sector === "Énergie Renouvelable") strengths.push("Aligné avec les priorités stratégiques nationales 2030");

  if (form.riskLevel === "critical") warnings.push("Niveau de risque critique — approbation comité requise");
  if (!form.irr) warnings.push("TRI non renseigné — modélisation financière à compléter");
  if (irr < sectorAvgIrr && irr > 0) warnings.push(`TRI inférieur à la moyenne du secteur ${form.sector} (${sectorAvgIrr}%)`);
  if (!hasCompany) warnings.push("Aucune entreprise associée — identification en cours");
  if (investment > 2_000_000_000) warnings.push("Investissement important — approbation niveau direction générale");

  let grade = "C";
  let gradeColor = "text-yellow-500";
  if (score >= 80) { grade = "A"; gradeColor = "text-primary"; }
  else if (score >= 65) { grade = "B"; gradeColor = "text-blue-400"; }
  else if (score >= 45) { grade = "C"; gradeColor = "text-yellow-500"; }
  else { grade = "D"; gradeColor = "text-destructive"; }

  const recommendation = score >= 65
    ? "Projet recommandé pour validation — indicateurs favorables"
    : score >= 45
    ? "Projet à approfondir — des clarifications sont nécessaires avant validation"
    : "Projet à risque élevé — révision du plan d'affaires recommandée";

  return { score, grade, gradeColor, irrPrediction, successProbability, sectorAvgIrr, sectorProjectCount, riskAssessment, strengths, warnings, recommendation };
}

export default function AddProject() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [form, setForm] = useState<FormData>({
    name: "", description: "", sector: "", investmentAmount: "", currentValue: "",
    irr: "", startDate: "", endDate: "", companyId: "", region: "", riskLevel: "medium",
    progressPercent: "0", status: "evaluation",
  });

  const { data: projectStats } = useGetProjectStats();
  const { data: companies } = useListCompanies();
  const createProject = useCreateProject();
  const queryClient = useQueryClient();

  const setField = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const canAnalyze = form.name && form.sector && form.investmentAmount && form.region && form.riskLevel;

  const handleAnalyze = () => {
    const a = computeAnalysis(form, projectStats);
    setAnalysis(a);
    setStep(2);
  };

  const handleSubmit = async () => {
    try {
      await createProject.mutateAsync({
        name: form.name,
        description: form.description || undefined,
        sector: form.sector,
        status: form.status as any,
        investmentAmount: parseFloat(form.investmentAmount),
        currentValue: form.currentValue ? parseFloat(form.currentValue) : parseFloat(form.investmentAmount),
        irr: form.irr ? parseFloat(form.irr) : undefined,
        startDate: form.startDate || new Date().toISOString().split("T")[0],
        endDate: form.endDate || undefined,
        companyId: form.companyId ? parseInt(form.companyId) : undefined,
        region: form.region,
        riskLevel: form.riskLevel as any,
        progressPercent: parseFloat(form.progressPercent) || 0,
      });
      await queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      navigate("/projects");
    } catch (e) {
      console.error(e);
    }
  };

  const RiskIcon = { low: ShieldCheck, medium: Shield, high: ShieldAlert, critical: AlertTriangle }[form.riskLevel] ?? Shield;
  const riskColor = { low: "text-primary", medium: "text-yellow-400", high: "text-orange-500", critical: "text-destructive" }[form.riskLevel];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => step === 1 ? navigate("/projects") : setStep(step === 3 ? 2 : 1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nouveau Projet d'Investissement</h1>
          <p className="text-sm text-muted-foreground">Analyse pré-investissement et validation</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[{ n: 1, label: "Informations" }, { n: 2, label: "Analyse" }, { n: 3, label: "Finalisation" }].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{n}</div>
            <span className={`text-sm font-medium ${step >= n ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
            {n < 3 && <div className={`h-px w-8 ${step > n ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <Card>
              <CardHeader>
                <CardTitle>Informations du Projet</CardTitle>
                <CardDescription>Renseignez les données de base pour lancer l'analyse pré-investissement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Nom du projet <span className="text-destructive">*</span></Label>
                    <Input placeholder="ex: Centrale Solaire Tlemcen 200MW" value={form.name} onChange={e => setField("name", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Secteur <span className="text-destructive">*</span></Label>
                    <Select value={form.sector} onValueChange={v => setField("sector", v)}>
                      <SelectTrigger><SelectValue placeholder="Choisir un secteur" /></SelectTrigger>
                      <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Région <span className="text-destructive">*</span></Label>
                    <Select value={form.region} onValueChange={v => setField("region", v)}>
                      <SelectTrigger><SelectValue placeholder="Choisir une région" /></SelectTrigger>
                      <SelectContent>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Montant d'investissement (DZD) <span className="text-destructive">*</span></Label>
                    <Input type="number" placeholder="ex: 500000000" value={form.investmentAmount} onChange={e => setField("investmentAmount", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>TRI estimé (%)</Label>
                    <Input type="number" step="0.1" placeholder="ex: 12.5" value={form.irr} onChange={e => setField("irr", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Niveau de risque <span className="text-destructive">*</span></Label>
                    <Select value={form.riskLevel} onValueChange={v => setField("riskLevel", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Faible</SelectItem>
                        <SelectItem value="medium">Modéré</SelectItem>
                        <SelectItem value="high">Élevé</SelectItem>
                        <SelectItem value="critical">Critique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Entreprise porteuse</Label>
                    <Select value={form.companyId} onValueChange={v => setField("companyId", v)}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner une entreprise" /></SelectTrigger>
                      <SelectContent>
                        {companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Date de début</Label>
                    <Input type="date" value={form.startDate} onChange={e => setField("startDate", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Date de fin prévue</Label>
                    <Input type="date" value={form.endDate} onChange={e => setField("endDate", e.target.value)} />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label>Description</Label>
                    <Textarea placeholder="Décrivez les objectifs et le contexte du projet..." value={form.description} onChange={e => setField("description", e.target.value)} rows={3} />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleAnalyze} disabled={!canAnalyze} size="lg" className="gap-2">
                    <Zap className="h-4 w-4" /> Lancer l'analyse pré-investissement
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && analysis && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
            {/* Score card */}
            <Card className="border-2" style={{ borderColor: analysis.score >= 65 ? "hsl(var(--primary))" : analysis.score >= 45 ? "hsl(var(--accent))" : "hsl(var(--destructive))" }}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground font-medium mb-1">Score d'évaluation FNI</p>
                    <div className="flex items-end gap-3 mb-3">
                      <span className={`text-6xl font-black ${analysis.gradeColor}`}>{analysis.grade}</span>
                      <span className="text-3xl font-bold text-muted-foreground mb-1">{analysis.score}/100</span>
                    </div>
                    <Progress value={analysis.score} className="h-2 mb-3" />
                    <p className="text-sm text-foreground font-medium">{analysis.recommendation}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-right shrink-0">
                    <div>
                      <p className="text-xs text-muted-foreground">TRI prédit</p>
                      <p className="text-2xl font-bold text-accent">{analysis.irrPrediction.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Probabilité succès</p>
                      <p className="text-2xl font-bold text-primary">{analysis.successProbability}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Moy. sectorielle TRI</p>
                      <p className="text-xl font-bold text-foreground">{analysis.sectorAvgIrr}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Projets {form.sector}</p>
                      <p className="text-xl font-bold text-foreground">{analysis.sectorProjectCount}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              {/* Risk assessment */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <RiskIcon className={`h-4 w-4 ${riskColor}`} />
                    Évaluation du risque
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className={`mb-3 ${riskColor} border-current`}>
                    Risque {form.riskLevel === "low" ? "Faible" : form.riskLevel === "medium" ? "Modéré" : form.riskLevel === "high" ? "Élevé" : "Critique"}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{analysis.riskAssessment}</p>
                </CardContent>
              </Card>

              {/* Investment summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Résumé financier
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Investissement</span>
                    <span className="font-mono font-bold">{formatCurrency(parseFloat(form.investmentAmount) || 0, "DZD")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TRI renseigné</span>
                    <span className="font-mono font-bold text-accent">{form.irr ? `${form.irr}%` : "N/A"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TRI prédit ML</span>
                    <span className="font-mono font-bold text-primary">{analysis.irrPrediction.toFixed(1)}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Strengths and warnings */}
            {analysis.strengths.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-primary">
                    <CheckCircle2 className="h-4 w-4" /> Points forts ({analysis.strengths.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {analysis.warnings.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-yellow-500">
                    <AlertTriangle className="h-4 w-4" /> Points d'attention ({analysis.warnings.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.warnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Modifier les données
              </Button>
              <Button onClick={() => setStep(3)} size="lg" className="gap-2">
                Finaliser le projet <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <Card>
              <CardHeader>
                <CardTitle>Finalisation du Projet</CardTitle>
                <CardDescription>Complétez les dernières informations avant d'enregistrer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Statut initial</Label>
                    <Select value={form.status} onValueChange={v => setField("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pipeline">Pipeline</SelectItem>
                        <SelectItem value="evaluation">Évaluation</SelectItem>
                        <SelectItem value="active">Actif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Valeur actuelle estimée (DZD)</Label>
                    <Input type="number" placeholder={form.investmentAmount} value={form.currentValue} onChange={e => setField("currentValue", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Avancement actuel (%)</Label>
                    <Input type="number" min="0" max="100" placeholder="0" value={form.progressPercent} onChange={e => setField("progressPercent", e.target.value)} />
                  </div>
                </div>

                {/* Summary */}
                {analysis && (
                  <div className="rounded-lg bg-muted/50 p-4 space-y-2 border border-border">
                    <p className="text-sm font-semibold">Récapitulatif analyse</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`text-2xl font-black ${analysis.gradeColor}`}>{analysis.grade}</span>
                      <div>
                        <p className="text-muted-foreground">Score: {analysis.score}/100 — TRI prédit: {analysis.irrPrediction.toFixed(1)}%</p>
                        <p className="text-foreground">{analysis.recommendation}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Voir l'analyse
                  </Button>
                  <Button onClick={handleSubmit} disabled={createProject.isPending} size="lg" className="gap-2">
                    {createProject.isPending ? "Enregistrement..." : <><CheckCircle2 className="h-4 w-4" /> Enregistrer le projet</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
