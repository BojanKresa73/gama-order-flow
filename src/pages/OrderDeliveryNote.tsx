import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Info, Download, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OrderDeliveryNote = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const fetchPDF = useCallback(async () => {
    if (!orderId) return;
    
    setPdfLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Niste prijavljeni");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-delivery-note-pdf?work_order_id=${orderId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Greška pri generisanju PDF-a');
      }

      const blob = await response.blob();
      setPdfBlob(blob);
      
      // Convert blob to base64 data URL for iframe display
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setPdfDataUrl(base64data);
      };
      reader.readAsDataURL(blob);
    } catch (error: any) {
      console.error("PDF fetch error:", error);
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPdfLoading(false);
    }
  }, [orderId, toast]);

  useEffect(() => {
    checkAuth();
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
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
        .eq("id", orderId)
        .is("deleted_at", null)
        .single();

      if (orderError) throw orderError;
      setWorkOrder(orderData);
      
      // Auto-fetch PDF after loading order details
      if (orderData) {
        setTimeout(() => fetchPDF(), 100);
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

  const handleDownloadPDF = () => {
    if (!pdfBlob) {
      toast({
        title: "Greška",
        description: "PDF još nije učitan",
        variant: "destructive",
      });
      return;
    }

    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Otpremnica-${workOrder?.order_number || orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenPDF = () => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, "_blank");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Učitavanje...</div>;
  }

  if (!workOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Nalog nije pronađen</p>
        <Button onClick={() => navigate("/work-orders")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Nazad
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/work-orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Otpremnica - {workOrder.order_number}</h1>
          </div>
          <div className="flex gap-2">
            {pdfDataUrl && (
              <>
                <Button variant="outline" onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Preuzmi PDF
                </Button>
                <Button variant="outline" onClick={handleOpenPDF}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Otvori u novom tabu
                </Button>
              </>
            )}
            {!pdfDataUrl && !pdfLoading && (
              <Button onClick={fetchPDF}>
                Učitaj PDF
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col">
        {/* Info bar */}
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            {workOrder.status === "open" ? (
              <span>
                <strong>Nalog nije zatvoren</strong> — otpremnica će se automatski poslati klijentu pri zatvaranju.
              </span>
            ) : (
              <span>
                <strong>Ovo je isti PDF koji je poslat klijentu na email.</strong>
              </span>
            )}
          </AlertDescription>
        </Alert>

        {/* PDF Preview */}
        <div className="flex-1 bg-muted rounded-lg overflow-hidden min-h-[600px]">
          {pdfLoading ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[600px] text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p className="text-lg">Učitavanje PDF-a...</p>
            </div>
          ) : pdfDataUrl ? (
            <object
              data={pdfDataUrl}
              type="application/pdf"
              className="w-full h-full min-h-[600px]"
            >
              <div className="flex flex-col items-center justify-center h-full min-h-[600px] text-muted-foreground">
                <p className="text-lg mb-4">PDF se ne može prikazati u pregledaču</p>
                <div className="flex gap-2">
                  <Button onClick={handleDownloadPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Preuzmi PDF
                  </Button>
                  <Button variant="outline" onClick={handleOpenPDF}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Otvori u novom tabu
                  </Button>
                </div>
              </div>
            </object>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[600px] text-muted-foreground">
              <p className="text-lg mb-4">PDF nije učitan</p>
              <Button onClick={fetchPDF}>
                Učitaj PDF
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default OrderDeliveryNote;
