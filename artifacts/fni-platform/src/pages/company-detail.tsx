import { useGetCompany, getGetCompanyQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { calculateROA, calculateROE, calculateLeverageEffect, formatPct, formatMillions } from "@/lib/finance";
import { Building2, Users, MapPin, Calendar, TrendingUp, TrendingDown, Activity, Info } from "lucide-react";
import { motion } from "framer-motion";

const TAX_RATE = 0.25;
const COST_OF_DEBT = 0.055;

function RatioBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.abs(value / max) * 100);
  return <div className={`h-1.5 rounded-full ${color} mt-1`} style={{ width: `${pct}%` }} />;
}

export default function CompanyDetail() {
  const { id } = useParams();
  const companyId = parseInt(id || "0", 10);

  const { data: company, isLoading } = useGetCompany(companyId, {
    query: { enabled: !!companyId, queryKey: getGetCompanyQueryKey(companyId) }
  });

  const getStatusColor = (s: string) => ({
    active: "bg-primary/20 text-primary border-primary/20",
    inactive: "bg-muted text-muted-foreground",
    watchlist: "bg-accent/20 text-accent border-accent/20",
  }[s] ?? "bg-muted text-muted-foreground");
  const getStatusLabel = (s: string) => ({ active: "Actif", inactive: "Inactif", watchlist: "Sous surveillance" }[s] ?? s);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!company) return <div className="text-muted-foreground">Entreprise introuvable.</div>;

  // Financial ratio estimation from available data
  const totalAssets = company.currentValuation ?? 0;
  const debtRatio = company.debtRatio ?? 0;
  const equity = totalAssets > 0 ? totalAssets * (1 - debtRatio) : 0;
  const debtAmount = totalAssets * debtRatio;
  const interestCharges = debtAmount * COST_OF_DEBT;
  const ebitda = company.ebitda ?? 0;
  const ebit = ebitda * 0.85;
  const ebt = Math.max(0, ebit - interestCharges);
  const netIncome = ebt * (1 - TAX_RATE);
  const revenue = company.revenue ?? 0;

  const roa = calculateROA(netIncome, totalAssets);
  const roe = calculateROE(netIncome, equity);
  const leverage = calculateLeverageEffect(roe, roa);
  const ebitdaMargin = revenue > 0 ? ebitda / revenue : 0;
  const netMargin = revenue > 0 ? netIncome / revenue : 0;

  const hasFin = totalAssets > 0 && ebitda > 0;

  const ratios = [
    {
      key: "ROA", label: "Rentabilité Économique (ROA)", value: roa,
      formula: "Résultat Net / Actif Total", desc: "Mesure la rentabilité de l'ensemble des actifs",
      color: roa >= 0.05 ? "bg-primary" : roa >= 0.02 ? "bg-accent" : "bg-destructive",
      verdict: roa >= 0.05 ? "Excellente" : roa >= 0.02 ? "Correcte" : "Faible",
    },
    {
      key: "ROE", label: "Rentabilité Financière (ROE)", value: roe,
      formula: "Résultat Net / Capitaux Propres", desc: "Rentabilité des capitaux propres (actionnaires)",
      color: roe >= 0.10 ? "bg-primary" : roe >= 0.05 ? "bg-accent" : "bg-destructive",
      verdict: roe >= 0.10 ? "Excellente" : roe >= 0.05 ? "Correcte" : "Faible",
    },
    {
      key: "Levier", label: "Effet de Levier", value: leverage,
      formula: "ROE − ROA", desc: leverage > 0 ? "Levier positif : l'endettement améliore la rentabilité" : leverage < 0 ? "Levier négatif : coût de la dette > ROA" : "Neutre",
      color: leverage > 0 ? "bg-primary" : "bg-destructive",
      verdict: leverage > 0.02 ? "Favorable" : leverage > 0 ? "Légèrement positif" : "Défavorable",
    },
    {
      key: "Marge EBITDA", label: "Marge EBITDA", value: ebitdaMargin,
      formula: "EBITDA / CA", desc: "Marge opérationnelle avant amortissements",
      color: ebitdaMargin >= 0.20 ? "bg-primary" : ebitdaMargin >= 0.10 ? "bg-accent" : "bg-destructive",
      verdict: ebitdaMargin >= 0.20 ? "Bonne" : ebitdaMargin >= 0.10 ? "Correcte" : "Faible",
    },
    {
      key: "Marge Nette", label: "Marge Nette", value: netMargin,
      formula: "Résultat Net / CA", desc: "Part du chiffre d'affaires converties en bénéfice net",
      color: netMargin >= 0.10 ? "bg-primary" : netMargin >= 0.04 ? "bg-accent" : "bg-destructive",
      verdict: netMargin >= 0.10 ? "Bonne" : netMargin >= 0.04 ? "Correcte" : "Faible",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-sidebar-accent rounded-lg flex items-center justify-center border border-border">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{company.name}</h1>
            <div className="flex items-center gap-3 text-muted-foreground mt-1">
              <span className="flex items-center text-sm"><MapPin className="h-3.5 w-3.5 mr-1" />{company.region}</span>
              <span className="flex items-center text-sm"><Activity className="h-3.5 w-3.5 mr-1" />{company.sector}</span>
              {company.foundedYear && <span className="text-sm">Fondée {company.foundedYear}</span>}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={getStatusColor(company.status)}>
          {getStatusLabel(company.status)}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Valorisation</div>
            <div className="text-xl font-bold">{company.currentValuation ? formatCurrency(company.currentValuation, "DZD") : '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Chiffre d'Affaires</div>
            <div className="text-xl font-bold text-primary">{company.revenue ? formatCurrency(company.revenue, "DZD") : '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">EBITDA</div>
            <div className="text-xl font-bold text-accent">{company.ebitda ? formatCurrency(company.ebitda, "DZD") : '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Croissance</div>
            <div className={`text-xl font-bold flex items-center gap-1 ${Number(company.growthRate ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
              {Number(company.growthRate ?? 0) >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {company.growthRate != null ? `${(Number(company.growthRate) * 100).toFixed(1)}%` : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Description + details */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Aperçu de l'Entreprise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">{company.description || "Aucune description renseignée."}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
              <div>
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Users className="h-3 w-3" /> Employés</div>
                <div className="font-medium text-sm">{company.employees ? company.employees.toLocaleString() : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> Fondée</div>
                <div className="font-medium text-sm">{company.foundedYear || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Ratio d'Endettement</div>
                <div className="font-medium text-sm">{company.debtRatio != null ? `${(Number(company.debtRatio) * 100).toFixed(0)}%` : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Projets actifs</div>
                <div className="font-medium text-sm">{company.activeProjects ?? 0}</div>
              </div>
            </div>

            {hasFin && (
              <div className="pt-4 border-t border-border space-y-2">
                <div className="text-xs text-muted-foreground">Structure financière estimée</div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Capitaux propres</span>
                    <div className="font-mono font-bold">{formatMillions(equity)} DZD</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dettes financières</span>
                    <div className="font-mono font-bold">{formatMillions(debtAmount)} DZD</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Résultat net estimé</span>
                    <div className="font-mono font-bold text-primary">{formatMillions(netIncome)} DZD</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ratios de rentabilité */}
        {hasFin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Ratios de Rentabilité
              </CardTitle>
              <CardDescription>Analyse de la performance financière (données estimées)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ratios.map((r, i) => (
                <motion.div key={r.key} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-medium">{r.label}</span>
                    <Badge variant="outline" className={`text-xs ${r.color.includes("primary") ? "bg-primary/10 text-primary border-primary/20" : r.color.includes("accent") ? "bg-accent/10 text-accent border-accent/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                      {r.verdict}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-lg font-bold ${r.color.includes("primary") ? "text-primary" : r.color.includes("accent") ? "text-accent" : "text-destructive"}`}>
                      {formatPct(r.value)}
                    </span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${r.color}`} style={{ width: `${Math.min(100, Math.abs(r.value) * 5)}%` }} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                  <p className="text-xs text-muted-foreground opacity-60 font-mono">{r.formula}</p>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Effet de Levier Explained */}
      {hasFin && (
        <Card className={leverage > 0 ? "border-primary/20 bg-primary/5" : "border-destructive/20 bg-destructive/5"}>
          <CardContent className="pt-5">
            <div className="flex items-start gap-4">
              <Info className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
              <div className="space-y-2 text-sm">
                <p className="font-semibold">
                  Effet de Levier Financier :
                  <span className={leverage > 0 ? "text-primary ml-2" : "text-destructive ml-2"}>
                    {leverage > 0 ? "Positif" : "Négatif"} ({formatPct(leverage)})
                  </span>
                </p>
                <p className="text-muted-foreground">
                  ROE ({formatPct(roe)}) − ROA ({formatPct(roa)}) = <strong>{formatPct(leverage)}</strong>.
                  {leverage > 0
                    ? ` L'entreprise bénéficie d'un effet de levier positif : le coût de la dette (${(COST_OF_DEBT * 100).toFixed(1)}%) est inférieur à la rentabilité économique (${formatPct(roa)}), ce qui améliore la rentabilité des actionnaires.`
                    : ` L'effet de levier est négatif : le coût de la dette (${(COST_OF_DEBT * 100).toFixed(1)}%) dépasse la rentabilité économique (${formatPct(roa)}). L'endettement pénalise les actionnaires.`}
                </p>
                <div className="flex items-center gap-6 text-xs pt-1">
                  <span>ROA = Résultat net / Actif total = <strong>{formatPct(roa)}</strong></span>
                  <span>ROE = Résultat net / CP = <strong>{formatPct(roe)}</strong></span>
                  <span>Ratio d'endettement = <strong>{(debtRatio * 100).toFixed(0)}%</strong></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profitability Overview Chart */}
      {hasFin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Structure du Compte de Résultat Estimé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Chiffre d'affaires", value: revenue, pct: 100, color: "bg-blue-500/40" },
                { label: "EBITDA", value: ebitda, pct: ebitdaMargin * 100, color: "bg-accent/50" },
                { label: "EBIT (après amort.)", value: ebit, pct: revenue > 0 ? ebit / revenue * 100 : 0, color: "bg-primary/40" },
                { label: "Résultat net", value: netIncome, pct: netMargin * 100, color: "bg-primary" },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <div className="flex gap-3">
                      <span className="font-mono font-medium">{formatMillions(item.value)} DZD</span>
                      <span className="text-muted-foreground w-10 text-right">{item.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${item.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${item.pct}%` }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Estimations basées sur l'EBITDA déclaré, un taux de dépréciation de 15%, une charge de dette de {(COST_OF_DEBT * 100).toFixed(1)}% et IBS de {(TAX_RATE * 100).toFixed(0)}%.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
