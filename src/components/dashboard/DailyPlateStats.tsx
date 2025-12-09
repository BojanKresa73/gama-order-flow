import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Layers, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface PlateStats {
  format_name: string;
  current_stock: number;
  today_used: number;
}

export const DailyPlateStats = () => {
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["daily-plate-stats", today],
    staleTime: 30_000,
    queryFn: async () => {
      // Get all plate formats with current stock
      const { data: formats } = await supabase
        .from("plate_formats")
        .select("id, format_name, current_stock")
        .order("format_name");

      if (!formats) return [];

      // Get today's usage from inventory_history
      const todayStart = `${today}T00:00:00`;
      const todayEnd = `${today}T23:59:59`;
      
      const { data: todayUsage } = await supabase
        .from("inventory_history")
        .select("plate_format_id, change_amount")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
        .lt("change_amount", 0); // Only usage (negative amounts)

      // Aggregate usage per format
      const usageMap: Record<string, number> = {};
      todayUsage?.forEach((entry) => {
        const formatId = entry.plate_format_id;
        usageMap[formatId] = (usageMap[formatId] || 0) + Math.abs(entry.change_amount);
      });

      // Combine data
      const result: PlateStats[] = formats.map((f) => ({
        format_name: f.format_name,
        current_stock: f.current_stock,
        today_used: usageMap[f.id] || 0,
      }));

      return result;
    },
  });

  const totalTodayUsed = stats?.reduce((sum, s) => sum + s.today_used, 0) || 0;
  const totalStock = stats?.reduce((sum, s) => sum + s.current_stock, 0) || 0;

  if (isLoading) {
    return (
      <Card className="h-[340px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="h-[44px] flex flex-row items-center justify-between pb-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Dnevna Potrošnja Ploča
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 pt-4 overflow-hidden">
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[340px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="h-[44px] flex flex-row items-center justify-between pb-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          Dnevna Potrošnja Ploča
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {/* Summary */}
        <div className="bg-muted/50 rounded-lg p-3 mb-3 flex justify-between items-center">
          <div>
            <p className="text-xs text-muted-foreground">Danas pušteno</p>
            <p className="text-2xl font-bold text-primary">{totalTodayUsed}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Ukupno na stanju</p>
            <p className="text-2xl font-bold">{totalStock}</p>
          </div>
        </div>

        {/* Per-format breakdown */}
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="text-muted-foreground text-xs">Format</TableHead>
              <TableHead className="text-muted-foreground text-xs text-right">Danas</TableHead>
              <TableHead className="text-muted-foreground text-xs text-right">Na stanju</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats?.map((format) => (
              <TableRow key={format.format_name} className="hover:bg-muted/50">
                <TableCell className="font-medium text-sm py-2">{format.format_name}</TableCell>
                <TableCell className="text-right text-sm py-2">
                  {format.today_used > 0 ? (
                    <span className="text-primary font-medium">{format.today_used}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm py-2">{format.current_stock}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="border-t border-neutral-200 dark:border-neutral-800 pt-3 pb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/inventory")}
          className="w-full"
        >
          <Package className="h-4 w-4 mr-2" />
          Inventar
        </Button>
      </CardFooter>
    </Card>
  );
};
