import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { Link } from "wouter";

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-primary/20 text-primary hover:bg-primary/30 border-primary/20';
      case 'completed': return 'bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 border-blue-500/20';
      case 'suspended': return 'bg-destructive/20 text-destructive hover:bg-destructive/30 border-destructive/20';
      case 'evaluation': return 'bg-accent/20 text-accent hover:bg-accent/30 border-accent/20';
      default: return 'bg-muted text-muted-foreground hover:bg-muted/80';
    }
  };

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case 'low': return 'text-primary';
      case 'medium': return 'text-accent';
      case 'high': return 'text-orange-500';
      case 'critical': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Investment Projects</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Project Name</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Investment</TableHead>
                <TableHead className="text-right">IRR</TableHead>
                <TableHead>Risk</TableHead>
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
                    <TableCell><Skeleton className="h-4 w-[60px] ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  </TableRow>
                ))
              ) : projects && projects.length > 0 ? (
                projects.map((project) => (
                  <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <Link href={`/projects/${project.id}`} className="font-medium hover:underline block">
                        {project.name}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-1">{project.companyName}</div>
                    </TableCell>
                    <TableCell>{project.sector}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(project.status)}>
                        {project.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(project.investmentAmount)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-accent">
                      {project.irr ? formatPercentage(project.irr) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium capitalize ${getRiskColor(project.riskLevel)}`}>
                        {project.riskLevel}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                    No projects found.
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