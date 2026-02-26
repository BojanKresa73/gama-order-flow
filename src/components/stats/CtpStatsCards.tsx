import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CtpFiltersState } from "@/pages/CtpStats";
import { buildCtpRpcParams } from "@/lib/ctpRpcHelpers";
import { FileText, Package, TrendingUp, Users, Euro } from "lucide-react";
import { useAuthz } from "@/hooks/useAuthz";

interface CtpStatsCardsProps {
  filters: CtpFiltersState;
}

export const CtpStatsCards = ({ filters }: CtpStatsCardsProps) => {
  const { isSuper, isAdmin } = useAuthz();
  const canViewRevenue = isSuper || isAdmin;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["ctp-stats-rpc", filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ctp_stats", buildCtpRpcParams(filters));
      if (error) throw error;
      const parsed = data as any;
      const totalPlates = parsed?.total_plates || 0;
      const orderCount = parsed?.order_count || 0;
      return {
        totalPlates,
        ordersCount: orderCount,
        avgPlatesPerOrder: orderCount > 0 ? totalPlates / orderCount : 0,
        clientsCount: parsed?.client_count || 0,
      };
    },
    staleTime: 30000,
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ["ctp-revenue-rpc", filters],
    queryFn: async () => {
      const params = buildCtpRpcParams(filters);
      const { data, error } = await supabase.rpc("get_ctp_revenue", params);
      if (error) throw error;
      const row = (data as any)?.[0];
      return row?.total_revenue_eur || 0;
    },
    enabled: canViewRevenue,
    staleTime: 30000,
  });

  const cards = useMemo(() => {
    const base = [
      { title: "Ukupno ploča", value: stats?.totalPlates || 0, icon: Package, format: false },
      { title: "Broj CTP naloga", value: stats?.ordersCount || 0, icon: FileText, format: false },
      { title: "Prosečno ploča/nalog", value: stats?.avgPlatesPerOrder?.toFixed(1) || "0.0", icon: TrendingUp, format: false },
      { title: "Broj klijenata", value: stats?.clientsCount || 0, icon: Users, format: false },
    ];
    if (canViewRevenue) {
      base.push({
        title: "Ukupna vrednost (EUR)",
        value: Number(revenueData || 0).toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        icon: Euro,
        format: true,
      });
    }
    return base;
  }, [stats, revenueData, canViewRevenue]);

  const isAnyLoading = isLoading || (canViewRevenue && revenueLoading);

  if (isAnyLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(canViewRevenue ? 5 : 4)].map((_, i) => (
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

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${canViewRevenue ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
      {cards.map((card, index) => (
        <Card key={index} className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`font-bold ${card.format ? 'text-2xl text-green-600' : 'text-3xl'}`}>{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
