import { useGetCompany, getGetCompanyQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Building2, Users, MapPin, Calendar, TrendingUp, Activity } from "lucide-react";

export default function CompanyDetail() {
  const { id } = useParams();
  const companyId = parseInt(id || "0", 10);
  
  const { data: company, isLoading } = useGetCompany(companyId, {
    query: { enabled: !!companyId, queryKey: getGetCompanyQueryKey(companyId) }
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-primary/20 text-primary border-primary/20';
      case 'inactive': return 'bg-muted text-muted-foreground';
      case 'watchlist': return 'bg-accent/20 text-accent border-accent/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!company) return <div>Company not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-sidebar-accent rounded-lg flex items-center justify-center border border-border">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{company.name}</h1>
            <div className="flex items-center gap-3 text-muted-foreground mt-1">
              <span className="flex items-center text-sm"><MapPin className="h-3.5 w-3.5 mr-1" /> {company.region}</span>
              <span className="flex items-center text-sm"><Activity className="h-3.5 w-3.5 mr-1" /> {company.sector}</span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={getStatusColor(company.status)}>
          {company.status.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Current Valuation</div>
            <div className="text-2xl font-bold text-foreground">{company.currentValuation ? formatCurrency(company.currentValuation) : '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Annual Revenue</div>
            <div className="text-2xl font-bold text-primary">{company.revenue ? formatCurrency(company.revenue) : '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">EBITDA</div>
            <div className="text-2xl font-bold text-accent">{company.ebitda ? formatCurrency(company.ebitda) : '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Growth Rate</div>
            <div className="text-2xl font-bold text-primary flex items-center">
              {company.growthRate ? `+${company.growthRate}%` : '-'}
              {company.growthRate && <TrendingUp className="h-5 w-5 ml-2 opacity-50" />}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Company Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">{company.description || "No description provided."}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
              <div>
                <div className="text-xs text-muted-foreground mb-1 flex items-center"><Users className="h-3 w-3 mr-1"/> Employees</div>
                <div className="font-medium text-sm">{company.employees || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1 flex items-center"><Calendar className="h-3 w-3 mr-1"/> Founded</div>
                <div className="font-medium text-sm">{company.foundedYear || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Debt Ratio</div>
                <div className="font-medium text-sm">{company.debtRatio ? `${company.debtRatio}x` : '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Active Projects</div>
                <div className="font-medium text-sm">{company.activeProjects || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}