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
import { CheckCircle, XCircle, Search, FileText, Calendar, User, Eye } from "lucide-react";
import { PriorityBadge } from "@/components/priority/PriorityBadge";
import { format, subDays } from "date-fns";
import { displayOrderNumber } from "@/lib/orderLabel";
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
}

interface FileEntry {
  id: string;
  filename: string;
  quantity: number;
  plate_format_id: string | null;
  plate_format_name: string | null;
  status: string;
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
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

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
              plate_formats(format_name)
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
            };
          }

          // Calculate total plates and format file entries
          const fileEntries = (files || []).map((file) => {
            const pf = (file as any).plate_formats;
            const pfName = Array.isArray(pf) ? pf[0]?.format_name : pf?.format_name;

            return {
              id: file.id,
              filename: file.filename,
              quantity: file.quantity ?? (orderType === "ctp" ? 4 : 0),
              plate_format_id: (file as any).plate_format_id ?? null,
              plate_format_name: pfName || null,
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
        body: { workOrderId },
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
  const MobileOrderCard = ({ order }: { order: WorkOrder }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
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
            <div className="col-span-2">
              <span className="font-medium text-foreground">Ploče: {order.total_plates}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
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
              Zatvori
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
        // Desktop: Table layout
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">P</TableHead>
              <TableHead>Broj Naloga</TableHead>
              <TableHead>Klijent</TableHead>
              <TableHead>Kreirao</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Datum Otvaranja</TableHead>
              <TableHead>Datum Zatvaranja</TableHead>
              <TableHead>Status</TableHead>
              {orderType === "ctp" && <TableHead>Broj Ploča</TableHead>}
              <TableHead className="text-right">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.map((order) => (
              <TableRow key={order.id} className="hover:bg-muted/50">
                <TableCell>
                  <PriorityBadge priority={order.priority} size="sm" />
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
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
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
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default ChecklistView;
