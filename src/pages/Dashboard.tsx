import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuthz } from "@/hooks/useAuthz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, FileText, Users, Package, ClipboardList } from "lucide-react";
import gamaLogo from "@/assets/gama-united-logo.svg";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { OrdersByTypeChart } from "@/components/dashboard/OrdersByTypeChart";
import { ClosedOrdersChart } from "@/components/dashboard/ClosedOrdersChart";
import { MonthlyPlateUsageChart } from "@/components/dashboard/MonthlyPlateUsageChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { LowStockAlerts } from "@/components/dashboard/LowStockAlerts";
import { TopClientsCard } from "@/components/dashboard/TopClientsCard";
import AdminSection from "@/components/dashboard/AdminSection";
import { DigitalStatsSection } from "@/components/dashboard/DigitalStatsSection";

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuper, isAdmin } = useAuthz();

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Odjavljeni ste",
      description: "Uspešno ste se odjavili iz sistema",
    });
    navigate("/");
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
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={gamaLogo} alt="Gama United" className="h-14" />
            <h1 className="text-2xl font-bold">Radni nalozi - Gama United</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
            <Button variant="outline" onClick={handleLogout}>
              Odjavi se
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Quick Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Dobrodošli, {profile?.full_name}!</h2>
          <div className="flex items-center gap-3 flex-wrap">
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
            <Button variant="outline" onClick={() => navigate("/checklist")}>
              Checklist
            </Button>
            <Button variant="outline" onClick={() => navigate("/stats/ctp")}>
              CTP statistika
            </Button>
            <Button variant="outline" onClick={() => navigate("/stats/digital")} className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              Digitala statistika
            </Button>
            {isSuper && (
              <Button variant="outline" onClick={() => navigate("/admin/users")}>
                Administracija
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 items-start">
          <StatsCards />
          
          <AdminSection />
          
          <div className="col-span-12 xl:col-span-4">
            <OrdersByTypeChart />
          </div>
          
          <div className="col-span-12 xl:col-span-4">
            <TopClientsCard />
          </div>

          <div className="col-span-12 xl:col-span-4">
            <MonthlyPlateUsageChart />
          </div>

          <div className="col-span-12 xl:col-span-4">
            <ClosedOrdersChart />
          </div>

          <div className="col-span-12 xl:col-span-7">
            <RecentOrders />
          </div>
          
          <div className="col-span-12 xl:col-span-5">
            <LowStockAlerts />
          </div>

          {/* Digital Stats Section - Full Width */}
          <DigitalStatsSection />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
