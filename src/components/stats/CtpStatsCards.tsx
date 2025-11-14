import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CtpFiltersState } from "@/pages/CtpStats";
import { FileText, Package, TrendingUp, Users } from "lucide-react";

interface CtpStatsCardsProps {
  filters: CtpFiltersState;
}

export const CtpStatsCards = ({ filters }: CtpStatsCardsProps) => {
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["ctp-stats", filters],
    queryFn: async () => {
      let query = supabase
        .from("v_ctp_items" as any)
        .select("work_order_id, client_id, plates_qty");

      // Apply date range filter
      if (filters.dateRange.from) {
        query = query.gte("closed_on", filters.dateRange.from.toISOString().split("T")[0]);
      }
      if (filters.dateRange.to) {
        query = query.lte("closed_on", filters.dateRange.to.toISOString().split("T")[0]);
      }

      // Apply client filter
      if (filters.clientIds.length > 0) {
        query = query.in("client_id", filters.clientIds);
      }

      // Apply plate format filter
      if (filters.plateFormatIds.length > 0) {
        query = query.in("plate_format_id", filters.plateFormatIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      return ((data || []) as unknown) as Array<{
        work_order_id: string;
        client_id: string;
        plates_qty: number;
      }>;
    },
    staleTime: 30000,
  });

  // Memoize stats calculation
  const stats = useMemo(() => {
    if (!rawData) return null;

    const totalPlates = rawData.reduce((sum, item) => sum + (item.plates_qty || 0), 0);
    const uniqueOrders = new Set(rawData.map((item) => item.work_order_id)).size;
    const uniqueClients = new Set(rawData.map((item) => item.client_id)).size;
    const avgPlatesPerOrder = uniqueOrders > 0 ? totalPlates / uniqueOrders : 0;

    return {
      totalPlates,
      ordersCount: uniqueOrders,
      avgPlatesPerOrder,
      clientsCount: uniqueClients,
    };
  }, [rawData]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = useMemo(() => [
    {
      title: "Ukupno ploča",
      value: stats?.totalPlates || 0,
      icon: Package,
    },
    {
      title: "Broj CTP naloga",
      value: stats?.ordersCount || 0,
      icon: FileText,
    },
    {
      title: "Prosečno ploča/nalog",
      value: stats?.avgPlatesPerOrder?.toFixed(1) || "0.0",
      icon: TrendingUp,
    },
    {
      title: "Broj klijenata",
      value: stats?.clientsCount || 0,
      icon: Users,
    },
  ], [stats]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <Card key={index} className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
