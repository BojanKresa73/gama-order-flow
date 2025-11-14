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
          <div key={i} className="col-span-3 h-28 rounded-2xl border shadow-sm p-5 bg-card">
            <div className="flex items-start justify-between mb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-6 rounded opacity-60" />
            </div>
            <Skeleton className="h-8 w-20 mb-2" />
          </div>
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
        <div 
          key={card.title} 
          className="col-span-3 h-28 rounded-2xl border shadow-sm p-5 bg-card hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm text-muted-foreground">{card.title}</p>
            <card.icon className={`h-6 w-6 ${card.color} opacity-60`} />
          </div>
          <div className="text-3xl font-semibold tracking-tight">{card.value}</div>
        </div>
      ))}
    </>
  );
};
