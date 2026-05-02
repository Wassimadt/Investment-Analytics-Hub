import { useState } from "react";
import { useCompareCompanies } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from "recharts";
import { Search } from "lucide-react";

export default function Comparison() {
  const [ids, setIds] = useState("1,2");
  const [searchInput, setSearchInput] = useState("1,2");

  const { data: comparisonData, isLoading } = useCompareCompanies({ ids }, {
    query: { enabled: !!ids }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIds(searchInput);
  };

  const getRadarData = () => {
    if (!comparisonData || comparisonData.length === 0) return [];
    
    return [
      {
        subject: 'Revenue',
        ...comparisonData.reduce((acc, c) => ({...acc, [c.name]: c.revenue || 0}), {}),
        fullMark: Math.max(...comparisonData.map(c => c.revenue || 0)) * 1.2
      },
      {
        subject: 'Growth',
        ...comparisonData.reduce((acc, c) => ({...acc, [c.name]: c.growthRate || 0}), {}),
        fullMark: Math.max(...comparisonData.map(c => c.growthRate || 0)) * 1.2
      },
      {
        subject: 'IRR',
        ...comparisonData.reduce((acc, c) => ({...acc, [c.name]: c.irr || 0}), {}),
        fullMark: Math.max(...comparisonData.map(c => c.irr || 0)) * 1.2
      },
      {
        subject: 'EBITDA',
        ...comparisonData.reduce((acc, c) => ({...acc, [c.name]: c.ebitda || 0}), {}),
        fullMark: Math.max(...comparisonData.map(c => c.ebitda || 0)) * 1.2
      },
      {
        subject: 'Valuation',
        ...comparisonData.reduce((acc, c) => ({...acc, [c.name]: c.currentValuation || 0}), {}),
        fullMark: Math.max(...comparisonData.map(c => c.currentValuation || 0)) * 1.2
      }
    ];
  };

  const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold">Company Comparison</h1>
          <p className="text-muted-foreground mt-1 text-sm">Compare key metrics across portfolio companies</p>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input 
            value={searchInput} 
            onChange={(e) => setSearchInput(e.target.value)} 
            placeholder="Enter comma-separated IDs (e.g. 1,2)"
            className="w-64"
          />
          <Button type="submit" variant="secondary"><Search className="h-4 w-4 mr-2" /> Compare</Button>
        </form>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      ) : comparisonData && comparisonData.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Radar</CardTitle>
              <CardDescription>Relative comparison of key financial indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={getRadarData()}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    {comparisonData.map((company, idx) => (
                      <Radar 
                        key={company.id} 
                        name={company.name} 
                        dataKey={company.name} 
                        stroke={colors[idx % colors.length]} 
                        fill={colors[idx % colors.length]} 
                        fillOpacity={0.3} 
                      />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Metric</TableHead>
                    {comparisonData.map(c => (
                      <TableHead key={c.id} className="text-right font-bold text-foreground">{c.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Sector</TableCell>
                    {comparisonData.map(c => <TableCell key={c.id} className="text-right">{c.sector}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Valuation</TableCell>
                    {comparisonData.map(c => <TableCell key={c.id} className="text-right font-mono">{c.currentValuation ? formatCurrency(c.currentValuation) : '-'}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Revenue</TableCell>
                    {comparisonData.map(c => <TableCell key={c.id} className="text-right font-mono">{c.revenue ? formatCurrency(c.revenue) : '-'}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">EBITDA</TableCell>
                    {comparisonData.map(c => <TableCell key={c.id} className="text-right font-mono">{c.ebitda ? formatCurrency(c.ebitda) : '-'}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Growth Rate</TableCell>
                    {comparisonData.map(c => <TableCell key={c.id} className="text-right font-mono text-primary font-bold">{c.growthRate ? `+${c.growthRate}%` : '-'}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">IRR</TableCell>
                    {comparisonData.map(c => <TableCell key={c.id} className="text-right font-mono text-accent font-bold">{c.irr ? formatPercentage(c.irr) : '-'}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Debt Ratio</TableCell>
                    {comparisonData.map(c => <TableCell key={c.id} className="text-right font-mono">{c.debtRatio ? `${c.debtRatio}x` : '-'}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Risk Score</TableCell>
                    {comparisonData.map(c => <TableCell key={c.id} className="text-right font-mono">{c.riskScore || '-'}</TableCell>)}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg bg-muted/20">
          Enter company IDs to compare
        </div>
      )}
    </div>
  );
}