import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package } from "lucide-react";
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
      <Card className="h-[340px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="h-[44px] flex flex-row items-center justify-between pb-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Upozorenja o Zalihama
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

  if (!lowStock || lowStock.length === 0) {
    return (
      <Card className="h-[340px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="h-[44px] flex flex-row items-center justify-between pb-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Upozorenja o Zalihama
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 pt-4 flex items-center justify-center">
          <div className="text-center bg-green-50 dark:bg-green-950 rounded-lg p-6 w-full">
            <p className="text-sm text-green-800 dark:text-green-300 font-medium">
              Sve zalihe su u redu ✓
            </p>
          </div>
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
  }

  return (
    <Card className="h-[340px] flex flex-col rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="h-[44px] flex flex-row items-center justify-between pb-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Upozorenja o Zalihama
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="text-muted-foreground">Format</TableHead>
              <TableHead className="text-muted-foreground">Trenutno Stanje</TableHead>
              <TableHead className="text-muted-foreground">Prag Upozorenja</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
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
