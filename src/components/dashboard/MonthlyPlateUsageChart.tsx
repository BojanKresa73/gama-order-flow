import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";

export const MonthlyPlateUsageChart = () => {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["monthly-plate-usage-chart-v2"],
    staleTime: 300_000, // 5 minutes
    queryFn: async () => {
      // Get current month start
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      // Fetch from inventory_history with plate_formats join
      const { data, error } = await supabase
        .from("inventory_history")
        .select(`
          change_amount,
          plate_formats!inner(format_name)
        `)
        .lt("change_amount", 0)
        .gte("created_at", startOfMonth);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Aggregate by plate format
      const formatMap = new Map<string, number>();
      
      data.forEach(row => {
        const format = (row.plate_formats as any)?.format_name || "Nepoznat";
        const used = Math.abs(row.change_amount || 0);
        formatMap.set(format, (formatMap.get(format) || 0) + used);
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
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Colors for different formats
  const COLORS = [
    "hsl(200, 85%, 55%)",  // bright blue
    "hsl(160, 65%, 45%)",  // teal
    "hsl(280, 60%, 55%)",  // purple
    "hsl(35, 90%, 55%)",   // orange
    "hsl(340, 70%, 55%)",  // pink
    "hsl(180, 60%, 45%)",  // cyan
    "hsl(45, 85%, 50%)",   // yellow
    "hsl(220, 70%, 50%)",  // royal blue
    "hsl(100, 50%, 45%)",  // green
    "hsl(0, 70%, 55%)",    // red
  ];

  const total = chartData?.reduce((sum, item) => sum + item.value, 0) || 0;

  const currentMonthName = new Date().toLocaleDateString('sr-Latn-RS', { 
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
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
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
                  formatter={(value: number, name: string) => [
                    `${value} ploča (${((value / total) * 100).toFixed(1)}%)`, 
                    name
                  ]}
                />
                <Legend 
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }}
                  formatter={(value, entry) => {
                    const item = chartData.find(d => d.name === value);
                    return (
                      <span className="text-foreground text-xs">
                        {value}: {item?.value || 0}
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center mt-4 p-3 bg-primary/10 rounded-lg">
              <p className="text-3xl font-bold text-primary">{total.toLocaleString('sr-RS')}</p>
              <p className="text-sm text-muted-foreground">Ukupno ploča ovog meseca</p>
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
