import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, CheckCircle, Users, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const StatsCards = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [openRes, closedRes, clientsRes, formatsRes] = await Promise.all([
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .eq("status", "open"),
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .eq("status", "closed")
          .gte("created_at", startOfMonth),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("plate_formats")
          .select("id, current_stock, low_stock_threshold"),
      ]);

      const lowStockCount = formatsRes.data?.filter(
        (f) => f.current_stock < f.low_stock_threshold
      ).length || 0;

      return {
        openOrders: openRes.count || 0,
        closedThisMonth: closedRes.count || 0,
        totalClients: clientsRes.count || 0,
        lowStockCount,
      };
    },
  });

  if (isLoading) {
    return (
      <>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="col-span-1 md:col-span-6 lg:col-span-3 h-24 md:h-28 rounded-xl md:rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-4 md:p-5 bg-card">
            <div className="flex items-start justify-between mb-2 md:mb-3">
              <Skeleton className="h-3 md:h-4 w-20 md:w-24" />
              <Skeleton className="h-5 md:h-6 w-5 md:w-6 rounded opacity-60" />
            </div>
            <Skeleton className="h-7 md:h-8 w-16 md:w-20 mb-2" />
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
          className="col-span-1 md:col-span-6 lg:col-span-3 h-20 md:h-28 rounded-xl md:rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-3 md:p-5 bg-card hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-1 md:mb-3">
            <p className="text-[10px] md:text-sm text-muted-foreground leading-tight">{card.title}</p>
            <card.icon className={`h-4 md:h-6 w-4 md:w-6 ${card.color} opacity-60 shrink-0`} />
          </div>
          <div className="text-xl md:text-3xl font-semibold tracking-tight">{card.value}</div>
        </div>
      ))}
    </>
  );
};
