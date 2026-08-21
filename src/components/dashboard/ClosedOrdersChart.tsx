import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { useMemo } from "react";

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium">{payload[0].payload.date}</p>
        <p className="text-sm text-muted-foreground">
          Zatvoreno: <span className="font-semibold text-foreground">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const ClosedOrdersChart = () => {
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["orders-timeline"],
    staleTime: 60_000,
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data } = await supabase
        .from("work_orders")
        .select("closed_at")
        .eq("status", "closed")
        .is("deleted_at", null)
        .is("invalidated_at", null)
        .gte("closed_at", sevenDaysAgo.toISOString())
        .range(0, 49999);

      return data || [];
    },
  });

  const ordersTimeline = useMemo(() => {
    const dailyCounts: Record<string, number> = {};

    // Local (Belgrade) calendar day key, not UTC
    const localKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    // Initialize all 7 days with 0
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dailyCounts[localKey(date)] = 0;
    }

    // Count orders per day
    rawData?.forEach((order) => {
      if (order.closed_at) {
        const dateStr = localKey(new Date(order.closed_at));
        if (dailyCounts[dateStr] !== undefined) {
          dailyCounts[dateStr]++;
        }
      }
    });

    return Object.entries(dailyCounts).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit" }),
      count,
    }));
  }, [rawData]);

  if (isLoading) {
    return (
      <Card className="h-[300px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
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
        <CardTitle className="text-lg">Zatvoreni Nalozi (7 Dana)</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-4 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={ordersTimeline}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
            <YAxis 
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="count" 
              stroke="#3b82f6" 
              strokeWidth={2} 
              fill="url(#colorCount)"
              strokeLinecap="round"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
