import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const TopClientsCard = () => {
  const { data: topClients, isLoading } = useQuery({
    queryKey: ["top-clients-monthly-direct"],
    staleTime: 60_000, // 1 minute
    queryFn: async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const startOfMonth = `${year}-${month}-01T00:00:00`;
      
      // Query directly from work_orders + file_entries for accurate data
      const { data: workOrders, error: woError } = await supabase
        .from("work_orders")
        .select(`
          client_id,
          clients!inner(id, name),
          file_entries(quantity)
        `)
        .eq("kind", "CTP")
        .gte("closed_at", startOfMonth)
        .is("deleted_at", null)
        .is("invalidated_at", null);

      if (woError) throw woError;
      if (!workOrders || workOrders.length === 0) return [];

      // Aggregate plates by client
      const clientMap = new Map<string, { name: string; plates: number }>();
      
      workOrders.forEach((wo: any) => {
        const clientId = wo.client_id;
        const clientName = wo.clients?.name || "Nepoznat";
        const plates = wo.file_entries?.reduce((sum: number, fe: any) => sum + (fe.quantity || 0), 0) || 0;
        
        if (clientMap.has(clientId)) {
          clientMap.get(clientId)!.plates += plates;
        } else {
          clientMap.set(clientId, { name: clientName, plates });
        }
      });

      // Convert to array, sort and take top 5
      const results = Array.from(clientMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        plates: data.plates
      }));

      return results
        .sort((a, b) => b.plates - a.plates)
        .slice(0, 5);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top 5 Klijenata - Tekući Mesec
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!topClients || topClients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top 5 Klijenata - Tekući Mesec
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nema podataka za tekući mesec
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Top 5 Klijenata - Tekući Mesec
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topClients.map((client, index) => (
            <div
              key={client.id}
              className="flex justify-between items-center pb-3 border-b last:border-b-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="font-medium text-sm">{client.name}</span>
              </div>
              <span className="text-sm font-semibold text-muted-foreground">
                {client.plates.toLocaleString()} ploča
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
