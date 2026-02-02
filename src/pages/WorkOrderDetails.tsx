import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Mail, Download, Receipt, ReceiptText, FileCode } from "lucide-react";
import { generateMinimaxOrderXml } from "@/lib/minimaxXmlExport";
import { fetchNbsEurRate } from "@/lib/nbsExchangeRate";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkOrderChecklistTab } from "@/components/work-orders/WorkOrderChecklistTab";
import { InvoiceDialog } from "@/components/work-orders/InvoiceDialog";
import { getOrderItems } from "@/lib/orderItems";
import { displayOrderNumber } from "@/lib/orderLabel";
import { DigitalPricingBreakdown } from "@/components/digital/DigitalPricingBreakdown";
import { useAuthz } from "@/hooks/useAuthz";
import type { LocalDigitalJob } from "@/components/digital/LocalDigitalJobsTable";
const WorkOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSuper, isAdmin, isAdminPlus } = useAuthz();
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [digitalJobs, setDigitalJobs] = useState<LocalDigitalJob[]>([]);
  const [fileEntries, setFileEntries] = useState<any[]>([]);
  const [clientPlatePrices, setClientPlatePrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState<any>(null);
  const [resending, setResending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [markingInvoiced, setMarkingInvoiced] = useState(false);
  const [exportingMinimax, setExportingMinimax] = useState(false);
  
  const canSeeDigitalSummary = isSuper || isAdmin || isAdminPlus;

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
          clients (name, email, pib, adresa, rabat_procenat),
          profiles (full_name)
        `)
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (error) throw error;
      
      // Use unified helper to fetch items
      const items = await getOrderItems(id!);
      
      setWorkOrder({ ...data, items });

      // Fetch digital jobs for summary if it's a digital order
      if (data.order_type === 'digital') {
        const { data: digitalJobsData, error: digitalError } = await supabase
          .from('digital_jobs')
          .select('*')
          .eq('work_order_id', id)
          .order('order_index');
        
        if (!digitalError && digitalJobsData) {
          setDigitalJobs(digitalJobsData as LocalDigitalJob[]);
        }
      }

      // Fetch file_entries with plate format for CTP orders (for Minimax export)
      if (data.order_type === 'ctp') {
        const { data: fileEntriesData } = await supabase
          .from('file_entries')
          .select('*, plate_formats(format_name)')
          .eq('work_order_id', id)
          .order('created_at');
        
        if (fileEntriesData) {
          // Flatten plate_formats join
          const entries = fileEntriesData.map(fe => ({
            ...fe,
            format_name: fe.plate_formats?.format_name
          }));
          setFileEntries(entries);
        }

        // Fetch client plate prices for Minimax export (now in EUR)
        const { data: pricesData } = await supabase
          .from('client_plate_prices')
          .select('*, plate_formats(format_name)')
          .eq('client_id', data.client_id);
        
        if (pricesData) {
          const prices = pricesData.map(p => ({
            plate_format_id: p.plate_format_id,
            format_name: p.plate_formats?.format_name,
            price_eur: Number(p.price_eur)
          }));
          setClientPlatePrices(prices);
        }
      }

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

  const handleDownloadPDF = async () => {
    if (!workOrder) {
      toast.error("Nalog nije pronađen");
      return;
    }

    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Niste prijavljeni");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/print-work-order/${id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Greška pri generisanju PDF-a');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RadniNalog_${workOrder.display_order_number || workOrder.order_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("PDF preuzet");
    } catch (error: any) {
      console.error('PDF download error:', error);
      toast.error("Greška: " + error.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleMarkInvoiced = async (invoiceNumber: string) => {
    setMarkingInvoiced(true);
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({
          invoiced_at: new Date().toISOString(),
          invoice_number: invoiceNumber || null,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Nalog označen kao fakturisan");
      setInvoiceDialogOpen(false);
      fetchWorkOrder();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    } finally {
      setMarkingInvoiced(false);
    }
  };

  const handleRemoveInvoiced = async () => {
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({
          invoiced_at: null,
          invoice_number: null,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Status fakturisanja uklonjen");
      fetchWorkOrder();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    }
  };

  const handleMinimaxExport = async () => {
    if (!workOrder) return;
    
    setExportingMinimax(true);
    try {
      // Fetch current NBS EUR rate
      const nbsRate = await fetchNbsEurRate();
      
      // Generate XML with the rate
      const xml = generateMinimaxOrderXml({
        ...workOrder,
        clients: workOrder.clients,
        file_entries: fileEntries,
        client_plate_prices: clientPlatePrices,
        nbs_rate: nbsRate
      });

       // Guard: Minimax rejects NarociloVrstica if it contains <Popust>
       if (xml.includes("<Popust>") || xml.includes("</Popust>")) {
         console.error("Minimax XML still contains <Popust> tag. Aborting export.");
         toast.error("XML i dalje sadrži <Popust> (osvežite stranicu pa pokušajte ponovo).");
         return;
       }
      
      // Download the file
      const orderNumber = workOrder.display_order_number || workOrder.order_number || workOrder.id;
      const fileName = `Minimax_${orderNumber.replace(/[^A-Za-z0-9_-]/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.xml`;
      
      const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Minimax XML eksportovan (kurs: ${nbsRate.toFixed(4)} RSD/EUR)`);
    } catch (error: any) {
      toast.error("Greška pri eksportu: " + error.message);
    } finally {
      setExportingMinimax(false);
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
            <Button variant="ghost" onClick={() => navigate(-1)}>
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
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Nalog {displayOrderNumber(workOrder)}</h1>
              <p className="text-sm text-muted-foreground">
                {workOrder.clients?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(workOrder.status)}
            <Badge variant="outline">{getOrderTypeLabel(workOrder.order_type)}</Badge>
            {workOrder.status === "open" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/work-orders/${id}/edit`)}
              >
                Izmeni
              </Button>
            )}
            {workOrder.status === "closed" && (
              <>
                {!workOrder.invoiced_at ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInvoiceDialogOpen(true)}
                    className="border-green-500 text-green-600 hover:bg-green-50"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Fakturiši
                  </Button>
                ) : (
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 gap-1">
                    <ReceiptText className="h-3 w-3" />
                    Fakturisano {workOrder.invoice_number ? `(${workOrder.invoice_number})` : ""}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloading ? "Preuzima se..." : "Preuzmi PDF"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendEmail}
                  disabled={resending}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {resending ? "Šalje se..." : "Ponovo pošalji"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMinimaxExport}
                  disabled={exportingMinimax}
                  title="Eksportuj za Minimax (konverzija EUR → RSD po kursu NBS)"
                >
                  <FileCode className="h-4 w-4 mr-2" />
                  {exportingMinimax ? "Eksportujem..." : "Minimax XML"}
                </Button>
              </>
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
            <div className="space-y-6">
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
                    {workOrder.invoiced_at && (
                      <div>
                        <p className="text-sm text-muted-foreground">Fakturisano</p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-green-600">
                            {format(new Date(workOrder.invoiced_at), "dd.MM.yyyy")}
                            {workOrder.invoice_number && ` - ${workOrder.invoice_number}`}
                          </p>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                            onClick={handleRemoveInvoiced}
                          >
                            Poništi
                          </Button>
                        </div>
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

              {/* Digital Pricing Breakdown - for superuser, admin, admin_plus */}
              {workOrder.order_type === 'digital' && digitalJobs.length > 0 && canSeeDigitalSummary && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Kalkulacija digitale</h3>
                  <DigitalPricingBreakdown 
                    jobs={digitalJobs} 
                    clientRabatProcenat={workOrder.clients?.rabat_procenat || 0}
                    prepHours={workOrder.prep_hours || 0}
                  />
                </div>
              )}

              {/* Items Summary */}
              {workOrder.items && workOrder.items.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Stavke ({workOrder.items.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {workOrder.items.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-b-0">
                          <div className="flex-1">
                            <p className="font-medium">{item.label}</p>
                            {item.details && (
                              <p className="text-sm text-muted-foreground">{item.details}</p>
                            )}
                            {item.note && (
                              <p className="text-xs text-muted-foreground mt-1">Napomena: {item.note}</p>
                            )}
                          </div>
                          <div className="text-right flex items-center gap-3">
                            {item.total !== undefined && item.total > 0 && (
                              <p className="text-sm font-medium text-primary">
                                {item.total.toFixed(2)} {item.unit}
                              </p>
                            )}
                            {item.status && (
                              <Badge variant={item.status === 'open' ? 'default' : 'secondary'}>
                                {item.status === 'open' ? 'Otvoren' : 'Zatvoren'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
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

      <InvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        onConfirm={handleMarkInvoiced}
        isLoading={markingInvoiced}
      />
    </div>
  );
};

export default WorkOrderDetails;
