import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, FileText, Users, Package, ClipboardList } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { OrdersChart } from "@/components/dashboard/OrdersChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { LowStockAlerts } from "@/components/dashboard/LowStockAlerts";
import { FollowUpWidget } from "@/components/dashboard/FollowUpWidget";

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
      <header className="border-b bg-card">
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

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dobrodošli, {profile?.full_name}!</h2>
          <p className="text-muted-foreground">Pregled sistema u realnom vremenu</p>
        </div>

        <div className="space-y-6">
          <StatsCards />
          
          <OrdersChart />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <RecentOrders />
            <LowStockAlerts />
            <FollowUpWidget />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Brzi Pristup</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate("/dashboard")}
              >
                <CardHeader>
                  <LayoutDashboard className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>Dashboard</CardTitle>
                  <CardDescription>Pregled sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Statistika i pregled</p>
                </CardContent>
              </Card>

              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate("/work-orders")}
              >
                <CardHeader>
                  <FileText className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>Radni nalozi</CardTitle>
                  <CardDescription>CTP, Digital, Other</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Upravljanje nalozima</p>
                </CardContent>
              </Card>

              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate("/checklist")}
              >
                <CardHeader>
                  <ClipboardList className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>Checklist</CardTitle>
                  <CardDescription>Praćenje statusa</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Pregled naloga po tipu</p>
                </CardContent>
              </Card>

              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate("/clients")}
              >
                <CardHeader>
                  <Users className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>Klijenti</CardTitle>
                  <CardDescription>Baza klijenata</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Upravljanje klijentima</p>
                </CardContent>
              </Card>

              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate("/inventory")}
              >
                <CardHeader>
                  <Package className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>Inventar</CardTitle>
                  <CardDescription>Plate formati</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Upravljanje zalihama</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
