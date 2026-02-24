import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CtpFiltersState } from "@/pages/CtpStats";
import { buildCtpRpcParams } from "@/lib/ctpRpcHelpers";
import { FileText, Package, TrendingUp, Users } from "lucide-react";

interface CtpStatsCardsProps {
  filters: CtpFiltersState;
}

export const CtpStatsCards = ({ filters }: CtpStatsCardsProps) => {
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

  const cards = useMemo(() => [
    { title: "Ukupno ploča", value: stats?.totalPlates || 0, icon: Package },
    { title: "Broj CTP naloga", value: stats?.ordersCount || 0, icon: FileText },
    { title: "Prosečno ploča/nalog", value: stats?.avgPlatesPerOrder?.toFixed(1) || "0.0", icon: TrendingUp },
    { title: "Broj klijenata", value: stats?.clientsCount || 0, icon: Users },
  ], [stats]);

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
