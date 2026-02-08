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
  LayoutGrid,
  ShoppingCart
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Učitavanje...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Ambient glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <AppHeader userName={profile?.full_name} />

        <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-10">
          {/* Hero Section */}
          <div className="mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Dobrodošli, {profile?.full_name?.split(' ')[0]}
            </h1>
            <p className="mt-2 text-slate-400">
              Upravljajte nalogama i pratite statistiku
            </p>
          </div>

          {/* Quick Actions - Glass Cards */}
          <div className="mb-10 md:mb-14">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <GlassAction
                icon={Plus}
                label="Novi nalog"
                onClick={() => navigate("/work-orders/new")}
                gradient="from-violet-500 to-purple-600"
                glow
              />
              <GlassAction
                icon={FileText}
                label="Svi nalozi"
                onClick={() => navigate("/work-orders")}
              />
              <GlassAction
                icon={Printer}
                label="Rolna"
                onClick={() => navigate("/large-format/new?type=roll")}
                gradient="from-orange-500 to-amber-500"
              />
              <GlassAction
                icon={LayoutGrid}
                label="Ploča"
                onClick={() => navigate("/large-format/new?type=rigid")}
                gradient="from-teal-500 to-emerald-500"
              />
              <GlassAction
                icon={Users}
                label="Klijenti"
                onClick={() => navigate("/clients")}
              />
              <GlassAction
                icon={Package}
                label="Inventar"
                onClick={() => navigate("/inventory")}
              />
              <GlassAction
                icon={ShoppingCart}
                label="Nabavka"
                onClick={() => navigate("/nabavka")}
              />
            </div>
            
            {/* Secondary Actions */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-slate-400 hover:text-white hover:bg-white/5"
                onClick={() => navigate("/checklist")}
              >
                <ClipboardList className="h-4 w-4 mr-1.5" />
                Checklist
              </Button>
              {canViewStats && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-white/5">
                      <BarChart3 className="h-4 w-4 mr-1.5" />
                      Statistika
                      <ChevronDown className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-slate-900/95 backdrop-blur-xl border-slate-700/50">
                    <DropdownMenuItem 
                      onClick={() => navigate("/stats/ctp")}
                      className="text-slate-300 focus:bg-white/10 focus:text-white"
                    >
                      CTP statistika
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => navigate("/stats/digital")}
                      className="text-slate-300 focus:bg-white/10 focus:text-white"
                    >
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
              <GlassSection title="Poslednji nalozi">
                <RecentOrders />
              </GlassSection>

              {canViewStats && (
                <>
                  {/* Charts Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <GlassSection title="Mesečna potrošnja">
                      <MonthlyPlateUsageChart />
                    </GlassSection>
                    <GlassSection title="Zatvoreni nalozi">
                      <ClosedOrdersChart />
                    </GlassSection>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <GlassSection title="Nalozi po tipu">
                      <OrdersByTypeChart />
                    </GlassSection>
                    <GlassSection title="Dnevna statistika">
                      <DailyPlateStats />
                    </GlassSection>
                  </div>

                  {/* Digital Stats */}
                  <GlassSection title="Digitala">
                    <DigitalStatsSection />
                  </GlassSection>
                </>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              {/* Admin Section */}
              <GlassSection>
                <AdminSection />
              </GlassSection>

              {canViewStats && (
                <>
                  <GlassSection title="Top klijenti">
                    <TopClientsCard />
                  </GlassSection>
                  <GlassSection title="Fakturisanje">
                    <InvoiceStatsCard />
                  </GlassSection>
                </>
              )}

              {/* Online Users */}
              <GlassSection title="Online korisnici">
                <OnlineUsersCard />
              </GlassSection>

              {canViewStats && (
                <GlassSection title="Portal korisnici">
                  <OnlinePortalUsersCard />
                </GlassSection>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// Glass Action Button
const GlassAction = ({ 
  icon: Icon, 
  label, 
  onClick, 
  gradient,
  glow = false
}: { 
  icon: React.ElementType; 
  label: string; 
  onClick: () => void; 
  gradient?: string;
  glow?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`
      group relative flex flex-col items-center justify-center gap-2.5 p-4 md:p-5
      rounded-2xl border border-white/10 
      bg-white/5 backdrop-blur-xl
      transition-all duration-300
      hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]
      ${glow ? "shadow-lg shadow-violet-500/20" : ""}
    `}
  >
    {gradient && (
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />
    )}
    <div className={`
      p-2 rounded-xl 
      ${gradient 
        ? `bg-gradient-to-br ${gradient}` 
        : "bg-white/10"
      }
    `}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <span className="text-xs md:text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
      {label}
    </span>
  </button>
);

// Glass Section Container
const GlassSection = ({ 
  title, 
  children 
}: { 
  title?: string; 
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 md:p-6">
    {title && (
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
        {title}
      </h3>
    )}
    <div className="[&_.rounded-xl]:bg-transparent [&_.rounded-2xl]:bg-transparent [&_.border]:border-white/10 [&_.bg-card]:bg-transparent [&_.shadow-md]:shadow-none [&_.shadow-sm]:shadow-none">
      {children}
    </div>
  </div>
);

// Section Header Component
const SectionHeader = ({ title }: { title: string }) => (
  <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">
    {title}
  </h2>
);

export default Dashboard;
