import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CheckCircle, XCircle, Search, FileText, Calendar, User, Eye, ChevronRight, ChevronDown, Play, Pause, Square, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PriorityBadge } from "@/components/priority/PriorityBadge";
import { InProgressIndicator } from "@/components/checklist/InProgressIndicator";
import { format, subDays } from "date-fns";
import { displayOrderNumber } from "@/lib/orderLabel";

/**
 * Check if work order is "in progress" - has at least one closed file while others remain open
 */
const isOrderInProgress = (order: WorkOrder): boolean => {
  if (!order.file_entries || order.file_entries.length === 0) return false;
  if (order.status === "closed") return false;
  
  const hasClosedFiles = order.file_entries.some(f => f.status === "closed");
  const hasOpenFiles = order.file_entries.some(f => f.status === "open");
  
  return hasClosedFiles && hasOpenFiles;
};

interface WorkOrder {
  id: string;
  order_number: string;
  display_order_number?: string | null;
  order_code?: string | null;
  client_name: string;
  created_at: string;
  closed_at: string | null;
  status: string;
  type: string | null;
  kind: string | null;
  total_plates: number;
  created_by_name: string | null;
  file_entries?: FileEntry[];
  priority: number;
  machine_id?: string | null;
}

interface FileEntry {
  id: string;
  filename: string;
  quantity: number;
  plate_format_id: string | null;
  plate_format_name: string | null;
  format_group: string | null;
  status: string;
}

interface MachineSpeed {
  machine_id: string;
  format_group: string;
  base_seconds_per_plate: number;
  avg_seconds_per_plate: number | null;
  sample_count: number;
}

interface JobSession {
  id: string;
  work_order_id: string;
  machine_id: string;
  status: "running" | "paused" | "stopped";
  started_at: string;
  paused_at: string | null;
  total_active_seconds: number;
}

interface ChecklistViewProps {
  orderType: "ctp" | "digital" | "other" | "film" | "large_format";
  onNavigateToSearch?: () => void;
}

type StatusFilter = "open" | "closed" | "all";
type ChecklistSortField = 'order_number' | 'client_name' | 'created_by_name' | 'created_at' | 'closed_at' | 'status' | 'total_plates' | 'priority';
type SortDir = 'asc' | 'desc';

const ChecklistView = ({ orderType, onNavigateToSearch }: ChecklistViewProps) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [machineSpeeds, setMachineSpeeds] = useState<MachineSpeed[]>([]);
  const [jobSessions, setJobSessions] = useState<JobSession[]>([]);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<ChecklistSortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchTerm, setSearchTerm] = useState("");

  const toggleSort = (field: ChecklistSortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortHead = ({ field, label, className = '' }: { field: ChecklistSortField; label: string; className?: string }) => {
    const isActive = sortField === field;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className="flex items-center gap-1 hover:text-foreground transition-colors w-full"
        >
          {label}
          {isActive ? (
            sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
          )}
        </button>
      </TableHead>
    );
  };

  // Fetch machine speeds once
  useEffect(() => {
    if (orderType === "ctp") {
      supabase
        .from("ctp_machine_speeds")
        .select("machine_id, format_group, base_seconds_per_plate, avg_seconds_per_plate, sample_count")
        .then(({ data }) => {
          if (data) setMachineSpeeds(data as MachineSpeed[]);
        });
    }
  }, [orderType]);

  // Fetch active job sessions for CTP
  const fetchJobSessions = async () => {
    if (orderType !== "ctp") return;
    const { data } = await supabase
      .from("ctp_job_sessions")
      .select("*")
      .in("status", ["running", "paused"]);
    if (data) setJobSessions(data as JobSession[]);
  };

  useEffect(() => {
    fetchJobSessions();

    // Subscribe to realtime changes
    if (orderType === "ctp") {
      const channel = supabase
        .channel("ctp-job-sessions")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ctp_job_sessions" },
          () => fetchJobSessions()
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [orderType]);

  const getSessionForOrder = (orderId: string): JobSession | undefined => {
    return jobSessions.find(s => s.work_order_id === orderId && (s.status === "running" || s.status === "paused"));
  };

  const toggleJobSession = async (order: WorkOrder) => {
    if (!order.machine_id) {
      toast({ title: "Greška", description: "Prvo izaberi mašinu", variant: "destructive" });
      return;
    }

    const existingSession = getSessionForOrder(order.id);

    if (!existingSession) {
      // START: first auto-pause any running job on the same machine
      const runningOnMachine = jobSessions.find(s => s.machine_id === order.machine_id && s.status === "running");
      if (runningOnMachine) {
        const elapsed = (Date.now() - new Date(runningOnMachine.started_at).getTime()) / 1000;
        const newActive = Number(runningOnMachine.total_active_seconds) + elapsed;
        await supabase
          .from("ctp_job_sessions")
          .update({ status: "paused", paused_at: new Date().toISOString(), total_active_seconds: newActive, updated_at: new Date().toISOString() } as any)
          .eq("id", runningOnMachine.id);
      }

      // Create new running session
      await supabase.from("ctp_job_sessions").insert({
        work_order_id: order.id,
        machine_id: order.machine_id,
        status: "running",
        started_at: new Date().toISOString(),
      } as any);

      toast({ title: "▶ Posao pokrenut", description: `${displayOrderNumber(order)} na ${order.machine_id === "ctp_1" ? "CTP 1" : "CTP 2"}` });
    } else if (existingSession.status === "running") {
      // PAUSE
      const elapsed = (Date.now() - new Date(existingSession.started_at).getTime()) / 1000;
      const newActive = Number(existingSession.total_active_seconds) + elapsed;
      await supabase
        .from("ctp_job_sessions")
        .update({ status: "paused", paused_at: new Date().toISOString(), total_active_seconds: newActive, updated_at: new Date().toISOString() } as any)
        .eq("id", existingSession.id);

      toast({ title: "⏸ Posao pauziran", description: displayOrderNumber(order) });
    } else if (existingSession.status === "paused") {
      // RESUME: auto-pause any running job on same machine
      const runningOnMachine = jobSessions.find(s => s.machine_id === existingSession.machine_id && s.status === "running");
      if (runningOnMachine) {
        const elapsed = (Date.now() - new Date(runningOnMachine.started_at).getTime()) / 1000;
        const newActive = Number(runningOnMachine.total_active_seconds) + elapsed;
        await supabase
          .from("ctp_job_sessions")
          .update({ status: "paused", paused_at: new Date().toISOString(), total_active_seconds: newActive, updated_at: new Date().toISOString() } as any)
          .eq("id", runningOnMachine.id);
      }

      await supabase
        .from("ctp_job_sessions")
        .update({ status: "running", started_at: new Date().toISOString(), paused_at: null, updated_at: new Date().toISOString() } as any)
        .eq("id", existingSession.id);

      toast({ title: "▶ Posao nastavljen", description: displayOrderNumber(order) });
    }
  };

  const toggleExpanded = (orderId: string) => {
    setExpandedOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchWorkOrders();
  }, [orderType, statusFilter]);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      
      // Build query based on filters
      let query = supabase
        .from("work_orders")
        .select(`
          id,
          order_number,
          display_order_number,
          order_code,
          created_at,
          closed_at,
          status,
          type,
          kind,
          order_type,
          created_by,
          priority,
          machine_id,
          clients!inner(name),
          profiles!work_orders_created_by_fkey(full_name)
        `)
        .eq("order_type", orderType)
        .is("deleted_at", null)
        .is("invalidated_at", null);

      // Apply status filter
      if (statusFilter === "open") {
        query = query.eq("status", "open");
      } else if (statusFilter === "closed") {
        query = query.eq("status", "closed");
      } else {
        // For "all", limit to last 10 days
        const tenDaysAgo = subDays(new Date(), 10).toISOString();
        query = query.gte("created_at", tenDaysAgo);
      }

      const { data: orders, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      // For each work order, fetch file entries and calculate total plates
      const ordersWithDetails = await Promise.all(
        (orders || []).map(async (order) => {
          const { data: files, error: filesError } = await supabase
            .from("file_entries")
            .select(`
              id,
              filename,
              quantity,
              file_type,
              status,
              plate_format_id,
              plate_formats(format_name, format_group)
            `)
            .eq("work_order_id", order.id);

          if (filesError) {
            console.error("Error fetching files:", filesError);
            return {
              id: order.id,
              order_number: order.order_number,
              display_order_number: order.display_order_number,
              order_code: order.order_code,
              client_name: (order.clients as any).name,
              created_at: order.created_at,
              closed_at: order.closed_at,
              status: order.status,
              type: order.type,
              kind: order.kind,
              total_plates: 0,
              created_by_name: (order.profiles as any)?.full_name || null,
              file_entries: [],
              priority: (order as any).priority ?? 5,
              machine_id: (order as any).machine_id || null,
            };
          }

          // Calculate total plates and format file entries
          const fileEntries = (files || []).map((file) => {
            const pf = (file as any).plate_formats;
            const pfName = Array.isArray(pf) ? pf[0]?.format_name : pf?.format_name;
            const pfGroup = Array.isArray(pf) ? pf[0]?.format_group : pf?.format_group;

            return {
              id: file.id,
              filename: file.filename,
              quantity: file.quantity ?? (orderType === "ctp" ? 4 : 0),
              plate_format_id: (file as any).plate_format_id ?? null,
              plate_format_name: pfName || null,
              format_group: pfGroup || null,
              status: file.status || "open",
            } as FileEntry;
          });

          const totalPlates = fileEntries.reduce((sum, file) => sum + file.quantity, 0);

          return {
            id: order.id,
            order_number: order.order_number,
            display_order_number: order.display_order_number,
            order_code: order.order_code,
            client_name: (order.clients as any).name,
            created_at: order.created_at,
            closed_at: order.closed_at,
            status: order.status,
            type: order.type,
            kind: order.kind,
            total_plates: totalPlates,
            created_by_name: (order.profiles as any)?.full_name || null,
            file_entries: fileEntries,
            priority: (order as any).priority ?? 5,
            machine_id: (order as any).machine_id || null,
          };
        })
      );

      setWorkOrders(ordersWithDetails);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      toast({
        title: "Greška",
        description: "Greška pri učitavanju radnih naloga",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const closeWorkOrder = async (workOrderId: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // For film orders, use dedicated function with validation
      if (orderType === "film") {
        const { data, error } = await supabase.rpc("close_film_work_order", {
          p_work_order_id: workOrderId,
          p_user_id: user.id,
        });

        if (error) throw error;
        
        const result = data as { success: boolean; error?: string };
        if (!result?.success) throw new Error(result?.error || "Failed to close film work order");

        toast({
          title: "Uspešno",
          description: "Film nalog je zatvoren",
        });

        fetchWorkOrders();
        return;
      }

      // For digital orders, use dedicated function with validation
      if (orderType === "digital") {
        const { data, error } = await supabase.rpc("close_digital_work_order", {
          p_work_order_id: workOrderId,
          p_user_id: user.id,
        });

        if (error) throw error;
        
        const result = data as { success: boolean; error?: string };
        if (!result?.success) throw new Error(result?.error || "Failed to close digital work order");

        toast({
          title: "Uspešno",
          description: "Digitalni nalog je zatvoren",
        });

        fetchWorkOrders();
        return;
      }

      // For other order types, use standard atomic close function
      const { data, error } = await supabase.rpc("close_work_order_atomic", {
        p_work_order_id: workOrderId,
        p_user_id: user.id,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error || "Failed to close work order");

      // After successful atomic close, send delivery note
      try {
        const { error: deliveryError } = await supabase.functions.invoke(
          "send-delivery-note",
          {
            body: { workOrderId },
          }
        );

        if (deliveryError) throw deliveryError;

        toast({
          title: "Uspešno",
          description: "Radni nalog je zatvoren i otpremnica je poslata",
        });
      } catch (deliveryError) {
        console.error("Error sending delivery note:", deliveryError);
        toast({
          title: "Upozorenje",
          description: "Radni nalog je zatvoren, ali otpremnica nije poslata",
          variant: "destructive",
        });
      }

      fetchWorkOrders();
    } catch (error) {
      console.error("Error closing work order:", error);
      toast({
        title: "Greška",
        description: error instanceof Error ? error.message : "Greška pri zatvaranju radnog naloga",
        variant: "destructive",
      });
    }
  };

  const closeFileEntry = async (fileId: string, workOrderId: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Close this file entry and record who closed it
      const { error } = await supabase
        .from("file_entries")
        .update({ 
          status: "closed",
          closed_by: user.id,
          closed_at: new Date().toISOString()
        })
        .eq("id", fileId);

      if (error) throw error;

      // Check if all file entries for this work order are now closed
      const { data: remainingOpenFiles, error: checkError } = await supabase
        .from("file_entries")
        .select("id")
        .eq("work_order_id", workOrderId)
        .eq("status", "open");

      if (checkError) throw checkError;

      // If no more open files, close the entire work order
      if (!remainingOpenFiles || remainingOpenFiles.length === 0) {
        toast({
          title: "Info",
          description: "Sve stavke su zatvorene, zatvaranje naloga...",
        });

        // Close the work order (this will also send delivery note)
        await closeWorkOrder(workOrderId);
      } else {
        toast({
          title: "Uspešno",
          description: `Fajl je zatvoren. Preostalo još ${remainingOpenFiles.length} otvorenih stavki.`,
        });
        fetchWorkOrders();
      }
    } catch (error) {
      console.error("Error closing file:", error);
      toast({
        title: "Greška",
        description: "Greška pri zatvaranju fajla",
        variant: "destructive",
      });
    }
  };

  const sendDeliveryNote = async (workOrderId: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-delivery-note", {
        body: { workOrderId, resend: true },
      });

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: "Otpremnica je poslata",
      });
    } catch (error: any) {
      console.error("Error sending delivery note:", error);
      toast({
        title: "Greška",
        description: error.message || "Greška pri slanju otpremnice",
        variant: "destructive",
      });
    }
  };

  const updateMachine = async (workOrderId: string, machineId: string) => {
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({ machine_id: machineId } as any)
        .eq("id", workOrderId);

      if (error) throw error;

      setWorkOrders(prev => prev.map(o => o.id === workOrderId ? { ...o, machine_id: machineId } : o));
      toast({ title: "Uspešno", description: `Mašina postavljena na ${machineId === "ctp_1" ? "CTP 1" : "CTP 2"}` });
    } catch (error) {
      console.error("Error updating machine:", error);
      toast({ title: "Greška", description: "Greška pri postavljanju mašine", variant: "destructive" });
    }
  };

  const calculateEta = (order: WorkOrder): { totalSeconds: number; breakdown: { group: string; plates: number; spp: number }[] } | null => {
    if (!order.machine_id || !order.file_entries || order.file_entries.length === 0) return null;

    // Group plates by format_group
    const groupedPlates: Record<string, number> = {};
    for (const file of order.file_entries) {
      const fg = file.format_group || "unknown";
      groupedPlates[fg] = (groupedPlates[fg] || 0) + file.quantity;
    }

    let totalSeconds = 0;
    const breakdown: { group: string; plates: number; spp: number }[] = [];

    for (const [fg, plates] of Object.entries(groupedPlates)) {
      const speed = machineSpeeds.find(s => s.machine_id === order.machine_id && s.format_group === fg);
      if (!speed) continue;
      const spp = speed.avg_seconds_per_plate ?? speed.base_seconds_per_plate;
      totalSeconds += spp * plates;
      breakdown.push({ group: fg, plates, spp });
    }

    return totalSeconds > 0 ? { totalSeconds, breakdown } : null;
  };

  const formatEta = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `~${h}h ${m}min`;
    return `~${m}min`;
  };

  const getStatusBadge = (status: string) => {
    if (status === "closed") {
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Zatvoren
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="gap-1">
        <XCircle className="h-3 w-3" />
        Otvoren
      </Badge>
    );
  };

  const getTypeBadge = (type: string | null, kind?: string | null) => {
    // For large format, show ROLNA or PLOCA based on kind
    if (orderType === "large_format") {
      return <Badge variant="outline">{kind === "PLOCA" ? "Ploča" : "Rolna"}</Badge>;
    }
    
    const label = { 
      ctp: 'CTP', 
      digital: 'Digital', 
      film: 'Film', 
      ostalo: 'Ostalo' 
    }[type?.toLowerCase() ?? ''] ?? 'CTP';
    
    return <Badge variant="outline">{label}</Badge>;
  };

  const openSearchTab = () => {
    if (onNavigateToSearch) {
      onNavigateToSearch();
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return workOrders;
    const term = searchTerm.toLowerCase().trim();
    return workOrders.filter(order => {
      const orderNum = displayOrderNumber(order).toLowerCase();
      if (orderNum.includes(term)) return true;
      if (order.client_name.toLowerCase().includes(term)) return true;
      if (order.created_by_name?.toLowerCase().includes(term)) return true;
      if (order.file_entries?.some(f => f.filename.toLowerCase().includes(term))) return true;
      return false;
    });
  }, [workOrders, searchTerm]);

  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'order_number':
          return dir * (Number(a.order_number) - Number(b.order_number));
        case 'client_name':
          return dir * a.client_name.localeCompare(b.client_name, 'sr');
        case 'created_by_name':
          return dir * (a.created_by_name || '').localeCompare(b.created_by_name || '', 'sr');
        case 'created_at':
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'closed_at':
          return dir * ((a.closed_at ? new Date(a.closed_at).getTime() : 0) - (b.closed_at ? new Date(b.closed_at).getTime() : 0));
        case 'status':
          return dir * a.status.localeCompare(b.status, 'sr');
        case 'total_plates':
          return dir * (a.total_plates - b.total_plates);
        case 'priority':
          return dir * (a.priority - b.priority);
        default:
          return 0;
      }
    });
    return list;
  }, [filteredOrders, sortField, sortDir]);

  if (loading) {
    return <div className="p-4 text-center">Učitavanje...</div>;
  }

  // Mobile card component for work orders
  const MobileOrderCard = ({ order }: { order: WorkOrder }) => {
    const isExpanded = expandedOrderIds.has(order.id);
    const hasFiles = order.file_entries && order.file_entries.length > 0;

    return (
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {hasFiles && (
                  <button
                    onClick={() => toggleExpanded(order.id)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                )}
                <PriorityBadge priority={order.priority} size="sm" />
                <p className="font-semibold text-sm truncate">
                  {displayOrderNumber(order)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground truncate">{order.client_name}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {getStatusBadge(order.status)}
              {getTypeBadge(order.type, order.kind)}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(order.created_at), "dd.MM.yyyy")}
            </div>
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {order.created_by_name || "-"}
            </div>
            {orderType === "ctp" && (() => {
              const formats = [...new Set((order.file_entries || []).map(f => f.plate_format_name).filter(Boolean))];
              return formats.length > 0 ? (
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground text-xs">
                    {formats.join(", ")}
                  </span>
                </div>
              ) : null;
            })()}
            {orderType === "ctp" && (() => {
              const remaining = (order.file_entries || [])
                .filter(f => f.status === "open")
                .reduce((sum, f) => sum + f.quantity, 0);
              const total = order.total_plates;
              return (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    Ploče: {total}
                    {order.status === "open" && remaining < total && (
                      <span className="text-muted-foreground font-normal">/{remaining}</span>
                    )}
                  </span>
                </div>
              );
            })()}
            {orderType === "ctp" && (
              <div>
                <div className="flex items-center gap-1">
                  <Select
                    value={order.machine_id || ""}
                    onValueChange={(val) => updateMachine(order.id, val)}
                  >
                    <SelectTrigger className="w-[90px] h-7 text-xs">
                      <SelectValue placeholder="Mašina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ctp_1">CTP 1</SelectItem>
                      <SelectItem value="ctp_2">CTP 2</SelectItem>
                    </SelectContent>
                  </Select>
                  {order.machine_id && order.status === "open" && (() => {
                    const session = getSessionForOrder(order.id);
                    const isRunning = session?.status === "running";
                    const isPaused = session?.status === "paused";
                    return (
                      <button
                        onClick={() => toggleJobSession(order)}
                        className={`p-1 rounded-full transition-all ${
                          isRunning
                            ? "bg-green-500/20 text-green-600 animate-pulse"
                            : isPaused
                            ? "bg-yellow-500/20 text-yellow-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </button>
                    );
                  })()}
                </div>
                {(() => {
                  const eta = calculateEta(order);
                  if (!eta) return null;
                  return (
                    <span className="text-[10px] text-muted-foreground ml-1 font-medium">
                      {formatEta(eta.totalSeconds)}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Expanded file entries */}
          {isExpanded && hasFiles && (
            <div className="mb-3 space-y-2 bg-muted/30 rounded-lg p-2">
              {order.file_entries!.map((file) => (
                <div key={file.id} className="flex items-center justify-between gap-2 p-2 bg-background rounded border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.filename}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {file.plate_format_name && (
                        <span>Format: {file.plate_format_name}</span>
                      )}
                      <span>Količina: {file.quantity}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(file.status)}
                    {file.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => closeFileEntry(file.id, order.id)}
                      >
                        Zatvori Fajl
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap items-center">
            {isOrderInProgress(order) && (
              <InProgressIndicator className="mr-1" />
            )}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => navigate(`/work-orders/${order.id}`)}
              title="Pogledaj nalog"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {order.status === "open" && (
              <Button size="sm" className="flex-1" onClick={() => closeWorkOrder(order.id)}>
                Zatvori Nalog
              </Button>
            )}
            {order.status === "closed" && (
              <Button size="sm" variant="outline" className="flex-1" onClick={() => sendDeliveryNote(order.id)}>
                <FileText className="h-3 w-3 mr-1" />
                Otpremnica
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Desktop table row with expandable files
  const DesktopOrderRow = ({ order }: { order: WorkOrder }) => {
    const isExpanded = expandedOrderIds.has(order.id);
    const hasFiles = order.file_entries && order.file_entries.length > 0;
    const columnCount = orderType === "ctp" ? 13 : 9;

    return (
      <>
        <TableRow className="hover:bg-muted/50">
          <TableCell className="w-6 px-1">
            {hasFiles ? (
              <button
                onClick={() => toggleExpanded(order.id)}
                className="p-0.5 hover:bg-muted rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-4 inline-block" />
            )}
          </TableCell>
          <TableCell className="font-medium px-2 whitespace-nowrap">
            {displayOrderNumber(order)}
          </TableCell>
          <TableCell className="px-2">{order.client_name}</TableCell>
          <TableCell className="text-muted-foreground px-2">{order.created_by_name || "-"}</TableCell>
          <TableCell className="px-2">{getTypeBadge(order.type, order.kind)}</TableCell>
          <TableCell className="px-2 whitespace-nowrap">
            {format(new Date(order.created_at), "dd.MM.yyyy HH:mm")}
          </TableCell>
          <TableCell>
            {order.closed_at
              ? format(new Date(order.closed_at), "dd.MM.yyyy HH:mm")
              : "-"}
          </TableCell>
          <TableCell>{getStatusBadge(order.status)}</TableCell>
          {orderType === "ctp" && (
            <TableCell className="text-xs">
              {(() => {
                const formats = [...new Set((order.file_entries || []).map(f => f.plate_format_name).filter(Boolean))];
                return formats.length > 0 ? formats.join(", ") : "-";
              })()}
            </TableCell>
          )}
          {orderType === "ctp" && (() => {
            const remaining = (order.file_entries || [])
              .filter(f => f.status === "open")
              .reduce((sum, f) => sum + f.quantity, 0);
            const total = order.total_plates;
            return (
              <TableCell className="font-semibold">
                <span>{total}</span>
                {order.status === "open" && remaining < total && (
                  <span className="text-muted-foreground font-normal">
                    /{remaining}
                  </span>
                )}
              </TableCell>
            );
          })()}
          {orderType === "ctp" && (
            <TableCell>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Select
                    value={order.machine_id || ""}
                    onValueChange={(val) => updateMachine(order.id, val)}
                  >
                    <SelectTrigger className="w-[110px] h-8 text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ctp_1">CTP 1</SelectItem>
                      <SelectItem value="ctp_2">CTP 2</SelectItem>
                    </SelectContent>
                  </Select>
                  {order.machine_id && order.status === "open" && (() => {
                    const session = getSessionForOrder(order.id);
                    const isRunning = session?.status === "running";
                    const isPaused = session?.status === "paused";
                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => toggleJobSession(order)}
                              className={`p-1.5 rounded-full transition-all ${
                                isRunning
                                  ? "bg-green-500/20 text-green-600 hover:bg-green-500/30 ring-2 ring-green-500/40 animate-pulse"
                                  : isPaused
                                  ? "bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30 ring-2 ring-yellow-500/40"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isRunning ? "Pauziraj posao" : isPaused ? "Nastavi posao" : "Pokreni posao"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })()}
                </div>
                {(() => {
                  const eta = calculateEta(order);
                  const session = getSessionForOrder(order.id);
                  if (!eta && !session) return null;
                  return (
                    <div className="text-xs text-muted-foreground">
                      {eta && (
                        <span className="font-medium text-foreground">{formatEta(eta.totalSeconds)}</span>
                      )}
                      {session && (
                        <span className={`ml-1 text-[10px] ${session.status === "running" ? "text-green-600" : "text-yellow-600"}`}>
                          ({session.status === "running" ? "radi" : "pauz."} {Math.round(Number(session.total_active_seconds) / 60)}m)
                        </span>
                      )}
                      {eta && eta.breakdown.length > 1 && (
                        <div className="text-[10px] leading-tight mt-0.5">
                          {eta.breakdown.map(b => `${b.group}: ${b.plates}pl`).join(", ")}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </TableCell>
          )}
          <TableCell className="text-right">
            <div className="flex gap-2 justify-end items-center">
              {isOrderInProgress(order) && (
                <InProgressIndicator className="mr-1" />
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/work-orders/${order.id}`)}
                title="Pogledaj nalog"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {order.status === "open" && (
                <Button
                  size="sm"
                  onClick={() => closeWorkOrder(order.id)}
                >
                  Zatvori Nalog
                </Button>
              )}
              {order.status === "closed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendDeliveryNote(order.id)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Pošalji Otpremnicu
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
        
        {/* Expanded file entries row */}
        {isExpanded && hasFiles && order.file_entries!.map((file) => (
          <TableRow key={file.id} className="bg-muted/30">
            <TableCell></TableCell>
            <TableCell colSpan={2} className="pl-8">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{file.filename}</span>
              </div>
            </TableCell>
            <TableCell>
              {file.plate_format_name ? `Format: ${file.plate_format_name}` : "-"}
            </TableCell>
            <TableCell>
              Količina: {file.quantity}
            </TableCell>
            <TableCell colSpan={2}></TableCell>
            <TableCell>{getStatusBadge(file.status)}</TableCell>
            {orderType === "ctp" && <TableCell></TableCell>}
            {orderType === "ctp" && <TableCell></TableCell>}
            <TableCell className="text-right">
              {file.status === "open" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => closeFileEntry(file.id, order.id)}
                >
                  Zatvori Fajl
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </>
    );
  };

  return (
    <div className="mt-4">
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <span className="text-xs md:text-sm font-medium">Status:</span>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[130px] md:w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Otvoreni</SelectItem>
              <SelectItem value="closed">Zatvoreni</SelectItem>
              <SelectItem value="all">Svi (10 dana)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openSearchTab} size={isMobile ? "sm" : "default"} className="gap-2">
          <Search className="h-4 w-4" />
          <span className="hidden md:inline">Pretraga i Statistika</span>
          <span className="md:hidden">Statistika</span>
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pretraži po broju naloga, klijentu, fajlu..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {workOrders.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          Nema radnih naloga
        </div>
      ) : isMobile ? (
        // Mobile: Card-based layout
        <div className="space-y-3">
          {sortedOrders.map((order) => (
            <MobileOrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        // Desktop: Table layout with expandable rows
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-6 px-1"></TableHead>
              <SortHead field="order_number" label="Br. Naloga" className="px-2" />
              <SortHead field="client_name" label="Klijent" className="px-2" />
              <SortHead field="created_by_name" label="Kreirao" className="px-2" />
              <TableHead className="px-2">Tip</TableHead>
              <SortHead field="created_at" label="Otvoreno" className="px-2" />
              <SortHead field="closed_at" label="Zatvoreno" className="px-2" />
              <SortHead field="status" label="Status" className="px-2" />
              {orderType === "ctp" && <TableHead className="px-2">Format</TableHead>}
              {orderType === "ctp" && <SortHead field="total_plates" label="Ploče" className="px-2" />}
              {orderType === "ctp" && <TableHead className="px-2">Mašina</TableHead>}
              <TableHead className="text-right px-2">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedOrders.map((order) => (
              <DesktopOrderRow key={order.id} order={order} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default ChecklistView;
