import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, FileText, Eye, Lock, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OrderFilesDialog } from "@/components/work-orders/OrderFilesDialog";
import { InvalidateOrderDialog } from "@/components/work-orders/InvalidateOrderDialog";
import { DeleteOrderDialog } from "@/components/work-orders/DeleteOrderDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { prefixFor, displayOrderNumber } from "@/lib/orderLabel";
import { useAuthz } from "@/hooks/useAuthz";

const WorkOrders = () => {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [orderToClose, setOrderToClose] = useState<any>(null);
  const [closingNote, setClosingNote] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkCloseDialogOpen, setBulkCloseDialogOpen] = useState(false);
  const [bulkClosingProgress, setBulkClosingProgress] = useState(0);
  const [bulkClosingTotal, setBulkClosingTotal] = useState(0);
  const [bulkResults, setBulkResults] = useState<{ closed: number; alreadyClosed: number; errors: number } | null>(null);
  const [invalidateDialogOpen, setInvalidateDialogOpen] = useState(false);
  const [orderToInvalidate, setOrderToInvalidate] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuper, isAdmin } = useAuthz();

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
      const { data, error} = await supabase
        .from("work_orders")
        .select(`
          *,
          clients (name),
          profiles (full_name),
          email_job_latest_status (
            status,
            error_msg
          )
        `)
        .is("deleted_at", null)
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

  const getStatusBadge = (status: string, invalidatedAt?: string, deletedAt?: string) => {
    if (deletedAt) {
      return <Badge variant="destructive">Obrisan</Badge>;
    }
    if (invalidatedAt) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">Nevažeći</Badge>;
    }
    return status === "open" ? (
      <Badge variant="default">Otvoren</Badge>
    ) : (
      <Badge variant="secondary">Zatvoren</Badge>
    );
  };

  const getEmailStatusBadge = (emailStatus: any) => {
    if (!emailStatus) return null;
    
    if (emailStatus.status === "sent") {
      return <span title="Email poslat">📧 poslato</span>;
    } else if (emailStatus.status === "error") {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-destructive cursor-help">📧 greška</span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{emailStatus.error_msg || "Greška pri slanju"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return null;
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

  const validateOrderBeforeClose = async (order: any): Promise<{ valid: boolean; error?: string }> => {
    // Check if client exists
    if (!order.client_id) {
      return { valid: false, error: "Izaberi klijenta pre zatvaranja naloga." };
    }

    // For film orders, validate film jobs
    if (order.order_type === 'film') {
      const { data: filmJobs, error: filmError } = await supabase
        .from('film_jobs')
        .select('id, width_mm, height_mm, qty, computed_total_m, file_name')
        .eq('work_order_id', order.id);

      if (filmError) {
        return { valid: false, error: "Greška pri učitavanju stavki filmovanja." };
      }

      if (!filmJobs || filmJobs.length === 0) {
        return { valid: false, error: "Nalog mora da ima bar jednu stavku filmovanja." };
      }

      // Check each film job
      for (const job of filmJobs) {
        if (job.width_mm < 10) {
          return { valid: false, error: `Stavka "${job.file_name}" ima širinu manju od 10mm (${job.width_mm}mm).` };
        }
        if (job.height_mm < 10) {
          return { valid: false, error: `Stavka "${job.file_name}" ima visinu manju od 10mm (${job.height_mm}mm).` };
        }
        if (job.qty < 1) {
          return { valid: false, error: `Stavka "${job.file_name}" ima količinu manju od 1 (${job.qty}).` };
        }
        if (!job.computed_total_m || job.computed_total_m <= 0) {
          return { valid: false, error: `Stavka "${job.file_name}" nema izračunatu dužinu (m). Izračunaj pre zatvaranja.` };
        }
      }
    }

    // For digital orders, validate digital jobs
    if (order.order_type === 'digital') {
      const { data: digitalJobs, error: digitalError } = await supabase
        .from('digital_jobs')
        .select('id, file_name, computed_total_sheets')
        .eq('work_order_id', order.id);

      if (digitalError) {
        return { valid: false, error: "Greška pri učitavanju digitalnih stavki." };
      }

      if (!digitalJobs || digitalJobs.length === 0) {
        return { valid: false, error: "Nalog mora da ima bar jednu digitalnu stavku." };
      }

      // Check each digital job
      for (const job of digitalJobs) {
        if (!job.computed_total_sheets || job.computed_total_sheets <= 0) {
          return { valid: false, error: `Stavka "${job.file_name}" nema izračunat broj tabaka. Popuni sve podatke.` };
        }
      }
    }

    // For CTP orders, check file entries
    if (order.order_type === 'ctp') {
      const { data: fileEntries, error: fileError } = await supabase
        .from('file_entries')
        .select('id')
        .eq('work_order_id', order.id);

      if (fileError) {
        return { valid: false, error: "Greška pri učitavanju fajlova." };
      }

      if (!fileEntries || fileEntries.length === 0) {
        return { valid: false, error: "Nalog mora da ima bar jedan fajl." };
      }
    }

    return { valid: true };
  };

  const handleCloseOrder = async (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.status === 'closed') return;
    if (order.invalidated_at) {
      toast({
        title: "Zabranjena akcija",
        description: "Ne može se zatvoriti nalog koji je proglašen nevažećim.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate order before opening dialog
    const validation = await validateOrderBeforeClose(order);
    if (!validation.valid) {
      toast({
        title: "Validaciona greška",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }
    
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

      const result = data as { 
        ok?: boolean;
        success?: boolean; 
        error?: string;
        code?: string;
        message?: string;
        delivery_note_sent?: boolean;
      };
      
      // Handle both ok and success fields (backend uses ok)
      const isSuccess = result?.ok || result?.success;
      
      if (!isSuccess) {
        // Map error codes to Serbian messages
        const errorMessages: Record<string, string> = {
          'CLIENT_REQUIRED': 'Izaberi klijenta pre zatvaranja naloga.',
          'FILM_COMPUTE_MISSING': 'Neka stavka nema izračunatu dužinu (m).',
          'NO_ITEMS': 'Nalog mora da ima bar jednu stavku.',
          'INVALID_DIMENSIONS': 'Neka stavka ima neispravne dimenzije.',
          'PDF_GENERATION_FAILED': 'Greška pri generisanju PDF-a.',
          'EMAIL_SEND_FAILED': 'Greška pri slanju email-a.',
        };
        
        const errorMsg = result.code 
          ? errorMessages[result.code] || `Greška pri zatvaranju naloga (kod: ${result.code})`
          : result.error || "Greška pri zatvaranju naloga";
        
        throw new Error(errorMsg);
      }

      // Show appropriate toast based on delivery note status
      if (result.delivery_note_sent) {
        toast({
          title: "Uspeh",
          description: "Radni nalog je zatvoren i otpremnica je poslata.",
        });
      } else {
        toast({
          title: "Upozorenje",
          description: "Nalog zatvoren, ali slanje otpremnice nije uspelo – pokušajte ponovo iz pregleda otpremnice.",
          variant: "destructive",
        });
      }

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

  const toggleOrderSelection = (orderId: string, isOpen: boolean) => {
    if (!isOpen) return; // Only allow selecting open orders
    
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleAllOrders = () => {
    const openOrders = workOrders.filter(order => order.status === 'open');
    if (selectedOrders.size === openOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(openOrders.map(order => order.id)));
    }
  };

  const handleBulkClose = () => {
    if (selectedOrders.size === 0) return;
    setBulkResults(null);
    setBulkCloseDialogOpen(true);
  };

  const confirmBulkClose = async () => {
    const orderIds = Array.from(selectedOrders);
    setBulkClosingTotal(orderIds.length);
    setBulkClosingProgress(0);

    let closed = 0;
    let alreadyClosed = 0;
    let errors = 0;

    for (let i = 0; i < orderIds.length; i++) {
      try {
        const { data, error } = await supabase.functions.invoke('close-work-order', {
          body: {
            work_order_id: orderIds[i],
            note: closingNote.trim() || undefined
          }
        });

        if (error) throw error;

        const result = data as { success: boolean; error?: string };
        
        if (result?.success) {
          closed++;
        } else if (result?.error?.includes('već zatvoren')) {
          alreadyClosed++;
        } else {
          errors++;
        }
      } catch (error: any) {
        if (error.message?.includes('već zatvoren')) {
          alreadyClosed++;
        } else {
          errors++;
        }
      }

      setBulkClosingProgress(i + 1);
    }

    setBulkResults({ closed, alreadyClosed, errors });
    setSelectedOrders(new Set());
    setClosingNote("");
    fetchWorkOrders();
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/checklist")}>
              Checklist
            </Button>
            <Button onClick={() => navigate("/work-orders/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Novi nalog
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Svi radni nalozi
              </div>
              {selectedOrders.size > 0 && (
                <Button onClick={handleBulkClose} variant="default">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Zatvori odabrane ({selectedOrders.size})
                </Button>
              )}
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
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedOrders.size > 0 && selectedOrders.size === workOrders.filter(o => o.status === 'open').length}
                        onCheckedChange={toggleAllOrders}
                        disabled={workOrders.filter(o => o.status === 'open').length === 0}
                      />
                    </TableHead>
                    <TableHead>Broj naloga</TableHead>
                    <TableHead>Klijent</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email</TableHead>
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={() => toggleOrderSelection(order.id, order.status === 'open')}
                          disabled={order.status === 'closed'}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span>{displayOrderNumber(order)}</span>
                          {order.invalid_reason && (
                            <span className="text-xs text-orange-600">
                              Razlog: {order.invalid_reason}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{order.clients?.name}</TableCell>
                      <TableCell>{getOrderTypeLabel(order.order_type)}</TableCell>
                      <TableCell>{getStatusBadge(order.status, order.invalidated_at, order.deleted_at)}</TableCell>
                      <TableCell>
                        {getEmailStatusBadge(order.email_job_latest_status?.[0])}
                      </TableCell>
                      <TableCell>{order.profiles?.full_name}</TableCell>
                      <TableCell>{new Date(order.created_at).toLocaleDateString('sr-RS')}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/work-orders/${order.id}/print`, '_blank');
                            }}
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
                          {order.status === 'open' && !order.invalidated_at && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/work-orders/${order.id}/edit`);
                              }}
                            >
                              Izmeni
                            </Button>
                          )}
                          {(isAdmin || isSuper) && !order.invalidated_at && !order.deleted_at && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOrderToInvalidate(order);
                                setInvalidateDialogOpen(true);
                              }}
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Nevažeći
                            </Button>
                          )}
                          {isSuper && !order.deleted_at && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOrderToDelete(order);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Obriši
                            </Button>
                          )}
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
                                  disabled={order.status === 'closed' || order.invalidated_at}
                                  onClick={(e) => handleCloseOrder(order, e)}
                                >
                                  {order.status === 'closed' && <Lock className="h-4 w-4 mr-2" />}
                                  {order.invalidated_at && <AlertTriangle className="h-4 w-4 mr-2" />}
                                  Zatvori
                                </Button>
                              </div>
                            </TooltipTrigger>
                            {(order.status === 'closed' || order.invalidated_at) && (
                              <TooltipContent>
                                <p>{order.status === 'closed' ? 'Nalog je već zatvoren' : 'Nalog je nevažeći'}</p>
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

      <InvalidateOrderDialog
        open={invalidateDialogOpen}
        onOpenChange={setInvalidateDialogOpen}
        order={orderToInvalidate}
        onSuccess={fetchWorkOrders}
      />

      <DeleteOrderDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        order={orderToDelete}
        onSuccess={fetchWorkOrders}
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

      <AlertDialog open={bulkCloseDialogOpen} onOpenChange={setBulkCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Zatvori {selectedOrders.size} {selectedOrders.size === 1 ? 'nalog' : 'naloga'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Po zatvaranju biće generisane i automatski poslate otpremnice klijentima.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {bulkClosingTotal > 0 && !bulkResults && (
            <div className="space-y-2 py-4">
              <div className="flex justify-between text-sm">
                <span>Zatvaranje naloga...</span>
                <span>{bulkClosingProgress} / {bulkClosingTotal}</span>
              </div>
              <Progress value={(bulkClosingProgress / bulkClosingTotal) * 100} />
            </div>
          )}

          {bulkResults && (
            <div className="space-y-2 py-4">
              <div className="rounded-md bg-muted p-4 space-y-1">
                <p className="text-sm">
                  ✅ Zatvoreno: <strong>{bulkResults.closed}</strong>
                </p>
                {bulkResults.alreadyClosed > 0 && (
                  <p className="text-sm text-muted-foreground">
                    ℹ️ Već zatvoreno: {bulkResults.alreadyClosed}
                  </p>
                )}
                {bulkResults.errors > 0 && (
                  <p className="text-sm text-destructive">
                    ❌ Greške: {bulkResults.errors}
                  </p>
                )}
              </div>
            </div>
          )}

          {!bulkResults && (
            <div className="space-y-2 py-4">
              <Label htmlFor="bulk-closing-note">Napomena za zatvaranje (opciono)</Label>
              <Textarea
                id="bulk-closing-note"
                placeholder="Dodajte napomenu..."
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                rows={3}
                disabled={bulkClosingTotal > 0}
              />
            </div>
          )}

          <AlertDialogFooter>
            {bulkResults ? (
              <AlertDialogCancel onClick={() => {
                setBulkCloseDialogOpen(false);
                setBulkResults(null);
                setBulkClosingTotal(0);
                setBulkClosingProgress(0);
              }}>
                Zatvori
              </AlertDialogCancel>
            ) : (
              <>
                <AlertDialogCancel disabled={bulkClosingTotal > 0}>Otkaži</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={confirmBulkClose} 
                  disabled={bulkClosingTotal > 0}
                >
                  {bulkClosingTotal > 0 ? "Zatvaranje..." : "Zatvori naloge"}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkOrders;