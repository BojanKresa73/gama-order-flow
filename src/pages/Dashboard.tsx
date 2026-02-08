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
  ShoppingCart,
  Zap,
  Rocket
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-indigo-600 font-medium">Učitavanje...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <AppHeader userName={profile?.full_name} />

      <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-10">
        {/* Hero Section with Accent */}
        <div className="mb-8 md:mb-12 relative">
          <div className="absolute -left-4 -top-4 w-32 h-32 bg-gradient-to-br from-violet-400/30 to-blue-400/30 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <Rocket className="h-6 w-6 text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Dobrodošli nazad</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 bg-clip-text text-transparent">
              {profile?.full_name?.split(' ')[0]}, hajde da radimo!
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Upravljajte nalogama, pratite statistiku i držite sve pod kontrolom
            </p>
          </div>
        </div>

        {/* Primary CTA - Hero Card */}
        <div className="mb-10 md:mb-14">
          <button
            onClick={() => navigate("/work-orders/new")}
            className="w-full group relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-600 p-8 md:p-10 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-center justify-between">
              <div className="text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="h-5 w-5" />
                  <span className="text-sm font-bold uppercase tracking-wider">Kreni odmah</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black">Kreiraj novi nalog</h2>
              </div>
              <Zap className="h-12 w-12 opacity-30 group-hover:opacity-50 transition-opacity" />
            </div>
          </button>
        </div>

        {/* Quick Actions Grid */}
        <div className="mb-10 md:mb-14">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Brze akcije</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <BoldAction
              icon={FileText}
              label="Svi nalozi"
              onClick={() => navigate("/work-orders")}
              color="indigo"
            />
            <BoldAction
              icon={Printer}
              label="Rolna"
              onClick={() => navigate("/large-format/new?type=roll")}
              color="orange"
            />
            <BoldAction
              icon={LayoutGrid}
              label="Ploča"
              onClick={() => navigate("/large-format/new?type=rigid")}
              color="teal"
            />
            <BoldAction
              icon={Users}
              label="Klijenti"
              onClick={() => navigate("/clients")}
              color="pink"
            />
            <BoldAction
              icon={Package}
              label="Inventar"
              onClick={() => navigate("/inventory")}
              color="amber"
            />
            <BoldAction
              icon={ShoppingCart}
              label="Nabavka"
              onClick={() => navigate("/nabavka")}
              color="emerald"
            />
          </div>

          {/* Secondary Actions */}
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <Button 
              variant="outline"
              size="sm"
              className="border-2 border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 font-medium"
              onClick={() => navigate("/checklist")}
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Checklist
            </Button>
            {canViewStats && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="border-2 border-slate-300 hover:border-purple-500 hover:bg-purple-50 text-slate-700 font-medium"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Statistika
                    <ChevronDown className="h-3.5 w-3.5 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-white border-2 border-slate-200">
                  <DropdownMenuItem 
                    onClick={() => navigate("/stats/ctp")}
                    className="font-medium text-slate-700"
                  >
                    CTP statistika
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate("/stats/digital")}
                    className="font-medium text-slate-700"
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
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Pregled</h3>
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
            <BoldSection title="Poslednji nalozi" icon={<FileText className="h-5 w-5" />}>
              <RecentOrders />
            </BoldSection>

            {canViewStats && (
              <>
                {/* Charts Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <BoldSection title="Mesečna potrošnja" color="indigo">
                    <MonthlyPlateUsageChart />
                  </BoldSection>
                  <BoldSection title="Zatvoreni nalozi" color="emerald">
                    <ClosedOrdersChart />
                  </BoldSection>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <BoldSection title="Nalozi po tipu" color="purple">
                    <OrdersByTypeChart />
                  </BoldSection>
                  <BoldSection title="Dnevna statistika" color="amber">
                    <DailyPlateStats />
                  </BoldSection>
                </div>

                {/* Digital Stats */}
                <BoldSection title="Digitala" color="violet" fullWidth>
                  <DigitalStatsSection />
                </BoldSection>
              </>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Admin Section */}
            <BoldSection color="red">
              <AdminSection />
            </BoldSection>

            {canViewStats && (
              <>
                <BoldSection title="Top klijenti" color="blue">
                  <TopClientsCard />
                </BoldSection>
                <BoldSection title="Fakturisanje" color="pink">
                  <InvoiceStatsCard />
                </BoldSection>
              </>
            )}

            {/* Online Users */}
            <BoldSection title="Online korisnici" color="cyan">
              <OnlineUsersCard />
            </BoldSection>

            {canViewStats && (
              <BoldSection title="Portal korisnici" color="orange">
                <OnlinePortalUsersCard />
              </BoldSection>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// Bold Vibrant Action Button
const BoldAction = ({ 
  icon: Icon, 
  label, 
  onClick,
  color = "indigo"
}: { 
  icon: React.ElementType; 
  label: string; 
  onClick: () => void;
  color?: string;
}) => {
  const colorClasses: Record<string, { bg: string; text: string; border: string; hover: string }> = {
    indigo: { bg: "bg-indigo-500", text: "text-indigo-600", border: "border-indigo-200", hover: "hover:bg-indigo-600" },
    orange: { bg: "bg-orange-500", text: "text-orange-600", border: "border-orange-200", hover: "hover:bg-orange-600" },
    teal: { bg: "bg-teal-500", text: "text-teal-600", border: "border-teal-200", hover: "hover:bg-teal-600" },
    pink: { bg: "bg-pink-500", text: "text-pink-600", border: "border-pink-200", hover: "hover:bg-pink-600" },
    amber: { bg: "bg-amber-500", text: "text-amber-600", border: "border-amber-200", hover: "hover:bg-amber-600" },
    emerald: { bg: "bg-emerald-500", text: "text-emerald-600", border: "border-emerald-200", hover: "hover:bg-emerald-600" },
  };

  const colors = colorClasses[color] || colorClasses.indigo;

  return (
    <button
      onClick={onClick}
      className={`
        group flex flex-col items-center justify-center gap-2 p-4 md:p-5
        rounded-2xl border-2 transition-all duration-300
        ${colors.bg} text-white shadow-lg
        ${colors.hover} hover:shadow-xl hover:scale-105
        active:scale-95
      `}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs md:text-sm font-bold">
        {label}
      </span>
    </button>
  );
};

// Bold Section Container
const BoldSection = ({ 
  title, 
  icon,
  color,
  fullWidth = false,
  children 
}: { 
  title?: string;
  icon?: React.ReactNode;
  color?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) => {
  const colorMap: Record<string, string> = {
    indigo: "border-l-indigo-600 bg-indigo-50/50",
    purple: "border-l-purple-600 bg-purple-50/50",
    emerald: "border-l-emerald-600 bg-emerald-50/50",
    amber: "border-l-amber-600 bg-amber-50/50",
    violet: "border-l-violet-600 bg-violet-50/50",
    blue: "border-l-blue-600 bg-blue-50/50",
    pink: "border-l-pink-600 bg-pink-50/50",
    cyan: "border-l-cyan-600 bg-cyan-50/50",
    orange: "border-l-orange-600 bg-orange-50/50",
    red: "border-l-red-600 bg-red-50/50",
  };

  const borderColor = color ? colorMap[color] : "border-l-slate-300 bg-slate-50/30";

  return (
    <div className={`rounded-2xl border-2 border-slate-200 border-l-4 ${borderColor} p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow`}>
      {title && (
        <div className="flex items-center gap-2 mb-4">
          {icon && <span className="text-slate-600">{icon}</span>}
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            {title}
          </h3>
        </div>
      )}
      <div className="[&_.rounded-xl]:bg-transparent [&_.rounded-2xl]:bg-transparent [&_.bg-card]:bg-transparent [&_.shadow-md]:shadow-none [&_.shadow-sm]:shadow-none">
        {children}
      </div>
    </div>
  );
};

export default Dashboard;
