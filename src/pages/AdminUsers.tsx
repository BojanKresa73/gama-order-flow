import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { Users, Search, RefreshCw } from "lucide-react";
import { useAuthz } from "@/hooks/useAuthz";
import { useNavigate } from "react-router-dom";

type AppRole = "superuser" | "admin" | "operator" | "operator_ctp";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
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
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users", {
        p_search: search,
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      return data as User[];
    },
  });

  // Mutation za promenu role
  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.rpc("admin_set_user_role", {
        p_user_id: userId,
        p_role: role,
      });
      if (error) throw error;
    },
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
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase.rpc("admin_set_user_active", {
        p_user_id: userId,
        p_active: active,
      });
      if (error) throw error;
    },
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
              <Users className="h-6 w-6" />
              <CardTitle>Administracija korisnika</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Osveži
            </Button>
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
