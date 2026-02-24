import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CtpFiltersState } from "@/pages/CtpStats";
import { buildCtpRpcParams } from "@/lib/ctpRpcHelpers";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CtpTopClientsTableProps {
  filters: CtpFiltersState;
}

export const CtpTopClientsTable = ({ filters }: CtpTopClientsTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ["ctp-top-clients-rpc", filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ctp_top_clients", buildCtpRpcParams(filters));
      if (error) throw error;
      const parsed = (data || []) as Array<{ client_id: string; client_name: string; total_plates: number; orders_count: number }>;
      const totalPlates = parsed.reduce((sum, c) => sum + c.total_plates, 0);
      return parsed.map(c => ({
        ...c,
        percentage: totalPlates > 0 ? (c.total_plates / totalPlates) * 100 : 0,
      }));
    },
    staleTime: 30000,
  });

  const paginatedData = useMemo(() => {
    if (!clientsData) return null;
    const start = (currentPage - 1) * pageSize;
    return clientsData.slice(start, start + pageSize);
  }, [clientsData, currentPage]);

  const totalPages = clientsData ? Math.ceil(clientsData.length / pageSize) : 0;

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader><CardTitle>Top klijenti</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[320px] w-full" /></CardContent>
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
              <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
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
                  <TableRow key={client.client_id}>
                    <TableCell className="font-medium">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                    <TableCell>{client.client_name}</TableCell>
                    <TableCell className="text-right">{client.total_plates}</TableCell>
                    <TableCell className="text-right">{client.orders_count}</TableCell>
                    <TableCell className="text-right">{client.percentage.toFixed(1)}%</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Nema podataka za prikaz</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
