import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CtpFiltersState } from "@/pages/CtpStats";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

interface CtpDailyChartProps {
  filters: CtpFiltersState;
}

export const CtpDailyChart = ({ filters }: CtpDailyChartProps) => {
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["ctp-daily", filters],
    queryFn: async () => {
      let query = supabase
        .from("v_ctp_daily" as any)
        .select("closed_on, total_plates")
        .order("closed_on", { ascending: true });

      // Apply date range filter
      if (filters.dateRange.from) {
        query = query.gte("closed_on", filters.dateRange.from.toISOString().split("T")[0]);
      }
      if (filters.dateRange.to) {
        query = query.lte("closed_on", filters.dateRange.to.toISOString().split("T")[0]);
      }

      const { data, error } = await query;

      if (error) throw error;

      return ((data || []) as unknown) as Array<{
        closed_on: string;
        total_plates: number;
      }>;
    },
    staleTime: 30000,
  });

  // Memoize chart data transformation
  const chartData = useMemo(() => {
    if (!rawData) return [];

    return rawData.map((item) => ({
      date: item.closed_on,
      dateFormatted: format(new Date(item.closed_on), "dd.MM."),
      plates: Number(item.total_plates) || 0,
    }));
  }, [rawData]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Ploče po danima</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Ploče po danima</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="dateFormatted"
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Area
              type="monotone"
              dataKey="plates"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
