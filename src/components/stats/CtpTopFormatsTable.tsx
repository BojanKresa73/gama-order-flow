import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CtpFiltersState } from "@/pages/CtpStats";

interface CtpTopFormatsTableProps {
  filters: CtpFiltersState;
}

export const CtpTopFormatsTable = ({ filters }: CtpTopFormatsTableProps) => {
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["ctp-top-formats", filters],
    queryFn: async () => {
      let query = supabase
        .from("v_ctp_items" as any)
        .select("plate_format_id, plate_format_name, plates_qty");

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

      // IMPORTANT: Override default 1000 row limit to get ALL data
      const { data, error } = await query.range(0, 49999);

      if (error) throw error;

      return ((data || []) as unknown) as Array<{
        plate_format_id: string;
        plate_format_name: string;
        plates_qty: number;
      }>;
    },
    staleTime: 30000,
  });

  // Memoize format statistics calculation
  const formatsData = useMemo(() => {
    if (!rawData) return null;

    // Group by format
    const formatStats = rawData.reduce((acc, item) => {
      const formatId = item.plate_format_id;
      if (!acc[formatId]) {
        acc[formatId] = {
          formatName: item.plate_format_name || "Nepoznato",
          totalPlates: 0,
        };
      }
      acc[formatId].totalPlates += item.plates_qty || 0;
      return acc;
    }, {} as Record<string, { formatName: string; totalPlates: number }>);

    // Calculate total plates for percentage
    const totalPlates = Object.values(formatStats).reduce(
      (sum, format) => sum + format.totalPlates,
      0
    );

    // Convert to array and sort
    const formatsArray = Object.entries(formatStats)
      .map(([formatId, stats]) => ({
        formatId,
        formatName: stats.formatName,
        totalPlates: stats.totalPlates,
        percentage: totalPlates > 0 ? (stats.totalPlates / totalPlates) * 100 : 0,
      }))
      .sort((a, b) => b.totalPlates - a.totalPlates);

    return formatsArray;
  }, [rawData]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Top formati</CardTitle>
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
        <CardTitle>Top formati</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Format ploče</TableHead>
                <TableHead className="text-right">Ploča ukupno</TableHead>
                <TableHead className="text-right">% učešća</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formatsData && formatsData.length > 0 ? (
                formatsData.map((format, index) => (
                  <TableRow key={format.formatId}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{format.formatName}</TableCell>
                    <TableCell className="text-right">{format.totalPlates}</TableCell>
                    <TableCell className="text-right">{format.percentage.toFixed(1)}%</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
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
