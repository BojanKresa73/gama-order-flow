import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileStack, Palette, Layers, Target, TrendingUp, Zap } from "lucide-react";
import { DigitalFiltersState } from "@/pages/DigitalStats";

interface DigitalStatsCardsProps {
  filters: DigitalFiltersState;
}

export function DigitalStatsCards({ filters }: DigitalStatsCardsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["digital-stats-cards", filters],
    queryFn: async () => {
      let query = supabase
        .from("digital_jobs")
        .select(`
          *,
          work_order:work_orders!inner(
            id,
            status,
            created_at,
            client_id,
            deleted_at,
            invalidated_at
          )
        `)
        .gte("work_order.created_at", filters.dateRange.from.toISOString())
        .lte("work_order.created_at", filters.dateRange.to.toISOString())
        .is("work_order.deleted_at", null)
        .is("work_order.invalidated_at", null);

      const { data: digitalJobs, error } = await query.range(0, 49999);

      if (error) throw error;

      // Apply client-side filters
      let filteredJobs = digitalJobs || [];

      if (filters.clientIds.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.clientIds.includes(job.work_order?.client_id)
        );
      }

      if (filters.printSides.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.printSides.includes(job.print_sides)
        );
      }

      if (filters.paperTypes.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.paperTypes.includes(job.paper_type || "")
        );
      }

      if (filters.sheetFormats.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.sheetFormats.includes(job.machine_sheet_format)
        );
      }

      // Calculate totals
      const totalSheets = filteredJobs.reduce((sum, job) => sum + (job.computed_total_sheets || 0), 0);
      const totalColorClicks = filteredJobs.reduce((sum, job) => sum + (job.computed_color_clicks || 0), 0);
      const totalMonoClicks = filteredJobs.reduce((sum, job) => sum + (job.computed_mono_clicks || 0), 0);
      const totalJobs = filteredJobs.length;

      // Unique work orders
      const uniqueOrders = new Set(filteredJobs.map(job => job.work_order_id)).size;

      // Average sheets per job
      const avgSheetsPerJob = totalJobs > 0 ? Math.round(totalSheets / totalJobs) : 0;

      return {
        totalSheets,
        totalColorClicks,
        totalMonoClicks,
        totalJobs,
        uniqueOrders,
        avgSheetsPerJob,
      };
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Ukupno tabaka",
      value: stats?.totalSheets.toLocaleString("sr-RS") || "0",
      icon: FileStack,
      gradient: "from-indigo-500 to-indigo-600",
      shadow: "shadow-indigo-500/20",
    },
    {
      title: "Color klikovi",
      value: stats?.totalColorClicks.toLocaleString("sr-RS") || "0",
      icon: Palette,
      gradient: "from-purple-500 to-purple-600",
      shadow: "shadow-purple-500/20",
    },
    {
      title: "Mono klikovi",
      value: stats?.totalMonoClicks.toLocaleString("sr-RS") || "0",
      icon: Layers,
      gradient: "from-slate-600 to-slate-700",
      shadow: "shadow-slate-500/20",
    },
    {
      title: "Broj stavki",
      value: stats?.totalJobs.toLocaleString("sr-RS") || "0",
      icon: Target,
      gradient: "from-emerald-500 to-emerald-600",
      shadow: "shadow-emerald-500/20",
    },
    {
      title: "Broj naloga",
      value: stats?.uniqueOrders.toLocaleString("sr-RS") || "0",
      icon: TrendingUp,
      gradient: "from-blue-500 to-blue-600",
      shadow: "shadow-blue-500/20",
    },
    {
      title: "Prosek tab/stavka",
      value: stats?.avgSheetsPerJob.toLocaleString("sr-RS") || "0",
      icon: Zap,
      gradient: "from-amber-500 to-orange-600",
      shadow: "shadow-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card 
          key={card.title} 
          className={`relative overflow-hidden border-0 bg-gradient-to-br ${card.gradient} text-white shadow-xl ${card.shadow}`}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <card.icon className="h-6 w-6 opacity-80" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {card.value}
            </div>
            <p className="text-white/80 text-xs mt-1">{card.title}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
