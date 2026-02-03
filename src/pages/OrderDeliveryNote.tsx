import { useEffect, useState } from "react";
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
  const [deliveryNote, setDeliveryNote] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

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

      // Fetch delivery note if exists
      const { data: deliveryNoteData, error: dnError } = await supabase
        .from("delivery_notes")
        .select("*")
        .eq("work_order_id", orderId)
        .maybeSingle();

      if (dnError) {
        console.error("Error fetching delivery note:", dnError);
      } else {
        setDeliveryNote(deliveryNoteData);
        
        // If PDF exists, get public URL for iframe
        if (deliveryNoteData?.pdf_path) {
          const pdfPath = deliveryNoteData.pdf_path.replace("delivery-notes/", "");
          const { data } = supabase.storage
            .from("delivery-notes")
            .getPublicUrl(pdfPath);
          setPdfUrl(data.publicUrl);
        }
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

  const handleGeneratePDF = async () => {
    if (!orderId) return;
    
    setPdfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-delivery-note-pdf', {
        body: { work_order_id: orderId }
      });

      if (error) throw error;
      
      if (data?.pdf_path) {
        // Refresh delivery note data
        const { data: dnData } = await supabase
          .from("delivery_notes")
          .select("*")
          .eq("work_order_id", orderId)
          .maybeSingle();
        
        if (dnData) {
          setDeliveryNote(dnData);
          const pdfPath = dnData.pdf_path.replace("delivery-notes/", "");
          const { data: urlData } = supabase.storage
            .from("delivery-notes")
            .getPublicUrl(pdfPath);
          setPdfUrl(urlData.publicUrl);
        }
        
        toast({
          title: "Uspešno",
          description: "PDF je generisan",
        });
      }
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!deliveryNote?.pdf_path) {
      toast({
        title: "Greška",
        description: "PDF još nije generisan",
        variant: "destructive",
      });
      return;
    }

    try {
      const pdfPath = deliveryNote.pdf_path.replace("delivery-notes/", "");
      const { data, error } = await supabase.storage
        .from("delivery-notes")
        .download(pdfPath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${workOrder.order_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleOpenPDF = () => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
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
            {!pdfUrl && (
              <Button onClick={handleGeneratePDF} disabled={pdfLoading}>
                {pdfLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generiše se...
                  </>
                ) : (
                  "Generiši PDF"
                )}
              </Button>
            )}
            {pdfUrl && (
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
          {pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              className="w-full h-full min-h-[600px]"
              title="Otpremnica PDF"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[600px] text-muted-foreground">
              <p className="text-lg mb-4">PDF još nije generisan</p>
              <Button onClick={handleGeneratePDF} disabled={pdfLoading}>
                {pdfLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generiše se...
                  </>
                ) : (
                  "Generiši PDF"
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default OrderDeliveryNote;
