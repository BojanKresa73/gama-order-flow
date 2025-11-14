import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, Users, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const StatsCards = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [ordersRes, clientsRes, formatsRes] = await Promise.all([
        supabase.from("work_orders").select("status, created_at"),
        supabase.from("clients").select("id", { count: "exact" }),
        supabase.from("plate_formats").select("id, current_stock, low_stock_threshold"),
      ]);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const openOrders = ordersRes.data?.filter((o) => o.status === "open").length || 0;
      const closedThisMonth =
        ordersRes.data?.filter((o) => {
          return o.status === "closed" && new Date(o.created_at) >= startOfMonth;
        }).length || 0;

      const lowStockCount = formatsRes.data?.filter(
        (f) => f.current_stock < f.low_stock_threshold
      ).length || 0;

      return {
        openOrders,
        closedThisMonth,
        totalClients: clientsRes.count || 0,
        lowStockCount,
      };
    },
  });

  if (isLoading) {
    return (
      <>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="col-span-3 h-28">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </>
    );
  }

  const cards = [
    {
      title: "Aktivni Nalozi",
      value: stats?.openOrders || 0,
      icon: FileText,
      color: "text-blue-600",
    },
    {
      title: "Zatvoreno Ovog Meseca",
      value: stats?.closedThisMonth || 0,
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      title: "Ukupno Klijenata",
      value: stats?.totalClients || 0,
      icon: Users,
      color: "text-purple-600",
    },
    {
      title: "Niske Zalihe",
      value: stats?.lowStockCount || 0,
      icon: AlertTriangle,
      color: "text-orange-600",
    },
  ];

  return (
    <>
      {cards.map((card) => (
        <Card key={card.title} className="col-span-3 h-28">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </>
  );
};
