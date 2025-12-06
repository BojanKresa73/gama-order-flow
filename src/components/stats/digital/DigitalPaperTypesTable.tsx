import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileStack } from "lucide-react";
import { DigitalFiltersState } from "@/pages/DigitalStats";

interface DigitalPaperTypesTableProps {
  filters: DigitalFiltersState;
}

export function DigitalPaperTypesTable({ filters }: DigitalPaperTypesTableProps) {
  const { data: paperData, isLoading } = useQuery({
    queryKey: ["digital-paper-types-stats", filters],
    queryFn: async () => {
      const { data: digitalJobs, error } = await supabase
        .from("digital_jobs")
        .select(`
          *,
          work_order:work_orders!inner(
            id,
            created_at,
            client_id,
            deleted_at
          )
        `)
        .gte("work_order.created_at", filters.dateRange.from.toISOString())
        .lte("work_order.created_at", filters.dateRange.to.toISOString())
        .is("work_order.deleted_at", null);

      if (error) throw error;

      // Apply filters
      let filteredJobs = digitalJobs || [];

      if (filters.clientIds.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.clientIds.includes(job.work_order?.client_id)
        );
      }

      if (filters.printSides.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.printSides.includes(job.print_sides)
        );
      }

      if (filters.paperTypes.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.paperTypes.includes(job.paper_type || "")
        );
      }

      if (filters.sheetFormats.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.sheetFormats.includes(job.machine_sheet_format)
        );
      }

      // Group by paper type
      const paperStats: Record<string, { 
        sheets: number; 
        colorClicks: number;
        monoClicks: number;
        jobs: number;
      }> = {};

      filteredJobs.forEach(job => {
        const paperType = job.paper_type || "Neodređeno";
        
        if (!paperStats[paperType]) {
          paperStats[paperType] = { 
            sheets: 0, 
            colorClicks: 0,
            monoClicks: 0,
            jobs: 0
          };
        }
        paperStats[paperType].sheets += job.computed_total_sheets || 0;
        paperStats[paperType].colorClicks += job.computed_color_clicks || 0;
        paperStats[paperType].monoClicks += job.computed_mono_clicks || 0;
        paperStats[paperType].jobs += 1;
      });

      const result = Object.entries(paperStats)
        .map(([name, data]) => ({
          name,
          ...data,
        }))
        .sort((a, b) => b.sheets - a.sheets);

      const maxSheets = result.length > 0 ? result[0].sheets : 1;

      return result.map(item => ({
        ...item,
        percentage: (item.sheets / maxSheets) * 100,
      }));
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalSheets = paperData?.reduce((sum, item) => sum + item.sheets, 0) || 0;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileStack className="h-5 w-5 text-blue-500" />
          Statistika po tipu papira
        </CardTitle>
        <CardDescription>
          Ukupno: <strong>{totalSheets.toLocaleString("sr-RS")}</strong> tabaka
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tip papira</TableHead>
              <TableHead className="w-48">Udeo</TableHead>
              <TableHead className="text-right">Tabaka</TableHead>
              <TableHead className="text-right">Color</TableHead>
              <TableHead className="text-right">Mono</TableHead>
              <TableHead className="text-right">Stavki</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paperData && paperData.length > 0 ? (
              paperData.map((paper) => (
                <TableRow key={paper.name}>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {paper.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={paper.percentage} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {((paper.sheets / totalSheets) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-indigo-600">
                    {paper.sheets.toLocaleString("sr-RS")}
                  </TableCell>
                  <TableCell className="text-right text-purple-600">
                    {paper.colorClicks.toLocaleString("sr-RS")}
                  </TableCell>
                  <TableCell className="text-right text-slate-600">
                    {paper.monoClicks.toLocaleString("sr-RS")}
                  </TableCell>
                  <TableCell className="text-right">
                    {paper.jobs}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nema podataka za izabrani period
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
