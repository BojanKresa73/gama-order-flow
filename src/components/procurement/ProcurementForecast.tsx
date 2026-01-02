import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, Package, Calendar, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ProcurementForecastProps {
  plateFormats: any[];
  orders: any[];
}

// Shipping time in days from China
const SHIPPING_DAYS = 90; // ~3 months
const SAFETY_BUFFER_DAYS = 30; // 1 month buffer for delays

export function ProcurementForecast({ plateFormats, orders }: ProcurementForecastProps) {
  // Fetch consumption data from inventory_history
  const { data: consumptionData, isLoading } = useQuery({
    queryKey: ["plate-consumption"],
    queryFn: async () => {
      // Get ALL consumption data to calculate proper daily average
      const { data, error } = await supabase
        .from("inventory_history")
        .select("plate_format_id, change_amount, created_at")
        .lt("change_amount", 0) // Only consumption (negative changes)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      // Calculate actual date range with data
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

  // Calculate forecast data
  const forecastData = useMemo(() => {
    if (!consumptionData?.entries || !plateFormats.length) return [];

    const { entries, actualDays } = consumptionData;

    return plateFormats.map((format) => {
      // Calculate total consumption for this format
      const formatConsumption = entries.filter(
        (c) => c.plate_format_id === format.id
      );

      const totalConsumed = formatConsumption.reduce(
        (sum, c) => sum + Math.abs(c.change_amount),
        0
      );

      // Daily average based on actual days with data
      const avgDaily = actualDays > 0 ? totalConsumed / actualDays : 0;

      // Current stock
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
      const daysUntilStockout = avgDaily > 0 ? Math.floor(currentStock / avgDaily) : 999;

      // Total available (current + pending)
      const totalAvailable = currentStock + pendingPlates;
      const daysWithPending = avgDaily > 0 ? Math.floor(totalAvailable / avgDaily) : 999;

      // When to order: need stock for shipping time + buffer
      const minDaysNeeded = SHIPPING_DAYS + SAFETY_BUFFER_DAYS;
      const shouldOrderNow = daysWithPending < minDaysNeeded;

      // How much to order: cover shipping time + buffer + extra month
      const daysToRecover = SHIPPING_DAYS + SAFETY_BUFFER_DAYS + 30;
      const recommendedOrder = Math.max(0, Math.ceil(avgDaily * daysToRecover) - currentStock - pendingPlates);

      // Calculate estimated stockout date
      const stockoutDate = new Date();
      stockoutDate.setDate(stockoutDate.getDate() + daysWithPending);

      return {
        format,
        currentStock,
        pendingPlates,
        totalConsumed,
        actualDays,
        avgDaily: avgDaily.toFixed(1),
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
  }, [consumptionData, plateFormats, orders]);

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
            Bazirano na prosečnoj potrošnji (30 dana: 70%, 90 dana: 30%)
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
                  <TableHead className="text-right hidden sm:table-cell">Dnevna potrošnja</TableHead>
                  <TableHead className="text-right">Dana do 0</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Traje do</TableHead>
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
                        <span className="font-medium">{row.currentStock}</span>
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
                        <span className="font-medium">{row.avgDaily}</span>
                        <span className="text-muted-foreground text-xs block">
                          ({row.totalConsumed} za {row.actualDays}d)
                        </span>
                      </div>
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
                    <TableCell className="text-right hidden md:table-cell">
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
                          Naruči {row.recommendedOrder}
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
