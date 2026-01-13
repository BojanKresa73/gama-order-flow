import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Printer, Info, Download, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Helper function to format date as dd.MM.yyyy.
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}.`;
};

const OrderDeliveryNote = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [fileEntries, setFileEntries] = useState<any[]>([]);
  const [deliveryNote, setDeliveryNote] = useState<any>(null);

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

      // Fetch items based on order kind
      const orderKind = orderData.kind?.toUpperCase() || 'CTP';
      let items: any[] = [];

      if (orderKind === 'FILMOVANJE') {
        // Fetch film jobs
        const { data: filmJobs, error: filmError } = await supabase
          .from("film_jobs")
          .select("*")
          .eq("work_order_id", orderId);

        if (filmError) throw filmError;
        items = (filmJobs || []).map(job => {
          const totalM = Number(job.computed_total_m ?? 0);
          return {
            id: job.id,
            filename: job.file_name,
            quantity: job.qty,
            format: `${job.width_mm}x${job.height_mm} mm`,
            details: totalM > 0 ? `${totalM.toFixed(2)} m` : '-',
          };
        });
      } else if (orderKind === 'DIGITALA') {
        // Fetch digital jobs
        const { data: digitalJobs, error: digitalError } = await supabase
          .from("digital_jobs")
          .select("*")
          .eq("work_order_id", orderId);

        if (digitalError) throw digitalError;

        // Check if work order has job_name (product mode vs sheet mode)
        const hasJobName = orderData.job_name && orderData.job_name.trim().length > 0;

        if (hasJobName) {
          // Product mode: show single item with job name and run_quantity
          items = [{
            id: orderData.id,
            filename: orderData.job_name,
            quantity: orderData.run_quantity || 1,
            format: '-',
            details: 'Proizvod'
          }];
        } else {
          // Sheet mode: show individual files with format and print type
          items = (digitalJobs || []).map(job => ({
            id: job.id,
            filename: job.file_name || job.name,
            quantity: `${(job.obim || 1) * (job.qty || 1)} tab.`,
            format: job.machine_sheet_format || '-',
            details: job.print_sides || '-'
          }));
        }
      } else if (orderKind === 'CTP') {
        // CTP orders: use file entries
        const { data: filesData, error: filesError } = await supabase
          .from("file_entries")
          .select(`
            *,
            plate_format:plate_formats (
              format_name
            )
          `)
          .eq("work_order_id", orderId)
          .eq("status", "closed");

        if (filesError) throw filesError;
        items = (filesData || []).map(entry => ({
          id: entry.id,
          filename: entry.filename,
          quantity: entry.quantity || 1,
          format: entry.plate_format?.format_name || '-',
          details: 'CTP'
        }));
      } else {
        // RAZNO orders: use job_name and run_quantity from work order
        items = [{
          id: orderData.id,
          filename: orderData.job_name || 'Usluga',
          quantity: orderData.run_quantity || 1,
          format: '-',
          details: 'Ostalo'
        }];
      }

      setFileEntries(items);

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

  const handlePrint = () => {
    window.print();
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
      const { data, error } = await supabase.storage
        .from("delivery-notes")
        .download(deliveryNote.pdf_path.replace("delivery-notes/", ""));

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
    if (!deliveryNote?.pdf_path) {
      toast({
        title: "Greška",
        description: "PDF još nije generisan",
        variant: "destructive",
      });
      return;
    }

    const { data } = supabase.storage
      .from("delivery-notes")
      .getPublicUrl(deliveryNote.pdf_path.replace("delivery-notes/", ""));

    window.open(data.publicUrl, "_blank");
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card print:hidden">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/work-orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          <h1 className="text-2xl font-bold">Otpremnica - {workOrder.order_number}</h1>
          </div>
          <div className="flex gap-2">
            {deliveryNote?.pdf_path && (
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
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Info bar */}
        <Alert className="mb-6 print:hidden">
          <Info className="h-4 w-4" />
          <AlertDescription>
            {workOrder.status === "open" ? (
              <span>
                <strong>Nalog nije zatvoren</strong> — otpremnica će se automatski poslati klijentu pri zatvaranju.
              </span>
            ) : (
              <span>
                <strong>Otpremnica je automatski poslata pri zatvaranju.</strong> Ovde je pregled.
              </span>
            )}
          </AlertDescription>
        </Alert>

        {/* Delivery note template */}
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
              <p><strong>Broj naloga:</strong> {workOrder.order_number}</p>
              <p><strong>Datum zatvaranja:</strong> {workOrder.closed_at ? formatDate(workOrder.closed_at) : "-"}</p>
            </div>
          </div>

          <div className="client-box">
            <p><strong>Klijent:</strong> {workOrder.clients?.name}</p>
            {workOrder.clients?.pib && workOrder.clients.pib.trim() && (
              <p><strong>PIB:</strong> {workOrder.clients.pib}</p>
            )}
            {workOrder.clients?.notification_email && workOrder.clients.notification_email.trim() && (
              <p><strong>Email:</strong> {workOrder.clients.notification_email}</p>
            )}
          </div>

          {fileEntries && fileEntries.length > 0 ? (
            <table className="items-table">
              <thead>
                <tr>
                  <th className="number">#</th>
                  <th>Naziv</th>
                  <th className="format">Format / Detalji</th>
                  <th className="quantity">Količina</th>
                </tr>
              </thead>
              <tbody>
                {fileEntries.map((entry, index) => (
                  <tr key={entry.id}>
                    <td className="number">{index + 1}</td>
                    <td>{entry.filename}</td>
                    <td className="format">{entry.format || entry.details || "-"}</td>
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
      </main>
    </div>
  );
};

export default OrderDeliveryNote;
