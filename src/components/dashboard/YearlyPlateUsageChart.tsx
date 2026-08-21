import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const MONTHS_SR = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium">{payload[0].payload.label}</p>
        <p className="text-sm text-muted-foreground">
          Ploča:{" "}
          <span className="font-semibold text-foreground">
            {Number(payload[0].value).toLocaleString("sr-RS")}
          </span>
        </p>
      </div>
    );
  }
  return null;
};

export const YearlyPlateUsageChart = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["plate-usage-last-12-months"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_plate_usage_last_12_months");
      if (error) throw error;
      return (data || []) as Array<{ month_start: string; plates: number }>;
    },
  });

  const chartData = useMemo(
    () =>
      (data || []).map((row) => {
        const [y, m] = row.month_start.split("-");
        return {
          label: `${MONTHS_SR[Number(m) - 1]} ${y.slice(2)}`,
          plates: Number(row.plates) || 0,
        };
      }),
    [data]
  );

  const total = chartData.reduce((s, r) => s + r.plates, 0);

  if (isLoading) {
    return (
      <Card className="h-[300px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm">
        <CardHeader className="h-[44px] flex flex-row items-center justify-between pb-0">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="flex-1 pt-4">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[300px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="h-[44px] flex flex-row items-center justify-between pb-0">
        <CardTitle className="text-lg">Potrošnja ploča (12 meseci)</CardTitle>
        <span className="text-sm text-muted-foreground">
          Ukupno: {total.toLocaleString("sr-RS")}
        </span>
      </CardHeader>
      <CardContent className="flex-1 pt-4 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
            <Bar dataKey="plates" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
