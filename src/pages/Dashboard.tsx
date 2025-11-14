import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, FileText, Users, Package, ClipboardList } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { OrdersByTypeChart } from "@/components/dashboard/OrdersByTypeChart";
import { ClosedOrdersChart } from "@/components/dashboard/ClosedOrdersChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { LowStockAlerts } from "@/components/dashboard/LowStockAlerts";

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

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
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">CTP Prepress Sistem</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
            <Button variant="outline" onClick={handleLogout}>
              Odjavi se
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-4">
        {/* Quick Actions Bar */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Dobrodošli, {profile?.full_name}!</h2>
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate("/new-work-order")} size="sm">
              + Novi nalog
            </Button>
            <Button variant="outline" onClick={() => navigate("/clients")} size="sm">
              Klijenti
            </Button>
            <Button variant="outline" onClick={() => navigate("/inventory")} size="sm">
              Inventar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 items-start">
          <StatsCards />
          
          <div className="col-span-4">
            <OrdersByTypeChart />
          </div>
          
          <div className="col-span-8">
            <ClosedOrdersChart />
          </div>

          <div className="col-span-7">
            <RecentOrders />
          </div>
          
          <div className="col-span-5">
            <LowStockAlerts />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
