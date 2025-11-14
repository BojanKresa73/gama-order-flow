import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkOrderChecklistTab } from "@/components/work-orders/WorkOrderChecklistTab";
import { format } from "date-fns";

const WorkOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    if (id) {
      fetchWorkOrder();
    }
  }, [id]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
    }
  };

  const fetchWorkOrder = async () => {
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          *,
          clients (name, email, pib, adresa),
          profiles (full_name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setWorkOrder(data);
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case "ctp": return "CTP";
      case "digital": return "Digital";
      case "film": return "Film";
      case "other": return "Ostalo";
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    return status === "open" ? (
      <Badge variant="default">Otvoren</Badge>
    ) : (
      <Badge variant="secondary">Zatvoren</Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate("/work-orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Nalog nije pronađen</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/work-orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Nalog {workOrder.order_number}</h1>
              <p className="text-sm text-muted-foreground">
                {workOrder.clients?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(workOrder.status)}
            <Badge variant="outline">{getOrderTypeLabel(workOrder.order_type)}</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Pregled</TabsTrigger>
            <TabsTrigger value="files">Fajlovi</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Osnovne informacije</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Broj naloga</p>
                    <p className="font-medium">{workOrder.order_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tip naloga</p>
                    <p className="font-medium">{getOrderTypeLabel(workOrder.order_type)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Klijent</p>
                    <p className="font-medium">{workOrder.clients?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Kreirao</p>
                    <p className="font-medium">{workOrder.profiles?.full_name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Datum kreiranja</p>
                    <p className="font-medium">{format(new Date(workOrder.created_at), "dd.MM.yyyy HH:mm")}</p>
                  </div>
                  {workOrder.closed_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">Datum zatvaranja</p>
                      <p className="font-medium">{format(new Date(workOrder.closed_at), "dd.MM.yyyy HH:mm")}</p>
                    </div>
                  )}
                </div>
                {workOrder.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Napomene</p>
                    <p className="font-medium whitespace-pre-wrap">{workOrder.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Fajlovi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Lista fajlova se prikazuje ovde...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checklist" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <WorkOrderChecklistTab workOrderId={id!} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default WorkOrderDetails;
