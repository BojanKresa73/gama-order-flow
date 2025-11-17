import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChecklistStats from "./ChecklistStats";
import ChecklistFilters from "./ChecklistFilters";
import { useEffect } from "react";

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
  order_type: string;
  file_entries?: FileEntry[];
}

interface FileEntry {
  id: string;
  filename: string;
  quantity: number;
  plate_format_name: string | null;
  status: string;
}

const SearchAndStats = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ctp");

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetchAllWorkOrders();
  }, []);

  const fetchAllWorkOrders = async () => {
    try {
      setLoading(true);
      
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
        .order("created_at", { ascending: false });

      if (error) throw error;

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
              order_type: order.order_type,
              total_plates: 0,
              file_entries: [],
            };
          }

          const fileEntries = (files || []).map((file) => ({
            id: file.id,
            filename: file.filename,
            quantity: file.quantity ?? (order.order_type === "ctp" ? 4 : 0),
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
            order_type: order.order_type,
            total_plates: totalPlates,
            file_entries: fileEntries,
          };
        })
      );

      setWorkOrders(ordersWithDetails);
    } catch (error) {
      console.error("Error fetching work orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getOrdersByType = (type: string) => {
    return workOrders.filter((order) => order.order_type === type);
  };

  const uniqueClients = useMemo(() => {
    const orders = getOrdersByType(activeTab);
    return Array.from(new Set(orders.map((order) => order.client_name))).sort();
  }, [workOrders, activeTab]);

  const uniqueFormats = useMemo(() => {
    if (activeTab !== "ctp") return [];
    const orders = getOrdersByType(activeTab);
    const formats = new Set<string>();
    orders.forEach((order) => {
      order.file_entries?.forEach((file) => {
        if (file.plate_format_name) {
          formats.add(file.plate_format_name);
        }
      });
    });
    return Array.from(formats).sort();
  }, [workOrders, activeTab]);

  const filteredOrders = useMemo(() => {
    const ordersByType = getOrdersByType(activeTab);
    
    return ordersByType.filter((order) => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesOrderNumber = order.order_number.toLowerCase().includes(searchLower);
        const matchesFileName = order.file_entries?.some((file) =>
          file.filename.toLowerCase().includes(searchLower)
        );
        if (!matchesOrderNumber && !matchesFileName) return false;
      }

      if (selectedClient !== "all" && order.client_name !== selectedClient) {
        return false;
      }

      if (selectedStatus !== "all" && order.status !== selectedStatus) {
        return false;
      }

      if (activeTab === "ctp" && selectedFormat !== "all") {
        const hasFormat = order.file_entries?.some(
          (file) => file.plate_format_name === selectedFormat
        );
        if (!hasFormat) return false;
      }

      if (dateFrom) {
        const orderDate = new Date(order.created_at);
        const fromDate = new Date(dateFrom);
        if (orderDate < fromDate) return false;
      }

      if (dateTo) {
        const orderDate = new Date(order.created_at);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (orderDate > toDate) return false;
      }

      return true;
    });
  }, [workOrders, activeTab, searchTerm, selectedClient, selectedFormat, selectedStatus, dateFrom, dateTo]);

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="ctp">CTP Usluge</TabsTrigger>
          <TabsTrigger value="digital">Digitalna Štampa</TabsTrigger>
          <TabsTrigger value="other">Ostale Usluge</TabsTrigger>
        </TabsList>

        <TabsContent value="ctp">
          <ChecklistStats
            totalOrders={stats.totalOrders}
            openOrders={stats.openOrders}
            closedOrders={stats.closedOrders}
            totalPlates={stats.totalPlates}
            orderType="ctp"
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
            orderType="ctp"
          />
        </TabsContent>

        <TabsContent value="digital">
          <ChecklistStats
            totalOrders={stats.totalOrders}
            openOrders={stats.openOrders}
            closedOrders={stats.closedOrders}
            totalPlates={stats.totalPlates}
            orderType="digital"
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
            orderType="digital"
          />
        </TabsContent>

        <TabsContent value="other">
          <ChecklistStats
            totalOrders={stats.totalOrders}
            openOrders={stats.openOrders}
            closedOrders={stats.closedOrders}
            totalPlates={stats.totalPlates}
            orderType="other"
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
            orderType="other"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SearchAndStats;
