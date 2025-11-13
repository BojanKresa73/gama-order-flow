import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Helper function to format date as dd.MM.yyyy.
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}.`;
};

const DeliveryNotePreview = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [fileEntries, setFileEntries] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
    fetchWorkOrders();
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      fetchOrderDetails();
    }
  }, [selectedOrderId]);

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
          id,
          order_number,
          created_at,
          closed_at,
          status,
          clients (
            id,
            name,
            pib,
            notification_email
          )
        `)
        .eq("status", "closed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
      
      // Auto-select first order
      if (data && data.length > 0) {
        setSelectedOrderId(data[0].id);
      }
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

  const fetchOrderDetails = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from("work_orders")
        .select(`
          *,
          clients (
            id,
            name,
            pib,
            notification_email
          )
        `)
        .eq("id", selectedOrderId)
        .single();

      if (orderError) throw orderError;
      setSelectedOrder(orderData);

      const { data: filesData, error: filesError } = await supabase
        .from("file_entries")
        .select(`
          *,
          plate_format:plate_formats (
            format_name
          )
        `)
        .eq("work_order_id", selectedOrderId)
        .eq("status", "closed");

      if (filesError) throw filesError;
      setFileEntries(filesData || []);
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Učitavanje...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card print:hidden">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dev/preview")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Preview Otpremnice (A5)</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6 print:hidden">
          <CardHeader>
            <CardTitle>Izaberi radni nalog</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Radni nalog (samo zatvoreni)</label>
                <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberi nalog..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.order_number} - {order.clients?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handlePrint} disabled={!selectedOrder}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </CardContent>
        </Card>

        {selectedOrder && (
          <div className="delivery-note-container">
            <style>{`
              @page {
                size: A5 landscape;
                margin: 10mm;
              }
              
              @media print {
                body {
                  margin: 0;
                  padding: 0;
                }
                
                .delivery-note-container {
                  width: 100%;
                  height: 100%;
                }
                
                .doc-footer {
                  position: fixed;
                  bottom: 0;
                  width: 100%;
                }
              }
              
              .delivery-note-container {
                font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 11px;
                line-height: 1.4;
                color: #000;
                background: white;
                padding: 20px;
                max-width: 210mm;
                margin: 0 auto;
              }
              
              .doc-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 2px solid #000;
              }
              
              .company-info {
                flex: 1;
              }
              
              .company-info h1 {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 4px;
              }
              
              .company-info p {
                font-size: 10px;
                line-height: 1.3;
                margin: 0;
              }
              
              .delivery-info {
                text-align: right;
                flex: 1;
              }
              
              .delivery-info h2 {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 6px;
              }
              
              .delivery-info p {
                font-size: 11px;
                margin-bottom: 2px;
              }
              
              .client-box {
                border: 1px solid #000;
                padding: 8px;
                margin-bottom: 12px;
                background: #f9f9f9;
              }
              
              .client-box p {
                margin-bottom: 3px;
              }
              
              .client-box strong {
                font-weight: 600;
              }
              
              .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
              }
              
              .items-table th,
              .items-table td {
                border: 1px solid #ddd;
                padding: 6px 8px;
                text-align: left;
              }
              
              .items-table th {
                background: #e8e8e8;
                font-weight: 600;
                font-size: 10px;
                text-transform: uppercase;
              }
              
              .items-table td {
                font-size: 11px;
              }
              
              .items-table td.number {
                text-align: center;
                width: 40px;
              }
              
              .items-table td.quantity {
                text-align: center;
                width: 80px;
              }
              
              .items-table td.format {
                width: 120px;
              }
              
              .items-table thead {
                display: table-header-group;
              }
              
              .items-table tfoot {
                display: table-footer-group;
              }
              
              .items-table tr {
                page-break-inside: avoid;
              }
              
              .doc-footer {
                margin-top: 20px;
                padding-top: 12px;
                border-top: 1px solid #ddd;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              
              .signature-line {
                font-size: 10px;
              }
              
              .signature-line span {
                display: inline-block;
                margin-right: 15px;
              }
              
              .signature-line .underline {
                border-bottom: 1px solid #000;
                display: inline-block;
                width: 150px;
                margin-left: 5px;
              }
              
              .pagination {
                font-size: 10px;
                text-align: right;
              }
              
              .no-items {
                text-align: center;
                padding: 40px;
                font-style: italic;
                color: #666;
              }
            `}</style>

            <div className="doc-header">
              <div className="company-info">
                <h1>Gama United</h1>
                <p>Adresa vaše firme</p>
                <p>Grad, Poštanski broj</p>
                <p>PIB: 123456789</p>
              </div>
              <div className="delivery-info">
                <h2>OTPREMNICA</h2>
                <p><strong>Broj naloga:</strong> {selectedOrder.order_number}</p>
                <p><strong>Datum zatvaranja:</strong> {selectedOrder.closed_at ? formatDate(selectedOrder.closed_at) : "-"}</p>
              </div>
            </div>

            <div className="client-box">
              <p><strong>Klijent:</strong> {selectedOrder.clients?.name}</p>
              {selectedOrder.clients?.pib && <p><strong>PIB:</strong> {selectedOrder.clients.pib}</p>}
              {selectedOrder.clients?.notification_email && (
                <p><strong>Email:</strong> {selectedOrder.clients.notification_email}</p>
              )}
            </div>

            {fileEntries && fileEntries.length > 0 ? (
              <table className="items-table">
                <thead>
                  <tr>
                    <th className="number">#</th>
                    <th>Naziv fajla</th>
                    <th className="format">Format ploče</th>
                    <th className="quantity">Količina</th>
                  </tr>
                </thead>
                <tbody>
                  {fileEntries.map((entry, index) => (
                    <tr key={entry.id}>
                      <td className="number">{index + 1}</td>
                      <td>{entry.filename}</td>
                      <td className="format">{entry.plate_format?.format_name || "-"}</td>
                      <td className="quantity">{entry.quantity || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-items">
                <p>Nema zatvorenih stavki za otpremnicu.</p>
              </div>
            )}

            <div className="doc-footer">
              <div className="signature-line">
                <span>Robu preuzeo: <span className="underline"></span></span>
                <span>Broj lične karte: <span className="underline"></span></span>
              </div>
              <div className="pagination">
                Strana 1/1
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DeliveryNotePreview;
