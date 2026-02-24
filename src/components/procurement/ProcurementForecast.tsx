import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, Package, Calendar, Clock, BarChart3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ProcurementForecastProps {
  plateFormats: any[];
  orders: any[];
}

// Shipping time in days from China
const SHIPPING_DAYS = 90; // ~3 months
const SAFETY_BUFFER_DAYS = 30; // 1 month buffer for delays

interface MonthlyData {
  month: string;
  formatName: string;
  totalPlates: number;
}

export function ProcurementForecast({ plateFormats, orders }: ProcurementForecastProps) {
  // Fetch monthly consumption by format from file_entries
  // IMPORTANT: Using limit(10000) to avoid Supabase's default 1000 row limit
  const { data: monthlyData, isLoading: loadingMonthly } = useQuery({
    queryKey: ["monthly-consumption-by-format-v3"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("file_entries")
        .select(`
          quantity,
          plate_format_id,
          plate_formats(format_name),
          work_orders!inner(status, order_type, closed_at, deleted_at)
        `)
        .eq("work_orders.order_type", "ctp")
        .eq("work_orders.status", "closed")
        .is("work_orders.deleted_at", null)
        .not("work_orders.closed_at", "is", null)
        .range(0, 49999); // Override default 1000 row limit

      if (error) throw error;
      
      // Group by month and format
      const monthlyMap = new Map<string, Map<string, { total: number; formatId: string }>>();
      
      data?.forEach((row: any) => {
        const closedAt = row.work_orders?.closed_at;
        if (!closedAt) return;
        
        const date = new Date(closedAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const formatId = row.plate_format_id;
        const qty = row.quantity || 0;
        
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, new Map());
        }
        const formatMap = monthlyMap.get(monthKey)!;
        const existing = formatMap.get(formatId) || { total: 0, formatId };
        formatMap.set(formatId, { total: existing.total + qty, formatId });
      });
      
      // Convert to array with month info
      const result: { month: string; formatId: string; total: number }[] = [];
      monthlyMap.forEach((formats, month) => {
        formats.forEach(({ total, formatId }) => {
          result.push({ month, formatId, total });
        });
      });
      
      return result.sort((a, b) => b.month.localeCompare(a.month));
    },
    staleTime: 60000,
  });

  // Fetch consumption data from inventory_history for daily averages
  const { data: consumptionData, isLoading: loadingConsumption } = useQuery({
    queryKey: ["plate-consumption"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_history")
        .select("plate_format_id, change_amount, created_at")
        .lt("change_amount", 0)
        .order("created_at", { ascending: true })
        .range(0, 49999);

      if (error) throw error;
      
      if (data && data.length > 0) {
        const firstDate = new Date(data[0].created_at);
        const lastDate = new Date(data[data.length - 1].created_at);
        const actualDays = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        return { entries: data, actualDays, firstDate, lastDate };
      }
      return { entries: [], actualDays: 1, firstDate: new Date(), lastDate: new Date() };
    },
    staleTime: 60000,
  });

  // Calculate forecast with monthly trends
  const forecastData = useMemo(() => {
    if (!plateFormats.length) return [];

    const now = new Date();
    
    // Build monthly stats from file_entries data (primary source)
    const monthlyStatsByFormat = new Map<string, { 
      totals: number[]; 
      months: string[];
      totalPlates: number;
    }>();
    
    if (monthlyData && monthlyData.length > 0) {
      // Sort by month descending to ensure most recent comes first
      const sortedMonthly = [...monthlyData].sort((a, b) => b.month.localeCompare(a.month));
      
      sortedMonthly.forEach(({ month, formatId, total }) => {
        if (!monthlyStatsByFormat.has(formatId)) {
          monthlyStatsByFormat.set(formatId, { totals: [], months: [], totalPlates: 0 });
        }
        const data = monthlyStatsByFormat.get(formatId)!;
        data.totals.push(total);
        data.months.push(month);
        data.totalPlates += total;
      });
    }

    return plateFormats.map((format) => {
      // Get monthly data for this format
      const monthlyStats = monthlyStatsByFormat.get(format.id);
      
      // Calculate from monthly data (file_entries) - this is the accurate source
      let monthlyAvg = 0;
      let activeMonths = 0;
      let lastMonthUsage = 0;
      let trend = 1;
      let avgDaily = 0;
      let totalConsumed = 0;
      
      if (monthlyStats && monthlyStats.totals.length > 0) {
        totalConsumed = monthlyStats.totalPlates;
        activeMonths = monthlyStats.totals.length;
        lastMonthUsage = monthlyStats.totals[0] || 0; // Most recent month (already sorted desc)
        
        // Monthly average
        monthlyAvg = totalConsumed / activeMonths;
        
        // Daily average from monthly data (more accurate than inventory_history)
        avgDaily = monthlyAvg / 30;
        
        // Calculate trend (comparing recent 2 months vs older months)
        if (monthlyStats.totals.length >= 2) {
          const recentMonths = monthlyStats.totals.slice(0, 2);
          const recentAvg = recentMonths.reduce((a, b) => a + b, 0) / recentMonths.length;
          
          if (monthlyStats.totals.length > 2) {
            const olderMonths = monthlyStats.totals.slice(2);
            const olderAvg = olderMonths.reduce((a, b) => a + b, 0) / olderMonths.length;
            if (olderAvg > 0) {
              trend = recentAvg / olderAvg;
              // Clamp between 0.5x and 2x
              trend = Math.max(0.5, Math.min(2, trend));
            }
          }
        }
      } else {
        // Fallback to inventory_history if no file_entries data
        if (consumptionData?.entries) {
          const formatConsumption = consumptionData.entries.filter(
            (c) => c.plate_format_id === format.id
          );
          totalConsumed = formatConsumption.reduce(
            (sum, c) => sum + Math.abs(c.change_amount),
            0
          );
          if (consumptionData.actualDays > 0 && totalConsumed > 0) {
            avgDaily = totalConsumed / consumptionData.actualDays;
            monthlyAvg = avgDaily * 30;
            activeMonths = 1; // Estimate
          }
        }
      }

      // Current stock (protect against negative display)
      const currentStock = format.current_stock || 0;

      // Plates on the way (from active orders)
      const pendingPlates = orders
        .filter((o) => o.status !== "arrived" && o.status !== "cancelled")
        .reduce((sum, order) => {
          const items = order.procurement_order_items || [];
          const formatItems = items.filter((i: any) => i.plate_format_id === format.id);
          return sum + formatItems.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
        }, 0);

      // Days until stockout (without pending orders)
      const daysUntilStockout = avgDaily > 0 ? Math.floor(Math.max(0, currentStock) / avgDaily) : 999;

      // Total available (current + pending) - use max 0 for negative stock
      const totalAvailable = Math.max(0, currentStock) + pendingPlates;
      const daysWithPending = avgDaily > 0 ? Math.floor(totalAvailable / avgDaily) : 999;

      // When to order: need stock for shipping time + buffer
      const minDaysNeeded = SHIPPING_DAYS + SAFETY_BUFFER_DAYS;
      const shouldOrderNow = daysWithPending < minDaysNeeded;

      // How much to order: cover shipping time + buffer + extra month
      // Adjust based on trend - if growing, order more
      const daysToRecover = (SHIPPING_DAYS + SAFETY_BUFFER_DAYS + 30) * Math.max(1, trend);
      const recommendedOrder = Math.max(0, Math.ceil(avgDaily * daysToRecover) - Math.max(0, currentStock) - pendingPlates);

      // Calculate estimated stockout date
      const stockoutDate = new Date();
      stockoutDate.setDate(stockoutDate.getDate() + daysWithPending);

      return {
        format,
        currentStock,
        pendingPlates,
        totalConsumed,
        actualDays: consumptionData?.actualDays || 0,
        avgDaily: avgDaily.toFixed(1),
        monthlyAvg: Math.round(monthlyAvg),
        activeMonths,
        lastMonthUsage,
        trend,
        daysUntilStockout,
        daysWithPending,
        stockoutDate,
        shouldOrderNow,
        recommendedOrder,
        urgencyLevel: shouldOrderNow
          ? daysWithPending < SHIPPING_DAYS
            ? "critical"
            : "warning"
          : "ok",
      };
    }).sort((a, b) => a.daysWithPending - b.daysWithPending);
  }, [consumptionData, monthlyData, plateFormats, orders]);

  const isLoading = loadingMonthly || loadingConsumption;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const criticalFormats = forecastData.filter((f) => f.urgencyLevel === "critical");
  const warningFormats = forecastData.filter((f) => f.urgencyLevel === "warning");

  // Calculate total recommended order
  const totalRecommended = forecastData.reduce((sum, f) => sum + f.recommendedOrder, 0);

  return (
    <div className="space-y-6">
      {/* Summary Alert */}
      {(criticalFormats.length > 0 || warningFormats.length > 0) && (
        <Card className={criticalFormats.length > 0 ? "border-destructive" : "border-orange-500"}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${criticalFormats.length > 0 ? "text-destructive" : "text-orange-500"}`} />
              <CardTitle className="text-lg">Potrebna akcija</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {criticalFormats.length > 0 && (
              <p className="text-sm text-destructive font-medium mb-2">
                🚨 KRITIČNO: {criticalFormats.length} format(a) može nestati pre nego što stigne nova pošiljka!
              </p>
            )}
            {warningFormats.length > 0 && (
              <p className="text-sm text-orange-600">
                ⚠️ UPOZORENJE: Za {warningFormats.length} format(a) treba naručiti odmah zbog vremena isporuke.
              </p>
            )}
            {totalRecommended > 0 && (
              <p className="text-sm font-medium mt-3 pt-3 border-t">
                📦 Ukupno preporučena narudžbina: <span className="text-primary">{totalRecommended.toLocaleString('sr-RS')} ploča</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Forecast Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Predikcija po formatima
          </CardTitle>
          <CardDescription>
            Bazirano na mesečnoj potrošnji sa analizom trenda
            <br />
            Vreme isporuke: ~{SHIPPING_DAYS} dana + {SAFETY_BUFFER_DAYS} dana rezerve
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-right">Stanje</TableHead>
                  <TableHead className="text-right">Na putu</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Mesečni prosek</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Trend</TableHead>
                  <TableHead className="text-right">Dana do 0</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Traje do</TableHead>
                  <TableHead className="text-right">Preporuka</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecastData.map((row) => (
                  <TableRow
                    key={row.format.id}
                    className={
                      row.urgencyLevel === "critical"
                        ? "bg-destructive/10"
                        : row.urgencyLevel === "warning"
                        ? "bg-orange-500/10"
                        : ""
                    }
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {row.urgencyLevel === "critical" && (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                        {row.urgencyLevel === "warning" && (
                          <Clock className="h-4 w-4 text-orange-500" />
                        )}
                        {row.format.format_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-medium">{row.currentStock.toLocaleString('sr-RS')}</span>
                        <Progress
                          value={Math.min(100, (row.daysWithPending / 150) * 100)}
                          className="h-1 w-16 mt-1"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.pendingPlates > 0 ? (
                        <Badge variant="outline" className="gap-1">
                          <Package className="h-3 w-3" />
                          {row.pendingPlates}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      <div className="text-sm">
                        <span className="font-medium">{row.monthlyAvg.toLocaleString('sr-RS')}</span>
                        <span className="text-muted-foreground text-xs block">
                          ({row.activeMonths} mesec{row.activeMonths === 1 ? '' : 'a'})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      {row.activeMonths >= 2 ? (
                        <Badge 
                          variant={row.trend > 1.1 ? "default" : row.trend < 0.9 ? "secondary" : "outline"}
                          className="gap-1"
                        >
                          {row.trend > 1.1 ? (
                            <>↑ {((row.trend - 1) * 100).toFixed(0)}%</>
                          ) : row.trend < 0.9 ? (
                            <>↓ {((1 - row.trend) * 100).toFixed(0)}%</>
                          ) : (
                            "→ stabilan"
                          )}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">malo podataka</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          row.daysWithPending < SHIPPING_DAYS
                            ? "destructive"
                            : row.daysWithPending < SHIPPING_DAYS + SAFETY_BUFFER_DAYS
                            ? "outline"
                            : "default"
                        }
                      >
                        {row.daysWithPending > 365 ? "365+" : row.daysWithPending}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell">
                      {row.daysWithPending > 365 ? (
                        <span className="text-muted-foreground">365+ dana</span>
                      ) : (
                        <span className={row.urgencyLevel === "critical" ? "text-destructive font-medium" : row.urgencyLevel === "warning" ? "text-orange-600" : ""}>
                          {row.stockoutDate.toLocaleDateString("sr-Latn", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.shouldOrderNow && row.recommendedOrder > 0 ? (
                        <span className="font-bold text-orange-600">
                          Naruči {row.recommendedOrder.toLocaleString('sr-RS')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      {monthlyData && monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Potrošnja po mesecima
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            {(() => {
                // Get unique months in descending order (most recent first)
                const uniqueMonths = monthlyData
                  .map(d => d.month)
                  .filter((month, index, self) => self.indexOf(month) === index)
                  .sort((a, b) => b.localeCompare(a))
                  .slice(0, 6);
                
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Format</TableHead>
                        {uniqueMonths.map(month => (
                          <TableHead key={month} className="text-right">
                            {new Date(month + '-01').toLocaleDateString('sr-Latn', { month: 'short', year: '2-digit' })}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plateFormats.filter(f => monthlyData.some(d => d.formatId === f.id)).map(format => (
                        <TableRow key={format.id}>
                          <TableCell className="font-medium">{format.format_name}</TableCell>
                          {uniqueMonths.map(month => {
                            const data = monthlyData.find(d => d.month === month && d.formatId === format.id);
                            return (
                              <TableCell key={month} className="text-right">
                                {data ? data.total.toLocaleString('sr-RS') : '-'}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend / Explanation */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="h-4 w-4 rounded bg-destructive/20 border border-destructive mt-0.5" />
              <div>
                <p className="font-medium">Kritično</p>
                <p className="text-muted-foreground">
                  Zalihe mogu nestati pre dolaska nove pošiljke
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-4 w-4 rounded bg-orange-500/20 border border-orange-500 mt-0.5" />
              <div>
                <p className="font-medium">Upozorenje</p>
                <p className="text-muted-foreground">
                  Treba naručiti sada zbog vremena transporta
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-4 w-4 rounded bg-muted border mt-0.5" />
              <div>
                <p className="font-medium">OK</p>
                <p className="text-muted-foreground">
                  Zalihe su dovoljne za naredni period
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
