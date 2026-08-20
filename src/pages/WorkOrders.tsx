import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, FileText, CheckCircle2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileOrderCard } from "@/components/work-orders/MobileOrderCard";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PriorityNotificationBell } from "@/components/priority/PriorityNotificationBell";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { OrderFilesDialog } from "@/components/work-orders/OrderFilesDialog";
import { InvalidateOrderDialog } from "@/components/work-orders/InvalidateOrderDialog";
import { DeleteOrderDialog } from "@/components/work-orders/DeleteOrderDialog";
import { WorkOrderFilters, WorkOrderFiltersState } from "@/components/work-orders/WorkOrderFilters";
import { FilmStatsSummary } from "@/components/work-orders/FilmStatsSummary";
import { CtpStatsSummary } from "@/components/work-orders/CtpStatsSummary";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthz } from "@/hooks/useAuthz";
import { InvoiceDialog } from "@/components/work-orders/InvoiceDialog";
import { exportBatchToMinimax } from "@/lib/minimaxBatchExport";
import { exportFilmBatchToMinimax } from "@/lib/minimaxFilmBatchExport";
import { serializeFiltersToParams, parseFiltersFromParams } from "@/lib/workOrderFilters";
import { SortableHead, type SortField, type SortDirection } from "@/components/work-orders/SortableHead";
import { WorkOrderTableRow, getOrderTypeLabel } from "@/components/work-orders/WorkOrderTableRow";
import { WorkOrderExportActions } from "@/components/work-orders/WorkOrderExportActions";
import { CloseOrderDialog } from "@/components/work-orders/CloseOrderDialog";
import { BulkCloseDialog } from "@/components/work-orders/BulkCloseDialog";

const WorkOrders = () => {
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [exportSelectedOrders, setExportSelectedOrders] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingXml, setIsExportingXml] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [bulkInvoiceDialogOpen, setBulkInvoiceDialogOpen] = useState(false);
  const [isInvoicing, setIsInvoicing] = useState(false);
  const [filters, setFilters] = useState<WorkOrderFiltersState>(() => parseFiltersFromParams(searchParams));

  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuper, isAdmin, isAdminPlus } = useAuthz();

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDirection(field === 'created_at' ? 'desc' : 'asc');
      return field;
    });
  }, []);

  const handleFiltersChange = useCallback((newFilters: WorkOrderFiltersState) => {
    setFilters(newFilters);
    setSearchParams(serializeFiltersToParams(newFilters), { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    fetchWorkOrders();
  }, [filters]);

  // Server-side pretraga po imenu fajla: vraća skup work_order_id iz sve tri tabele fajlova
  const fetchOrderIdsByFileName = async (needle: string): Promise<string[]> => {
    const pattern = `%${needle.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const PAGE = 1000;

    const collect = async (table: 'file_entries' | 'film_jobs' | 'digital_jobs', column: string) => {
      const ids: string[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from(table)
          .select('work_order_id')
          .ilike(column, pattern)
          .not('work_order_id', 'is', null)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        (data || []).forEach((r: any) => { if (r.work_order_id) ids.push(r.work_order_id); });
        if (!data || data.length < PAGE) break;
      }
      return ids;
    };

    const [a, b, c] = await Promise.all([
      collect('file_entries', 'filename'),
      collect('film_jobs', 'file_name'),
      collect('digital_jobs', 'file_name'),
    ]);
    return Array.from(new Set([...a, ...b, ...c]));
  };

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const fileNeedle = filters.fileNameFilter.trim();
      let fileOrderIds: string[] | null = null;
      if (fileNeedle) {
        fileOrderIds = await fetchOrderIdsByFileName(fileNeedle);
        if (fileOrderIds.length === 0) {
          setWorkOrders([]);
          return;
        }
      }

      let query = supabase
        .from("work_orders")
        .select(`*, clients (name), profiles!work_orders_created_by_fkey (full_name), email_job_latest_status (status, error_msg), file_entries (quantity, closed_by, filename), film_jobs (computed_total_m, file_name), digital_jobs (file_name)`)
        .is("deleted_at", null);

      if (fileOrderIds) query = query.in("id", fileOrderIds);


      if (filters.dateRange.from) query = query.gte("created_at", filters.dateRange.from.toISOString());
      if (filters.dateRange.to) {
        const endOfDay = new Date(filters.dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }
      if (filters.clientIds.length > 0) query = query.in("client_id", filters.clientIds);
      if (filters.orderType !== "all") query = query.eq("order_type", filters.orderType as any);
      if (filters.status !== "all") {
        if (filters.status === "invoiced") query = query.not("invoiced_at", "is", null);
        else if (filters.status === "not_invoiced") query = query.is("invoiced_at", null);
        else query = query.eq("status", filters.status as any);
      }

      const { data, error } = await query.order("created_at", { ascending: false }).limit(2000);
      if (error) throw error;

      if (data && data.length >= 2000) {
        toast({ title: "Upozorenje: Prikazano je maksimalnih 2000 naloga", description: "Suzite filter da biste videli sve naloge.", variant: "destructive", duration: 10000 });
      }

      const closedByIds = new Set<string>();
      (data || []).forEach((o) => { if (o.closed_by) closedByIds.add(o.closed_by); });

      let closerProfiles: Record<string, string> = {};
      if (closedByIds.size > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", Array.from(closedByIds));
        if (profiles) closerProfiles = Object.fromEntries(profiles.map(p => [p.id, p.full_name || '']));
      }

      const ordersWithClosers = (data || []).map((order) => {
        if (order.status !== 'closed') return order;
        const closedByName = order.closed_by ? closerProfiles[order.closed_by] || null : null;
        if (order.order_type === 'film' || order.order_type === 'digital') return { ...order, _closedByName: closedByName };
        const files = order.file_entries || [];
        if (files.length > 0) {
          const uniqueClosers = new Set(files.map((f: any) => f.closed_by).filter(Boolean));
          if (uniqueClosers.size > 1) return { ...order, _closedByMix: true };
        }
        return { ...order, _closedByName: closedByName };
      });

      setWorkOrders(ordersWithClosers);
    } catch (error: any) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkOrders = useMemo(() => {
    const sorted = [...workOrders];
    const getSortValue = (order: any): string | number => {
      switch (sortField) {
        case 'order_number': return order.order_number || order.display_order_number || '';
        case 'client': return (order.clients?.name || '').toLowerCase();
        case 'order_type': return order.order_type || '';
        case 'quantity': {
          if (order.order_type === 'ctp') return (order.file_entries || []).reduce((s: number, e: any) => s + (e.quantity || 0), 0);
          if (order.order_type === 'film') return (order.film_jobs || []).reduce((s: number, j: any) => s + (j.computed_total_m || 0), 0);
          return 0;
        }
        case 'status': return order.status || '';
        case 'created_by': return (order.profiles?.full_name || '').toLowerCase();
        case 'closed_by': return (order._closedByName || '').toLowerCase();
        case 'created_at': return new Date(order.created_at).getTime();
        default: return '';
      }
    };
    sorted.sort((a, b) => {
      const valA = getSortValue(a);
      const valB = getSortValue(b);
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * dir;
      return String(valA).localeCompare(String(valB), 'sr') * dir;
    });

    // Filtriranje po imenu fajla se radi server-side u fetchWorkOrders
    return sorted;
  }, [workOrders, sortField, sortDirection]);


  const filmOrderIds = useMemo(() => filteredWorkOrders.filter(o => o.order_type === "film").map(o => o.id), [filteredWorkOrders]);
  const ctpOrderIds = useMemo(() => filteredWorkOrders.filter(o => o.order_type === "ctp").map(o => o.id), [filteredWorkOrders]);

  // --- Validation ---
  const validateOrderBeforeClose = async (order: any): Promise<{ valid: boolean; error?: string }> => {
    if (!order.client_id) return { valid: false, error: "Izaberi klijenta pre zatvaranja naloga." };
    if (order.order_type === 'film') {
      const { data: filmJobs, error: filmError } = await supabase.from('film_jobs').select('id, width_mm, height_mm, qty, computed_total_m, file_name').eq('work_order_id', order.id);
      if (filmError) return { valid: false, error: "Greška pri učitavanju stavki filmovanja." };
      if (!filmJobs?.length) return { valid: false, error: "Nalog mora da ima bar jednu stavku filmovanja." };
      for (const job of filmJobs) {
        if (job.width_mm < 10) return { valid: false, error: `Stavka "${job.file_name}" ima širinu manju od 10mm.` };
        if (job.height_mm < 10) return { valid: false, error: `Stavka "${job.file_name}" ima visinu manju od 10mm.` };
        if (job.qty < 1) return { valid: false, error: `Stavka "${job.file_name}" ima količinu manju od 1.` };
        if (!job.computed_total_m || job.computed_total_m <= 0) return { valid: false, error: `Stavka "${job.file_name}" nema izračunatu dužinu (m).` };
      }
    }
    if (order.order_type === 'digital') {
      const { data: digitalJobs, error: digitalError } = await supabase.from('digital_jobs').select('id, file_name, computed_total_sheets, obim, qty').eq('work_order_id', order.id);
      if (digitalError) return { valid: false, error: "Greška pri učitavanju digitalnih stavki." };
      if (!digitalJobs?.length) return { valid: false, error: "Nalog mora da ima bar jednu digitalnu stavku." };
      for (const job of digitalJobs) {
        const calculatedSheets = (job.obim || 1) * (job.qty || 0);
        if ((!job.computed_total_sheets || job.computed_total_sheets <= 0) && calculatedSheets <= 0) return { valid: false, error: `Stavka "${job.file_name}" nema ispravno unet broj tabaka.` };
      }
    }
    if (order.order_type === 'ctp') {
      const { data: fileEntries, error: fileError } = await supabase.from('file_entries').select('id').eq('work_order_id', order.id);
      if (fileError) return { valid: false, error: "Greška pri učitavanju fajlova." };
      if (!fileEntries?.length) return { valid: false, error: "Nalog mora da ima bar jedan fajl." };
    }
    return { valid: true };
  };

  // --- Close handlers ---
  const handleCloseOrder = async (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.status === 'closed') return;
    if (order.invalidated_at) {
      toast({ title: "Zabranjena akcija", description: "Ne može se zatvoriti nalog koji je proglašen nevažećim.", variant: "destructive" });
      return;
    }
    const validation = await validateOrderBeforeClose(order);
    if (!validation.valid) {
      toast({ title: "Validaciona greška", description: validation.error, variant: "destructive" });
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
      const { data, error } = await supabase.functions.invoke('close-work-order', { body: { work_order_id: orderToClose.id, note: closingNote.trim() || undefined } });
      if (error) throw error;
      const result = data as { ok?: boolean; success?: boolean; error?: string; code?: string; delivery_note_sent?: boolean };
      if (!(result?.ok || result?.success)) {
        const errorMessages: Record<string, string> = { 'CLIENT_REQUIRED': 'Izaberi klijenta pre zatvaranja naloga.', 'FILM_COMPUTE_MISSING': 'Neka stavka nema izračunatu dužinu (m).', 'NO_ITEMS': 'Nalog mora da ima bar jednu stavku.', 'INVALID_DIMENSIONS': 'Neka stavka ima neispravne dimenzije.', 'PDF_GENERATION_FAILED': 'Greška pri generisanju PDF-a.', 'EMAIL_SEND_FAILED': 'Greška pri slanju email-a.' };
        throw new Error(result.code ? errorMessages[result.code] || `Greška (kod: ${result.code})` : result.error || "Greška pri zatvaranju naloga");
      }
      toast({ title: result.delivery_note_sent ? "Uspeh" : "Upozorenje", description: result.delivery_note_sent ? "Radni nalog je zatvoren i otpremnica je poslata." : "Nalog zatvoren, ali slanje otpremnice nije uspelo.", variant: result.delivery_note_sent ? "default" : "destructive" });
      setCloseDialogOpen(false);
      setOrderToClose(null);
      setClosingNote("");
      fetchWorkOrders();
    } catch (error: any) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } finally {
      setIsClosing(false);
    }
  };

  // --- Selection handlers ---
  const toggleOrderSelection = (orderId: string, isOpen: boolean) => {
    if (!isOpen) return;
    setSelectedOrders(prev => { const n = new Set(prev); n.has(orderId) ? n.delete(orderId) : n.add(orderId); return n; });
  };
  const toggleAllOrders = () => {
    const openOrders = filteredWorkOrders.filter(o => o.status === 'open');
    setSelectedOrders(selectedOrders.size === openOrders.length ? new Set() : new Set(openOrders.map(o => o.id)));
  };
  const toggleExportOrderSelection = (orderId: string) => {
    setExportSelectedOrders(prev => { const n = new Set(prev); n.has(orderId) ? n.delete(orderId) : n.add(orderId); return n; });
  };
  const toggleAllExportOrders = () => {
    setExportSelectedOrders(exportSelectedOrders.size === filteredWorkOrders.length ? new Set() : new Set(filteredWorkOrders.map(o => o.id)));
  };

  // --- Bulk close ---
  const handleBulkClose = () => { if (selectedOrders.size === 0) return; setBulkResults(null); setBulkCloseDialogOpen(true); };
  const confirmBulkClose = async () => {
    const orderIds = Array.from(selectedOrders);
    setBulkClosingTotal(orderIds.length);
    setBulkClosingProgress(0);
    let closed = 0, alreadyClosed = 0, errors = 0;
    for (let i = 0; i < orderIds.length; i++) {
      try {
        const { data, error } = await supabase.functions.invoke('close-work-order', { body: { work_order_id: orderIds[i], note: closingNote.trim() || undefined } });
        if (error) throw error;
        const result = data as { success: boolean; error?: string };
        if (result?.success) closed++; else if (result?.error?.includes('već zatvoren')) alreadyClosed++; else errors++;
      } catch (error: any) { error.message?.includes('već zatvoren') ? alreadyClosed++ : errors++; }
      setBulkClosingProgress(i + 1);
    }
    setBulkResults({ closed, alreadyClosed, errors });
    setSelectedOrders(new Set());
    setClosingNote("");
    fetchWorkOrders();
  };

  // --- Export handlers ---
  const handleExportToExcel = async () => {
    if (exportSelectedOrders.size === 0) { toast({ title: "Upozorenje", description: "Odaberite barem jedan nalog za izvoz.", variant: "destructive" }); return; }
    setIsExporting(true);
    try {
      const ordersToExport = filteredWorkOrders.filter(o => exportSelectedOrders.has(o.id));
      const clientIds = [...new Set(ordersToExport.map(o => o.client_id).filter(Boolean))];
      const { data: clients } = await supabase.from('clients').select('id, pib').in('id', clientIds);
      const clientPibMap = new Map(clients?.map(c => [c.id, c.pib]) || []);
      const exportRows: any[] = [];
      for (const order of ordersToExport) {
        const base = {
          "Broj naloga": order.display_order_number || order.order_number, "Klijent": order.clients?.name || '', "PIB klijenta": clientPibMap.get(order.client_id) || '',
          "Tip": getOrderTypeLabel(order.order_type), "Posao": order.job_name || '', "Status": order.status === 'open' ? 'Otvoren' : 'Zatvoren',
          "Datum kreiranja": format(new Date(order.created_at), 'dd.MM.yyyy'), "Datum zatvaranja": order.closed_at ? format(new Date(order.closed_at), 'dd.MM.yyyy') : '', "Napomena": order.notes || '',
        };
        if (order.order_type === 'ctp') {
          const { data: files } = await supabase.from('file_entries').select('filename, quantity, plate_formats(format_name)').eq('work_order_id', order.id);
          if (files?.length) { for (const f of files) exportRows.push({ ...base, "Format": (f.plate_formats as any)?.format_name || '', "Fajl": f.filename, "Količina": f.quantity || 0, "Jedinica": 'ploča' }); }
          else exportRows.push({ ...base, "Format": '', "Fajl": '', "Količina": '', "Jedinica": '' });
        } else if (order.order_type === 'film') {
          const { data: films } = await supabase.from('film_jobs').select('file_name, qty, computed_total_m').eq('work_order_id', order.id);
          if (films?.length) { for (const f of films) exportRows.push({ ...base, "Format": '', "Fajl": f.file_name, "Količina": (f.computed_total_m || 0).toFixed(2), "Jedinica": 'm' }); }
          else exportRows.push({ ...base, "Format": '', "Fajl": '', "Količina": '', "Jedinica": '' });
        } else if (order.order_type === 'digital') {
          const { data: digitals } = await supabase.from('digital_jobs').select('file_name, qty, computed_total_sheets, computed_color_clicks, computed_mono_clicks').eq('work_order_id', order.id);
          if (digitals?.length) { for (const d of digitals) exportRows.push({ ...base, "Format": '', "Fajl": d.file_name, "Količina": (d.computed_color_clicks || 0) + (d.computed_mono_clicks || 0), "Jedinica": 'klikova' }); }
          else exportRows.push({ ...base, "Format": '', "Fajl": '', "Količina": '', "Jedinica": '' });
        } else { exportRows.push({ ...base, "Format": '', "Fajl": '', "Količina": '', "Jedinica": '' }); }
      }
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws, "Nalozi");
      const firstClientName = ordersToExport[0]?.clients?.name || 'Nalozi';
      XLSX.writeFile(wb, `${firstClientName.replace(/[\\/:*?"<>|]/g, '_')}_${format(new Date(), 'dd.MM.yyyy')}.xlsx`);
      toast({ title: "Uspešno", description: `Izvezeno ${exportRows.length} stavki u Excel.` });
      setExportSelectedOrders(new Set());
    } catch (error: any) {
      toast({ title: "Greška", description: "Greška pri izvozu u Excel.", variant: "destructive" });
    } finally { setIsExporting(false); }
  };

  const handleExportToMinimaxXml = async () => {
    if (exportSelectedOrders.size === 0) { toast({ title: "Upozorenje", description: "Odaberite barem jedan nalog za izvoz u Minimax.", variant: "destructive" }); return; }
    const selectedOrderIds = Array.from(exportSelectedOrders);
    const validCtpOrders = workOrders.filter(o => selectedOrderIds.includes(o.id) && o.order_type === 'ctp' && o.status === 'closed');
    const validFilmOrders = workOrders.filter(o => selectedOrderIds.includes(o.id) && o.order_type === 'film' && o.status === 'closed');
    if (validCtpOrders.length === 0 && validFilmOrders.length === 0) { toast({ title: "Upozorenje", description: "Nema zatvorenih CTP ili Film naloga za Minimax izvoz.", variant: "destructive" }); return; }
    setIsExportingXml(true);
    try {
      let totalExported = 0, totalSkipped = 0;
      const allErrors: string[] = [];
      if (validCtpOrders.length > 0) { const r = await exportBatchToMinimax(validCtpOrders.map(o => o.id)); if (r.success) { totalExported += r.exportedCount; totalSkipped += r.skippedCount; } else allErrors.push(...r.errors); }
      if (validFilmOrders.length > 0) { const r = await exportFilmBatchToMinimax(validFilmOrders.map(o => o.id)); if (r.success) { totalExported += r.exportedCount; totalSkipped += r.skippedCount; } else allErrors.push(...r.errors); }
      if (totalExported > 0) {
        const types: string[] = [];
        if (validCtpOrders.length > 0) types.push(`${validCtpOrders.length} CTP`);
        if (validFilmOrders.length > 0) types.push(`${validFilmOrders.length} Film`);
        toast({ title: "Uspešno", description: `Izvezeno ${types.join(" i ")} naloga u Minimax XML.${totalSkipped > 0 ? ` Preskočeno: ${totalSkipped}` : ''}` });
        setExportSelectedOrders(new Set());
      } else { toast({ title: "Greška", description: allErrors.join(", ") || "Greška pri izvozu.", variant: "destructive" }); }
    } catch (error: any) { toast({ title: "Greška", description: error.message || "Greška pri izvozu u Minimax XML.", variant: "destructive" }); }
    finally { setIsExportingXml(false); }
  };

  const handleBulkInvoice = () => {
    if (exportSelectedOrders.size === 0) { toast({ title: "Upozorenje", description: "Odaberite barem jedan nalog za fakturisanje.", variant: "destructive" }); return; }
    setBulkInvoiceDialogOpen(true);
  };

  const confirmBulkInvoice = async (invoiceNumber: string) => {
    setIsInvoicing(true);
    try {
      const orderIds = Array.from(exportSelectedOrders);
      const { error } = await supabase.from('work_orders').update({ invoiced_at: new Date().toISOString(), invoice_number: invoiceNumber || null }).in('id', orderIds);
      if (error) throw error;
      toast({ title: "Uspešno", description: `${orderIds.length} ${orderIds.length === 1 ? 'nalog označen' : 'naloga označeno'} kao fakturisano.` });
      setBulkInvoiceDialogOpen(false);
      setExportSelectedOrders(new Set());
      fetchWorkOrders();
    } catch (error: any) { toast({ title: "Greška", description: error.message, variant: "destructive" }); }
    finally { setIsInvoicing(false); }
  };

  const handleBatchPdfDownload = async () => {
    if (exportSelectedOrders.size === 0) { toast({ title: "Upozorenje", description: "Odaberite barem jedan nalog.", variant: "destructive" }); return; }
    setIsExportingPdf(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niste prijavljeni");
      const allIds = Array.from(exportSelectedOrders);
      const CHUNK_SIZE = 10;
      const chunks: string[][] = [];
      for (let i = 0; i < allIds.length; i += CHUNK_SIZE) chunks.push(allIds.slice(i, i + CHUNK_SIZE));
      const { PDFDocument } = await import("pdf-lib");
      const mergedPdf = await PDFDocument.create();
      let totalSuccess = 0, totalErrors = 0;
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        toast({ title: "Generisanje PDF-a", description: `Obrađujem grupu ${ci + 1}/${chunks.length} (${chunk.length} naloga)...` });
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-delivery-notes-pdf`, { method: "POST", headers: { "Authorization": `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ work_order_ids: chunk }) });
        if (!response.ok) { totalErrors += chunk.length; continue; }
        const pdfBytes = new Uint8Array(await response.arrayBuffer());
        const chunkPdf = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(chunkPdf, chunkPdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
        totalSuccess += Number(response.headers.get('X-Success-Count') || chunk.length);
        totalErrors += Number(response.headers.get('X-Error-Count') || 0);
      }
      if (mergedPdf.getPageCount() === 0) throw new Error("Nijedna otpremnica nije generisana.");
      const finalBytes = await mergedPdf.save() as unknown as ArrayBuffer;
      const blob = new Blob([finalBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `Otpremnice-${allIds.length}-naloga.pdf`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      toast({ title: "PDF preuzet", description: `Generisano ${totalSuccess} otpremnica.${totalErrors > 0 ? ` ${totalErrors} grešaka.` : ''}` });
    } catch (error: any) { toast({ title: "Greška", description: error.message, variant: "destructive" }); }
    finally { setIsExportingPdf(false); }
  };

  const isMobile = useIsMobile();

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
            <img src="/gama-united-logo.svg" alt="Gama United" className="h-10 md:h-14 cursor-pointer hidden sm:block" onClick={() => navigate("/dashboard")} />
            <h1 className="text-lg md:text-2xl font-bold">Radni nalozi</h1>
          </div>
          <div className="flex items-center gap-2">
            <PriorityNotificationBell />
            <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => navigate("/checklist")}>Checklist</Button>
            <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => navigate("/checklist?tab=pretraga")}>Pretraga i statistika</Button>
            <Button size="sm" onClick={() => navigate("/work-orders/new")}><Plus className="h-4 w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Novi nalog</span><span className="sm:hidden">Novo</span></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-8 max-w-[1600px] space-y-4">
        <WorkOrderFilters filters={filters} onFiltersChange={handleFiltersChange} />
        {(isSuper || isAdmin) && <FilmStatsSummary workOrderIds={filmOrderIds} />}
        {(isSuper || isAdmin) && <CtpStatsSummary workOrderIds={ctpOrderIds} />}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Radni nalozi
                <Badge variant="outline" className="ml-2">{filteredWorkOrders.length} {filteredWorkOrders.length === 1 ? "nalog" : "naloga"}</Badge>
                {exportSelectedOrders.size > 0 && <Badge variant="secondary" className="ml-1">{exportSelectedOrders.size} odabrano za izvoz</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <WorkOrderExportActions
                  selectedCount={exportSelectedOrders.size}
                  isExporting={isExporting} isExportingXml={isExportingXml} isExportingPdf={isExportingPdf} isInvoicing={isInvoicing}
                  isSuper={isSuper} isAdminPlus={isAdminPlus}
                  onExportExcel={handleExportToExcel} onExportMinimaxXml={handleExportToMinimaxXml} onBulkInvoice={handleBulkInvoice} onBatchPdf={handleBatchPdfDownload}
                />
                {(isSuper || isAdmin) && selectedOrders.size > 0 && (
                  <Button onClick={handleBulkClose} variant="default"><CheckCircle2 className="h-4 w-4 mr-2" />Zatvori odabrane ({selectedOrders.size})</Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredWorkOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nema radnih naloga za izabrane filtere.</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-0">
                {filteredWorkOrders.map((order) => (
                  <MobileOrderCard
                    key={order.id}
                    order={order}
                    onView={(id) => navigate(`/work-orders/${id}`)}
                    onDeliveryNote={(id) => navigate(`/work-orders/${id}/delivery-note`)}
                    onEdit={(id) => navigate(`/work-orders/${id}/edit`)}
                    onClose={(o) => handleCloseOrder(o, { stopPropagation: () => {} } as React.MouseEvent)}
                    canClose={isSuper || isAdmin}
                  />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox checked={exportSelectedOrders.size > 0 && exportSelectedOrders.size === filteredWorkOrders.length} onCheckedChange={toggleAllExportOrders} title="Odaberi sve za izvoz" />
                    </TableHead>
                    {(isSuper || isAdmin) && (
                      <TableHead className="w-12">
                        <Checkbox checked={selectedOrders.size > 0 && selectedOrders.size === filteredWorkOrders.filter(o => o.status === 'open').length} onCheckedChange={toggleAllOrders} disabled={filteredWorkOrders.filter(o => o.status === 'open').length === 0} title="Odaberi sve za zatvaranje" />
                      </TableHead>
                    )}
                    <SortableHead field="order_number" label="Broj naloga" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHead field="client" label="Klijent" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHead field="order_type" label="Tip" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHead field="quantity" label="Količina" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-right" />
                    <SortableHead field="status" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHead field="created_by" label="Kreirao" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHead field="closed_by" label="Zatvorio" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHead field="created_at" label="Datum" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <TableHead className="text-right">Akcije</TableHead>
                    {(isSuper || isAdmin) && <TableHead className="text-center">Zatvori</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkOrders.map((order) => (
                    <WorkOrderTableRow
                      key={order.id}
                      order={order}
                      isSuper={isSuper} isAdmin={isAdmin}
                      exportSelected={exportSelectedOrders.has(order.id)}
                      closeSelected={selectedOrders.has(order.id)}
                      onToggleExport={toggleExportOrderSelection}
                      onToggleClose={toggleOrderSelection}
                      onCloseOrder={handleCloseOrder}
                      onInvalidate={(o) => { setOrderToInvalidate(o); setInvalidateDialogOpen(true); }}
                      onDelete={(o) => { setOrderToDelete(o); setDeleteDialogOpen(true); }}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <OrderFilesDialog orderId={selectedOrderId} open={filesDialogOpen} onOpenChange={setFilesDialogOpen} />
      <InvalidateOrderDialog open={invalidateDialogOpen} onOpenChange={setInvalidateDialogOpen} order={orderToInvalidate} onSuccess={fetchWorkOrders} />
      <DeleteOrderDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} order={orderToDelete} onSuccess={fetchWorkOrders} />
      <CloseOrderDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen} orderNumber={orderToClose?.order_number} closingNote={closingNote} onClosingNoteChange={setClosingNote} onConfirm={confirmCloseOrder} isClosing={isClosing} />
      <BulkCloseDialog
        open={bulkCloseDialogOpen} onOpenChange={setBulkCloseDialogOpen}
        selectedCount={selectedOrders.size} closingNote={closingNote} onClosingNoteChange={setClosingNote}
        onConfirm={confirmBulkClose} progress={bulkClosingProgress} total={bulkClosingTotal} results={bulkResults}
        onDismissResults={() => { setBulkCloseDialogOpen(false); setBulkResults(null); setBulkClosingTotal(0); setBulkClosingProgress(0); }}
      />
      <InvoiceDialog open={bulkInvoiceDialogOpen} onOpenChange={setBulkInvoiceDialogOpen} onConfirm={confirmBulkInvoice} isLoading={isInvoicing} />
    </div>
  );
};

export default WorkOrders;
