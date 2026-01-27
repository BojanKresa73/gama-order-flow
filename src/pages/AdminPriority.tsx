import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Users, Building2, History, Search, ExternalLink, ArrowUp, ArrowDown, Minus, Pencil } from "lucide-react";
import { EditPortalUserDialog } from "@/components/portal/EditPortalUserDialog";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { PriorityBadge } from "@/components/priority/PriorityBadge";

interface ClientPortalUser {
  id: string;
  client_id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  clients?: {
    name: string;
  };
}

interface Client {
  id: string;
  name: string;
}

interface ClientWithStats extends Client {
  portalUserCount: number;
  openOrdersCount: number;
}

interface PriorityChangeLog {
  id: string;
  work_order_id: string;
  old_priority: number | null;
  new_priority: number;
  note: string | null;
  changed_by: string;
  changed_by_type: string;
  created_at: string;
  work_orders?: {
    order_code: string;
    display_order_number: string;
    clients?: {
      name: string;
    };
  };
}

const getFunctionErrorMessage = (err: any): string | null => {
  const body = err?.context?.body;
  if (!body) return null;

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return parsed?.error ?? null;
    } catch {
      return null;
    }
  }

  if (typeof body === "object") {
    return body?.error ?? null;
  }

  return null;
};

const AdminPriority = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("users");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<ClientPortalUser | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [newUserForm, setNewUserForm] = useState({
    email: "",
    fullName: "",
    phone: "",
    password: "",
  });

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-portal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

  // Fetch portal users
  const { data: portalUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["client-portal-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_portal_users")
        .select(`
          *,
          clients (name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClientPortalUser[];
    },
  });

  // Fetch clients with stats
  const { data: clientsWithStats = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["clients-with-priority-stats", portalUsers],
    queryFn: async () => {
      // Get open orders count per client
      const { data: orderCounts, error: orderError } = await supabase
        .from("work_orders")
        .select("client_id")
        .eq("status", "open")
        .is("deleted_at", null);
      
      if (orderError) throw orderError;

      // Count orders per client
      const orderCountMap: Record<string, number> = {};
      (orderCounts || []).forEach((order) => {
        orderCountMap[order.client_id] = (orderCountMap[order.client_id] || 0) + 1;
      });

      // Count portal users per client
      const userCountMap: Record<string, number> = {};
      portalUsers.forEach((user) => {
        userCountMap[user.client_id] = (userCountMap[user.client_id] || 0) + 1;
      });

      // Combine
      return clients.map((client) => ({
        ...client,
        portalUserCount: userCountMap[client.id] || 0,
        openOrdersCount: orderCountMap[client.id] || 0,
      })) as ClientWithStats[];
    },
    enabled: clients.length > 0,
  });

  // Fetch priority change log
  const { data: priorityLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["priority-change-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("priority_change_log")
        .select(`
          *,
          work_orders (
            order_code,
            display_order_number,
            clients (name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as PriorityChangeLog[];
    },
  });

  // Create portal user mutation
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "create-client-portal-user",
        {
          body: {
            clientId: selectedClientId,
            email: newUserForm.email,
            fullName: newUserForm.fullName,
            phone: newUserForm.phone || undefined,
            password: newUserForm.password,
          },
        }
      );

      if (data?.error) throw new Error(data.error);

      if (error) {
        const msgFromBody = getFunctionErrorMessage(error);
        throw new Error(msgFromBody || error.message || "Greška pri kreiranju korisnika");
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Uspešno",
        description: "Korisnik portala je kreiran",
      });
      queryClient.invalidateQueries({ queryKey: ["client-portal-users"] });
      setIsAddDialogOpen(false);
      setNewUserForm({ email: "", fullName: "", phone: "", password: "" });
      setSelectedClientId("");
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }) => {
      const { error } = await supabase
        .from("client_portal_users")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-portal-users"] });
      toast({
        title: "Uspešno",
        description: "Status korisnika je ažuriran",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get user count per client
  const getUserCountForClient = (clientId: string) => {
    return portalUsers.filter((u) => u.client_id === clientId).length;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !newUserForm.email || !newUserForm.fullName || !newUserForm.password) {
      toast({
        title: "Greška",
        description: "Sva polja su obavezna",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate();
  };

  // Filter clients
  const filteredClients = clientsWithStats.filter((client) => {
    if (!clientSearch) return true;
    return client.name.toLowerCase().includes(clientSearch.toLowerCase());
  });

  // Filter logs
  const filteredLogs = priorityLogs.filter((log) => {
    if (!logSearch) return true;
    const search = logSearch.toLowerCase();
    return (
      log.work_orders?.order_code?.toLowerCase().includes(search) ||
      log.work_orders?.display_order_number?.toLowerCase().includes(search) ||
      log.work_orders?.clients?.name?.toLowerCase().includes(search) ||
      log.note?.toLowerCase().includes(search)
    );
  });

  // Get priority change icon
  const getPriorityChangeIcon = (oldPriority: number | null, newPriority: number) => {
    const old = oldPriority ?? 5;
    if (newPriority > old) return <ArrowUp className="h-4 w-4 text-red-500" />;
    if (newPriority < old) return <ArrowDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Nazad
            </Button>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Administracija prioriteta
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Korisnici portala
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Klijenti
            </TabsTrigger>
            <TabsTrigger value="log" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Log promena
            </TabsTrigger>
          </TabsList>

          {/* KORISNICI TAB */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Korisnici klijent portala</CardTitle>
                  <CardDescription>
                    Korisnici koji mogu da menjaju prioritete naloga svojih firmi
                  </CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Dodaj korisnika
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleSubmit}>
                      <DialogHeader>
                        <DialogTitle>Novi korisnik portala</DialogTitle>
                        <DialogDescription>
                          Kreirajte korisnika koji će moći da menja prioritete naloga za odabranog klijenta.
                          Maksimalno 2 korisnika po klijentu.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Klijent</Label>
                          <Select
                            value={selectedClientId}
                            onValueChange={setSelectedClientId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Izaberite klijenta" />
                            </SelectTrigger>
                            <SelectContent>
                              {clients.map((client) => {
                                const count = getUserCountForClient(client.id);
                                const disabled = count >= 2;
                                return (
                                  <SelectItem
                                    key={client.id}
                                    value={client.id}
                                    disabled={disabled}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4" />
                                      {client.name}
                                      {count > 0 && (
                                        <Badge variant="secondary" className="ml-2">
                                          {count}/2
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="fullName">Ime i prezime</Label>
                          <Input
                            id="fullName"
                            value={newUserForm.fullName}
                            onChange={(e) =>
                              setNewUserForm({ ...newUserForm, fullName: e.target.value })
                            }
                            placeholder="Petar Petrović"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newUserForm.email}
                            onChange={(e) =>
                              setNewUserForm({ ...newUserForm, email: e.target.value })
                            }
                            placeholder="petar@firma.rs"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefon (opciono)</Label>
                          <Input
                            id="phone"
                            value={newUserForm.phone}
                            onChange={(e) =>
                              setNewUserForm({ ...newUserForm, phone: e.target.value })
                            }
                            placeholder="+381 64 123 4567"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="password">Lozinka</Label>
                          <Input
                            id="password"
                            type="password"
                            value={newUserForm.password}
                            onChange={(e) =>
                              setNewUserForm({ ...newUserForm, password: e.target.value })
                            }
                            placeholder="Minimalno 6 karaktera"
                          />
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsAddDialogOpen(false)}
                        >
                          Otkaži
                        </Button>
                        <Button type="submit" disabled={createUserMutation.isPending}>
                          {createUserMutation.isPending ? "Kreiranje..." : "Kreiraj"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </p>
                ) : portalUsers.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nema korisnika portala. Dodajte prvog korisnika.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ime</TableHead>
                        <TableHead>Klijent</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Kreiran</TableHead>
                        <TableHead>Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {portalUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.full_name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {user.clients?.name || "-"}
                            </div>
                          </TableCell>
                          <TableCell>{user.phone || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={user.is_active ? "default" : "secondary"}
                            >
                              {user.is_active ? "Aktivan" : "Neaktivan"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(user.created_at), "dd.MM.yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditUser(user)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  toggleActiveMutation.mutate({
                                    id: user.id,
                                    isActive: !user.is_active,
                                  })
                                }
                              >
                                {user.is_active ? "Deaktiviraj" : "Aktiviraj"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Portal link info */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Link za klijent portal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-muted rounded-lg text-sm font-mono">
                    {window.location.origin}/portal/login
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/portal/login`);
                      toast({
                        title: "Kopirano",
                        description: "Link je kopiran u clipboard",
                      });
                    }}
                  >
                    Kopiraj
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/portal/login", "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Prosledite ovaj link klijentima da se prijave na portal za upravljanje prioritetima.
                </p>
              </CardContent>
            </Card>

            {/* Edit user dialog */}
            <EditPortalUserDialog
              user={editUser}
              open={!!editUser}
              onOpenChange={(open) => !open && setEditUser(null)}
            />
          </TabsContent>

          {/* KLIJENTI TAB */}
          <TabsContent value="clients">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Pregled klijenata</CardTitle>
                    <CardDescription>
                      Klijenti sa brojem korisnika portala i otvorenih naloga
                    </CardDescription>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Pretraži klijente..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {clientsLoading ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Klijent</TableHead>
                        <TableHead className="text-center">Korisnika portala</TableHead>
                        <TableHead className="text-center">Otvorenih naloga</TableHead>
                        <TableHead>Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {client.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={client.portalUserCount > 0 ? "default" : "secondary"}>
                              {client.portalUserCount}/2
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {client.openOrdersCount > 0 ? (
                              <Badge variant="outline">{client.openOrdersCount}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {client.portalUserCount < 2 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedClientId(client.id);
                                  setActiveTab("users");
                                  setIsAddDialogOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Dodaj korisnika
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LOG TAB */}
          <TabsContent value="log">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Istorija promena prioriteta</CardTitle>
                    <CardDescription>
                      Sve promene prioriteta naloga od strane klijenata
                    </CardDescription>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Pretraži..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </p>
                ) : filteredLogs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nema zabeleženih promena prioriteta
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Nalog</TableHead>
                        <TableHead>Klijent</TableHead>
                        <TableHead>Promena</TableHead>
                        <TableHead>Napomena</TableHead>
                        <TableHead>Tip</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(log.created_at), "dd.MM.yyyy HH:mm", { locale: sr })}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.work_orders?.display_order_number || log.work_orders?.order_code || "-"}
                          </TableCell>
                          <TableCell>
                            {log.work_orders?.clients?.name || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority={log.old_priority ?? 5} size="sm" />
                              {getPriorityChangeIcon(log.old_priority, log.new_priority)}
                              <PriorityBadge priority={log.new_priority} size="sm" />
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {log.note || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.changed_by_type === "client" ? "secondary" : "outline"}>
                              {log.changed_by_type === "client" ? "Klijent" : "Interni"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPriority;
