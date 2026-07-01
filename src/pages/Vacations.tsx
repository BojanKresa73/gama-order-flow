import { useState, useEffect } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BalanceCard } from "@/components/vacations/BalanceCard";
import { NewRequestDialog } from "@/components/vacations/NewRequestDialog";
import { RequestsTable } from "@/components/vacations/RequestsTable";
import { TeamCalendar } from "@/components/vacations/TeamCalendar";
import { VacationGantt } from "@/components/vacations/VacationGantt";
import { TeamBalances } from "@/components/vacations/TeamBalances";
import { useVacationRequests } from "@/hooks/useVacations";
import { useAuthz } from "@/hooks/useAuthz";
import { supabase } from "@/integrations/supabase/client";
import { Palmtree } from "lucide-react";

export default function Vacations() {
  const { data: requests = [], isLoading } = useVacationRequests();
  const { isAdminPlus } = useAuthz();
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(async (r) => {
      if (!r.data.user) return;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", r.data.user.id).maybeSingle();
      setUserName(data?.full_name || r.data.user.email || "");
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader userName={userName} title="Godišnji odmori" />
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Hero — moj bilans + akcija */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Palmtree className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Godišnji odmori</h1>
              <p className="text-xs text-muted-foreground">Planiraj i prati odmore tima</p>
            </div>
          </div>
          <NewRequestDialog />
        </div>

        <BalanceCard />

        <Tabs defaultValue={isAdminPlus ? "team" : "calendar"}>
          <TabsList className="flex flex-wrap">
            {isAdminPlus && <TabsTrigger value="team">Bilansi tima</TabsTrigger>}
            <TabsTrigger value="calendar">Kalendar</TabsTrigger>
            <TabsTrigger value="gantt">Godišnji pregled</TabsTrigger>
            <TabsTrigger value="mine">Moji zahtevi</TabsTrigger>
            <TabsTrigger value="all">Svi zahtevi</TabsTrigger>
          </TabsList>
          {isAdminPlus && (
            <TabsContent value="team" className="mt-4">
              <TeamBalances />
            </TabsContent>
          )}
          <TabsContent value="calendar" className="mt-4">
            <TeamCalendar requests={requests} />
          </TabsContent>
          <TabsContent value="gantt" className="mt-4">
            <VacationGantt requests={requests} />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <RequestsTable requests={requests} scope="mine" />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <RequestsTable requests={requests} scope="all" />
          </TabsContent>
        </Tabs>

        {isLoading && <div className="text-center text-muted-foreground">Učitavanje...</div>}
      </div>
    </div>
  );
}
