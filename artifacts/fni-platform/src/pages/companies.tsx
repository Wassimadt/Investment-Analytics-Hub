import { useListCompanies } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { Link } from "wouter";

export default function Companies() {
  const { data: companies, isLoading } = useListCompanies();

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-primary/20 text-primary border-primary/20';
      case 'inactive': return 'bg-muted text-muted-foreground';
      case 'watchlist': return 'bg-accent/20 text-accent border-accent/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Portfolio Companies</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Company Name</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valuation</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Growth Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px] ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px] ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[60px] ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : companies && companies.length > 0 ? (
                companies.map((company) => (
                  <TableRow key={company.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <Link href={`/companies/${company.id}`} className="font-medium hover:underline block">
                        {company.name}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-1">{company.region}</div>
                    </TableCell>
                    <TableCell>{company.sector}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(company.status)}>
                        {company.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {company.currentValuation ? formatCurrency(company.currentValuation) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {company.revenue ? formatCurrency(company.revenue) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {company.growthRate ? `+${company.growthRate}%` : '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                    No companies found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}