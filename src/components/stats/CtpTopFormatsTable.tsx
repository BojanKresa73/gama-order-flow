import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CtpFiltersState } from "@/pages/CtpStats";
import { buildCtpRpcParams } from "@/lib/ctpRpcHelpers";

interface CtpTopFormatsTableProps {
  filters: CtpFiltersState;
}

export const CtpTopFormatsTable = ({ filters }: CtpTopFormatsTableProps) => {
  const { data: formatsData, isLoading } = useQuery({
    queryKey: ["ctp-top-formats-rpc", filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ctp_top_formats", buildCtpRpcParams(filters));
      if (error) throw error;
      const parsed = (data || []) as Array<{ format_id: string; format_name: string; total_plates: number }>;
      const totalPlates = parsed.reduce((sum, f) => sum + f.total_plates, 0);
      return parsed.map(f => ({
        ...f,
        percentage: totalPlates > 0 ? (f.total_plates / totalPlates) * 100 : 0,
      }));
    },
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader><CardTitle>Top formati</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[320px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader><CardTitle>Top formati</CardTitle></CardHeader>
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
                  <TableRow key={format.format_id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{format.format_name}</TableCell>
                    <TableCell className="text-right">{format.total_plates}</TableCell>
                    <TableCell className="text-right">{format.percentage.toFixed(1)}%</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">Nema podataka za prikaz</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
