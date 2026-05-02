import { useListValuations } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

export default function Valuation() {
  const { data: valuations, isLoading } = useListValuations();

  const getMethodColor = (method: string) => {
    switch(method) {
      case 'dcf': return 'bg-primary/20 text-primary border-primary/20';
      case 'comparables': return 'bg-accent/20 text-accent border-accent/20';
      case 'asset_based': return 'bg-blue-500/20 text-blue-500 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatMethod = (method: string) => {
    return method.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Valuation Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">Official valuation records for portfolio entities</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Date</TableHead>
                <TableHead>Target Entity</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Analyst</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px] ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  </TableRow>
                ))
              ) : valuations && valuations.length > 0 ? (
                valuations.map((valuation) => (
                  <TableRow key={valuation.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {new Date(valuation.valuationDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {valuation.companyId ? `Company ID: ${valuation.companyId}` : `Project ID: ${valuation.projectId}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getMethodColor(valuation.method)}>
                        {formatMethod(valuation.method)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {formatCurrency(valuation.value, valuation.currency)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {valuation.analyst || '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    No valuations found.
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