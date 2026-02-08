import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuthz } from "@/hooks/useAuthz";
import { 
  FileText, 
  BarChart3, 
  ChevronDown, 
  Plus, 
  Users, 
  Package, 
  ClipboardList,
  Printer,
  LayoutGrid
} from "lucide-react";
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Učitavanje...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <AppHeader userName={profile?.full_name} />

      <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-10">
        {/* Welcome Section */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Dobrodošli, {profile?.full_name?.split(' ')[0]}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Upravljajte nalogama i pratite statistiku
          </p>
        </div>

        {/* Quick Actions - Minimal Grid */}
        <div className="mb-10 md:mb-14">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <QuickAction
              icon={Plus}
              label="Novi nalog"
              onClick={() => navigate("/work-orders/new")}
              primary
            />
            <QuickAction
              icon={FileText}
              label="Svi nalozi"
              onClick={() => navigate("/work-orders")}
            />
            <QuickAction
              icon={Printer}
              label="Rolna"
              onClick={() => navigate("/large-format/new?type=roll")}
              className="text-orange-600"
            />
            <QuickAction
              icon={LayoutGrid}
              label="Ploča"
              onClick={() => navigate("/large-format/new?type=rigid")}
              className="text-teal-600"
            />
            <QuickAction
              icon={Users}
              label="Klijenti"
              onClick={() => navigate("/clients")}
            />
            <QuickAction
              icon={Package}
              label="Inventar"
              onClick={() => navigate("/inventory")}
            />
          </div>
          
          {/* Secondary Actions */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/nabavka")}
            >
              Nabavka
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/checklist")}
            >
              <ClipboardList className="h-4 w-4 mr-1.5" />
              Checklist
            </Button>
            {canViewStats && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    <BarChart3 className="h-4 w-4 mr-1.5" />
                    Statistika
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-background">
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

        {/* Stats Cards Row */}
        {canViewStats && (
          <div className="mb-10">
            <SectionHeader title="Pregled" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCards />
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-8 space-y-6 md:space-y-8">
            {/* Recent Orders */}
            <section>
              <SectionHeader title="Poslednji nalozi" />
              <RecentOrders />
            </section>

            {canViewStats && (
              <>
                {/* Charts Row */}
                <section>
                  <SectionHeader title="Analitika" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <MonthlyPlateUsageChart />
                    <ClosedOrdersChart />
                  </div>
                </section>

                <section>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <OrdersByTypeChart />
                    <DailyPlateStats />
                  </div>
                </section>

                {/* Digital Stats */}
                <section>
                  <SectionHeader title="Digitala" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <DigitalStatsSection />
                  </div>
                </section>
              </>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Admin Section */}
            <AdminSection />

            {canViewStats && (
              <>
                <TopClientsCard />
                <InvoiceStatsCard />
              </>
            )}

            {/* Online Users */}
            <OnlineUsersCard />

            {canViewStats && <OnlinePortalUsersCard />}
          </div>
        </div>
      </main>
    </div>
  );
};

// Minimal Quick Action Button
const QuickAction = ({ 
  icon: Icon, 
  label, 
  onClick, 
  primary = false,
  className = ""
}: { 
  icon: React.ElementType; 
  label: string; 
  onClick: () => void; 
  primary?: boolean;
  className?: string;
}) => (
  <button
    onClick={onClick}
    className={`
      group flex flex-col items-center justify-center gap-2 p-4 md:p-5
      rounded-xl border transition-all duration-200
      ${primary 
        ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm" 
        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
      }
    `}
  >
    <Icon className={`h-5 w-5 ${primary ? "" : className || "text-slate-600 group-hover:text-foreground"}`} />
    <span className={`text-xs md:text-sm font-medium ${primary ? "" : "text-slate-700"}`}>
      {label}
    </span>
  </button>
);

// Section Header Component
const SectionHeader = ({ title }: { title: string }) => (
  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
    {title}
  </h2>
);

export default Dashboard;
