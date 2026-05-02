import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useCreateValuation, useListCompanies, useListProjects, getListValuationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDZD } from "@/lib/utils";
import {
  ArrowLeft, CheckCircle2, Calculator, TrendingUp, Building2, Briefcase,
  Info, Loader2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { motion } from "framer-motion";

const METHODS = [
  {
    key: "dcf",
    label: "DCF — Flux de Trésorerie Actualisés",
    short: "DCF",
    desc: "Actualise les flux futurs au taux k. Idéal pour projets avec CFs prévisibles.",
    color: "text-primary bg-primary/10 border-primary/25",
  },
  {
    key: "market_comp",
    label: "Comparables de Marché",
    short: "Comp. Marché",
    desc: "Multiples de sociétés comparables cotées (EV/EBITDA, P/E…).",
    color: "text-accent bg-accent/10 border-accent/25",
  },
  {
    key: "asset_based",
    label: "Valeur d'Actif Net (ANR)",
    short: "Actif Net",
    desc: "Valeur de marché des actifs diminuée des dettes. Adapté aux holdings.",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/25",
  },
  {
    key: "precedent",
    label: "Transactions Précédentes",
    short: "Trans. Précéd.",
    desc: "Multiples issus de transactions similaires passées dans le secteur.",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/25",
  },
  {
    key: "book_value",
    label: "Valeur Comptable",
    short: "Val. Comptable",
    desc: "Capitaux propres tels qu'enregistrés dans les états financiers.",
    color: "text-muted-foreground bg-muted/40 border-border",
  },
] as const;

export default function AddValuation() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  /* ── Read query params ─────────────────────────────────────────────── */
  const params     = new URLSearchParams(search);
  const qProjectId = params.get("projectId") ?? "";
  const qCompanyId = params.get("companyId") ?? "";
  const returnTo   = params.get("returnTo") ?? "/valuation";

  const [form, setForm] = useState({
    companyId:     qCompanyId,
    projectId:     qProjectId,
    method:        "dcf",
    valuationDate: new Date().toISOString().split("T")[0],
    value:         "",
    currency:      "DZD",
    assumptions:   "",
    analyst:       "Wassim AIDAT",
  });

  const createValuation = useCreateValuation();
  const { data: companies } = useListCompanies();
  const { data: projects  } = useListProjects();
  const queryClient        = useQueryClient();

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  /* ── Pre-fill project name for display ────────────────────────────── */
  const selectedProject = useMemo(
    () => projects?.find(p => String(p.id) === form.projectId),
    [projects, form.projectId]
  );
  const selectedCompany = useMemo(
    () => companies?.find(c => String(c.id) === form.companyId),
    [companies, form.companyId]
  );
  const selectedMethod  = METHODS.find(m => m.key === form.method) ?? METHODS[0];

  /* ── Live value preview ──────────────────────────────────────────── */
  const numValue = parseFloat(form.value) || 0;
  const refValue = selectedProject?.investmentAmount ?? selectedProject?.currentValue ?? 0;
  const delta    = refValue > 0 ? ((numValue - refValue) / refValue) * 100 : null;

  const canSubmit = form.method && form.valuationDate && form.value && +form.value > 0 && (form.companyId || form.projectId);

  const handleSubmit = async () => {
    try {
      await createValuation.mutateAsync({
        companyId:     form.companyId && form.companyId !== "none" ? parseInt(form.companyId) : undefined,
        projectId:     form.projectId && form.projectId !== "none" ? parseInt(form.projectId) : undefined,
        method:        form.method as any,
        valuationDate: form.valuationDate,
        value:         parseFloat(form.value),
        currency:      form.currency,
        assumptions:   form.assumptions || undefined,
        analyst:       form.analyst || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: getListValuationsQueryKey() });
      toast({
        title: "Valorisation enregistrée",
        description: `${selectedMethod.short} · ${formatDZD(parseFloat(form.value))} — ajoutée au registre FNI.`,
      });
      navigate(returnTo);
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer la valorisation.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(returnTo)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {returnTo.startsWith("/projects/") ? "Retour au projet" : "Registre"}
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium">Nouvelle Valorisation</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Nouvelle Valorisation</h1>
        <p className="text-sm text-muted-foreground mt-1">Enregistrer une valorisation officielle dans le registre FNI</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* ── Entity card ──────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              Entité à Valoriser
            </CardTitle>
            <CardDescription className="text-xs">Sélectionnez un projet OU une entreprise</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Projet
                </Label>
                <Select value={form.projectId || "none"} onValueChange={v => { setField("projectId", v === "none" ? "" : v); setField("companyId", ""); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir un projet" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucun projet —</SelectItem>
                    {projects?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Entreprise
                </Label>
                <Select value={form.companyId || "none"} onValueChange={v => { setField("companyId", v === "none" ? "" : v); setField("projectId", ""); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir une entreprise" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucune entreprise —</SelectItem>
                    {companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected entity summary */}
            {(selectedProject || selectedCompany) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20"
              >
                <div className="flex items-center gap-2">
                  {selectedProject
                    ? <Briefcase className="h-4 w-4 text-primary" />
                    : <Building2 className="h-4 w-4 text-primary" />
                  }
                  <span className="text-sm font-bold">{selectedProject?.name ?? selectedCompany?.name}</span>
                  {selectedProject && (
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 ml-auto">
                      I₀ : {formatDZD(selectedProject.investmentAmount)}
                    </Badge>
                  )}
                </div>
                {selectedProject && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedProject.sector} · {selectedProject.region} · TRI actuel : {selectedProject.irr?.toFixed(1) ?? "—"}%</p>
                )}
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* ── Method selector ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="h-4 w-4 text-accent" />
              Méthode de Valorisation <span className="text-destructive text-sm">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              {METHODS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setField("method", m.key)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    form.method === m.key
                      ? `border-2 ${m.color}`
                      : "border-border hover:border-primary/30 hover:bg-muted/30"
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 mt-0.5 flex-shrink-0 transition-all ${
                    form.method === m.key ? "border-current bg-current" : "border-muted-foreground"
                  }`} />
                  <div>
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Value + Date ─────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Valeur & Date <span className="text-destructive text-sm">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Valeur (DZD) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  placeholder="ex: 5 000 000 000"
                  value={form.value}
                  onChange={e => setField("value", e.target.value)}
                  className="h-9 text-sm font-mono"
                />
                {numValue > 0 && (
                  <p className="text-xs text-primary font-semibold">{formatDZD(numValue)}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Devise</Label>
                <Select value={form.currency} onValueChange={v => setField("currency", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DZD">DZD — Dinar Algérien</SelectItem>
                    <SelectItem value="USD">USD — Dollar américain</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date de valorisation <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.valuationDate} onChange={e => setField("valuationDate", e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Analyste</Label>
                <Input placeholder="Nom de l'analyste" value={form.analyst} onChange={e => setField("analyst", e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            {/* Live comparison vs investissement */}
            {numValue > 0 && delta !== null && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  delta >= 0 ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"
                }`}
              >
                {delta >= 0
                  ? <ArrowUpRight className="h-4 w-4 text-primary shrink-0" />
                  : <ArrowDownRight className="h-4 w-4 text-destructive shrink-0" />
                }
                <div>
                  <p className={`text-sm font-bold ${delta >= 0 ? "text-primary" : "text-destructive"}`}>
                    {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% par rapport à l'investissement initial
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDZD(numValue)} vs I₀ = {formatDZD(refValue)}
                  </p>
                </div>
              </motion.div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hypothèses et notes méthodologiques</Label>
              <Textarea
                placeholder="Taux d'actualisation utilisé, multiples de valorisation, hypothèses de croissance, sources des données..."
                value={form.assumptions}
                onChange={e => setField("assumptions", e.target.value)}
                rows={4}
                className="text-sm resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Summary + Submit ─────────────────────────────────────── */}
        <Card className={canSubmit ? "border-primary/25 bg-primary/5" : "border-border"}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Récapitulatif</p>
                <div className="flex flex-wrap items-center gap-2">
                  {(selectedProject || selectedCompany) && (
                    <Badge variant="outline" className="text-xs">{selectedProject?.name ?? selectedCompany?.name}</Badge>
                  )}
                  <Badge variant="outline" className={`text-xs ${selectedMethod.color}`}>{selectedMethod.short}</Badge>
                  {numValue > 0 && (
                    <span className="text-sm font-bold text-primary">{formatDZD(numValue)}</span>
                  )}
                  {form.valuationDate && (
                    <span className="text-xs text-muted-foreground">{new Date(form.valuationDate).toLocaleDateString("fr-DZ")}</span>
                  )}
                </div>
                {!canSubmit && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {!form.projectId && !form.companyId ? "Sélectionnez un projet ou une entreprise." :
                     !form.value || +form.value <= 0 ? "Entrez une valeur." : "Vérifiez les champs obligatoires."}
                  </p>
                )}
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || createValuation.isPending}
                size="lg"
                className="gap-2 shrink-0"
              >
                {createValuation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</>
                  : <><CheckCircle2 className="h-4 w-4" /> Enregistrer</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
