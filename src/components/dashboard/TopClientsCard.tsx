import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const TopClientsCard = () => {
  const { data: topClients, isLoading } = useQuery({
    queryKey: ["top-clients-monthly"],
    staleTime: 300_000, // 5 minutes
    queryFn: async () => {
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const { data, error } = await supabase
        .from("v_plate_usage_monthly")
        .select(`
          client_id,
          plates_used
        `)
        .gte("month", currentMonth.toISOString().split('T')[0])
        .order("plates_used", { ascending: false });

      if (error) throw error;

      // Group by client and sum plates
      const clientMap = new Map<string, number>();
      data?.forEach(row => {
        if (row.client_id) {
          const current = clientMap.get(row.client_id) || 0;
          clientMap.set(row.client_id, current + (row.plates_used || 0));
        }
      });

      // Get client names
      const clientIds = Array.from(clientMap.keys());
      if (clientIds.length === 0) return [];

      const { data: clients } = await supabase
        .from("clients")
        .select("id, name")
        .in("id", clientIds);

      // Combine and sort
      const results = clientIds.map(id => ({
        id,
        name: clients?.find(c => c.id === id)?.name || "Nepoznat",
        plates: clientMap.get(id) || 0
      }));

      return results
        .sort((a, b) => b.plates - a.plates)
        .slice(0, 5);
    },
  });

  if (isLoading) {
    return (
      <Card className="col-span-12 lg:col-span-6">
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
      <Card className="col-span-12 lg:col-span-6">
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
    <Card className="col-span-12 lg:col-span-6">
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
