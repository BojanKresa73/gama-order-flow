import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CtpFiltersState } from "@/pages/CtpStats";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface CtpFormatChartProps {
  filters: CtpFiltersState;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted))",
];

export const CtpFormatChart = ({ filters }: CtpFormatChartProps) => {
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["ctp-formats", filters],
    queryFn: async () => {
      let query = supabase
        .from("v_ctp_items" as any)
        .select("plate_format_name, plates_qty, closed_on");

      // Apply date range filter
      if (filters.dateRange.from) {
        query = query.gte("closed_on", filters.dateRange.from.toISOString().split("T")[0]);
      }
      if (filters.dateRange.to) {
        query = query.lte("closed_on", filters.dateRange.to.toISOString().split("T")[0]);
      }

      // Apply client filter
      if (filters.clientIds.length > 0) {
        query = query.in("client_id", filters.clientIds);
      }

      // Apply plate format filter
      if (filters.plateFormatIds.length > 0) {
        query = query.in("plate_format_id", filters.plateFormatIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      return ((data || []) as unknown) as Array<{
        plate_format_name: string;
        plates_qty: number;
      }>;
    },
    staleTime: 30000,
  });

  // Memoize chart data transformation
  const chartData = useMemo(() => {
    if (!rawData) return null;

    // Group by format and calculate totals
    const formatTotals = rawData.reduce((acc, item) => {
      const format = item.plate_format_name || "Nepoznato";
      acc[format] = (acc[format] || 0) + (item.plates_qty || 0);
      return acc;
    }, {} as Record<string, number>);

    // Sort by total and take top 6
    const sortedFormats = Object.entries(formatTotals)
      .sort(([, a], [, b]) => b - a);

    const top6 = sortedFormats.slice(0, 6);
    const rest = sortedFormats.slice(6);
    const restTotal = rest.reduce((sum, [, count]) => sum + count, 0);

    // Prepare chart data
    const data = [
      {
        name: "Ukupno",
        ...Object.fromEntries(top6),
        ...(restTotal > 0 ? { Drugo: restTotal } : {}),
      },
    ];

    const formatKeys = [...top6.map(([name]) => name), ...(restTotal > 0 ? ["Drugo"] : [])];

    return { chartData: data, formatKeys };
  }, [rawData]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Ploče po formatima (u periodu)</CardTitle>
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
        <CardTitle>Ploče po formatima (u periodu)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData?.chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
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
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="square"
              align="right"
              verticalAlign="top"
            />
            {chartData?.formatKeys.map((format, index) => (
              <Bar
                key={format}
                dataKey={format}
                stackId="a"
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
