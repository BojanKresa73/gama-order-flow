import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Label } from "recharts";
import { useMemo } from "react";

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
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["orders-by-type"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("work_orders").select("order_type");
      return data || [];
    },
  });

  const ordersByType = useMemo(() => {
    if (!rawData) return [];
    
    const counts = rawData.reduce((acc, order) => {
      acc[order.order_type] = (acc[order.order_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).map(([name, value]) => ({ 
      name, 
      value,
      color: COLORS[name as keyof typeof COLORS] || COLORS.other
    }));
  }, [rawData]);

  const totalOrders = useMemo(() => 
    ordersByType.reduce((sum, item) => sum + item.value, 0),
    [ordersByType]
  );

  if (isLoading) {
    return (
      <Card className="h-[280px] sm:h-[250px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="h-[44px] flex flex-row items-center justify-between pb-0 flex-shrink-0">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="flex-1 pt-2 min-h-0">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[280px] sm:h-[250px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <CardHeader className="h-[44px] flex flex-row items-center justify-between pb-0 flex-shrink-0">
        <CardTitle className="text-lg">Nalozi po Tipu</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-2 pb-3 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={ordersByType}
              cx="35%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              fill="#8884d8"
              dataKey="value"
              label={false}
            >
              {ordersByType?.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <Label content={<CustomLabel totalOrders={totalOrders} />} position="center" />
            </Pie>
            <Tooltip wrapperStyle={{ zIndex: 1000 }} />
            <Legend 
              layout="vertical" 
              align="right" 
              verticalAlign="middle"
              iconType="circle"
              wrapperStyle={{ fontSize: '13px', paddingLeft: '10px' }}
              className="text-muted-foreground"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
