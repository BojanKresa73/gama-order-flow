import { useState, useEffect } from "react";
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
  TableCell,
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Search, Calendar } from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { PriorityBadge } from "@/components/priority/PriorityBadge";
import { PrioritySelect } from "@/components/priority/PrioritySelect";

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
}

const ClientPortal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [portalUser, setPortalUser] = useState<ClientPortalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [changePriorityDialog, setChangePriorityDialog] = useState<{
    open: boolean;
    workOrder: WorkOrder | null;
    newPriority: number;
    note: string;
  }>({ open: false, workOrder: null, newPriority: 5, note: "" });

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
    };

    checkPortalUser();
  }, [navigate, toast]);

  // Fetch work orders for this client
  const { data: workOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["client-portal-orders", portalUser?.client_id, statusFilter],
    queryFn: async () => {
      if (!portalUser?.client_id) return [];

      let query = supabase
        .from("work_orders")
        .select("id, order_code, display_order_number, job_name, status, priority, created_at, closed_at")
        .eq("client_id", portalUser.client_id)
        .is("deleted_at", null)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });

      if (statusFilter === "open") {
        query = query.eq("status", "open");
      } else if (statusFilter === "closed") {
        query = query.eq("status", "closed");
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as WorkOrder[];
    },
    enabled: !!portalUser?.client_id,
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

  // Filter work orders by search
  const filteredOrders = workOrders.filter((order) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      order.order_code?.toLowerCase().includes(search) ||
      order.display_order_number?.toLowerCase().includes(search) ||
      order.job_name?.toLowerCase().includes(search)
    );
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
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Odjava
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Vaši radni nalozi</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pretraži naloge..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
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
            </div>

            {ordersLoading ? (
              <p className="text-center py-8 text-muted-foreground">
                Učitavanje...
              </p>
            ) : filteredOrders.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nema naloga
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Broj naloga</TableHead>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioritet</TableHead>
                      <TableHead>Kreiran</TableHead>
                      <TableHead>Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.display_order_number || order.order_code}
                        </TableCell>
                        <TableCell>{order.job_name || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={order.status === "open" ? "default" : "secondary"}
                          >
                            {order.status === "open" ? "Otvoren" : "Zatvoren"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={order.priority} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(order.created_at), "dd.MM.yyyy", { locale: sr })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.status === "open" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPriorityDialog(order)}
                            >
                              Promeni prioritet
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
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
