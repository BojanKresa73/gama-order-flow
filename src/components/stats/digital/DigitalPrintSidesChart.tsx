import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers } from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Tooltip,
  Legend
} from "recharts";
import { DigitalFiltersState } from "@/pages/DigitalStats";

interface DigitalPrintSidesChartProps {
  filters: DigitalFiltersState;
}

const COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#c084fc", "#d8b4fe"];

export function DigitalPrintSidesChart({ filters }: DigitalPrintSidesChartProps) {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["digital-print-sides-chart", filters],
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
        .is("work_order.deleted_at", null)
        .range(0, 49999);

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

      // Group by print sides
      const printSidesCount: Record<string, { sheets: number; color: number; mono: number }> = {};
      
      filteredJobs.forEach(job => {
        const sides = job.print_sides || "4/0";
        if (!printSidesCount[sides]) {
          printSidesCount[sides] = { sheets: 0, color: 0, mono: 0 };
        }
        printSidesCount[sides].sheets += job.computed_total_sheets || 0;
        printSidesCount[sides].color += job.computed_color_clicks || 0;
        printSidesCount[sides].mono += job.computed_mono_clicks || 0;
      });

      return Object.entries(printSidesCount)
        .map(([name, data]) => ({ 
          name, 
          value: data.sheets,
          color: data.color,
          mono: data.mono 
        }))
        .sort((a, b) => b.value - a.value);
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
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalSheets = chartData?.reduce((sum, item) => sum + item.value, 0) || 0;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5 text-purple-500" />
          Pokrivenost štampe
        </CardTitle>
        <CardDescription>Distribucija po tipu štampe (tabaka)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData || []}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {chartData?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string, props: any) => {
                  const item = props.payload;
                  return [
                    <div className="space-y-1" key="tooltip">
                      <div><strong>{value.toLocaleString("sr-RS")}</strong> tabaka</div>
                      <div className="text-xs text-muted-foreground">
                        Color: {item.color.toLocaleString("sr-RS")} | Mono: {item.mono.toLocaleString("sr-RS")}
                      </div>
                    </div>,
                    item.name
                  ];
                }}
                contentStyle={{ 
                  borderRadius: 12, 
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))"
                }} 
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center text-sm text-muted-foreground mt-2">
          Ukupno: <strong>{totalSheets.toLocaleString("sr-RS")}</strong> tabaka
        </div>
      </CardContent>
    </Card>
  );
}
