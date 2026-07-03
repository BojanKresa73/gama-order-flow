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
import { Users, Search, RefreshCw, UserPlus, KeyRound, ArrowLeft, Pencil, Mail } from "lucide-react";
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
  const [invitePassword, setInvitePassword] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuper, isAdmin } = useAuthz();
  const navigate = useNavigate();

  // Provera pristupa - samo Superuser može da upravlja korisnicima
  if (!isSuper) {
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
    mutationFn: (data: { email: string; full_name: string; app_role: AppRole; password: string }) =>
      adminUsersService.inviteUser(data.email, data.full_name, data.app_role, data.password),
    onSuccess: () => {
      toast({
        title: "Korisnik kreiran",
        description: "Korisnik je uspešno kreiran sa zadatom lozinkom.",
      });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("operator");
      setInvitePassword("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri kreiranju",
        description: error.message || "Došlo je do greške. Pokušajte ponovo.",
        variant: "destructive",
      });
    },
  });

  const handleInviteUser = () => {
    if (!inviteEmail) {
      toast({ title: "Email je obavezan", variant: "destructive" });
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({ 
        title: "Neispravan format email adrese", 
        description: "Proverite da li ste uneli validnu email adresu u polje 'Email'.",
        variant: "destructive" 
      });
      return;
    }

    if (!invitePassword || invitePassword.length < 6) {
      toast({ 
        title: "Lozinka je obavezna", 
        description: "Lozinka mora imati najmanje 6 karaktera.",
        variant: "destructive" 
      });
      return;
    }
    
    inviteMutation.mutate({
      email: inviteEmail,
      full_name: inviteFullName || inviteEmail,
      app_role: inviteRole,
      password: invitePassword,
    });
  };

  // Mutation za reset lozinke
  const resetPasswordMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => 
      adminUsersService.resetUserPassword(email, password),
    onSuccess: () => {
      toast({
        title: "Lozinka promenjena",
        description: "Nova lozinka je uspešno postavljena.",
      });
      setResetPasswordOpen(false);
      setResetPasswordUser(null);
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri promeni lozinke",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleResetPassword = () => {
    if (!resetPasswordUser) return;
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Neispravan unos",
        description: "Lozinka mora imati najmanje 6 karaktera.",
        variant: "destructive",
      });
      return;
    }
    resetPasswordMutation.mutate({ 
      email: resetPasswordUser.email, 
      password: newPassword 
    });
  };

  const openResetPasswordDialog = (user: User) => {
    setResetPasswordUser(user);
    setNewPassword("");
    setResetPasswordOpen(true);
  };

  const getRoleBadgeVariant = (role: AppRole | null) => {
    switch (role) {
      case "superuser": return "default";
      case "admin_plus": return "default";
      case "admin": return "secondary";
      case "operator": return "outline";
      case "operator_ctp": return "outline";
      default: return "outline";
    }
  };

  const getRoleLabel = (role: AppRole | null) => {
    switch (role) {
      case "superuser": return "Superuser";
      case "admin_plus": return "Admin Plus";
      case "admin": return "Admin";
      case "operator": return "Operator";
      case "operator_ctp": return "Operator CTP";
      default: return role || "-";
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
                    Dodaj korisnika
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dodaj novog korisnika</DialogTitle>
                    <DialogDescription>
                      Unesite podatke za novog korisnika. Vi određujete lozinku.
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
                      <Label htmlFor="password">Lozinka *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Najmanje 6 karaktera"
                        value={invitePassword}
                        onChange={(e) => setInvitePassword(e.target.value)}
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
                          <SelectItem value="admin_plus">Admin Plus</SelectItem>
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
                      {inviteMutation.isPending ? "Kreiram..." : "Kreiraj korisnika"}
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
                      {(editUser.role === "superuser" || editUser.role === "admin_plus" || editUser.role === "admin") && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="edit_job_title">Titula / pozicija</Label>
                            <Input
                              id="edit_job_title"
                              placeholder="npr. Direktor prodaje"
                              value={editUser.job_title || ""}
                              onChange={(e) => setEditUser({ ...editUser, job_title: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit_phone">Telefon</Label>
                            <Input
                              id="edit_phone"
                              placeholder="+381 60 123 4567"
                              value={editUser.phone || ""}
                              onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Ova polja se prikazuju kao potpis u ponudama koje korisnik generiše.
                          </p>
                        </>
                      )}
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
                            <SelectItem value="admin_plus">Admin Plus</SelectItem>
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
                    <Button onClick={async () => {
                      if (!editUser) return;
                      try {
                        const original = users.find(u => u.id === editUser.id);
                        // Profile fields (name/phone/title)
                        await adminUsersService.updateUserProfile(
                          editUser.id,
                          editUser.full_name,
                          editUser.phone,
                          editUser.job_title,
                        );
                        // Role
                        if (original?.role !== editUser.role && editUser.role) {
                          handleRoleChange(editUser.id, editUser.role);
                        }
                        // Active state
                        if (original && original.is_active !== editUser.is_active) {
                          handleToggleActive(editUser.id, !editUser.is_active);
                        }
                        toast({ title: "Podaci sačuvani" });
                        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
                        queryClient.invalidateQueries({ queryKey: ["signer-profile"] });
                        setEditOpen(false);
                      } catch (e: any) {
                        toast({ title: "Greška", description: e?.message, variant: "destructive" });
                      }
                    }}>
                      Sačuvaj
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Dialog za promenu lozinke */}
              <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Promeni lozinku</DialogTitle>
                    <DialogDescription>
                      Unesite novu lozinku za korisnika {resetPasswordUser?.email}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new_password">Nova lozinka *</Label>
                      <Input
                        id="new_password"
                        type="password"
                        placeholder="Najmanje 6 karaktera"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>
                      Otkaži
                    </Button>
                    <Button 
                      onClick={handleResetPassword} 
                      disabled={resetPasswordMutation.isPending}
                    >
                      {resetPasswordMutation.isPending ? "Menjam..." : "Promeni lozinku"}
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
                            <SelectItem value="admin_plus">Admin Plus</SelectItem>
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
                            onClick={() => openResetPasswordDialog(user)}
                            disabled={resetPasswordMutation.isPending}
                          >
                            <KeyRound className="h-4 w-4 mr-1" />
                            Promeni lozinku
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
