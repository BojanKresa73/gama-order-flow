import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CtpFiltersState } from "@/pages/CtpStats";
import { buildCtpRpcParams } from "@/lib/ctpRpcHelpers";
import { useAuthz } from "@/hooks/useAuthz";
import { Layers } from "lucide-react";

interface Props {
  filters: CtpFiltersState;
}

export const CtpFormatConsumption = ({ filters }: Props) => {
  const { isSuper, isAdmin } = useAuthz();
  const canViewRevenue = isSuper || isAdmin;

  const { data, isLoading } = useQuery({
    queryKey: ["ctp-consumption-by-format", filters],
    queryFn: async () => {
      const params = buildCtpRpcParams(filters);
      const { data, error } = await supabase.rpc("get_ctp_consumption_by_format", params);
      if (error) throw error;
      return (data || []) as Array<{ format_name: string; plates_consumed: number; revenue_eur: number }>;
    },
    staleTime: 30000,
  });

  const totalPlates = data?.reduce((s, r) => s + r.plates_consumed, 0) || 0;
  const totalRevenue = data?.reduce((s, r) => s + Number(r.revenue_eur), 0) || 0;

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />Potrošnja ploča po formatima</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Potrošnja ploča po formatima
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Format</TableHead>
                <TableHead className="text-right">Ploča</TableHead>
                <TableHead className="text-right">% učešća</TableHead>
                {canViewRevenue && <TableHead className="text-right">Vrednost (EUR)</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data && data.length > 0 ? (
                <>
                  {data.map((row) => (
                    <TableRow key={row.format_name}>
                      <TableCell className="font-medium">{row.format_name}</TableCell>
                      <TableCell className="text-right">{row.plates_consumed.toLocaleString("sr-RS")}</TableCell>
                      <TableCell className="text-right">
                        {totalPlates > 0 ? ((row.plates_consumed / totalPlates) * 100).toFixed(1) : "0.0"}%
                      </TableCell>
                      {canViewRevenue && (
                        <TableCell className="text-right font-medium text-green-600">
                          {Number(row.revenue_eur).toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell className="font-bold">UKUPNO</TableCell>
                    <TableCell className="text-right font-bold">{totalPlates.toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right font-bold">100%</TableCell>
                    {canViewRevenue && (
                      <TableCell className="text-right font-bold text-green-600">
                        {totalRevenue.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    )}
                  </TableRow>
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={canViewRevenue ? 4 : 3} className="text-center text-muted-foreground py-8">
                    Nema podataka za selektovani period
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
