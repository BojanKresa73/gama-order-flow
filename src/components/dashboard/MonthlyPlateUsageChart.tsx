import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";

export const MonthlyPlateUsageChart = () => {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["monthly-plate-usage-chart"],
    staleTime: 300_000, // 5 minutes
    queryFn: async () => {
      // Get current month data
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("v_plate_usage_monthly")
        .select("plate_format, plates_used")
        .gte("month", startOfMonth);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Aggregate by plate format
      const formatMap = new Map<string, number>();
      
      data.forEach(row => {
        const format = row.plate_format || "Nepoznat";
        formatMap.set(format, (formatMap.get(format) || 0) + (row.plates_used || 0));
      });

      // Convert to pie chart format
      return Array.from(formatMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
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

  // Colors for different formats
  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(210, 70%, 50%)",
    "hsl(280, 60%, 55%)",
    "hsl(340, 65%, 50%)",
  ];

  const total = chartData?.reduce((sum, item) => sum + item.value, 0) || 0;

  const currentMonthName = new Date().toLocaleDateString('sr-RS', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Potrošnja Ploča - {currentMonthName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData && chartData.length > 0 ? (
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => 
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                >
                  {chartData.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                  formatter={(value: number) => [`${value} ploča`, 'Količina']}
                />
                <Legend 
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
                  formatter={(value) => <span className="text-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
              <p className="text-2xl font-bold text-foreground">{total}</p>
              <p className="text-sm text-muted-foreground">Ukupno ploča</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nema podataka za ovaj mesec
          </div>
        )}
      </CardContent>
    </Card>
  );
};
