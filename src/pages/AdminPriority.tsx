import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Users, Building2 } from "lucide-react";
import { format } from "date-fns";

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
  profiles?: {
    id: string;
  };
}

interface Client {
  id: string;
  name: string;
}

const AdminPriority = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
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
  const { data: portalUsers = [], isLoading } = useQuery({
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

      // Check for error in response data first (edge function errors)
      if (data?.error) {
        throw new Error(data.error);
      }
      
      // Then check for invoke errors
      if (error) {
        throw new Error(error.message || "Greška pri kreiranju korisnika");
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
              Prioritet - Korisnici portala
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Klijent korisnici portala</CardTitle>
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
            {isLoading ? (
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminPriority;
