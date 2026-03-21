import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Search, Package } from "lucide-react";
import { PriorityBadge } from "@/components/priority/PriorityBadge";
import { PrioritySelect } from "@/components/priority/PrioritySelect";
import { ClientOrderRow } from "@/components/portal/ClientOrderRow";
import { ClientOrderCard } from "@/components/portal/ClientOrderCard";
import { PortalNotificationBell } from "@/components/portal/PortalNotificationBell";
import { PushNotificationToggle } from "@/components/portal/PushNotificationToggle";
import { EmailNotificationToggle } from "@/components/portal/EmailNotificationToggle";
import { PortalUserGuide } from "@/components/portal/PortalUserGuide";
import { PortalOrderStats } from "@/components/portal/PortalOrderStats";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";

// Publik client IDs that should see stock info
const PUBLIK_CLIENT_IDS = [
  "b48adbce-868e-4564-9c56-27e372af5724", // Publik d.o.o.
  "a996f28a-bbaa-4dd7-9b7e-2febc691fa86", // Publik Praktikum d.o.o.
];
const PUBLIK_PLATE_FORMAT_ID = "833c26e8-cf70-4130-8a5c-56b1eb6022d1"; // 1040x800

interface ClientPortalUser {
  id: string;
  client_id: string;
  full_name: string;
  clients?: {
    name: string;
  };
}

interface WorkOrder {
  id: string;
  order_code: string;
  display_order_number: string;
  job_name: string | null;
  status: string;
  priority: number;
  created_at: string;
  closed_at: string | null;
  order_type: string;
  total_plates: number;
}

const ClientPortal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [portalUser, setPortalUser] = useState<ClientPortalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");
  const [sortBy, setSortBy] = useState<
    "created_desc" | "created_asc" | "priority_desc" | "order_desc"
  >("created_desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [changePriorityDialog, setChangePriorityDialog] = useState<{
    open: boolean;
    workOrder: WorkOrder | null;
    newPriority: number;
    note: string;
  }>({ open: false, workOrder: null, newPriority: 5, note: "" });

  // Presence tracking ref
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if user is a portal user
  useEffect(() => {
    const checkPortalUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/portal/login");
        return;
      }

      const { data: portalData, error } = await supabase
        .from("client_portal_users")
        .select(`
          *,
          clients (name)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (error || !portalData) {
        await supabase.auth.signOut();
        toast({
          title: "Pristup odbijen",
          description: "Nemate pristup klijent portalu",
          variant: "destructive",
        });
        navigate("/portal/login");
        return;
      }

      setPortalUser(portalData);
      setIsLoading(false);

      // Setup presence tracking for portal users
      const presenceChannel = supabase.channel("online-portal-users", {
        config: {
          presence: {
            key: user.id,
          },
          broadcast: {
            self: true,
          },
        },
      });

      presenceChannelRef.current = presenceChannel;

      presenceChannel.subscribe(async (status) => {
        console.log("[Portal User Presence] Channel status:", status);
        if (status === "SUBSCRIBED") {
          const result = await presenceChannel.track({
            user_id: user.id,
            full_name: portalData.full_name,
            client_name: portalData.clients?.name || "Nepoznat klijent",
            online_at: new Date().toISOString(),
          });
          console.log("[Portal User Presence] Track result:", result);
        }
      });

      // Heartbeat every 30 seconds
      heartbeatIntervalRef.current = setInterval(async () => {
        if (presenceChannelRef.current) {
          await presenceChannelRef.current.track({
            user_id: user.id,
            full_name: portalData.full_name,
            client_name: portalData.clients?.name || "Nepoznat klijent",
            online_at: new Date().toISOString(),
          });
        }
      }, 30000);
    };

    checkPortalUser();
    
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack();
        presenceChannelRef.current.unsubscribe();
        presenceChannelRef.current = null;
      }
    };
  }, [navigate, toast]);

  // Fetch work orders for this client with plate counts
  const { data: workOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["client-portal-orders", portalUser?.client_id, statusFilter, sortBy],
    queryFn: async () => {
      if (!portalUser?.client_id) return [];

      let query = supabase
        .from("work_orders")
        .select("id, order_code, display_order_number, job_name, status, priority, created_at, closed_at, order_type")
        .eq("client_id", portalUser.client_id)
        .is("deleted_at", null);

      if (statusFilter === "open") {
        query = query.eq("status", "open");
      } else if (statusFilter === "closed") {
        query = query.eq("status", "closed");
      }

      // Sorting
      if (sortBy === "created_desc") {
        query = query.order("created_at", { ascending: false });
      } else if (sortBy === "created_asc") {
        query = query.order("created_at", { ascending: true });
      } else if (sortBy === "priority_desc") {
        query = query.order("priority", { ascending: false }).order("created_at", { ascending: false });
      } else if (sortBy === "order_desc") {
        query = query.order("display_order_number", { ascending: false });
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      // Fetch plate counts for CTP orders
      const orderIds = (data || []).map(o => o.id);
      const { data: plateCounts } = await supabase
        .from("file_entries")
        .select("work_order_id, quantity")
        .in("work_order_id", orderIds)
        .range(0, 49999);

      // Calculate totals per order
      const plateMap = new Map<string, number>();
      (plateCounts || []).forEach(p => {
        const current = plateMap.get(p.work_order_id) || 0;
        plateMap.set(p.work_order_id, current + (p.quantity || 0));
      });

      return (data || []).map(order => ({
        ...order,
        total_plates: plateMap.get(order.id) || 0,
      })) as WorkOrder[];
    },
    enabled: !!portalUser?.client_id,
  });

  // Fetch stock for Publik clients (1040x800 format)
  const isPublikClient = portalUser?.client_id && PUBLIK_CLIENT_IDS.includes(portalUser.client_id);
  const { data: publikStock } = useQuery({
    queryKey: ["publik-plate-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plate_formats")
        .select("current_stock, format_name")
        .eq("id", PUBLIK_PLATE_FORMAT_ID)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: isPublikClient,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch all files for search
  const { data: allFiles = [] } = useQuery({
    queryKey: ["client-portal-files", portalUser?.client_id],
    queryFn: async () => {
      if (!portalUser?.client_id) return [];

      const orderIds = workOrders.map((o) => o.id);
      if (orderIds.length === 0) return [];

      const files: { orderId: string; name: string }[] = [];

      // Fetch CTP files
      const { data: ctpFiles } = await supabase
        .from("file_entries")
        .select("work_order_id, filename")
        .in("work_order_id", orderIds)
        .range(0, 49999);
      
      (ctpFiles || []).forEach((f) => {
        files.push({ orderId: f.work_order_id, name: f.filename });
      });

      // Fetch film files
      const { data: filmFiles } = await supabase
        .from("film_jobs")
        .select("work_order_id, file_name")
        .in("work_order_id", orderIds)
        .range(0, 49999);
      
      (filmFiles || []).forEach((f) => {
        files.push({ orderId: f.work_order_id, name: f.file_name });
      });

      // Fetch digital files
      const { data: digitalFiles } = await supabase
        .from("digital_jobs")
        .select("work_order_id, file_name")
        .in("work_order_id", orderIds)
        .range(0, 49999);
      
      (digitalFiles || []).forEach((f) => {
        files.push({ orderId: f.work_order_id, name: f.file_name });
      });

      return files;
    },
    enabled: workOrders.length > 0,
  });

  // Update priority mutation
  const updatePriorityMutation = useMutation({
    mutationFn: async ({ workOrderId, newPriority, note }: {
      workOrderId: string;
      newPriority: number;
      note: string;
    }) => {
      const { data, error } = await supabase.rpc("update_work_order_priority", {
        p_work_order_id: workOrderId,
        p_new_priority: newPriority,
        p_note: note || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (data, variables) => {
      toast({
        title: "Prioritet ažuriran",
        description: `Prioritet je promenjen na ${variables.newPriority}`,
      });
      queryClient.invalidateQueries({ queryKey: ["client-portal-orders"] });
      setChangePriorityDialog({ open: false, workOrder: null, newPriority: 5, note: "" });

      // Send notification email
      try {
        await supabase.functions.invoke("notify-priority-change", {
          body: {
            logId: (data as any)?.log_id,
            workOrderId: variables.workOrderId,
            orderNumber: changePriorityDialog.workOrder?.display_order_number || "",
            oldPriority: changePriorityDialog.workOrder?.priority || 5,
            newPriority: variables.newPriority,
            clientName: portalUser?.clients?.name || "",
            changedByName: portalUser?.full_name || "Klijent",
            note: variables.note,
          },
        });
      } catch (e) {
        console.error("Failed to send notification:", e);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login");
  };

  const openPriorityDialog = (workOrder: WorkOrder) => {
    setChangePriorityDialog({
      open: true,
      workOrder,
      newPriority: workOrder.priority,
      note: "",
    });
  };

  const handlePrioritySubmit = () => {
    if (!changePriorityDialog.workOrder) return;

    updatePriorityMutation.mutate({
      workOrderId: changePriorityDialog.workOrder.id,
      newPriority: changePriorityDialog.newPriority,
      note: changePriorityDialog.note,
    });
  };

  // Filter work orders by search (including files)
  const filteredOrders = workOrders.filter((order) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    
    // Check order fields
    const orderMatch =
      order.order_code?.toLowerCase().includes(search) ||
      order.display_order_number?.toLowerCase().includes(search) ||
      order.job_name?.toLowerCase().includes(search);
    
    if (orderMatch) return true;
    
    // Check if any file matches
    const fileMatch = allFiles.some(
      (f) => f.orderId === order.id && f.name.toLowerCase().includes(search)
    );
    
    return fileMatch;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Učitavanje...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Klijent Portal</h1>
              <p className="text-sm text-muted-foreground">
                {portalUser?.clients?.name} - {portalUser?.full_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Stock display for Publik clients */}
              {isPublikClient && publikStock && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="text-muted-foreground">Lager {publikStock.format_name}:</span>
                    <Badge variant="secondary" className="ml-2 font-semibold">
                      {publikStock.current_stock} ploča
                    </Badge>
                  </span>
                </div>
              )}
              <PortalUserGuide />
              <PushNotificationToggle />
              {portalUser && (
                <EmailNotificationToggle
                  portalUserId={portalUser.id}
                  initialEnabled={(portalUser as any).email_notifications_enabled ?? true}
                />
              )}
              {portalUser?.client_id && (
                <PortalNotificationBell clientId={portalUser.client_id} />
              )}
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Odjava
              </Button>
            </div>
          </div>
          {/* Mobile stock display for Publik */}
          {isPublikClient && publikStock && (
            <div className="sm:hidden mt-3 flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Lager {publikStock.format_name}:
                <Badge variant="secondary" className="ml-2 font-semibold">
                  {publikStock.current_stock} ploča
                </Badge>
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Vaši radni nalozi</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Order Statistics */}
            <PortalOrderStats orders={workOrders} />

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pretraži naloge ili fajlove..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Otvoreni</SelectItem>
                    <SelectItem value="closed">Zatvoreni</SelectItem>
                    <SelectItem value="all">Svi</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Sortiraj" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_desc">Kreiran (noviji prvo)</SelectItem>
                    <SelectItem value="created_asc">Kreiran (stariji prvo)</SelectItem>
                    <SelectItem value="priority_desc">Prioritet (veći prvo)</SelectItem>
                    <SelectItem value="order_desc">Broj naloga (veći prvo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {ordersLoading ? (
              <p className="text-center py-8 text-muted-foreground">
                Učitavanje...
              </p>
            ) : filteredOrders.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nema naloga
              </p>
            ) : isMobile ? (
              /* Mobile: Card view */
              <div className="space-y-3">
                {filteredOrders.map((order, index) => (
                  <ClientOrderCard
                    key={order.id}
                    order={order}
                    index={index + 1}
                    onChangePriority={openPriorityDialog}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            ) : (
              /* Desktop: Table view */
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Broj naloga</TableHead>
                      <TableHead>Naziv</TableHead>
                      <TableHead className="text-center">Ploče</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioritet</TableHead>
                      <TableHead>Kreiran</TableHead>
                      <TableHead>Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order, index) => (
                      <ClientOrderRow
                        key={order.id}
                        order={order}
                        index={index + 1}
                        onChangePriority={openPriorityDialog}
                        searchQuery={searchQuery}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority legend */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <h4 className="font-semibold mb-3">Legenda prioriteta</h4>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <PriorityBadge priority={10} size="sm" />
                <span className="text-sm">Najhitnije</span>
              </div>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={7} size="sm" />
                <span className="text-sm">Hitno</span>
              </div>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={5} size="sm" />
                <span className="text-sm">Normalno</span>
              </div>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={2} size="sm" />
                <span className="text-sm">Nisko</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Change Priority Dialog */}
      <Dialog
        open={changePriorityDialog.open}
        onOpenChange={(open) =>
          setChangePriorityDialog({ ...changePriorityDialog, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promena prioriteta</DialogTitle>
            <DialogDescription>
              Nalog: {changePriorityDialog.workOrder?.display_order_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Trenutni prioritet:</span>
              <PriorityBadge
                priority={changePriorityDialog.workOrder?.priority || 5}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Novi prioritet:</label>
              <PrioritySelect
                value={changePriorityDialog.newPriority}
                onChange={(value) =>
                  setChangePriorityDialog({ ...changePriorityDialog, newPriority: value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Napomena (opciono):</label>
              <Textarea
                value={changePriorityDialog.note}
                onChange={(e) =>
                  setChangePriorityDialog({ ...changePriorityDialog, note: e.target.value })
                }
                placeholder="Razlog promene prioriteta..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setChangePriorityDialog({ open: false, workOrder: null, newPriority: 5, note: "" })
              }
            >
              Otkaži
            </Button>
            <Button
              onClick={handlePrioritySubmit}
              disabled={
                updatePriorityMutation.isPending ||
                changePriorityDialog.newPriority === changePriorityDialog.workOrder?.priority
              }
            >
              {updatePriorityMutation.isPending ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientPortal;
