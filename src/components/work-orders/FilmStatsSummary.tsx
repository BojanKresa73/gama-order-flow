import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ruler, DollarSign, TrendingUp, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FilmStatsSummaryProps {
  workOrderIds: string[];
}

interface FilmStats {
  totalMeters: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  ordersCount: number;
}

export function FilmStatsSummary({ workOrderIds }: FilmStatsSummaryProps) {
  const { data: filmSettings } = useQuery({
    queryKey: ["film-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("film_settings")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["film-stats-summary", workOrderIds],
    queryFn: async (): Promise<FilmStats> => {
      if (!workOrderIds.length) {
        return { totalMeters: 0, totalCost: 0, totalRevenue: 0, totalProfit: 0, ordersCount: 0 };
      }

      // Fetch film jobs for the given work orders
      const { data: filmJobs, error } = await supabase
        .from("film_jobs")
        .select("work_order_id, computed_total_m")
        .in("work_order_id", workOrderIds);

      if (error) throw error;

      // Also check work orders for price overrides
      const { data: workOrders, error: woError } = await supabase
        .from("work_orders")
        .select("id, film_price_override_eur_per_m")
        .in("id", workOrderIds);

      if (woError) throw woError;

      const priceOverrides = new Map(
        workOrders?.map((wo) => [wo.id, wo.film_price_override_eur_per_m]) || []
      );

      // Calculate totals
      let totalMeters = 0;
      let totalCost = 0;
      let totalRevenue = 0;
      const ordersWithFilm = new Set<string>();

      const costPerM = filmSettings?.cost_eur_per_m || 12.5;
      const defaultPricePerM = filmSettings?.price_eur_per_m || 17;
      const wastePercent = filmSettings?.waste_percent || 3;

      for (const job of filmJobs || []) {
        if (job.computed_total_m && job.computed_total_m > 0) {
          const metersWithWaste = job.computed_total_m * (1 + wastePercent / 100);
          totalMeters += metersWithWaste;
          totalCost += metersWithWaste * costPerM;
          
          const pricePerM = priceOverrides.get(job.work_order_id) || defaultPricePerM;
          totalRevenue += metersWithWaste * pricePerM;
          
          ordersWithFilm.add(job.work_order_id);
        }
      }

      return {
        totalMeters,
        totalCost,
        totalRevenue,
        totalProfit: totalRevenue - totalCost,
        ordersCount: ordersWithFilm.size,
      };
    },
    enabled: workOrderIds.length > 0 && !!filmSettings,
  });

  if (!workOrderIds.length) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Statistika filmovanja
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.ordersCount === 0) {
    return null;
  }

  return (
    <Card className="rounded-2xl shadow-sm bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <Ruler className="h-5 w-5" />
          Statistika filmovanja
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Nalozi
            </p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {stats.ordersCount}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Ruler className="h-4 w-4" />
              Ukupno metara
            </p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {stats.totalMeters.toFixed(2)} m
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Trošak
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              €{stats.totalCost.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Naplata
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              €{stats.totalRevenue.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Profit
            </p>
            <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              €{stats.totalProfit.toFixed(2)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
