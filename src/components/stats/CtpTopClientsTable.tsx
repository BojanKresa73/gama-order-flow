import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CtpFiltersState } from "@/pages/CtpStats";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CtpTopClientsTableProps {
  filters: CtpFiltersState;
}

export const CtpTopClientsTable = ({ filters }: CtpTopClientsTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["ctp-top-clients", filters],
    queryFn: async () => {
      let query = supabase
        .from("v_ctp_items" as any)
        .select("client_id, client_name, work_order_id, plates_qty");

      // Apply date range filter
      if (filters.dateRange.from) {
        query = query.gte("closed_on", filters.dateRange.from.toISOString().split("T")[0]);
      }
      if (filters.dateRange.to) {
        query = query.lte("closed_on", filters.dateRange.to.toISOString().split("T")[0]);
      }

      // Apply client filter
      if (filters.clientIds.length > 0) {
        query = query.in("client_id", filters.clientIds);
      }

      // Apply plate format filter
      if (filters.plateFormatIds.length > 0) {
        query = query.in("plate_format_id", filters.plateFormatIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      return ((data || []) as unknown) as Array<{
        client_id: string;
        client_name: string;
        work_order_id: string;
        plates_qty: number;
      }>;
    },
    staleTime: 30000,
  });

  // Memoize client statistics calculation
  const clientsData = useMemo(() => {
    if (!rawData) return null;

    // Group by client
    const clientStats = rawData.reduce((acc, item) => {
      const clientId = item.client_id;
      if (!acc[clientId]) {
        acc[clientId] = {
          clientName: item.client_name || "Nepoznato",
          totalPlates: 0,
          orderIds: new Set<string>(),
        };
      }
      acc[clientId].totalPlates += item.plates_qty || 0;
      acc[clientId].orderIds.add(item.work_order_id);
      return acc;
    }, {} as Record<string, { clientName: string; totalPlates: number; orderIds: Set<string> }>);

    // Calculate total plates for percentage
    const totalPlates = Object.values(clientStats).reduce(
      (sum, client) => sum + client.totalPlates,
      0
    );

    // Convert to array and sort
    const clientsArray = Object.entries(clientStats)
      .map(([clientId, stats]) => ({
        clientId,
        clientName: stats.clientName,
        totalPlates: stats.totalPlates,
        ordersCount: stats.orderIds.size,
        percentage: totalPlates > 0 ? (stats.totalPlates / totalPlates) * 100 : 0,
      }))
      .sort((a, b) => b.totalPlates - a.totalPlates);

    return clientsArray;
  }, [rawData]);

  // Memoize pagination
  const paginatedData = useMemo(() => {
    if (!clientsData) return null;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return clientsData.slice(startIndex, endIndex);
  }, [clientsData, currentPage]);

  const totalPages = useMemo(() => {
    if (!clientsData) return 0;
    return Math.ceil(clientsData.length / pageSize);
  }, [clientsData]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Top klijenti</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[320px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Top klijenti</CardTitle>
          {clientsData && clientsData.length > pageSize && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Klijent</TableHead>
                <TableHead className="text-right">Ploča ukupno</TableHead>
                <TableHead className="text-right">Nalozi</TableHead>
                <TableHead className="text-right">% učešća</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData && paginatedData.length > 0 ? (
                paginatedData.map((client, index) => (
                  <TableRow key={client.clientId}>
                    <TableCell className="font-medium">
                      {(currentPage - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell>{client.clientName}</TableCell>
                    <TableCell className="text-right">{client.totalPlates}</TableCell>
                    <TableCell className="text-right">{client.ordersCount}</TableCell>
                    <TableCell className="text-right">{client.percentage.toFixed(1)}%</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nema podataka za prikaz
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
