import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CtpFiltersState } from "@/pages/CtpStats";
import { buildCtpRpcParams } from "@/lib/ctpRpcHelpers";
import { FileText, Package, TrendingUp, Users, Euro, ArrowUpDown } from "lucide-react";
import { useAuthz } from "@/hooks/useAuthz";

interface CtpStatsCardsProps {
  filters: CtpFiltersState;
}

export const CtpStatsCards = ({ filters }: CtpStatsCardsProps) => {
  const { isSuper, isAdminPlus } = useAuthz();
  const canViewFinancials = isSuper || isAdminPlus;

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
    enabled: canViewFinancials,
    staleTime: 30000,
  });

  const { data: costData, isLoading: costLoading } = useQuery({
    queryKey: ["ctp-cost-rpc", filters],
    queryFn: async () => {
      const params = buildCtpRpcParams(filters);
      const { data, error } = await supabase.rpc("get_ctp_cost", {
        p_from: params.p_from,
        p_to: params.p_to,
        p_client_ids: params.p_client_ids,
        p_format_ids: params.p_plate_format_ids,
      });
      if (error) throw error;
      const row = (data as any)?.[0];
      return row?.total_cost_eur || 0;
    },
    enabled: canViewFinancials,
    staleTime: 30000,
  });

  const margin = useMemo(() => {
    const revenue = Number(revenueData || 0);
    const cost = Number(costData || 0);
    return revenue - cost;
  }, [revenueData, costData]);

  const marginPercent = useMemo(() => {
    const revenue = Number(revenueData || 0);
    if (revenue === 0) return 0;
    return ((margin / revenue) * 100);
  }, [revenueData, margin]);

  const formatEur = (val: number) =>
    val.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cards = useMemo(() => {
    const base = [
      { title: "Ukupno ploča", value: stats?.totalPlates || 0, icon: Package, format: false, color: "" },
      { title: "Broj CTP naloga", value: stats?.ordersCount || 0, icon: FileText, format: false, color: "" },
      { title: "Prosečno ploča/nalog", value: stats?.avgPlatesPerOrder?.toFixed(1) || "0.0", icon: TrendingUp, format: false, color: "" },
      { title: "Broj klijenata", value: stats?.clientsCount || 0, icon: Users, format: false, color: "" },
    ];
    if (canViewFinancials) {
      base.push(
        {
          title: "Prihod (EUR)",
          value: formatEur(Number(revenueData || 0)),
          icon: Euro,
          format: true,
          color: "text-green-600",
        },
        {
          title: "Nabavka (EUR)",
          value: formatEur(Number(costData || 0)),
          icon: Euro,
          format: true,
          color: "text-orange-500",
        },
        {
          title: `Marža (${marginPercent.toFixed(1)}%)`,
          value: formatEur(margin),
          icon: ArrowUpDown,
          format: true,
          color: margin >= 0 ? "text-green-600" : "text-red-600",
        },
      );
    }
    return base;
  }, [stats, revenueData, costData, margin, marginPercent, canViewFinancials]);

  const totalCards = canViewFinancials ? 7 : 4;
  const isAnyLoading = isLoading || (canViewFinancials && (revenueLoading || costLoading));

  if (isAnyLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(Math.min(totalCards, 4))].map((_, i) => (
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.slice(0, 4).map((card, index) => (
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
      {canViewFinancials && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.slice(4).map((card, index) => (
            <Card key={index} className="rounded-2xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
