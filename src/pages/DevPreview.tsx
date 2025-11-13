import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, FileText, Users, Package, CheckSquare, Eye, AlertTriangle, Mail } from "lucide-react";
import { OrderFilesDialog } from "@/components/work-orders/OrderFilesDialog";
import { useToast } from "@/hooks/use-toast";

const DevPreview = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  // Data states
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [plateFormats, setPlateFormats] = useState<any[]>([]);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);

  // Dialog states
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [filesDialogStatus, setFilesDialogStatus] = useState<"open" | "closed">("open");
  const [deliveryPreviewOpen, setDeliveryPreviewOpen] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchAllData();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
    }
  };

  const fetchAllData = async () => {
    try {
      // Fetch work orders
      const { data: ordersData } = await supabase
        .from("work_orders")
        .select("*, clients(name)")
        .order("created_at", { ascending: false })
        .limit(5);
      setWorkOrders(ordersData || []);

      // Fetch clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select("*")
        .order("name", { ascending: true })
        .limit(5);
      setClients(clientsData || []);

      // Fetch plate formats
      const { data: formatsData } = await supabase
        .from("plate_formats")
        .select("*")
        .order("format_name", { ascending: true })
        .limit(5);
      setPlateFormats(formatsData || []);

      // Fetch checklist items
      const { data: checklistData } = await supabase
        .from("work_order_checklist_items")
        .select(`
          *,
          work_order_checklists!inner(
            work_orders(order_number, clients(name))
          )
        `)
        .eq("status", "Pending")
        .order("created_at", { ascending: false })
        .limit(5);
      setChecklistItems(checklistData || []);
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

  const handleShowFiles = (orderId: string, status: "open" | "closed") => {
    setSelectedOrderId(orderId);
    setFilesDialogStatus(status);
    setFilesDialogOpen(true);
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

  const isLowStock = (format: any) => {
    return format.current_stock <= format.low_stock_threshold;
  };

  const deliveryNotePreviewHTML = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; }
          .container { max-width: 210mm; margin: 0 auto; }
          .header { background-color: #f4f4f4; padding: 20px; text-align: center; margin-bottom: 20px; }
          .content { padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f4f4f4; font-weight: bold; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Otpremnica - OTR-2025-0001</h2>
          </div>
          <div class="content">
            <p><strong>Klijent:</strong> Primer Klijent D.O.O.</p>
            <p><strong>Radni nalog:</strong> WO-2025-0001</p>
            <p><strong>Datum otvaranja:</strong> 12.11.2025</p>
            <p><strong>Datum zatvaranja:</strong> 12.11.2025</p>
            
            <h3>Stavke:</h3>
            <table>
              <thead>
                <tr>
                  <th>Naziv fajla</th>
                  <th>Količina</th>
                  <th>Tip</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>dokument_001.pdf</td>
                  <td>5</td>
                  <td>PDF</td>
                </tr>
                <tr>
                  <td>dizajn_002.ai</td>
                  <td>3</td>
                  <td>AI</td>
                </tr>
                <tr>
                  <td>slika_003.jpg</td>
                  <td>10</td>
                  <td>JPG</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="footer">
            <p>Ova poruka je automatski generisana iz sistema za upravljanje radnim nalozima.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Učitavanje...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Dev Preview / Showroom</h1>
          <Badge variant="outline" className="ml-auto">VITE_SHOW_DEV_PREVIEW=true</Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* 1. Work Orders Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                1. Work Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Broj naloga</TableHead>
                    <TableHead>Klijent</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.clients?.name}</TableCell>
                      <TableCell>{getOrderTypeLabel(order.order_type)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowFiles(order.id, "open")}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Prikaz
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowFiles(order.id, "closed")}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Prikaz zatvorenih
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 2. Clients Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                2. Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naziv</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Email za obaveštenja</TableHead>
                    <TableHead>Datum kreiranja</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        {client.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {client.email}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {client.notification_email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {client.notification_email}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{new Date(client.created_at).toLocaleDateString('sr-RS')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 3. Inventory Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                3. Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Format</TableHead>
                    <TableHead>Trenutno stanje</TableHead>
                    <TableHead>Minimalno stanje</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plateFormats.map((format) => (
                    <TableRow key={format.id}>
                      <TableCell className="font-medium">{format.format_name}</TableCell>
                      <TableCell>{format.current_stock}</TableCell>
                      <TableCell>{format.low_stock_threshold}</TableCell>
                      <TableCell>
                        {isLowStock(format) ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" />
                            Niska zaliha
                          </Badge>
                        ) : (
                          <Badge variant="default">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 4. Checklist Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                4. Checklist - Aktivne stavke
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naslov</TableHead>
                    <TableHead>Radni nalog</TableHead>
                    <TableHead>Klijent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Kreiran</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklistItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>
                        {item.work_order_checklists?.work_orders?.order_number || "-"}
                      </TableCell>
                      <TableCell>
                        {item.work_order_checklists?.work_orders?.clients?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(item.created_at).toLocaleDateString('sr-RS')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 5. Delivery Note Preview Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                5. Preview otpremnice (A5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                HTML preview šablona iz edge funkcije <code className="bg-muted px-2 py-1 rounded">send-delivery-note</code> (bez realnog slanja).
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setDeliveryPreviewOpen(true)} variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  Otvori Modal Preview
                </Button>
                <Button onClick={() => navigate("/dev/preview/delivery-note")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Preview Otpremnice (A5)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* File Entries Dialog */}
      <OrderFilesDialog
        orderId={selectedOrderId}
        status={filesDialogStatus}
        open={filesDialogOpen}
        onOpenChange={setFilesDialogOpen}
      />

      {/* Delivery Note Preview Dialog */}
      <Dialog open={deliveryPreviewOpen} onOpenChange={setDeliveryPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Otpremnice (A5 format)</DialogTitle>
          </DialogHeader>
          <div 
            className="border rounded-lg p-4 bg-white"
            dangerouslySetInnerHTML={{ __html: deliveryNotePreviewHTML }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DevPreview;
