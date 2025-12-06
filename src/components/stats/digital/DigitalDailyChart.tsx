import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { format, eachDayOfInterval } from "date-fns";
import { sr } from "date-fns/locale";
import { DigitalFiltersState } from "@/pages/DigitalStats";

interface DigitalDailyChartProps {
  filters: DigitalFiltersState;
}

export function DigitalDailyChart({ filters }: DigitalDailyChartProps) {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["digital-daily-chart", filters],
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

      // Group by day
      const days = eachDayOfInterval({ start: filters.dateRange.from, end: filters.dateRange.to });
      
      return days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayJobs = filteredJobs.filter(job => {
          const jobDate = format(new Date(job.work_order?.created_at), "yyyy-MM-dd");
          return jobDate === dayStr;
        });
        
        return {
          date: format(day, "dd.MM", { locale: sr }),
          fullDate: format(day, "dd.MM.yyyy", { locale: sr }),
          tabaka: dayJobs.reduce((sum, job) => sum + (job.computed_total_sheets || 0), 0),
          color: dayJobs.reduce((sum, job) => sum + (job.computed_color_clicks || 0), 0),
          mono: dayJobs.reduce((sum, job) => sum + (job.computed_mono_clicks || 0), 0),
        };
      });
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

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-500" />
          Dnevni trend
        </CardTitle>
        <CardDescription>Tabaka i klikova po danu</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData || []}>
              <defs>
                <linearGradient id="colorTabaka" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorMono" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
              <YAxis className="text-xs" tick={{ fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: 12, 
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))"
                }}
                labelFormatter={(label, payload) => payload[0]?.payload?.fullDate || label}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="tabaka" 
                stroke="#6366f1" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorTabaka)" 
                name="Tabaka"
              />
              <Area 
                type="monotone" 
                dataKey="color" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorColor)" 
                name="Color"
              />
              <Area 
                type="monotone" 
                dataKey="mono" 
                stroke="#64748b" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorMono)" 
                name="Mono"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
