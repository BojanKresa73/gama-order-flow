import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Label } from "recharts";
import { useMemo } from "react";

import { useIsMobile } from "@/hooks/use-mobile";

const COLORS = {
  ctp: "#3B82F6",
  digital: "#22C55E",
  film: "#F59E0B",
  other: "#94A3B8",
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
  const isMobile = useIsMobile();

  const { data: ordersByType = [], isLoading } = useQuery({
    queryKey: ["orders-by-type"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_orders_by_type");
      if (error) throw error;
      return (data || []).map((row: any) => ({
        name: row.order_type,
        value: Number(row.count),
        color: COLORS[row.order_type as keyof typeof COLORS] || COLORS.other,
      }));
    },
  });

  const totalOrders = useMemo(
    () => ordersByType.reduce((sum, item) => sum + item.value, 0),
    [ordersByType]
  );

  if (isLoading) {
    return (
      <Card className="h-[320px] sm:h-[300px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="h-[44px] flex flex-row items-center justify-between pb-0">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="flex-1 pt-4 min-w-0">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[320px] sm:h-[300px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="h-[44px] flex flex-row items-center justify-between pb-0">
        <CardTitle className="text-lg">Nalozi po Tipu</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-4 pb-4 min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={ordersByType}
              cx={isMobile ? "50%" : "35%"}
              cy={isMobile ? "44%" : "50%"}
              innerRadius={isMobile ? 48 : 60}
              outerRadius={isMobile ? 70 : 80}
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
              layout={isMobile ? "horizontal" : "vertical"}
              align={isMobile ? "center" : "right"}
              verticalAlign={isMobile ? "bottom" : "middle"}
              iconType="circle"
              wrapperStyle={{
                fontSize: isMobile ? "12px" : "14px",
                paddingTop: isMobile ? "8px" : undefined,
              }}
              className="text-muted-foreground"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
