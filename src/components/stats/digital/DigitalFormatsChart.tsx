import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers } from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { DigitalFiltersState } from "@/pages/DigitalStats";

interface DigitalFormatsChartProps {
  filters: DigitalFiltersState;
}

export function DigitalFormatsChart({ filters }: DigitalFormatsChartProps) {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["digital-formats-chart", filters],
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

      // Group by format
      const formatStats: Record<string, { sheets: number; jobs: number }> = {};

      filteredJobs.forEach(job => {
        const format = job.machine_sheet_format || "330x488";
        
        if (!formatStats[format]) {
          formatStats[format] = { sheets: 0, jobs: 0 };
        }
        formatStats[format].sheets += job.computed_total_sheets || 0;
        formatStats[format].jobs += 1;
      });

      return Object.entries(formatStats)
        .map(([name, data]) => ({
          name,
          tabaka: data.sheets,
          stavki: data.jobs,
        }))
        .sort((a, b) => b.tabaka - a.tabaka);
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

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-500" />
          Format tabaka
        </CardTitle>
        <CardDescription>Po broju tabaka</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 11 }} />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  value.toLocaleString("sr-RS"), 
                  name === "tabaka" ? "Tabaka" : "Stavki"
                ]}
                contentStyle={{ 
                  borderRadius: 12, 
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))"
                }} 
              />
              <Bar 
                dataKey="tabaka" 
                fill="url(#formatGradient)"
                radius={[0, 4, 4, 0]}
                name="tabaka"
              />
              <defs>
                <linearGradient id="formatGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
