import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuthz } from "@/hooks/useAuthz";
import { FileText, BarChart3, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { OnlineUsersCard } from "@/components/dashboard/OnlineUsersCard";
import { OrdersByTypeChart } from "@/components/dashboard/OrdersByTypeChart";
import { ClosedOrdersChart } from "@/components/dashboard/ClosedOrdersChart";
import { MonthlyPlateUsageChart } from "@/components/dashboard/MonthlyPlateUsageChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { DailyPlateStats } from "@/components/dashboard/DailyPlateStats";
import { TopClientsCard } from "@/components/dashboard/TopClientsCard";
import AdminSection from "@/components/dashboard/AdminSection";
import { DigitalStatsSection } from "@/components/dashboard/DigitalStatsSection";
import { InvoiceStatsCard } from "@/components/dashboard/InvoiceStatsCard";
import { OnlinePortalUsersCard } from "@/components/dashboard/OnlinePortalUsersCard";
import { AppHeader } from "@/components/layout/AppHeader";

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuper, isAdmin } = useAuthz();

  const canViewStats = isSuper || isAdmin;

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Učitavanje...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader userName={profile?.full_name} />

      <main className="max-w-[1400px] mx-auto px-3 md:px-6 py-4 md:py-6">
        {/* Welcome & Quick Actions */}
        <div className="flex flex-col gap-4 mb-6">
          <h2 className="text-lg md:text-2xl font-semibold">
            Dobrodošli, {profile?.full_name}!
          </h2>
          
          {/* Mobile Quick Actions - Grid layout that wraps */}
          <div className="grid grid-cols-2 md:hidden gap-2">
            <Button size="sm" className="w-full" onClick={() => navigate("/work-orders/new")}>
              + Novi nalog
            </Button>
            <Button size="sm" variant="secondary" className="w-full" onClick={() => navigate("/work-orders")}>
              <FileText className="h-4 w-4 mr-1" />
              Nalozi
            </Button>
            <Button size="sm" variant="outline" className="w-full border-orange-300 text-orange-700" onClick={() => navigate("/large-format/new?type=roll")}>
              + Rolna
            </Button>
            <Button size="sm" variant="outline" className="w-full border-teal-300 text-teal-700" onClick={() => navigate("/large-format/new?type=rigid")}>
              + Ploča
            </Button>
            <Button size="sm" variant="outline" className="w-full col-span-2" onClick={() => navigate("/nabavka")}>
              Nabavka
            </Button>
          </div>
          
          {/* Desktop Quick Actions */}
          <div className="hidden md:flex items-center gap-3 flex-wrap">
            <Button onClick={() => navigate("/work-orders/new")}>
              + Novi nalog
            </Button>
            <Button variant="outline" onClick={() => navigate("/large-format/new?type=roll")} className="border-orange-300 text-orange-700 hover:bg-orange-50">
              + Rolna
            </Button>
            <Button variant="outline" onClick={() => navigate("/large-format/new?type=rigid")} className="border-teal-300 text-teal-700 hover:bg-teal-50">
              + Ploča
            </Button>
            <Button variant="secondary" onClick={() => navigate("/work-orders")}>
              <FileText className="h-4 w-4 mr-2" />
              Svi nalozi
            </Button>
            <Button variant="outline" onClick={() => navigate("/clients")}>
              Klijenti
            </Button>
            <Button variant="outline" onClick={() => navigate("/inventory")}>
              Inventar
            </Button>
            <Button variant="outline" onClick={() => navigate("/nabavka")}>
              Nabavka
            </Button>
            <Button variant="outline" onClick={() => navigate("/checklist")}>
              Checklist
            </Button>
            {canViewStats && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Statistika
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background">
                  <DropdownMenuItem onClick={() => navigate("/stats/ctp")}>
                    CTP statistika
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/stats/digital")}>
                    Digitala statistika
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
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
      </main>
    </div>
  );
};

export default Dashboard;
