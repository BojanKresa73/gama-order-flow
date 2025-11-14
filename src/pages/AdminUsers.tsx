import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, Search, RefreshCw, UserPlus, KeyRound, ArrowLeft, Pencil } from "lucide-react";
import { useAuthz } from "@/hooks/useAuthz";
import { useNavigate } from "react-router-dom";
import * as adminUsersService from "@/services/adminUsers";

type AppRole = adminUsersService.AppRole;
type User = adminUsersService.User;

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("operator");
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuper, isAdmin } = useAuthz();
  const navigate = useNavigate();

  // Provera pristupa
  if (!isSuper && !isAdmin) {
    navigate("/dashboard");
    return null;
  }

  // Učitaj korisnike
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => adminUsersService.listUsers(search, 100, 0),
  });

  // Mutation za promenu role
  const setRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) =>
      adminUsersService.setUserRole(userId, role),
    onSuccess: () => {
      toast({ title: "Rola promenjena" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    },
  });

  // Mutation za aktivaciju/deaktivaciju
  const setActiveMutation = useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      adminUsersService.setUserActive(userId, active),
    onSuccess: () => {
      toast({ title: "Status promenjen" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    },
  });

  const handleRoleChange = (userId: string, role: string) => {
    setRoleMutation.mutate({ userId, role: role as AppRole });
  };

  const handleToggleActive = (userId: string, currentActive: boolean) => {
    setActiveMutation.mutate({ userId, active: !currentActive });
  };

  // Mutation za pozivanje novog korisnika
  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; full_name: string; app_role: AppRole }) =>
      adminUsersService.inviteUser(data.email, data.full_name, data.app_role),
    onSuccess: () => {
      toast({
        title: "Korisnik pozvan",
        description: "Pozivnica je poslata na email adresu korisnika.",
      });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("operator");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri pozivu",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInviteUser = () => {
    if (!inviteEmail) {
      toast({ title: "Email je obavezan", variant: "destructive" });
      return;
    }
    inviteMutation.mutate({
      email: inviteEmail,
      full_name: inviteFullName || inviteEmail,
      app_role: inviteRole,
    });
  };

  // Mutation za reset lozinke
  const resetPasswordMutation = useMutation({
    mutationFn: (email: string) => adminUsersService.resetUserPassword(email),
    onSuccess: (data, email) => {
      toast({
        title: "Recovery link generisan",
        description: `Link za reset lozinke poslat za ${email}`,
      });

      // Prikaži recovery link u console (za dev)
      if (data?.recovery_link) {
        console.log("Recovery link:", data.recovery_link);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri resetu",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleResetPassword = (email: string) => {
    resetPasswordMutation.mutate(email);
  };

  const getRoleBadgeVariant = (role: AppRole | null) => {
    switch (role) {
      case "superuser": return "default";
      case "admin": return "secondary";
      case "operator": return "outline";
      case "operator_ctp": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Users className="h-6 w-6" />
              <CardTitle>Administracija korisnika</CardTitle>
            </div>
            <div className="flex gap-2">
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Pozovi korisnika
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Pozovi novog korisnika</DialogTitle>
                    <DialogDescription>
                      Korisnik će dobiti email sa linkom za postavljanje lozinke.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="korisnik@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Ime i prezime</Label>
                      <Input
                        id="full_name"
                        placeholder="Ime Prezime"
                        value={inviteFullName}
                        onChange={(e) => setInviteFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Rola *</Label>
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                        <SelectTrigger id="role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="superuser">Superuser</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operator">Operator</SelectItem>
                          <SelectItem value="operator_ctp">Operator CTP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteOpen(false)}>
                      Otkaži
                    </Button>
                    <Button onClick={handleInviteUser} disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? "Šaljem..." : "Pozovi"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Izmeni korisnika</DialogTitle>
                    <DialogDescription>
                      Izmeni podatke o korisniku.
                    </DialogDescription>
                  </DialogHeader>
                  {editUser && (
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit_email">Email</Label>
                        <Input
                          id="edit_email"
                          type="email"
                          value={editUser.email}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_full_name">Ime i prezime</Label>
                        <Input
                          id="edit_full_name"
                          placeholder="Ime Prezime"
                          value={editUser.full_name || ""}
                          onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_role">Rola</Label>
                        <Select 
                          value={editUser.role || ""} 
                          onValueChange={(v) => setEditUser({ ...editUser, role: v as AppRole })}
                        >
                          <SelectTrigger id="edit_role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="superuser">Superuser</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="operator">Operator</SelectItem>
                            <SelectItem value="operator_ctp">Operator CTP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="edit_active">Status</Label>
                        <Button
                          id="edit_active"
                          variant={editUser.is_active ? "outline" : "secondary"}
                          size="sm"
                          onClick={() => setEditUser({ ...editUser, is_active: !editUser.is_active })}
                        >
                          {editUser.is_active ? "Aktivan" : "Neaktivan"}
                        </Button>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>
                      Otkaži
                    </Button>
                    <Button onClick={() => {
                      if (editUser) {
                        handleRoleChange(editUser.id, editUser.role);
                        if (editUser.is_active !== users.find(u => u.id === editUser.id)?.is_active) {
                          handleToggleActive(editUser.id, !editUser.is_active);
                        }
                        setEditOpen(false);
                      }
                    }}>
                      Sačuvaj
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Osveži
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pretraga */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po email-u ili imenu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* Tabela */}
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Učitavanje...</p>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nema korisnika</p>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Ime</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Kreiran</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.full_name || "-"}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role || ""}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Bez role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="superuser">Superuser</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="operator">Operator</SelectItem>
                            <SelectItem value="operator_ctp">Operator CTP</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={user.is_active ? "outline" : "secondary"}
                          size="sm"
                          onClick={() => handleToggleActive(user.id, user.is_active)}
                        >
                          {user.is_active ? "Aktivan" : "Neaktivan"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(user.created_at).toLocaleDateString("sr-RS")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditUser(user);
                              setEditOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Izmeni
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetPassword(user.email)}
                            disabled={resetPasswordMutation.isPending}
                          >
                            <KeyRound className="h-4 w-4 mr-1" />
                            Reset lozinke
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
