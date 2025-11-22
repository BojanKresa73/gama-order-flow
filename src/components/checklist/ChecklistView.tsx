import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Search, FileText } from "lucide-react";
import { format } from "date-fns";
import { prefixFor } from "@/lib/orderLabel";

interface WorkOrder {
  id: string;
  order_number: string;
  order_code?: string | null;
  client_name: string;
  created_at: string;
  closed_at: string | null;
  status: string;
  type: string | null;
  total_plates: number;
  file_entries?: FileEntry[];
}

interface FileEntry {
  id: string;
  filename: string;
  quantity: number;
  plate_format_name: string | null;
  status: string;
}

interface ChecklistViewProps {
  orderType: "ctp" | "digital" | "other" | "film";
}

const ChecklistView = ({ orderType }: ChecklistViewProps) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkOrders();
  }, [orderType]);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch work orders based on type
      const { data: orders, error } = await supabase
        .from("work_orders")
        .select(`
          id,
          order_number,
          order_code,
          created_at,
          closed_at,
          status,
          type,
          order_type,
          clients!inner(name)
        `)
        .eq("order_type", orderType)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

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
              plate_formats(format_name)
            `)
            .eq("work_order_id", order.id);

          if (filesError) {
            console.error("Error fetching files:", filesError);
            return {
              id: order.id,
              order_number: order.order_number,
              order_code: order.order_code,
              client_name: order.clients.name,
              created_at: order.created_at,
              closed_at: order.closed_at,
              status: order.status,
              type: order.type,
              total_plates: 0,
              file_entries: [],
            };
          }

          // Calculate total plates and format file entries
          const fileEntries = (files || []).map((file) => ({
            id: file.id,
            filename: file.filename,
            quantity: file.quantity ?? (orderType === "ctp" ? 4 : 0),
            plate_format_name: file.plate_formats?.format_name || null,
            status: file.status || "open",
          }));

          const totalPlates = fileEntries.reduce((sum, file) => sum + file.quantity, 0);

          return {
            id: order.id,
            order_number: order.order_number,
            order_code: order.order_code,
            client_name: order.clients.name,
            created_at: order.created_at,
            closed_at: order.closed_at,
            status: order.status,
            type: order.type,
            total_plates: totalPlates,
            file_entries: fileEntries,
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

  const toggleExpand = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
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
      const { error } = await supabase
        .from("file_entries")
        .update({ status: "closed" })
        .eq("id", fileId);

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: "Fajl je zatvoren",
      });

      fetchWorkOrders();
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

  const getTypeBadge = (type: string | null) => {
    const label = { 
      ctp: 'CTP', 
      digital: 'Digital', 
      film: 'Film', 
      ostalo: 'Ostalo' 
    }[type?.toLowerCase() ?? ''] ?? 'CTP';
    
    return <Badge variant="outline">{label}</Badge>;
  };

  const openSearchTab = () => {
    const tabsTrigger = document.querySelector('[value="search"]') as HTMLElement;
    if (tabsTrigger) {
      tabsTrigger.click();
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Učitavanje...</div>;
  }

  return (
    <div className="mt-4">
      <div className="mb-6 flex justify-end">
        <Button onClick={openSearchTab} className="gap-2">
          <Search className="h-4 w-4" />
          Pretraga i Statistika
        </Button>
      </div>

      {workOrders.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          Nema radnih naloga
        </div>
      ) : (
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Broj Naloga</TableHead>
            <TableHead>Klijent</TableHead>
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
            <>
              <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell onClick={() => toggleExpand(order.id)}>
                  {orderType === "ctp" && order.file_entries && order.file_entries.length > 0 && (
                    expandedOrders.has(order.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {order.order_code || (() => {
                    const year = new Date(order.created_at).getFullYear();
                    const serial = String(order.order_number).padStart(4, '0');
                    return `${prefixFor(order.type)}-${year}-${serial}`;
                  })()}
                </TableCell>
                <TableCell>{order.client_name}</TableCell>
                <TableCell>{getTypeBadge(order.type)}</TableCell>
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

              {/* Expanded file entries for CTP orders */}
              {orderType === "ctp" &&
                expandedOrders.has(order.id) &&
                order.file_entries &&
                order.file_entries.map((file) => (
                  <TableRow key={file.id} className="bg-muted/30">
                    <TableCell></TableCell>
                    <TableCell colSpan={2} className="pl-8">
                      <span className="text-sm text-muted-foreground">
                        📄 {file.filename}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        Format: {file.plate_format_name || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        Količina: {file.quantity}
                      </span>
                    </TableCell>
                    <TableCell colSpan={orderType === "ctp" ? 1 : 2}>
                      {getStatusBadge(file.status)}
                    </TableCell>
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
          ))}
        </TableBody>
      </Table>
      )}
    </div>
  );
};

export default ChecklistView;
