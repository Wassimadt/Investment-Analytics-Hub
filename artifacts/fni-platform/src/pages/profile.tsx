import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  User, Briefcase, Building2, Mail, Phone, MapPin, Shield,
  Save, Lock, Bell, Palette, Globe, ChevronRight, CheckCircle2,
  KeyRound, Eye, EyeOff,
} from "lucide-react";
import { motion } from "framer-motion";

const STORAGE_KEY = "fni_profile";

interface Profile {
  nom: string;
  prenom: string;
  titre: string;
  organisation: string;
  email: string;
  telephone: string;
  region: string;
  matricule: string;
}

const DEFAULT_PROFILE: Profile = {
  prenom: "Wassim",
  nom: "AIDAT",
  titre: "Directeur d'Investissement",
  organisation: "Fonds National d'Investissement",
  email: "w.aidat@fni.dz",
  telephone: "+213 (0)21 XX XX XX",
  region: "Alger, Algérie",
  matricule: "FNI-DIR-2019-042",
};

export default function Profile() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE;
    } catch { return DEFAULT_PROFILE; }
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Profile>(profile);
  const [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [activeTab, setActiveTab] = useState<"info" | "security" | "notifications">("info");

  const initials = `${profile.prenom[0] ?? ""}${profile.nom[0] ?? ""}`.toUpperCase();

  const save = () => {
    setProfile(draft);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setEditing(false);
    toast({ title: "Profil mis à jour", description: "Vos informations ont été enregistrées." });
  };

  const cancel = () => { setDraft(profile); setEditing(false); };

  const handlePasswordChange = () => {
    if (!passwords.current) return toast({ title: "Erreur", description: "Entrez votre mot de passe actuel.", variant: "destructive" });
    if (passwords.next.length < 8) return toast({ title: "Erreur", description: "Le nouveau mot de passe doit contenir au moins 8 caractères.", variant: "destructive" });
    if (passwords.next !== passwords.confirm) return toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
    setPasswords({ current: "", next: "", confirm: "" });
    toast({ title: "Mot de passe mis à jour", description: "Votre mot de passe a été changé avec succès." });
  };

  const TABS = [
    { key: "info",          label: "Informations",  icon: User },
    { key: "security",      label: "Sécurité",      icon: Lock },
    { key: "notifications", label: "Notifications", icon: Bell },
  ] as const;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Mon Compte</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez vos informations personnelles et préférences</p>
      </div>

      {/* ── Profile header card ──────────────────────────────────────────── */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-16 w-16 border-2 border-primary/30">
                <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black">{profile.prenom} {profile.nom}</h2>
              <p className="text-sm text-muted-foreground">{profile.titre}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/25">
                  {profile.organisation}
                </Badge>
                <Badge variant="outline" className="text-xs bg-muted text-muted-foreground font-mono">
                  {profile.matricule}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Informations ───────────────────────────────────────────── */}
      {activeTab === "info" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Informations Personnelles
                </CardTitle>
                {!editing ? (
                  <Button variant="outline" size="sm" onClick={() => { setDraft(profile); setEditing(true); }}>
                    Modifier
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={cancel}>Annuler</Button>
                    <Button size="sm" onClick={save} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Enregistrer</Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Prénom", key: "prenom" as const, icon: User },
                  { label: "Nom",    key: "nom"    as const, icon: User },
                  { label: "Titre / Fonction", key: "titre" as const, icon: Briefcase },
                  { label: "Organisation",     key: "organisation" as const, icon: Building2 },
                  { label: "Email professionnel", key: "email" as const, icon: Mail },
                  { label: "Téléphone",           key: "telephone" as const, icon: Phone },
                  { label: "Localisation",         key: "region" as const, icon: MapPin },
                  { label: "Matricule",             key: "matricule" as const, icon: Shield, readonly: true },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <f.icon className="h-3.5 w-3.5" />
                      {f.label}
                      {f.readonly && <span className="text-xs opacity-50">(lecture seule)</span>}
                    </Label>
                    {editing && !f.readonly ? (
                      <Input
                        value={draft[f.key]}
                        onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    ) : (
                      <div className={`h-9 flex items-center px-3 rounded-md border text-sm ${f.readonly ? "bg-muted/30 text-muted-foreground font-mono text-xs" : "bg-muted/20"} border-border`}>
                        {profile[f.key]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Role & Permissions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" />
                Rôle & Accès
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: "Tableau de bord & KPIs",      perm: true },
                  { label: "Gestion des projets",          perm: true },
                  { label: "Gestion des entreprises",      perm: true },
                  { label: "Analyse comparative",           perm: true },
                  { label: "Valorisations",                 perm: true },
                  { label: "ML Insights & Prédictions",    perm: true },
                  { label: "Finance Quantitative",          perm: true },
                  { label: "Simulateur de portefeuille",   perm: true },
                  { label: "Rapports & Export PDF",        perm: true },
                  { label: "Administration système",       perm: false },
                ].map((p, i) => (
                  <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg ${p.perm ? "bg-primary/5" : "bg-muted/20"}`}>
                    <span className={`text-sm ${p.perm ? "" : "text-muted-foreground"}`}>{p.label}</span>
                    {p.perm
                      ? <CheckCircle2 className="h-4 w-4 text-primary" />
                      : <span className="text-xs text-muted-foreground">Non autorisé</span>
                    }
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── TAB: Sécurité ───────────────────────────────────────────────── */}
      {activeTab === "security" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                Changer le Mot de Passe
              </CardTitle>
              <CardDescription className="text-xs">Minimum 8 caractères, incluant chiffres et majuscules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "current", label: "Mot de passe actuel" },
                { key: "next",    label: "Nouveau mot de passe" },
                { key: "confirm", label: "Confirmer le nouveau mot de passe" },
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={passwords[f.key as keyof typeof passwords]}
                      onChange={e => setPasswords(p => ({ ...p, [f.key]: e.target.value }))}
                      className="pr-10 h-9 text-sm"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <Button onClick={handlePasswordChange} className="gap-2 w-full">
                <Lock className="h-4 w-4" /> Mettre à jour le mot de passe
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" />
                Activité de Connexion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { date: "Aujourd'hui, 09:12", device: "Chrome · Windows 11", location: "Alger, DZ", current: true },
                  { date: "Hier, 17:43",         device: "Chrome · Windows 11", location: "Alger, DZ", current: false },
                  { date: "28 avr. 2026, 11:05", device: "Safari · iPhone",     location: "Alger, DZ", current: false },
                ].map((s, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${s.current ? "border-primary/25 bg-primary/5" : "border-border bg-muted/20"}`}>
                    <div className={`h-2 w-2 rounded-full shrink-0 ${s.current ? "bg-primary" : "bg-muted-foreground/40"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{s.device}</span>
                        {s.current && <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 py-0">Session active</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.date} · {s.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── TAB: Notifications ──────────────────────────────────────────── */}
      {activeTab === "notifications" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Préférences de Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {[
                  { label: "Alertes projets en retard",          sub: "Notification quand un projet dépasse son calendrier", on: true },
                  { label: "Projets en alerte critique",         sub: "Niveau de risque critique détecté", on: true },
                  { label: "Nouvelles valorisations",            sub: "Une valorisation est ajoutée au portefeuille", on: true },
                  { label: "Rapport hebdomadaire",               sub: "Résumé de portefeuille chaque lundi", on: false },
                  { label: "Prévisions ML mises à jour",         sub: "Nouvelles prédictions disponibles", on: true },
                  { label: "Seuil TRI non atteint",              sub: "Un projet passe sous le seuil de 10%", on: true },
                  { label: "Rappel d'échéance (30 jours avant)", sub: "Alerte avant fin de projet", on: false },
                ].map((n, i) => (
                  <NotifRow key={i} label={n.label} sub={n.sub} defaultOn={n.on} />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

function NotifRow({ label, sub, defaultOn }: { label: string; sub: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  const { toast } = useToast();
  const toggle = () => {
    setOn(v => !v);
    toast({ description: `"${label}" ${!on ? "activé" : "désactivé"}.` });
  };
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={toggle}
    >
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
      <div className={`h-5 w-9 rounded-full relative transition-colors ${on ? "bg-primary" : "bg-muted"}`}>
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
    </div>
  );
}
