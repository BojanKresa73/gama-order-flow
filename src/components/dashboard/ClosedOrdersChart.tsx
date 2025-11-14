import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Area, AreaChart } from "recharts";

export const ClosedOrdersChart = () => {
  const { data: ordersTimeline, isLoading } = useQuery({
    queryKey: ["orders-timeline"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data } = await supabase
        .from("work_orders")
        .select("closed_at")
        .eq("status", "closed")
        .gte("closed_at", sevenDaysAgo.toISOString());

      const dailyCounts: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        dailyCounts[dateStr] = 0;
      }

      data?.forEach((order) => {
        if (order.closed_at) {
          const dateStr = order.closed_at.split("T")[0];
          if (dailyCounts[dateStr] !== undefined) {
            dailyCounts[dateStr]++;
          }
        }
      });

      return Object.entries(dailyCounts).map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("sr-RS", { day: "numeric", month: "short" }),
        count,
      }));
    },
  });

  if (isLoading) {
    return (
      <Card className="h-[300px] flex flex-col">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="flex-1">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[300px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Zatvoreni Nalozi (7 Dana)</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={ordersTimeline}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#colorCount)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
