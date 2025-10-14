import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

export const OrdersChart = () => {
  const { data: ordersByType, isLoading: loadingTypes } = useQuery({
    queryKey: ["orders-by-type"],
    queryFn: async () => {
      const { data } = await supabase.from("work_orders").select("order_type");
      
      const counts = data?.reduce((acc, order) => {
        acc[order.order_type] = (acc[order.order_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  const { data: ordersTimeline, isLoading: loadingTimeline } = useQuery({
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

  if (loadingTypes || loadingTimeline) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Nalozi po Tipu</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={ordersByType}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {ordersByType?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zatvoreni Nalozi (7 Dana)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={ordersTimeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
