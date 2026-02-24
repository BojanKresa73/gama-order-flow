import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { DigitalFiltersState } from "@/pages/DigitalStats";

interface DigitalTopClientsTableProps {
  filters: DigitalFiltersState;
}

export function DigitalTopClientsTable({ filters }: DigitalTopClientsTableProps) {
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ["digital-top-clients", filters],
    queryFn: async () => {
      const { data: digitalJobs, error } = await supabase
        .from("digital_jobs")
        .select(`
          *,
          work_order:work_orders!inner(
            id,
            created_at,
            client_id,
            clients(id, name),
            deleted_at
          )
        `)
        .gte("work_order.created_at", filters.dateRange.from.toISOString())
        .lte("work_order.created_at", filters.dateRange.to.toISOString())
        .is("work_order.deleted_at", null)
        .range(0, 49999);

      if (error) throw error;

      // Apply filters
      let filteredJobs = digitalJobs || [];

      if (filters.clientIds.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.clientIds.includes(job.work_order?.client_id)
        );
      }

      if (filters.printSides.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.printSides.includes(job.print_sides)
        );
      }

      if (filters.paperTypes.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.paperTypes.includes(job.paper_type || "")
        );
      }

      if (filters.sheetFormats.length > 0) {
        filteredJobs = filteredJobs.filter(job => 
          filters.sheetFormats.includes(job.machine_sheet_format)
        );
      }

      // Group by client
      const clientStats: Record<string, { 
        name: string; 
        sheets: number; 
        colorClicks: number;
        monoClicks: number;
        jobs: number;
        orders: Set<string>;
      }> = {};

      filteredJobs.forEach(job => {
        const clientId = job.work_order?.client_id;
        const clientName = job.work_order?.clients?.name || "Nepoznat";
        
        if (clientId) {
          if (!clientStats[clientId]) {
            clientStats[clientId] = { 
              name: clientName, 
              sheets: 0, 
              colorClicks: 0,
              monoClicks: 0,
              jobs: 0,
              orders: new Set()
            };
          }
          clientStats[clientId].sheets += job.computed_total_sheets || 0;
          clientStats[clientId].colorClicks += job.computed_color_clicks || 0;
          clientStats[clientId].monoClicks += job.computed_mono_clicks || 0;
          clientStats[clientId].jobs += 1;
          clientStats[clientId].orders.add(job.work_order_id);
        }
      });

      return Object.entries(clientStats)
        .map(([id, data]) => ({
          id,
          name: data.name,
          sheets: data.sheets,
          colorClicks: data.colorClicks,
          monoClicks: data.monoClicks,
          jobs: data.jobs,
          orders: data.orders.size,
        }))
        .sort((a, b) => b.sheets - a.sheets)
        .slice(0, 10);
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          Top 10 klijenata
        </CardTitle>
        <CardDescription>Po broju tabaka u izabranom periodu</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Klijent</TableHead>
              <TableHead className="text-right">Tabaka</TableHead>
              <TableHead className="text-right">Color</TableHead>
              <TableHead className="text-right">Mono</TableHead>
              <TableHead className="text-right">Naloga</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientsData && clientsData.length > 0 ? (
              clientsData.map((client, index) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={
                        index === 0 ? "bg-amber-100 text-amber-700" :
                        index === 1 ? "bg-slate-200 text-slate-700" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        ""
                      }
                    >
                      {index + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-right font-bold text-indigo-600">
                    {client.sheets.toLocaleString("sr-RS")}
                  </TableCell>
                  <TableCell className="text-right text-purple-600">
                    {client.colorClicks.toLocaleString("sr-RS")}
                  </TableCell>
                  <TableCell className="text-right text-slate-600">
                    {client.monoClicks.toLocaleString("sr-RS")}
                  </TableCell>
                  <TableCell className="text-right">
                    {client.orders}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nema podataka za izabrani period
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
