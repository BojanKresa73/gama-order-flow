import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CtpFiltersState } from "@/pages/CtpStats";
import { buildCtpRpcParams } from "@/lib/ctpRpcHelpers";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface CtpFormatChartProps {
  filters: CtpFiltersState;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
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

  const { rows, total } = useMemo(() => {
    if (!rawFormats || rawFormats.length === 0) return { rows: [], total: 0 };

    const top6 = rawFormats.slice(0, 6);
    const rest = rawFormats.slice(6);
    const restTotal = rest.reduce((sum, f) => sum + Number(f.total || 0), 0);

    const all = [
      ...top6.map(f => ({ name: f.format_name, value: Number(f.total || 0) })),
      ...(restTotal > 0 ? [{ name: "Drugo", value: restTotal }] : []),
    ].sort((a, b) => b.value - a.value);

    const sum = all.reduce((s, r) => s + r.value, 0);
    return {
      rows: all.map(r => ({ ...r, pct: sum > 0 ? (r.value / sum) * 100 : 0 })),
      total: sum,
    };
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
      <CardHeader>
        <CardTitle>Ploče po formatima (u periodu)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, rows.length * 44)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 64, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={(v) => v.toLocaleString("sr-RS")}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number, _name, props: any) => [
                `${value.toLocaleString("sr-RS")} ploča (${props.payload.pct.toFixed(1)}%)`,
                props.payload.name,
              ]}
            />
            <Bar dataKey="value" radius={[6, 6, 6, 6]}>
              {rows.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: number) => {
                  const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
                  return `${v.toLocaleString("sr-RS")} • ${pct}%`;
                }}
                style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 500 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
