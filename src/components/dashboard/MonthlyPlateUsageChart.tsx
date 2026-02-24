import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, CheckCircle, Clock } from "lucide-react";

export const MonthlyPlateUsageChart = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["monthly-plate-usage-chart-v5-rpc"],
    staleTime: 300_000, // 5 minutes
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      
      const { data: result, error } = await supabase.rpc("get_monthly_plate_usage", {
        p_start: startOfMonth,
        p_end: endOfMonth,
      });

      if (error) throw error;
      if (!result) {
        return { chartData: [], totals: { total: 0, closed: 0, open: 0 } };
      }

      const parsed = result as any;
      const totals = parsed.totals || { total: 0, closed: 0, open: 0 };
      const chartData = (parsed.formats || []) as Array<{ name: string; value: number }>;

      return { chartData, totals };
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
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.chartData || [];
  const totals = data?.totals || { total: 0, closed: 0, open: 0 };

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

  const currentMonthName = new Date().toLocaleDateString('sr-Latn-RS', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Ploče - {currentMonthName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400 mb-1">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Pripremljeno</span>
            </div>
            <p className="text-xl font-bold">{totals.total.toLocaleString('sr-RS')}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Pušteno</span>
            </div>
            <p className="text-xl font-bold">{totals.closed.toLocaleString('sr-RS')}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Ostalo</span>
            </div>
            <p className="text-xl font-bold">{totals.open.toLocaleString('sr-RS')}</p>
          </div>
        </div>

        {chartData && chartData.length > 0 ? (
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={280}>
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
                    `${value} ploča (${((value / totals.total) * 100).toFixed(1)}%)`, 
                    name
                  ]}
                />
                <Legend 
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }}
                  formatter={(value) => {
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
          </div>
        ) : (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground">
            Nema podataka za ovaj mesec
          </div>
        )}
      </CardContent>
    </Card>
  );
};
