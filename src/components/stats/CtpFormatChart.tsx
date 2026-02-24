import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CtpFiltersState } from "@/pages/CtpStats";
import { buildCtpRpcParams } from "@/lib/ctpRpcHelpers";
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
  const { data: rawFormats, isLoading } = useQuery({
    queryKey: ["ctp-formats-rpc", filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ctp_formats", buildCtpRpcParams(filters));
      if (error) throw error;
      return (data || []) as Array<{ format_name: string; total: number }>;
    },
    staleTime: 30000,
  });

  const chartData = useMemo(() => {
    if (!rawFormats || rawFormats.length === 0) return null;

    const top6 = rawFormats.slice(0, 6);
    const rest = rawFormats.slice(6);
    const restTotal = rest.reduce((sum, f) => sum + f.total, 0);

    const dataObj: Record<string, number> = {};
    top6.forEach(f => { dataObj[f.format_name] = f.total; });
    if (restTotal > 0) dataObj["Drugo"] = restTotal;

    const formatKeys = [...top6.map(f => f.format_name), ...(restTotal > 0 ? ["Drugo"] : [])];

    return { chartData: [{ name: "Ukupno", ...dataObj }], formatKeys };
  }, [rawFormats]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader><CardTitle>Ploče po formatima (u periodu)</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader><CardTitle>Ploče po formatima (u periodu)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData?.chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="square" align="right" verticalAlign="top" />
            {chartData?.formatKeys.map((format, index) => (
              <Bar key={format} dataKey={format} stackId="a" fill={COLORS[index % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
