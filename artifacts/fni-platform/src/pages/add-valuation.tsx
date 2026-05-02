import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateValuation, useListCompanies, useListProjects } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListValuationsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Calculator } from "lucide-react";
import { motion } from "framer-motion";

const METHOD_LABELS: Record<string, string> = {
  dcf: "DCF — Discounted Cash Flow",
  comparables: "Comparables de marché",
  asset_based: "Valeur d'actif net",
  market: "Valorisation de marché",
  book_value: "Valeur comptable",
};

export default function AddValuation() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    companyId: "", projectId: "", method: "dcf", valuationDate: new Date().toISOString().split("T")[0],
    value: "", currency: "DZD", assumptions: "", analyst: "Wassim AIDAT",
  });

  const createValuation = useCreateValuation();
  const { data: companies } = useListCompanies();
  const { data: projects } = useListProjects();
  const queryClient = useQueryClient();
  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const canSubmit = form.method && form.valuationDate && form.value && (form.companyId || form.projectId);

  const handleSubmit = async () => {
    try {
      await createValuation.mutateAsync({
        companyId: form.companyId ? parseInt(form.companyId) : undefined,
        projectId: form.projectId ? parseInt(form.projectId) : undefined,
        method: form.method as any,
        valuationDate: form.valuationDate,
        value: parseFloat(form.value),
        currency: form.currency,
        assumptions: form.assumptions || undefined,
        analyst: form.analyst || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: getListValuationsQueryKey() });
      navigate("/valuation");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/valuation")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nouvelle Valorisation</h1>
          <p className="text-sm text-muted-foreground">Enregistrer une valorisation officielle dans le registre FNI</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" /> Paramètres de Valorisation
            </CardTitle>
            <CardDescription>Sélectionnez la méthode et renseignez les données de valorisation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Entreprise cible</Label>
                <Select value={form.companyId} onValueChange={v => { setField("companyId", v); setField("projectId", ""); }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une entreprise" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Aucune --</SelectItem>
                    {companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Projet cible</Label>
                <Select value={form.projectId} onValueChange={v => { setField("projectId", v); setField("companyId", ""); }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un projet" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Aucun --</SelectItem>
                    {projects?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Méthode de valorisation <span className="text-destructive">*</span></Label>
                <Select value={form.method} onValueChange={v => setField("method", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Valeur (DZD) <span className="text-destructive">*</span></Label>
                <Input type="number" placeholder="ex: 5000000000" value={form.value} onChange={e => setField("value", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Devise</Label>
                <Select value={form.currency} onValueChange={v => setField("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DZD">DZD — Dinar Algérien</SelectItem>
                    <SelectItem value="USD">USD — Dollar américain</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Date de valorisation <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.valuationDate} onChange={e => setField("valuationDate", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Analyste</Label>
                <Input placeholder="Nom de l'analyste" value={form.analyst} onChange={e => setField("analyst", e.target.value)} />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Hypothèses et notes</Label>
                <Textarea placeholder="Taux d'actualisation, multiples utilisés, hypothèses de croissance..." value={form.assumptions} onChange={e => setField("assumptions", e.target.value)} rows={4} />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSubmit} disabled={!canSubmit || createValuation.isPending} size="lg" className="gap-2">
                {createValuation.isPending ? "Enregistrement..." : <><CheckCircle2 className="h-4 w-4" /> Enregistrer la valorisation</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
