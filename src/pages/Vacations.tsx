import { useState, useEffect } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BalanceCard } from "@/components/vacations/BalanceCard";
import { NewRequestDialog } from "@/components/vacations/NewRequestDialog";
import { RequestsTable } from "@/components/vacations/RequestsTable";
import { TeamCalendar } from "@/components/vacations/TeamCalendar";
import { VacationGantt } from "@/components/vacations/VacationGantt";
import { useVacationRequests } from "@/hooks/useVacations";
import { supabase } from "@/integrations/supabase/client";
import { Palmtree } from "lucide-react";

export default function Vacations() {
  const { data: requests = [], isLoading } = useVacationRequests();
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Palmtree className="h-6 w-6 text-primary" />
              <CardTitle>Godišnji odmori</CardTitle>
            </div>
            <NewRequestDialog />
          </CardHeader>
          <CardContent>
            <BalanceCard />
          </CardContent>
        </Card>

        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar">Tim kalendar</TabsTrigger>
            <TabsTrigger value="gantt">Godišnji pregled</TabsTrigger>
            <TabsTrigger value="mine">Moji zahtevi</TabsTrigger>
            <TabsTrigger value="all">Svi zahtevi</TabsTrigger>
          </TabsList>
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
