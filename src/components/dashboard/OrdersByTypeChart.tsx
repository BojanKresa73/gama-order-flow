import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

export const OrdersByTypeChart = () => {
  const { data: ordersByType, isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <Card className="h-[300px] flex flex-col">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-36" />
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
        <CardTitle className="text-lg">Nalozi po Tipu</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={ordersByType}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
              outerRadius={70}
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
  );
};
