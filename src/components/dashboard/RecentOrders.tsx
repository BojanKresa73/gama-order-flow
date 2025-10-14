import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

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
      <Card>
        <CardHeader>
          <CardTitle>Skorašnji Nalozi</CardTitle>
        </CardHeader>
        <CardContent>
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
    <Card>
      <CardHeader>
        <CardTitle>Skorašnji Nalogi</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
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
                onClick={() => navigate("/work-orders")}
              >
                <TableCell className="font-medium">{order.order_number}</TableCell>
                <TableCell>{(order.clients as any)?.name || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{order.order_type}</Badge>
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
    </Card>
  );
};
