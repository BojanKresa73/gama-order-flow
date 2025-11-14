import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Label } from "recharts";

const COLORS = {
  ctp: "#3B82F6",
  digital: "#22C55E",
  film: "#F59E0B",
  other: "#94A3B8"
};

const CustomLabel = ({ viewBox, totalOrders }: any) => {
  const { cx, cy } = viewBox;
  return (
    <g>
      <text
        x={cx}
        y={cy - 10}
        className="fill-foreground text-2xl font-bold"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {totalOrders}
      </text>
      <text
        x={cx}
        y={cy + 15}
        className="fill-muted-foreground text-sm"
        textAnchor="middle"
        dominantBaseline="central"
      >
        Ukupno naloga
      </text>
    </g>
  );
};

export const OrdersByTypeChart = () => {
  const { data: ordersByType, isLoading } = useQuery({
    queryKey: ["orders-by-type"],
    queryFn: async () => {
      const { data } = await supabase.from("work_orders").select("order_type");
      
      const counts = data?.reduce((acc, order) => {
        acc[order.order_type] = (acc[order.order_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return Object.entries(counts).map(([name, value]) => ({ 
        name, 
        value,
        color: COLORS[name as keyof typeof COLORS] || COLORS.other
      }));
    },
  });

  const totalOrders = ordersByType?.reduce((sum, item) => sum + item.value, 0) || 0;

  if (isLoading) {
    return (
      <Card className="h-[300px] sm:h-[260px] flex flex-col">
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
    <Card className="h-[300px] sm:h-[260px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Nalozi po Tipu</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={ordersByType}
              cx="35%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={false}
            >
              {ordersByType?.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <Label content={<CustomLabel totalOrders={totalOrders} />} position="center" />
            </Pie>
            <Tooltip />
            <Legend 
              layout="vertical" 
              align="right" 
              verticalAlign="middle"
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
