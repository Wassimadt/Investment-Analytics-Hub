import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Briefcase, Building2, BarChart3, Calculator,
  BrainCircuit, FlaskConical, Layers, Settings,
  PanelLeftClose, PanelLeftOpen, FileText,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV_SECTIONS = [
  {
    label: "Principal",
    items: [
      { href: "/",          icon: LayoutDashboard, label: "Dashboard" },
      { href: "/projects",  icon: Briefcase,       label: "Projets" },
      { href: "/companies", icon: Building2,        label: "Entreprises" },
    ],
  },
  {
    label: "Analyse",
    items: [
      { href: "/comparison",  icon: BarChart3,    label: "Comparaison" },
      { href: "/valuation",   icon: Calculator,   label: "Valorisation" },
      { href: "/ml-insights", icon: BrainCircuit, label: "ML Insights" },
    ],
  },
  {
    label: "Finance Quantitative",
    items: [
      { href: "/analyse-quantitative", icon: FlaskConical, label: "Analyse Quantitative" },
      { href: "/portfolio",            icon: Layers,       label: "Simulateur Portefeuille" },
      { href: "/reports",              icon: FileText,     label: "Rapports" },
    ],
  },
];

const PAGE_LABELS: Record<string, string> = {
  "/":                     "Dashboard",
  "/comparison":           "Comparaison de Projets",
  "/analyse-quantitative": "Analyse Quantitative",
  "/portfolio":            "Simulateur de Portefeuille",
  "/ml-insights":          "ML Insights",
  "/profile":              "Mon Compte",
  "/reports":              "Rapports Périodiques",
};

const STORAGE_KEY = "fni_sidebar_collapsed";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch {}
  }, [collapsed]);

  const pageLabel =
    PAGE_LABELS[location] ??
    (location.split("/")[1]
      ? location.split("/")[1].charAt(0).toUpperCase() + location.split("/")[1].slice(1).replace(/-/g, " ")
      : "Page");

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden dark">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className="flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full transition-all duration-300 ease-in-out overflow-hidden"
        style={{ width: collapsed ? 64 : 256 }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center border-b border-sidebar-border px-4 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-sm leading-none">FNI</span>
            </div>
            <div
              className="flex flex-col overflow-hidden transition-all duration-300"
              style={{ width: collapsed ? 0 : 160, opacity: collapsed ? 0 : 1 }}
            >
              <span className="text-sidebar-foreground font-bold text-sm leading-tight tracking-tight whitespace-nowrap">Fonds National</span>
              <span className="text-sidebar-foreground font-bold text-sm leading-tight tracking-tight whitespace-nowrap">d'Investissement</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto overflow-x-hidden space-y-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-3 mb-1.5 whitespace-nowrap overflow-hidden">
                  {section.label}
                </p>
              )}
              {collapsed && <div className="h-px bg-sidebar-border/40 mx-2 mb-2" />}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    location === item.href ||
                    (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer overflow-hidden ${
                          collapsed ? "px-0 justify-center h-9 w-full" : "px-3 py-2"
                        } ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                        {!collapsed && (
                          <span className="whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="p-3 border-t border-sidebar-border">
          <Link href="/profile">
            <div
              title={collapsed ? "Wassim AIDAT — Mon Compte" : undefined}
              className={`flex items-center rounded-md cursor-pointer transition-colors overflow-hidden ${
                collapsed ? "justify-center p-2" : "gap-3 px-3 py-2"
              } ${
                location === "/profile"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/50"
              }`}
            >
              <Avatar className="h-8 w-8 border border-sidebar-border flex-shrink-0">
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground font-bold text-xs">WA</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <span className="text-sm font-medium text-sidebar-foreground truncate">Wassim AIDAT</span>
                    <span className="text-xs text-sidebar-foreground/60 truncate">Directeur d'Investis…</span>
                  </div>
                  <Settings className={`h-4 w-4 shrink-0 ${location === "/profile" ? "text-primary" : "text-sidebar-foreground/60"}`} />
                </>
              )}
            </div>
          </Link>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Toggle button */}
            <button
              onClick={() => setCollapsed(v => !v)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title={collapsed ? "Ouvrir le menu" : "Réduire le menu"}
            >
              {collapsed
                ? <PanelLeftOpen className="h-5 w-5" />
                : <PanelLeftClose className="h-5 w-5" />
              }
            </button>
            <h2 className="text-lg font-semibold text-foreground">{pageLabel}</h2>
          </div>
          <span className="text-sm text-muted-foreground font-mono">
            {new Date().toLocaleDateString("fr-DZ", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
          </span>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
