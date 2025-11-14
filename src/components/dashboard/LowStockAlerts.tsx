import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const LowStockAlerts = () => {
  const navigate = useNavigate();

  const { data: lowStock, isLoading } = useQuery({
    queryKey: ["low-stock-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plate_formats")
        .select("id, format_name, current_stock, low_stock_threshold")
        .order("current_stock", { ascending: true });

      return data?.filter((f) => f.current_stock < f.low_stock_threshold) || [];
    },
  });

  if (isLoading) {
    return (
      <Card className="h-[340px] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Upozorenja o Zalihama
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!lowStock || lowStock.length === 0) {
    return (
      <Card className="h-[340px] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Upozorenja o Zalihama
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <p className="text-sm text-muted-foreground">Sve zalihe su u redu! ✓</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[340px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Upozorenja o Zalihama
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead>Format</TableHead>
              <TableHead>Trenutno Stanje</TableHead>
              <TableHead>Prag Upozorenja</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lowStock.map((format) => (
              <TableRow
                key={format.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate("/inventory")}
              >
                <TableCell className="font-medium">{format.format_name}</TableCell>
                <TableCell>{format.current_stock}</TableCell>
                <TableCell>{format.low_stock_threshold}</TableCell>
                <TableCell>
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Nizak nivo
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
