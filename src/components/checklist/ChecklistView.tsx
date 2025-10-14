import { useEffect, useState, useMemo } from "react";
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
import ChecklistStats from "./ChecklistStats";
import ChecklistFilters from "./ChecklistFilters";

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

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
              status,
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
            quantity: file.quantity ?? (orderType === "ctp" ? 4 : 0),
            plate_format_name: file.plate_formats?.format_name || null,
            status: file.status || "open",
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

  // Get unique clients and formats for filters
  const uniqueClients = useMemo(() => {
    return Array.from(new Set(workOrders.map((order) => order.client_name))).sort();
  }, [workOrders]);

  const uniqueFormats = useMemo(() => {
    if (orderType !== "ctp") return [];
    const formats = new Set<string>();
    workOrders.forEach((order) => {
      order.file_entries?.forEach((file) => {
        if (file.plate_format_name) {
          formats.add(file.plate_format_name);
        }
      });
    });
    return Array.from(formats).sort();
  }, [workOrders, orderType]);

  // Filter and search logic
  const filteredOrders = useMemo(() => {
    return workOrders.filter((order) => {
      // Search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesOrderNumber = order.order_number.toLowerCase().includes(searchLower);
        const matchesFileName = order.file_entries?.some((file) =>
          file.filename.toLowerCase().includes(searchLower)
        );
        if (!matchesOrderNumber && !matchesFileName) return false;
      }

      // Client filter
      if (selectedClient !== "all" && order.client_name !== selectedClient) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "all" && order.status !== selectedStatus) {
        return false;
      }

      // Format filter (CTP only)
      if (orderType === "ctp" && selectedFormat !== "all") {
        const hasFormat = order.file_entries?.some(
          (file) => file.plate_format_name === selectedFormat
        );
        if (!hasFormat) return false;
      }

      // Date from filter
      if (dateFrom) {
        const orderDate = new Date(order.created_at);
        const fromDate = new Date(dateFrom);
        if (orderDate < fromDate) return false;
      }

      // Date to filter
      if (dateTo) {
        const orderDate = new Date(order.created_at);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // Include the entire day
        if (orderDate > toDate) return false;
      }

      return true;
    });
  }, [workOrders, searchTerm, selectedClient, selectedFormat, selectedStatus, dateFrom, dateTo, orderType]);

  // Calculate statistics
  const stats = useMemo(() => {
    const openOrders = filteredOrders.filter((o) => o.status === "open").length;
    const closedOrders = filteredOrders.filter((o) => o.status === "closed").length;
    const totalPlates = filteredOrders.reduce((sum, order) => sum + order.total_plates, 0);

    return {
      totalOrders: filteredOrders.length,
      openOrders,
      closedOrders,
      totalPlates,
    };
  }, [filteredOrders]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedClient("all");
    setSelectedFormat("all");
    setSelectedStatus("all");
    setDateFrom("");
    setDateTo("");
  };

  if (loading) {
    return <div className="p-4 text-center">Učitavanje...</div>;
  }

  return (
    <div className="mt-4">
      <ChecklistStats
        totalOrders={stats.totalOrders}
        openOrders={stats.openOrders}
        closedOrders={stats.closedOrders}
        totalPlates={stats.totalPlates}
        orderType={orderType}
      />

      <ChecklistFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedClient={selectedClient}
        onClientChange={setSelectedClient}
        selectedFormat={selectedFormat}
        onFormatChange={setSelectedFormat}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        clients={uniqueClients}
        formats={uniqueFormats}
        onClearFilters={clearFilters}
        orderType={orderType}
      />

      {filteredOrders.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          Nema radnih naloga koji odgovaraju filterima
        </div>
      ) : (
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
          {filteredOrders.map((order) => (
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
      )}
    </div>
  );
};

export default ChecklistView;
