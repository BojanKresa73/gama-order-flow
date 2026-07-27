import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Receipt, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import ChecklistStats from "./ChecklistStats";
import ChecklistFilters from "./ChecklistFilters";
import WorkerProductivityStats from "./WorkerProductivityStats";
import { useAuthz } from "@/hooks/useAuthz";
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
  total_plates: number;
  order_type: string;
  invoiced_at: string | null;
  invoice_number: string | null;
  created_by: string | null;
  created_by_name: string | null;
  closed_by: string | null;
  closed_by_name: string | null;
  file_entries?: FileEntry[];
}

interface FileEntry {
  id: string;
  filename: string;
  quantity: number;
  plate_format_name: string | null;
  status: string;
}

interface Worker {
  id: string;
  name: string;
}

const SearchAndStats = () => {
  const navigate = useNavigate();
  const { isSuper, isAdmin } = useAuthz();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try { return sessionStorage.getItem("searchAndStats:activeTab") || "ctp"; } catch { return "ctp"; }
  });

  // Filter states – persisted in sessionStorage so they survive navigation back from order details
  const SS_KEY = "searchAndStats:filters";
  const initialFilters = (() => {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {} as Record<string, string>;
  })();

  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm || "");
  const [fileNameFilter, setFileNameFilter] = useState(initialFilters.fileNameFilter || "");
  const [selectedClient, setSelectedClient] = useState(initialFilters.selectedClient || "all");
  const [selectedFormat, setSelectedFormat] = useState(initialFilters.selectedFormat || "all");
  const [selectedStatus, setSelectedStatus] = useState(initialFilters.selectedStatus || "all");
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState(initialFilters.selectedInvoiceStatus || "all");
  const [selectedCreatedBy, setSelectedCreatedBy] = useState(initialFilters.selectedCreatedBy || "all");
  const [selectedClosedBy, setSelectedClosedBy] = useState(initialFilters.selectedClosedBy || "all");
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom || "");
  const [dateTo, setDateTo] = useState(initialFilters.dateTo || "");

  // Persist tab + filters
  useEffect(() => {
    try { sessionStorage.setItem("searchAndStats:activeTab", activeTab); } catch {}
  }, [activeTab]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({
        searchTerm, fileNameFilter, selectedClient, selectedFormat, selectedStatus,
        selectedInvoiceStatus, selectedCreatedBy, selectedClosedBy, dateFrom, dateTo,
      }));
    } catch {}
  }, [searchTerm, fileNameFilter, selectedClient, selectedFormat, selectedStatus, selectedInvoiceStatus, selectedCreatedBy, selectedClosedBy, dateFrom, dateTo]);

  useEffect(() => {
    fetchAllWorkOrders();
    fetchWorkers();
  }, []);

  // Users to exclude from productivity stats (management)
  const excludedFromProductivity = ["Natalija Kresovic", "Bojan Kresović"];

  const fetchWorkers = async () => {
    try {
      // Fetch profiles with their roles, excluding client_user role (portal users)
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .not("full_name", "is", null)
        .order("full_name");

      if (profilesError) throw profilesError;

      // Fetch user roles to filter out client_user
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Create a set of client_user IDs to exclude
      const clientUserIds = new Set(
        (rolesData || [])
          .filter((r) => r.role === "client_user")
          .map((r) => r.user_id)
      );

      // Filter out client_user profiles from workers list
      setWorkers(
        (profilesData || [])
          .filter((p) => p.full_name && !clientUserIds.has(p.id))
          .map((p) => ({ id: p.id, name: p.full_name! }))
      );
    } catch (error) {
      console.error("Error fetching workers:", error);
    }
  };

  const fetchAllWorkOrders = async () => {
    try {
      setLoading(true);
      
      const { data: orders, error } = await supabase
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
          order_type,
          invoiced_at,
          invoice_number,
          created_by,
          closed_by,
          clients!inner(name),
          profiles!work_orders_created_by_fkey(full_name)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(0, 49999);

      if (error) throw error;

      // Fetch closed_by names separately
      const closedByIds = [...new Set((orders || []).map(o => o.closed_by).filter(Boolean))];
      const closedByMap = new Map<string, string>();
      
      if (closedByIds.length > 0) {
        const { data: closerProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", closedByIds);
        
        (closerProfiles || []).forEach((p) => {
          if (p.full_name) closedByMap.set(p.id, p.full_name);
        });
      }

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
              display_order_number: order.display_order_number,
              order_code: order.order_code,
              client_name: order.clients.name,
              created_at: order.created_at,
              closed_at: order.closed_at,
              status: order.status,
              type: order.type,
              order_type: order.order_type,
              invoiced_at: order.invoiced_at,
              invoice_number: order.invoice_number,
              created_by: order.created_by,
              created_by_name: order.profiles?.full_name || null,
              closed_by: order.closed_by,
              closed_by_name: order.closed_by ? closedByMap.get(order.closed_by) || null : null,
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
            display_order_number: order.display_order_number,
            order_code: order.order_code,
            client_name: order.clients.name,
            created_at: order.created_at,
            closed_at: order.closed_at,
            status: order.status,
            type: order.type,
            order_type: order.order_type,
            invoiced_at: order.invoiced_at,
            invoice_number: order.invoice_number,
            created_by: order.created_by,
            created_by_name: order.profiles?.full_name || null,
            closed_by: order.closed_by,
            closed_by_name: order.closed_by ? closedByMap.get(order.closed_by) || null : null,
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

      // Invoice status filter
      if (selectedInvoiceStatus === "invoiced" && !order.invoiced_at) {
        return false;
      }
      if (selectedInvoiceStatus === "not_invoiced" && order.invoiced_at) {
        return false;
      }

      // Created by filter
      if (selectedCreatedBy !== "all" && order.created_by !== selectedCreatedBy) {
        return false;
      }

      // Closed by filter
      if (selectedClosedBy !== "all" && order.closed_by !== selectedClosedBy) {
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
  }, [workOrders, activeTab, searchTerm, selectedClient, selectedFormat, selectedStatus, selectedInvoiceStatus, selectedCreatedBy, selectedClosedBy, dateFrom, dateTo]);

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
    setSelectedInvoiceStatus("all");
    setSelectedCreatedBy("all");
    setSelectedClosedBy("all");
    setDateFrom("");
    setDateTo("");
  };

  // Prepare data for worker productivity (includes all order types)
  const allFilteredOrdersForProductivity = useMemo(() => {
    return workOrders.filter((order) => {
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
  }, [workOrders, dateFrom, dateTo]);

  if (loading) {
    return <div className="p-4 text-center">Učitavanje...</div>;
  }

  const canSeeProductivity = isSuper || isAdmin;

  return (
    <div className="mt-4">
      {/* Worker Productivity Stats - Only for Superuser/Admin */}
      {canSeeProductivity && (
        <WorkerProductivityStats 
          workOrders={allFilteredOrdersForProductivity}
          dateFrom={dateFrom}
          dateTo={dateTo}
          allWorkers={workers.filter(w => !excludedFromProductivity.includes(w.name))}
        />
      )}

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
            selectedInvoiceStatus={selectedInvoiceStatus}
            onInvoiceStatusChange={setSelectedInvoiceStatus}
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
            clients={uniqueClients}
            formats={uniqueFormats}
            workers={workers}
            selectedCreatedBy={selectedCreatedBy}
            onCreatedByChange={setSelectedCreatedBy}
            selectedClosedBy={selectedClosedBy}
            onClosedByChange={setSelectedClosedBy}
            onClearFilters={clearFilters}
            orderType="ctp"
          />
          
          <SearchResultsTable 
            orders={filteredOrders} 
            onViewOrder={(id) => navigate(`/work-orders/${id}`)}
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
            selectedInvoiceStatus={selectedInvoiceStatus}
            onInvoiceStatusChange={setSelectedInvoiceStatus}
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
            clients={uniqueClients}
            formats={uniqueFormats}
            workers={workers}
            selectedCreatedBy={selectedCreatedBy}
            onCreatedByChange={setSelectedCreatedBy}
            selectedClosedBy={selectedClosedBy}
            onClosedByChange={setSelectedClosedBy}
            onClearFilters={clearFilters}
            orderType="digital"
          />
          
          <SearchResultsTable 
            orders={filteredOrders} 
            onViewOrder={(id) => navigate(`/work-orders/${id}`)}
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
            selectedInvoiceStatus={selectedInvoiceStatus}
            onInvoiceStatusChange={setSelectedInvoiceStatus}
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
            clients={uniqueClients}
            formats={uniqueFormats}
            workers={workers}
            selectedCreatedBy={selectedCreatedBy}
            onCreatedByChange={setSelectedCreatedBy}
            selectedClosedBy={selectedClosedBy}
            onClosedByChange={setSelectedClosedBy}
            onClearFilters={clearFilters}
            orderType="other"
          />
          
          <SearchResultsTable 
            orders={filteredOrders} 
            onViewOrder={(id) => navigate(`/work-orders/${id}`)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Sortable column header
type SearchSortField = 'order_number' | 'client' | 'type' | 'date' | 'status' | 'created_by' | 'closed_by' | 'invoiced' | 'plates';
type SortDir = 'asc' | 'desc';

const SortHead = ({ field, label, current, dir, onSort, className = '' }: {
  field: SearchSortField; label: string; current: SearchSortField; dir: SortDir; onSort: (f: SearchSortField) => void; className?: string;
}) => (
  <TableHead className={className}>
    <button type="button" onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors w-full">
      {label}
      {current === field ? (dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />}
    </button>
  </TableHead>
);

// Component for displaying search results table
interface SearchResultsTableProps {
  orders: WorkOrder[];
  onViewOrder: (id: string) => void;
}

const SearchResultsTable = ({ orders, onViewOrder }: SearchResultsTableProps) => {
  const [sortField, setSortField] = useState<SearchSortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (field: SearchSortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'date' ? 'desc' : 'asc');
    }
  };

  const sortedOrders = useMemo(() => {
    const arr = [...orders];
    const mult = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case 'order_number':
          return mult * (displayOrderNumber(a) || '').localeCompare(displayOrderNumber(b) || '', 'sr');
        case 'client':
          return mult * a.client_name.localeCompare(b.client_name, 'sr');
        case 'type':
          return mult * (a.order_type || '').localeCompare(b.order_type || '', 'sr');
        case 'date':
          return mult * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'status':
          return mult * a.status.localeCompare(b.status, 'sr');
        case 'created_by':
          return mult * (a.created_by_name || '').localeCompare(b.created_by_name || '', 'sr');
        case 'closed_by':
          return mult * (a.closed_by_name || '').localeCompare(b.closed_by_name || '', 'sr');
        case 'invoiced':
          return mult * ((a.invoiced_at ? 1 : 0) - (b.invoiced_at ? 1 : 0));
        case 'plates':
          return mult * (a.total_plates - b.total_plates);
        default:
          return 0;
      }
    });
    return arr;
  }, [orders, sortField, sortDir]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Otvoren</Badge>;
      case "closed":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Zatvoren</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOrderTypeLabel = (orderType: string) => {
    switch (orderType) {
      case "ctp": return "CTP";
      case "digital": return "Digitala";
      case "film": return "Filmovanje";
      case "other": return "Ostalo";
      case "large_format": return "Veliki Format";
      default: return orderType;
    }
  };

  if (orders.length === 0) {
    return (
      <div className="mt-6 p-8 text-center text-muted-foreground border rounded-lg bg-muted/20">
        Nema naloga koji odgovaraju pretrazi
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead field="order_number" label="Broj naloga" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortHead field="client" label="Klijent" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortHead field="type" label="Tip" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortHead field="date" label="Datum" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortHead field="status" label="Status" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortHead field="created_by" label="Kreirao" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortHead field="closed_by" label="Zatvorio" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortHead field="invoiced" label="Fakturisano" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortHead field="plates" label="Ploča/Stavki" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedOrders.slice(0, 100).map((order) => (
              <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onViewOrder(order.id)}>
                <TableCell className="font-medium">{displayOrderNumber(order)}</TableCell>
                <TableCell>{order.client_name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{getOrderTypeLabel(order.order_type)}</Badge>
                </TableCell>
                <TableCell>{format(new Date(order.created_at), "dd.MM.yyyy")}</TableCell>
                <TableCell>{getStatusBadge(order.status)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{order.created_by_name || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{order.closed_by_name || "-"}</TableCell>
                <TableCell>
                  {order.invoiced_at ? (
                    <div className="flex items-center gap-1">
                      <Receipt className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">
                        {order.invoice_number || format(new Date(order.invoiced_at), "dd.MM.yyyy")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">{order.total_plates}</TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewOrder(order.id);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {orders.length > 100 && (
        <p className="text-sm text-muted-foreground mt-2 text-center">
          Prikazano prvih 100 od {orders.length} naloga
        </p>
      )}
    </div>
  );
};

export default SearchAndStats;
