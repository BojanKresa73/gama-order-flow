import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Package, Plus, TrendingUp, Ship, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProcurementOrdersList } from "@/components/procurement/ProcurementOrdersList";
import { ProcurementForecast } from "@/components/procurement/ProcurementForecast";
import { NewProcurementDialog } from "@/components/procurement/NewProcurementDialog";
import { ChinaOrderRecommendation } from "@/components/procurement/ChinaOrderRecommendation";

const Procurement = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);

  const { data: orders, refetch: refetchOrders } = useQuery({
    queryKey: ["procurement-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procurement_orders")
        .select(`
          *,
          procurement_order_items (
            *,
            plate_formats (format_name)
          )
        `)
        .order("order_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: plateFormats } = useQuery({
    queryKey: ["plate-formats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plate_formats")
        .select("*")
        .order("format_name");

      if (error) throw error;
      return data;
    },
  });

  const activeOrders = orders?.filter((o) => o.status !== "arrived" && o.status !== "cancelled") || [];
  const pendingPlates = activeOrders.reduce((sum, order) => {
    const items = order.procurement_order_items || [];
    return sum + items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
  }, 0);

  const handleEdit = (order: any) => {
    setEditingOrder(order);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingOrder(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Nabavka ploča</h1>
                <p className="text-sm text-muted-foreground">Planiranje i praćenje narudžbina</p>
              </div>
            </div>
            <Button onClick={() => { setEditingOrder(null); setDialogOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova narudžbina
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Ship className="h-4 w-4" />
                Aktivne narudžbine
              </div>
              <p className="text-2xl font-bold mt-1">{activeOrders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Package className="h-4 w-4" />
                Ploča na putu
              </div>
              <p className="text-2xl font-bold mt-1">{pendingPlates}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Calendar className="h-4 w-4" />
                Sledeći dolazak
              </div>
              <p className="text-lg font-bold mt-1">
                {(() => {
                  const nextArrival = activeOrders
                    .filter((o) => o.expected_arrival_date)
                    .sort((a, b) => new Date(a.expected_arrival_date!).getTime() - new Date(b.expected_arrival_date!).getTime())[0];
                  return nextArrival
                    ? new Date(nextArrival.expected_arrival_date).toLocaleDateString("sr-Latn")
                    : "-";
                })()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp className="h-4 w-4" />
                Ukupno ove godine
              </div>
              <p className="text-2xl font-bold mt-1">
                {orders?.filter((o) => {
                  const orderYear = new Date(o.order_date).getFullYear();
                  return orderYear === new Date().getFullYear();
                }).length || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="forecast" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="forecast">
              <TrendingUp className="h-4 w-4 mr-2" />
              Predikcija
            </TabsTrigger>
            <TabsTrigger value="orders">
              <Ship className="h-4 w-4 mr-2" />
              Narudžbine
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forecast" className="space-y-4">
            <ChinaOrderRecommendation plateFormats={plateFormats || []} orders={orders || []} />
            <ProcurementForecast plateFormats={plateFormats || []} orders={orders || []} />
          </TabsContent>

          <TabsContent value="orders">
            <ProcurementOrdersList orders={orders || []} onUpdate={refetchOrders} onEdit={handleEdit} />
          </TabsContent>
        </Tabs>
      </main>

      <NewProcurementDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        plateFormats={plateFormats || []}
        onSuccess={refetchOrders}
        editOrder={editingOrder}
      />
    </div>
  );
};

export default Procurement;
