import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, FileText, Eye, Lock, CheckCircle2, AlertTriangle, Trash2, Pencil, Send, Download, Loader2, Receipt, FileCheck } from "lucide-react";
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

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { prefixFor, displayOrderNumber } from "@/lib/orderLabel";
import { useAuthz } from "@/hooks/useAuthz";
import { InvoiceDialog } from "@/components/work-orders/InvoiceDialog";

// Helper functions to serialize/deserialize filters to URL params
const serializeFiltersToParams = (filters: WorkOrderFiltersState): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.dateRange.from) {
    params.set("dateFrom", filters.dateRange.from.toISOString());
  }
  if (filters.dateRange.to) {
    params.set("dateTo", filters.dateRange.to.toISOString());
  }
  if (filters.clientIds.length > 0) {
    params.set("clients", filters.clientIds.join(","));
  }
  if (filters.orderType !== "all") {
    params.set("type", filters.orderType);
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.searchText) {
    params.set("search", filters.searchText);
  }
  return params;
};

const parseFiltersFromParams = (params: URLSearchParams): WorkOrderFiltersState => {
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const clients = params.get("clients");
  const type = params.get("type");
  const status = params.get("status");
  const search = params.get("search");

  return {
    dateRange: {
      from: dateFrom ? new Date(dateFrom) : undefined,
      to: dateTo ? new Date(dateTo) : undefined,
    },
    clientIds: clients ? clients.split(",").filter(Boolean) : [],
    orderType: type || "all",
    status: status || "all",
    searchText: search || "",
  };
};

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
  
  // Export selection state (separate from bulk close selection)
  const [exportSelectedOrders, setExportSelectedOrders] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  
  // Bulk invoice state
  const [bulkInvoiceDialogOpen, setBulkInvoiceDialogOpen] = useState(false);
  const [isInvoicing, setIsInvoicing] = useState(false);
  
  // Initialize filters from URL params
  const [filters, setFilters] = useState<WorkOrderFiltersState>(() => 
    parseFiltersFromParams(searchParams)
  );
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuper, isAdmin } = useAuthz();

  // Update URL when filters change
  const handleFiltersChange = useCallback((newFilters: WorkOrderFiltersState) => {
    setFilters(newFilters);
    const params = serializeFiltersToParams(newFilters);
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

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
          profiles!work_orders_created_by_fkey (full_name),
          email_job_latest_status (
            status,
            error_msg
          ),
          file_entries (quantity, closed_by),
          film_jobs (computed_total_m)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      
      // Get unique closed_by IDs to fetch their names in one query
      const closedByIds = new Set<string>();
      (data || []).forEach((order) => {
        if (order.closed_by) closedByIds.add(order.closed_by);
      });
      
      // Fetch all closer profiles in one query
      let closerProfiles: Record<string, string> = {};
      if (closedByIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(closedByIds));
        if (profiles) {
          closerProfiles = Object.fromEntries(profiles.map(p => [p.id, p.full_name || '']));
        }
      }
      
      // Process orders to add _closedByName without additional per-order queries
      const ordersWithClosers = (data || []).map((order) => {
        if (order.status !== 'closed') {
          return order;
        }
        
        // Get closed_by name from the batch-fetched profiles
        const closedByName = order.closed_by ? closerProfiles[order.closed_by] || null : null;
        
        // For film and digital orders, just use the work order closer
        if (order.order_type === 'film' || order.order_type === 'digital') {
          return { ...order, _closedByName: closedByName };
        }
        
        // Check file_entries for different closers (CTP and other orders)
        const files = order.file_entries || [];
        if (files.length > 0) {
          const uniqueClosers = new Set(files.map((f: any) => f.closed_by).filter(Boolean));
          if (uniqueClosers.size > 1) {
            return { ...order, _closedByMix: true };
          }
        }
        
        return { ...order, _closedByName: closedByName };
      });
      
      setWorkOrders(ordersWithClosers);
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

  // Apply filters to work orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((order) => {
      // Date range filter
      if (filters.dateRange.from) {
        const orderDate = new Date(order.created_at);
        if (orderDate < filters.dateRange.from) return false;
      }
      if (filters.dateRange.to) {
        const orderDate = new Date(order.created_at);
        const endOfDay = new Date(filters.dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (orderDate > endOfDay) return false;
      }

      // Client filter
      if (filters.clientIds.length > 0 && !filters.clientIds.includes(order.client_id)) {
        return false;
      }

      // Order type filter
      if (filters.orderType !== "all" && order.order_type !== filters.orderType) {
        return false;
      }

      // Status filter
      if (filters.status !== "all") {
        if (filters.status === "invoiced") {
          // Filter for invoiced orders only
          if (!order.invoiced_at) return false;
        } else if (filters.status === "not_invoiced") {
          // Filter for not invoiced orders only
          if (order.invoiced_at) return false;
        } else if (order.status !== filters.status) {
          return false;
        }
      }

      return true;
    });
  }, [workOrders, filters]);

  // Get film order IDs for stats summary
  const filmOrderIds = useMemo(() => {
    return filteredWorkOrders
      .filter((order) => order.order_type === "film")
      .map((order) => order.id);
  }, [filteredWorkOrders]);

  // Get CTP order IDs for stats summary
  const ctpOrderIds = useMemo(() => {
    return filteredWorkOrders
      .filter((order) => order.order_type === "ctp")
      .map((order) => order.id);
  }, [filteredWorkOrders]);

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case "ctp": return "CTP";
      case "digital": return "Digital";
      case "film": return "Filmovanje";
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

  const getClosedByDisplay = (order: any) => {
    if (order.status !== 'closed') return '-';
    if (order._closedByMix) return 'Mix';
    if (order._closedByName) return order._closedByName;
    return '-';
  };

  // Get quantity display for order (plates for CTP, meters for film)
  const getOrderQuantity = (order: any) => {
    if (order.order_type === 'ctp') {
      // Sum all plate quantities from file_entries
      const totalPlates = (order.file_entries || []).reduce(
        (sum: number, entry: any) => sum + (entry.quantity || 0),
        0
      );
      return totalPlates > 0 ? `${totalPlates} ploča` : '-';
    }
    if (order.order_type === 'film') {
      // Sum all meters from film_jobs
      const totalMeters = (order.film_jobs || []).reduce(
        (sum: number, job: any) => sum + (job.computed_total_m || 0),
        0
      );
      return totalMeters > 0 ? `${totalMeters.toFixed(2)} m` : '-';
    }
    return '-';
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
    const openOrders = filteredWorkOrders.filter(order => order.status === 'open');
    if (selectedOrders.size === openOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(openOrders.map(order => order.id)));
    }
  };

  // Export selection functions
  const toggleExportOrderSelection = (orderId: string) => {
    setExportSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleAllExportOrders = () => {
    if (exportSelectedOrders.size === filteredWorkOrders.length) {
      setExportSelectedOrders(new Set());
    } else {
      setExportSelectedOrders(new Set(filteredWorkOrders.map(order => order.id)));
    }
  };

  const handleExportToExcel = async () => {
    if (exportSelectedOrders.size === 0) {
      toast({
        title: "Upozorenje",
        description: "Odaberite barem jedan nalog za izvoz.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      // Get selected orders from filtered list
      const ordersToExport = filteredWorkOrders.filter(order => 
        exportSelectedOrders.has(order.id)
      );

      // Fetch client PIBs first
      const clientIds = [...new Set(ordersToExport.map(o => o.client_id).filter(Boolean))];
      const { data: clients } = await supabase
        .from('clients')
        .select('id, pib')
        .in('id', clientIds);
      
      const clientPibMap = new Map(clients?.map(c => [c.id, c.pib]) || []);

      // Build export rows - each file/item gets its own row
      const exportRows: any[] = [];

      for (const order of ordersToExport) {
        const baseRowData = {
          "Broj naloga": order.display_order_number || order.order_number,
          "Klijent": order.clients?.name || '',
          "PIB klijenta": clientPibMap.get(order.client_id) || '',
          "Tip": getOrderTypeLabel(order.order_type),
          "Posao": order.job_name || '',
          "Status": order.status === 'open' ? 'Otvoren' : 'Zatvoren',
          "Datum kreiranja": format(new Date(order.created_at), 'dd.MM.yyyy'),
          "Datum zatvaranja": order.closed_at ? format(new Date(order.closed_at), 'dd.MM.yyyy') : '',
          "Napomena": order.notes || '',
        };

        if (order.order_type === 'ctp') {
          const { data: files } = await supabase
            .from('file_entries')
            .select('filename, quantity, plate_formats(format_name)')
            .eq('work_order_id', order.id);
          
          if (files && files.length > 0) {
            for (const file of files) {
              const formatName = (file.plate_formats as any)?.format_name || '';
              exportRows.push({
                ...baseRowData,
                "Format": formatName,
                "Fajl": file.filename,
                "Količina": file.quantity || 0,
                "Jedinica": 'ploča',
              });
            }
          } else {
            exportRows.push({
              ...baseRowData,
              "Format": '',
              "Fajl": '',
              "Količina": '',
              "Jedinica": '',
            });
          }
        } else if (order.order_type === 'film') {
          const { data: films } = await supabase
            .from('film_jobs')
            .select('file_name, qty, computed_total_m')
            .eq('work_order_id', order.id);
          
          if (films && films.length > 0) {
            for (const film of films) {
              exportRows.push({
                ...baseRowData,
                "Format": '',
                "Fajl": film.file_name,
                "Količina": (film.computed_total_m || 0).toFixed(2),
                "Jedinica": 'm',
              });
            }
          } else {
            exportRows.push({
              ...baseRowData,
              "Format": '',
              "Fajl": '',
              "Količina": '',
              "Jedinica": '',
            });
          }
        } else if (order.order_type === 'digital') {
          const { data: digitals } = await supabase
            .from('digital_jobs')
            .select('file_name, qty, computed_total_sheets, computed_color_clicks, computed_mono_clicks')
            .eq('work_order_id', order.id);
          
          if (digitals && digitals.length > 0) {
            for (const digital of digitals) {
              const clicks = (digital.computed_color_clicks || 0) + (digital.computed_mono_clicks || 0);
              exportRows.push({
                ...baseRowData,
                "Format": '',
                "Fajl": digital.file_name,
                "Količina": clicks,
                "Jedinica": 'klikova',
              });
            }
          } else {
            exportRows.push({
              ...baseRowData,
              "Format": '',
              "Fajl": '',
              "Količina": '',
              "Jedinica": '',
            });
          }
        } else {
          // Other order types
          exportRows.push({
            ...baseRowData,
            "Format": '',
            "Fajl": '',
            "Količina": '',
            "Jedinica": '',
          });
        }
      }

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 15 },  // Broj naloga
        { wch: 25 },  // Klijent
        { wch: 12 },  // PIB
        { wch: 10 },  // Tip
        { wch: 20 },  // Posao
        { wch: 10 },  // Status
        { wch: 12 },  // Datum kreiranja
        { wch: 12 },  // Datum zatvaranja
        { wch: 30 },  // Napomena
        { wch: 12 },  // Format
        { wch: 40 },  // Fajl
        { wch: 12 },  // Količina
        { wch: 10 },  // Jedinica
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, "Nalozi");
      
      // Generate filename
      const firstClientName = ordersToExport[0]?.clients?.name || 'Nalozi';
      const exportDate = format(new Date(), 'dd.MM.yyyy');
      const sanitizedClientName = firstClientName.replace(/[\\/:*?"<>|]/g, '_');
      const filename = `${sanitizedClientName}_${exportDate}`;
      
      XLSX.writeFile(wb, `${filename}.xlsx`);
      
      toast({
        title: "Uspešno",
        description: `Izvezeno ${exportRows.length} stavki u Excel.`,
      });
      
      // Clear selection after export
      setExportSelectedOrders(new Set());
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        title: "Greška",
        description: "Greška pri izvozu u Excel.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
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

  // Bulk invoice handlers
  const handleBulkInvoice = () => {
    if (exportSelectedOrders.size === 0) {
      toast({
        title: "Upozorenje",
        description: "Odaberite barem jedan nalog za fakturisanje.",
        variant: "destructive",
      });
      return;
    }
    setBulkInvoiceDialogOpen(true);
  };

  const confirmBulkInvoice = async (invoiceNumber: string) => {
    setIsInvoicing(true);
    try {
      const orderIds = Array.from(exportSelectedOrders);
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('work_orders')
        .update({
          invoiced_at: now,
          invoice_number: invoiceNumber || null,
        })
        .in('id', orderIds);

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: `${orderIds.length} ${orderIds.length === 1 ? 'nalog označen' : 'naloga označeno'} kao fakturisano.`,
      });

      setBulkInvoiceDialogOpen(false);
      setExportSelectedOrders(new Set());
      fetchWorkOrders();
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsInvoicing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Učitavanje...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img 
              src="/gama-united-logo.svg" 
              alt="Gama United" 
              className="h-10 md:h-14 cursor-pointer hidden sm:block" 
              onClick={() => navigate("/dashboard")}
            />
            <h1 className="text-2xl font-bold">Radni nalozi</h1>
          </div>
          <div className="flex items-center gap-2">
            <PriorityNotificationBell />
            <Button variant="outline" size="sm" onClick={() => navigate("/checklist")}>
              Checklist
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/checklist?tab=pretraga")}>
              Pretraga i statistika
            </Button>
            <Button onClick={() => navigate("/work-orders/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Novi nalog
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-8 max-w-[1600px] space-y-4">
        <WorkOrderFilters filters={filters} onFiltersChange={handleFiltersChange} />
        
        {/* Film Stats Summary - shows when there are film orders in filtered results (admin/superuser only) */}
        {(isSuper || isAdmin) && <FilmStatsSummary workOrderIds={filmOrderIds} />}

        {/* CTP Stats Summary - shows when there are CTP orders in filtered results (admin/superuser only) */}
        {(isSuper || isAdmin) && <CtpStatsSummary workOrderIds={ctpOrderIds} />}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Radni nalozi
                <Badge variant="outline" className="ml-2">
                  {filteredWorkOrders.length} {filteredWorkOrders.length === 1 ? "nalog" : "naloga"}
                </Badge>
                {exportSelectedOrders.size > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {exportSelectedOrders.size} odabrano za izvoz
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {exportSelectedOrders.size > 0 && (
                  <>
                    <Button 
                      onClick={handleExportToExcel} 
                      variant="outline"
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Izvoz ({exportSelectedOrders.size})
                    </Button>
                    <Button 
                      onClick={handleBulkInvoice} 
                      variant="outline"
                      disabled={isInvoicing}
                    >
                      {isInvoicing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Receipt className="h-4 w-4 mr-2" />
                      )}
                      Fakturisano ({exportSelectedOrders.size})
                    </Button>
                  </>
                )}
                {(isSuper || isAdmin) && selectedOrders.size > 0 && (
                  <Button onClick={handleBulkClose} variant="default">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Zatvori odabrane ({selectedOrders.size})
                  </Button>
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
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={exportSelectedOrders.size > 0 && exportSelectedOrders.size === filteredWorkOrders.length}
                        onCheckedChange={toggleAllExportOrders}
                        title="Odaberi sve za izvoz"
                      />
                    </TableHead>
                    {(isSuper || isAdmin) && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedOrders.size > 0 && selectedOrders.size === filteredWorkOrders.filter(o => o.status === 'open').length}
                          onCheckedChange={toggleAllOrders}
                          disabled={filteredWorkOrders.filter(o => o.status === 'open').length === 0}
                          title="Odaberi sve za zatvaranje"
                        />
                      </TableHead>
                    )}
                    <TableHead>Broj naloga</TableHead>
                    <TableHead>Klijent</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead className="text-right">Količina</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Kreirao</TableHead>
                    <TableHead>Zatvorio</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                    {(isSuper || isAdmin) && <TableHead className="text-center">Zatvori</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/work-orders/${order.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={exportSelectedOrders.has(order.id)}
                          onCheckedChange={() => toggleExportOrderSelection(order.id)}
                          title="Odaberi za izvoz"
                        />
                      </TableCell>
                      {(isSuper || isAdmin) && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id, order.status === 'open')}
                            disabled={order.status === 'closed'}
                            title="Odaberi za zatvaranje"
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{displayOrderNumber(order)}</span>
                          {order.invoiced_at && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <FileCheck className="h-4 w-4 text-green-600" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Fakturisano: {order.invoice_number || 'Da'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {order.invalid_reason && (
                          <span className="text-xs text-orange-600 block mt-1">
                            Razlog: {order.invalid_reason}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{order.clients?.name}</TableCell>
                      <TableCell>{getOrderTypeLabel(order.order_type)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {getOrderQuantity(order)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status, order.invalidated_at, order.deleted_at)}</TableCell>
                      <TableCell>{order.profiles?.full_name || '-'}</TableCell>
                      <TableCell>{getClosedByDisplay(order)}</TableCell>
                      <TableCell>{new Date(order.created_at).toLocaleDateString('sr-RS')}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`/work-orders/${order.id}/print`, '_blank');
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Prikaz</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => handleSendDeliveryNote(order.id, e)}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Otpremnica</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          {order.status === 'open' && !order.invalidated_at && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/work-orders/${order.id}/edit`);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Izmeni</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          {(isAdmin || isSuper) && !order.invalidated_at && !order.deleted_at && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOrderToInvalidate(order);
                                      setInvalidateDialogOpen(true);
                                    }}
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Nevažeći</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          {isSuper && !order.deleted_at && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOrderToDelete(order);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Obriši</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      {(isSuper || isAdmin) && (
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
                      )}
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

      <InvoiceDialog
        open={bulkInvoiceDialogOpen}
        onOpenChange={setBulkInvoiceDialogOpen}
        onConfirm={confirmBulkInvoice}
        isLoading={isInvoicing}
      />
    </div>
  );
};

export default WorkOrders;
