import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const ORDER_TYPE_COLORS = {
  ctp: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  digital: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  film: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
};

export const RecentOrders = () => {
  const navigate = useNavigate();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_orders")
        .select("id, order_number, order_type, status, created_at, clients(name)")
        .order("created_at", { ascending: false })
        .limit(5);

      return data;
    },
  });

  if (isLoading) {
    return (
      <Card className="h-[340px] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Skorašnji Nalozi</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[340px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Skorašnji Nalozi</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead>Broj Naloga</TableHead>
              <TableHead>Klijent</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Datum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map((order) => (
              <TableRow
                key={order.id}
                className="cursor-pointer hover:bg-muted/50"
              >
                <TableCell 
                  className="font-medium text-primary hover:underline"
                  onClick={() => navigate("/work-orders")}
                >
                  {order.order_number}
                </TableCell>
                <TableCell>{(order.clients as any)?.name || "-"}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={ORDER_TYPE_COLORS[order.order_type as keyof typeof ORDER_TYPE_COLORS] || ORDER_TYPE_COLORS.other}
                  >
                    {order.order_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={order.status === "open" ? "default" : "secondary"}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(order.created_at).toLocaleDateString("sr-RS")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="border-t pt-3 pb-3">
        <button
          onClick={() => navigate("/work-orders")}
          className="text-sm text-primary hover:underline flex items-center gap-1 font-medium"
        >
          Pogledaj sve
          <ArrowRight className="h-4 w-4" />
        </button>
      </CardFooter>
    </Card>
  );
};
