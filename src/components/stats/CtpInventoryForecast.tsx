import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { subDays } from "date-fns";

export const CtpInventoryForecast = () => {
  const navigate = useNavigate();

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["ctp-inventory-forecast"],
    queryFn: async () => {
      // Fetch plate formats with current stock
      const { data: formats, error: formatsError } = await supabase
        .from("plate_formats")
        .select("id, format_name, current_stock")
        .order("format_name");

      if (formatsError) throw formatsError;

      // Fetch CTP items from last 30 days (global, no filters)
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];
      const { data: items, error: itemsError } = await supabase
        .from("v_ctp_items" as any)
        .select("plate_format_id, plate_format_name, plates_qty, closed_on")
        .gte("closed_on", thirtyDaysAgo);

      if (itemsError) throw itemsError;

      // Fetch pending procurement (on the way from China)
      const { data: procOrders } = await supabase
        .from("procurement_orders")
        .select("status, procurement_order_items(plate_format_id, quantity)")
        .not("status", "in", "(arrived,cancelled)");

      const pending: Record<string, number> = {};
      (procOrders || []).forEach((o: any) => {
        (o.procurement_order_items || []).forEach((i: any) => {
          if (!i.plate_format_id) return;
          pending[i.plate_format_id] = (pending[i.plate_format_id] || 0) + (i.quantity || 0);
        });
      });

      return {
        formats,
        pending,
        items: ((items || []) as unknown) as Array<{
          plate_format_id: string;
          plate_format_name: string;
          plates_qty: number;
          closed_on: string;
        }>,
      };
    },
    staleTime: 60000, // 1 minute
  });

  // Memoize forecast calculation
  const forecastData = useMemo(() => {
    if (!rawData) return null;

    // Calculate consumption per format
    const formatConsumption: Record<string, number> = {};
    rawData.items.forEach(item => {
      if (item.plate_format_id) {
        formatConsumption[item.plate_format_id] = 
          (formatConsumption[item.plate_format_id] || 0) + (item.plates_qty || 0);
      }
    });

    // Calculate DoC for each format
    const data = rawData.formats.map(format => {
      const totalConsumption = formatConsumption[format.id] || 0;
      const avgDaily = totalConsumption / 30;
      const pendingQty = rawData.pending[format.id] || 0;
      const available = format.current_stock + pendingQty;
      const daysOfCover = avgDaily > 0 ? format.current_stock / avgDaily : 999;
      const daysOfCoverWithPending = avgDaily > 0 ? available / avgDaily : 999;

      return {
        formatId: format.id,
        formatName: format.format_name,
        currentStock: format.current_stock,
        pending: pendingQty,
        available,
        avgDaily: avgDaily,
        daysOfCover: daysOfCover,
        daysOfCoverWithPending,
      };
    });

    // Sort by DoC ascending (most critical first)
    return data.sort((a, b) => a.daysOfCover - b.daysOfCover);
  }, [rawData]);

  const getRowColor = (daysOfCover: number) => {
    if (daysOfCover < 7) {
      return "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500";
    } else if (daysOfCover <= 14) {
      return "bg-orange-50 dark:bg-orange-950/20 border-l-4 border-l-orange-500";
    } else {
      return "bg-green-50 dark:bg-green-950/20 border-l-4 border-l-green-500";
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Prognoza lagera (DoC)</CardTitle>
          <Skeleton className="h-9 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Prognoza lagera (DoC)</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Prosečna potrošnja iz poslednjih 30 dana
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/inventory")}
          className="gap-2"
        >
          <Package className="h-4 w-4" />
          Idi na Inventar
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Format</TableHead>
              <TableHead className="text-right">Lager</TableHead>
              <TableHead className="text-right">Na putu</TableHead>
              <TableHead className="text-right">Prosek/dan</TableHead>
              <TableHead className="text-right">DoC (lager)</TableHead>
              <TableHead className="text-right">DoC (+na putu)</TableHead>
            </TableRow>
          </TableHeader>
            <TableBody>
              {forecastData && forecastData.length > 0 ? (
                forecastData.map((item) => (
                <TableRow key={item.formatId} className={getRowColor(item.daysOfCover)}>
                  <TableCell className="font-medium">{item.formatName}</TableCell>
                  <TableCell className="text-right">{item.currentStock}</TableCell>
                  <TableCell className="text-right text-blue-600">
                    {item.pending > 0 ? item.pending.toLocaleString('sr-RS') : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.avgDaily > 0 ? item.avgDaily.toFixed(1) : "0.0"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {item.daysOfCover >= 999 ? "∞" : Math.round(item.daysOfCover)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-blue-700 dark:text-blue-400">
                    {item.daysOfCoverWithPending >= 999 ? "∞" : Math.round(item.daysOfCoverWithPending)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nema podataka za prikaz
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        
        {forecastData && forecastData.length > 0 && (
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 justify-between items-center">
            <span className="text-sm text-muted-foreground">Ukupno formata: {forecastData.length}</span>
            <div className="flex gap-4 text-sm">
              <span>Lager: <strong>{forecastData.reduce((s, i) => s + i.currentStock, 0).toLocaleString('sr-RS')}</strong></span>
              <span className="text-blue-600">Na putu: <strong>{forecastData.reduce((s, i) => s + i.pending, 0).toLocaleString('sr-RS')}</strong></span>
              <span className="text-lg font-semibold">
                Dostupno: {forecastData.reduce((s, i) => s + i.available, 0).toLocaleString('sr-RS')}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
