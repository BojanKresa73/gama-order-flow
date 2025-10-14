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
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface WorkOrder {
  id: string;
  order_number: string;
  client_name: string;
  created_at: string;
  closed_at: string | null;
  status: string;
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
  orderType: "ctp" | "digital" | "other";
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
          created_at,
          closed_at,
          status,
          order_type,
          clients!inner(name)
        `)
        .eq("order_type", orderType)
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
              plate_formats(format_name)
            `)
            .eq("work_order_id", order.id);

          if (filesError) {
            console.error("Error fetching files:", filesError);
            return {
              id: order.id,
              order_number: order.order_number,
              client_name: order.clients.name,
              created_at: order.created_at,
              closed_at: order.closed_at,
              status: order.status,
              total_plates: 0,
              file_entries: [],
            };
          }

          // Calculate total plates and format file entries
          const fileEntries = (files || []).map((file) => ({
            id: file.id,
            filename: file.filename,
            quantity: file.quantity || 0,
            plate_format_name: file.plate_formats?.format_name || null,
            status: "open", // TODO: Add actual status from file_entries table
          }));

          const totalPlates = fileEntries.reduce((sum, file) => sum + file.quantity, 0);

          return {
            id: order.id,
            order_number: order.order_number,
            client_name: order.clients.name,
            created_at: order.created_at,
            closed_at: order.closed_at,
            status: order.status,
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
      const { error } = await supabase
        .from("work_orders")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
        })
        .eq("id", workOrderId);

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: "Radni nalog je zatvoren",
      });

      fetchWorkOrders();
    } catch (error) {
      console.error("Error closing work order:", error);
      toast({
        title: "Greška",
        description: "Greška pri zatvaranju radnog naloga",
        variant: "destructive",
      });
    }
  };

  const closeFileEntry = async (fileId: string, workOrderId: string) => {
    try {
      // TODO: Implement file-specific closure logic
      // This might require adding a status field to file_entries table
      toast({
        title: "U razvoju",
        description: "Zatvaranje pojedinačnih fajlova će biti implementirano uskoro",
      });
    } catch (error) {
      console.error("Error closing file:", error);
      toast({
        title: "Greška",
        description: "Greška pri zatvaranju fajla",
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

  if (loading) {
    return <div className="p-4 text-center">Učitavanje...</div>;
  }

  if (workOrders.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Nema radnih naloga za ovaj tip
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Broj Naloga</TableHead>
            <TableHead>Klijent</TableHead>
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
                <TableCell className="font-medium">{order.order_number}</TableCell>
                <TableCell>{order.client_name}</TableCell>
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
                  {order.status === "open" && (
                    <Button
                      size="sm"
                      onClick={() => closeWorkOrder(order.id)}
                    >
                      Zatvori Nalog
                    </Button>
                  )}
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
    </div>
  );
};

export default ChecklistView;
