import { useEffect, useState } from "react";
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
import { CheckCircle, XCircle, Search, FileText, Calendar, User, Eye, ChevronRight, ChevronDown } from "lucide-react";
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

interface ChecklistViewProps {
  orderType: "ctp" | "digital" | "other" | "film" | "large_format";
  onNavigateToSearch?: () => void;
}

type StatusFilter = "open" | "closed" | "all";

const ChecklistView = ({ orderType, onNavigateToSearch }: ChecklistViewProps) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [machineSpeeds, setMachineSpeeds] = useState<MachineSpeed[]>([]);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

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
        .is("deleted_at", null);

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
            {orderType === "ctp" && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Ploče: {order.total_plates}</span>
              </div>
            )}
            {orderType === "ctp" && (
              <div>
                <Select
                  value={order.machine_id || ""}
                  onValueChange={(val) => updateMachine(order.id, val)}
                >
                  <SelectTrigger className="w-[100px] h-7 text-xs">
                    <SelectValue placeholder="Mašina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ctp_1">CTP 1</SelectItem>
                    <SelectItem value="ctp_2">CTP 2</SelectItem>
                  </SelectContent>
                </Select>
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
    const columnCount = orderType === "ctp" ? 12 : 9;

    return (
      <>
        <TableRow className="hover:bg-muted/50">
          <TableCell className="w-8">
            {hasFiles ? (
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
            ) : (
              <span className="w-6 inline-block" />
            )}
          </TableCell>
          <TableCell className="font-medium">
            {displayOrderNumber(order)}
          </TableCell>
          <TableCell>{order.client_name}</TableCell>
          <TableCell className="text-muted-foreground">{order.created_by_name || "-"}</TableCell>
          <TableCell>{getTypeBadge(order.type, order.kind)}</TableCell>
          <TableCell>
            {format(new Date(order.created_at), "dd.MM.yyyy HH:mm")}
          </TableCell>
          <TableCell>
            {order.closed_at
              ? format(new Date(order.closed_at), "dd.MM.yyyy HH:mm")
              : "-"}
          </TableCell>
          <TableCell>{getStatusBadge(order.status)}</TableCell>
          {orderType === "ctp" && (
            <TableCell className="font-semibold">{order.total_plates}</TableCell>
          )}
          {orderType === "ctp" && (
            <TableCell>
              <div className="space-y-1">
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
                {(() => {
                  const eta = calculateEta(order);
                  if (!eta) return null;
                  return (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{formatEta(eta.totalSeconds)}</span>
                      {eta.breakdown.length > 1 && (
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
          <span className="md:hidden">Pretraga</span>
        </Button>
      </div>

      {workOrders.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          Nema radnih naloga
        </div>
      ) : isMobile ? (
        // Mobile: Card-based layout
        <div className="space-y-3">
          {workOrders.map((order) => (
            <MobileOrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        // Desktop: Table layout with expandable rows
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Broj Naloga</TableHead>
              <TableHead>Klijent</TableHead>
              <TableHead>Kreirao</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Datum Otvaranja</TableHead>
              <TableHead>Datum Zatvaranja</TableHead>
              <TableHead>Status</TableHead>
              {orderType === "ctp" && <TableHead>Broj Ploča</TableHead>}
              {orderType === "ctp" && <TableHead>Mašina</TableHead>}
              <TableHead className="text-right">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.map((order) => (
              <DesktopOrderRow key={order.id} order={order} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default ChecklistView;
