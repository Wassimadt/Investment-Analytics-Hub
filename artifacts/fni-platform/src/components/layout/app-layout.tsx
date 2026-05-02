import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Briefcase, 
  Building2, 
  BarChart3, 
  Calculator, 
  BrainCircuit,
  LogOut,
  Settings
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projects", icon: Briefcase, label: "Projects" },
  { href: "/companies", icon: Building2, label: "Companies" },
  { href: "/comparison", icon: BarChart3, label: "Comparison" },
  { href: "/valuation", icon: Calculator, label: "Valuation" },
  { href: "/ml-insights", icon: BrainCircuit, label: "ML Insights" },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden dark">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg leading-none">FNI</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sidebar-foreground font-bold text-sm leading-tight tracking-tight">Fonds National</span>
              <span className="text-sidebar-foreground font-bold text-sm leading-tight tracking-tight">d'Investissement</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent/50 cursor-pointer transition-colors">
            <Avatar className="h-9 w-9 border border-sidebar-border">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">AD</AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 overflow-hidden">
              <span className="text-sm font-medium text-sidebar-foreground truncate">Amine Director</span>
              <span className="text-xs text-sidebar-foreground/60 truncate">Chief Analyst</span>
            </div>
            <Settings className="h-4 w-4 text-sidebar-foreground/60" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 border-b border-border bg-card flex-shrink-0">
          <h2 className="text-lg font-semibold text-foreground capitalize">
            {location === "/" ? "Dashboard" : location.split("/")[1].replace("-", " ")}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground font-mono">
              {new Date().toLocaleDateString("en-US", { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
