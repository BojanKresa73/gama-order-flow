import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkOrderChecklistTab } from "@/components/work-orders/WorkOrderChecklistTab";
import { format } from "date-fns";
import { getOrderItems } from "@/lib/orderItems";

const WorkOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState<any>(null);
  const [resending, setResending] = useState(false);

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
      
      // Use unified helper to fetch items
      const items = await getOrderItems(id!);
      
      setWorkOrder({ ...data, items });

      // Fetch email status
      const { data: emailData } = await supabase
        .from("email_job_latest_status")
        .select("*")
        .eq("work_order_id", id)
        .maybeSingle();

      setEmailStatus(emailData);
    } catch (error: any) {
      toast.error("Greška: " + error.message);
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

  const handleResendEmail = async () => {
    if (!workOrder) {
      toast.error("Nalog nije pronađen");
      return;
    }

    setResending(true);
    try {
      // Call the edge function to resend delivery note
      const { data, error } = await supabase.functions.invoke('send-delivery-note', {
        body: { workOrderId: id }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Otpremnica poslata klijentu");
      } else {
        throw new Error(data?.error || "Greška pri slanju");
      }

      // Refresh work order
      fetchWorkOrder();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    } finally {
      setResending(false);
    }
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
            {workOrder.status === "closed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendEmail}
                disabled={resending}
              >
                <Mail className="h-4 w-4 mr-2" />
                {resending ? "Šalje se..." : "Ponovo pošalji"}
              </Button>
            )}
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
                  {emailStatus && (
                    <div>
                      <p className="text-sm text-muted-foreground">Email status</p>
                      <p className="font-medium">
                        {emailStatus.status === "sent" && "📧 Poslato"}
                        {emailStatus.status === "error" && (
                          <span className="text-destructive">📧 Greška: {emailStatus.error_msg}</span>
                        )}
                        {emailStatus.status === "pending" && "📧 Čeka slanje"}
                      </p>
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
                  Stavke
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workOrder.items && workOrder.items.length > 0 ? (
                  <div className="space-y-3">
                    {workOrder.items.map((item: any) => (
                      <div key={item.id} className="border-b pb-3 last:border-b-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{item.label}</p>
                            <p className="text-sm text-muted-foreground">{item.details}</p>
                            {item.note && <p className="text-xs text-muted-foreground mt-1">Napomena: {item.note}</p>}
                          </div>
                          <div className="text-right">
                            {item.total !== undefined && item.total > 0 && (
                              <p className="text-sm font-medium text-primary">
                                {item.total.toFixed(2)} {item.unit}
                              </p>
                            )}
                            {item.status && (
                              <Badge variant={item.status === 'open' ? 'default' : 'secondary'} className="mt-1">
                                {item.status === 'open' ? 'Otvoren' : 'Zatvoren'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Nema stavki</p>
                )}
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
