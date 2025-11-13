import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, FileText, Eye, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OrderFilesDialog } from "@/components/work-orders/OrderFilesDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const WorkOrders = () => {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [orderToClose, setOrderToClose] = useState<any>(null);
  const [closingNote, setClosingNote] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchWorkOrders();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
    }
  };

  const fetchWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          *,
          clients (name),
          profiles (full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
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

  const handleSendDeliveryNote = async (workOrderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/work-orders/${workOrderId}/delivery-note`);
  };

  const handleShowFiles = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrderId(orderId);
    setFilesDialogOpen(true);
  };

  const handleCloseOrder = (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setOrderToClose(order);
    setClosingNote("");
    setCloseDialogOpen(true);
  };

  const confirmCloseOrder = async () => {
    if (!orderToClose) return;

    setIsClosing(true);
    try {
      const { data, error } = await supabase.functions.invoke('close-work-order', {
        body: {
          work_order_id: orderToClose.id,
          note: closingNote.trim() || undefined
        }
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result?.success) {
        throw new Error(result?.error || "Greška pri zatvaranju naloga");
      }

      toast({
        title: "Uspeh",
        description: result.message || "Radni nalog je zatvoren i otpremnica je poslata.",
      });

      setCloseDialogOpen(false);
      setOrderToClose(null);
      setClosingNote("");
      fetchWorkOrders();
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsClosing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Učitavanje...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Radni nalozi</h1>
          </div>
          <Button onClick={() => navigate("/work-orders/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Novi nalog
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Svi radni nalozi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nema radnih naloga. Kreirajte prvi nalog.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Broj naloga</TableHead>
                    <TableHead>Klijent</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Kreirao</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                    <TableHead className="text-center">Zatvori</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/work-orders/${order.id}`)}
                    >
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.clients?.name}</TableCell>
                      <TableCell>{getOrderTypeLabel(order.order_type)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{order.profiles?.full_name}</TableCell>
                      <TableCell>{new Date(order.created_at).toLocaleDateString('sr-RS')}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleShowFiles(order.id, e)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Prikaz
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleSendDeliveryNote(order.id, e)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Otpremnica
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-block">
                                <Button
                                  variant="default"
                                  size="sm"
                                  disabled={order.status === 'closed'}
                                  onClick={(e) => handleCloseOrder(order, e)}
                                >
                                  {order.status === 'closed' && <Lock className="h-4 w-4 mr-2" />}
                                  Zatvori
                                </Button>
                              </div>
                            </TooltipTrigger>
                            {order.status === 'closed' && (
                              <TooltipContent>
                                <p>Nalog je već zatvoren</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <OrderFilesDialog
        orderId={selectedOrderId}
        open={filesDialogOpen}
        onOpenChange={setFilesDialogOpen}
      />

      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Zatvori radni nalog {orderToClose?.order_number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Po zatvaranju biće generisana i automatski poslata otpremnica klijentu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="closing-note">Napomena za zatvaranje (opciono)</Label>
            <Textarea
              id="closing-note"
              placeholder="Dodajte napomenu..."
              value={closingNote}
              onChange={(e) => setClosingNote(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClosing}>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCloseOrder} disabled={isClosing}>
              {isClosing ? "Zatvaranje..." : "Zatvori nalog"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkOrders;