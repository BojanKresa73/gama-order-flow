import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthz } from "@/hooks/useAuthz";
import { Loader2 } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { OnlineUsersCard } from "@/components/dashboard/OnlineUsersCard";
import { OrdersByTypeChart } from "@/components/dashboard/OrdersByTypeChart";
import { ClosedOrdersChart } from "@/components/dashboard/ClosedOrdersChart";
import { MonthlyPlateUsageChart } from "@/components/dashboard/MonthlyPlateUsageChart";
import { YearlyPlateUsageChart } from "@/components/dashboard/YearlyPlateUsageChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { DailyPlateStats } from "@/components/dashboard/DailyPlateStats";
import { TopClientsCard } from "@/components/dashboard/TopClientsCard";
import AdminSection from "@/components/dashboard/AdminSection";
import { DigitalStatsSection } from "@/components/dashboard/DigitalStatsSection";
import { InvoiceStatsCard } from "@/components/dashboard/InvoiceStatsCard";
import { OnlinePortalUsersCard } from "@/components/dashboard/OnlinePortalUsersCard";
import { AppHeader } from "@/components/layout/AppHeader";
import { APP_VERSION_DISPLAY } from "@/lib/version";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuper, isAdmin } = useAuthz();

  const canViewStats = isSuper || isAdmin;

  // Fetch profile using react-query (auth is already handled by InternalUserGuard)
  const { data: profile, isLoading: loading } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/");
        return null;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      return data;
    },
    staleTime: 300_000,
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader userName={profile?.full_name} />

      <main className="max-w-[1400px] mx-auto px-3 md:px-6 py-4 md:py-6">
        {/* Welcome & Quick Actions */}
        <div className="flex flex-col gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Dobrodošli, {profile?.full_name}!
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upravljajte nalogama i pratite statistiku
            </p>
          </div>
          
          <DashboardQuickActions canViewStats={canViewStats} isSuper={isSuper} />
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 md:gap-6 items-start">
          {/* Stats Cards - only for admin/superuser */}
          {canViewStats && <StatsCards />}

          {/* Admin Section - already has its own visibility logic */}
          <div className="col-span-1 sm:col-span-2 md:col-span-12 xl:col-span-4 min-w-0">
            <AdminSection />
          </div>

          {/* Charts and Stats - only for admin/superuser */}
          {canViewStats && (
            <>
              <div className="col-span-1 sm:col-span-2 md:col-span-6 xl:col-span-4 min-w-0">
                <TopClientsCard />
              </div>

              <div className="col-span-1 sm:col-span-2 md:col-span-6 xl:col-span-4 min-w-0">
                <MonthlyPlateUsageChart />
              </div>

              <div className="col-span-1 sm:col-span-2 md:col-span-6 xl:col-span-4 min-w-0">
                <OrdersByTypeChart />
              </div>

              <div className="col-span-1 sm:col-span-2 md:col-span-6 xl:col-span-4 min-w-0">
                <ClosedOrdersChart />
              </div>

              <div className="col-span-1 sm:col-span-2 md:col-span-6 xl:col-span-4 min-w-0">
                <DailyPlateStats />
              </div>

              <div className="col-span-1 sm:col-span-2 md:col-span-12 min-w-0">
                <YearlyPlateUsageChart />
              </div>

              <div className="col-span-1 sm:col-span-2 md:col-span-6 xl:col-span-4 min-w-0">
                <InvoiceStatsCard />
              </div>
            </>
          )}

          {/* Recent Orders - visible to all */}
          <div
            className={`col-span-1 sm:col-span-2 md:col-span-12 min-w-0 ${
              canViewStats ? "xl:col-span-8" : ""
            }`}
          >
            <RecentOrders />
          </div>

          {/* Online Users - visible to all */}
          <div className="col-span-1 sm:col-span-2 md:col-span-6 xl:col-span-4 min-w-0">
            <OnlineUsersCard />
          </div>

          {/* Online Portal Users - only for admin/superuser */}
          {canViewStats && (
            <div className="col-span-1 sm:col-span-2 md:col-span-6 xl:col-span-4 min-w-0">
              <OnlinePortalUsersCard />
            </div>
          )}

          {/* Digital Stats Section - only for admin/superuser */}
          {canViewStats && <DigitalStatsSection />}
        </div>
        {/* App Version */}
        <div className="mt-8 mb-2 text-center text-xs text-muted-foreground/60">
          {APP_VERSION_DISPLAY}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
