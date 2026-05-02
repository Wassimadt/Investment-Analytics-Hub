import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";

import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import AddProject from "@/pages/add-project";
import ProjectDetail from "@/pages/project-detail";
import Companies from "@/pages/companies";
import AddCompany from "@/pages/add-company";
import CompanyDetail from "@/pages/company-detail";
import Comparison from "@/pages/comparison";
import Valuation from "@/pages/valuation";
import AddValuation from "@/pages/add-valuation";
import MlInsights from "@/pages/ml-insights";
import AnalyseQuantitative from "@/pages/analyse-quantitative";
import PortfolioSimulator from "@/pages/portfolio-simulator";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects/new" component={AddProject} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/projects" component={Projects} />
        <Route path="/companies/new" component={AddCompany} />
        <Route path="/companies/:id" component={CompanyDetail} />
        <Route path="/companies" component={Companies} />
        <Route path="/comparison" component={Comparison} />
        <Route path="/valuation/new" component={AddValuation} />
        <Route path="/valuation" component={Valuation} />
        <Route path="/ml-insights" component={MlInsights} />
        <Route path="/analyse-quantitative" component={AnalyseQuantitative} />
        <Route path="/portfolio" component={PortfolioSimulator} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
