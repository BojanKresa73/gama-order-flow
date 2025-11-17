import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";

export const MonthlyPlateUsageChart = () => {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["monthly-plate-usage-chart"],
    staleTime: 300_000, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_plate_usage_monthly")
        .select("month, plate_format, plates_used")
        .order("month", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Group by month
      const monthMap = new Map<string, Record<string, number>>();
      
      data.forEach(row => {
        const monthKey = row.month || "";
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {});
        }
        const monthData = monthMap.get(monthKey)!;
        monthData[row.plate_format] = (monthData[row.plate_format] || 0) + (row.plates_used || 0);
      });

      // Convert to chart format
      const chartData = Array.from(monthMap.entries()).map(([month, formats]) => {
        const date = new Date(month);
        const monthName = date.toLocaleDateString('sr-RS', { month: 'short', year: '2-digit' });
        
        return {
          month: monthName,
          ...formats
        };
      });

      // Get last 6 months
      return chartData.slice(-6);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mesečna Potrošnja Ploča
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mesečna Potrošnja Ploča
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-sm text-muted-foreground">Nema podataka</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get all unique plate formats for legend
  const allFormats = new Set<string>();
  chartData.forEach(month => {
    Object.keys(month).forEach(key => {
      if (key !== 'month') allFormats.add(key);
    });
  });

  // Colors for different formats
  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Mesečna Potrošnja Ploča
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '12px' }}
            />
            {Array.from(allFormats).map((format, index) => (
              <Bar 
                key={format}
                dataKey={format}
                stackId="a"
                fill={colors[index % colors.length]}
                name={format}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
