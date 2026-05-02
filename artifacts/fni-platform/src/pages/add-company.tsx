import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateCompany, useListCompanies } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListCompaniesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Building2 } from "lucide-react";
import { motion } from "framer-motion";

const SECTORS = ["Énergie", "Énergie Renouvelable", "Télécommunications", "Finance", "Agroalimentaire", "Pharmaceutique", "Transport", "Infrastructure", "Construction", "Industrie", "Agriculture", "Tourisme", "Technologie"];
const REGIONS = ["Alger", "Oran", "Constantine", "Annaba", "Sétif", "Bejaia", "Biskra", "Tamanrasset", "Adrar", "Blida", "Batna", "Tizi-Ouzou"];

export default function AddCompany() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    name: "", sector: "", status: "active", revenue: "", employees: "",
    foundedYear: "", region: "", description: "", ebitda: "", debtRatio: "", growthRate: "",
  });

  const createCompany = useCreateCompany();
  const queryClient = useQueryClient();
  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const canSubmit = form.name && form.sector && form.region;

  const handleSubmit = async () => {
    try {
      await createCompany.mutateAsync({
        name: form.name,
        sector: form.sector,
        status: form.status as any,
        revenue: form.revenue ? parseFloat(form.revenue) : undefined,
        employees: form.employees ? parseInt(form.employees) : undefined,
        foundedYear: form.foundedYear ? parseInt(form.foundedYear) : undefined,
        region: form.region,
        description: form.description || undefined,
        ebitda: form.ebitda ? parseFloat(form.ebitda) : undefined,
        debtRatio: form.debtRatio ? parseFloat(form.debtRatio) : undefined,
        growthRate: form.growthRate ? parseFloat(form.growthRate) : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
      navigate("/companies");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/companies")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nouvelle Entreprise</h1>
          <p className="text-sm text-muted-foreground">Enregistrer une entreprise dans le portefeuille FNI</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Informations de l'Entreprise
            </CardTitle>
            <CardDescription>Renseignez les données de l'entreprise à intégrer au portefeuille</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Nom de l'entreprise <span className="text-destructive">*</span></Label>
                <Input placeholder="ex: Groupe Industriel Batna" value={form.name} onChange={e => setField("name", e.target.value)} />
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
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={v => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="watchlist">Sous surveillance</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Année de création</Label>
                <Input type="number" placeholder="ex: 2005" value={form.foundedYear} onChange={e => setField("foundedYear", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Chiffre d'affaires (DZD)</Label>
                <Input type="number" placeholder="ex: 1500000000" value={form.revenue} onChange={e => setField("revenue", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Nombre d'employés</Label>
                <Input type="number" placeholder="ex: 3500" value={form.employees} onChange={e => setField("employees", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>EBITDA (DZD)</Label>
                <Input type="number" placeholder="ex: 250000000" value={form.ebitda} onChange={e => setField("ebitda", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Ratio d'endettement (0–1)</Label>
                <Input type="number" step="0.01" min="0" max="1" placeholder="ex: 0.35" value={form.debtRatio} onChange={e => setField("debtRatio", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Taux de croissance (%)</Label>
                <Input type="number" step="0.1" placeholder="ex: 5.2" value={form.growthRate} onChange={e => setField("growthRate", e.target.value)} />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Textarea placeholder="Décrivez les activités et le positionnement de l'entreprise..." value={form.description} onChange={e => setField("description", e.target.value)} rows={3} />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSubmit} disabled={!canSubmit || createCompany.isPending} size="lg" className="gap-2">
                {createCompany.isPending ? "Enregistrement..." : <><CheckCircle2 className="h-4 w-4" /> Enregistrer l'entreprise</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
