import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DeliveryNotePdfPreview = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchWorkOrders();
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      generatePdf();
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
          display_order_number,
          order_type,
          created_at,
          closed_at,
          status,
          clients (
            id,
            name
          )
        `)
        .eq("status", "closed")
        .is("deleted_at", null)
        .order("closed_at", { ascending: false })
        .limit(50);

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

  const generatePdf = async () => {
    if (!selectedOrderId) return;
    
    setPdfLoading(true);
    setPdfUrl(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Niste prijavljeni");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-delivery-note-pdf?work_order_id=${selectedOrderId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Greška: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast({
        title: "Greška pri generisanju PDF-a",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    
    const selectedOrder = workOrders.find(o => o.id === selectedOrderId);
    const filename = `Otpremnica-${selectedOrder?.display_order_number || selectedOrder?.order_number || 'unknown'}.pdf`;
    
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedOrder = workOrders.find(o => o.id === selectedOrderId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Preview PDF Otpremnice</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Izaberi radni nalog</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[300px]">
                <label className="text-sm font-medium mb-2 block">Radni nalog (zatvoreni, poslednjih 50)</label>
                <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberi nalog..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.display_order_number || order.order_number} - {order.clients?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleDownload} disabled={!pdfUrl || pdfLoading}>
                <Download className="h-4 w-4 mr-2" />
                Preuzmi PDF
              </Button>
            </div>
            
            {selectedOrder && (
              <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
                <span className="font-medium">Tip:</span> {selectedOrder.order_type} | 
                <span className="font-medium ml-2">Klijent:</span> {selectedOrder.clients?.name} | 
                <span className="font-medium ml-2">Zatvoreno:</span> {selectedOrder.closed_at ? new Date(selectedOrder.closed_at).toLocaleDateString('sr-Latn-RS') : '-'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {pdfLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Generisanje PDF-a...</p>
              </div>
            ) : pdfUrl ? (
              <iframe 
                src={pdfUrl} 
                className="w-full h-[800px] border-0 rounded-lg"
                title="PDF Preview"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FileText className="h-16 w-16 mb-4 opacity-50" />
                <p>Izaberite nalog za prikaz otpremnice</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DeliveryNotePdfPreview;
