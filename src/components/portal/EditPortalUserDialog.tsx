import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

interface ClientPortalUser {
  id: string;
  client_id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  clients?: {
    name: string;
  };
}

interface Props {
  user: ClientPortalUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPortalUserDialog({ user, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
  });

  // Fetch user email from auth
  const { data: userEmail } = useQuery({
    queryKey: ["portal-user-email", user?.user_id],
    queryFn: async () => {
      // We can't directly access auth.users, but we can get it from the edge function
      // For now, leave it empty and let admin update if needed
      return "";
    },
    enabled: !!user?.user_id,
  });

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.full_name,
        phone: user.phone || "",
        email: "", // Will be updated via edge function
        password: "",
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const { data, error } = await supabase.functions.invoke("manage-portal-user", {
        body: {
          action: "update",
          portalUserId: user.id,
          userId: user.user_id,
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || undefined,
          password: form.password || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Uspešno",
        description: "Korisnik je ažuriran",
      });
      queryClient.invalidateQueries({ queryKey: ["client-portal-users"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const { data, error } = await supabase.functions.invoke("manage-portal-user", {
        body: {
          action: "delete",
          portalUserId: user.id,
          userId: user.user_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Uspešno",
        description: "Korisnik je obrisan",
      });
      queryClient.invalidateQueries({ queryKey: ["client-portal-users"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName) {
      toast({
        title: "Greška",
        description: "Ime je obavezno",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Izmena korisnika</DialogTitle>
            <DialogDescription>
              Izmenite podatke korisnika portala za {user?.clients?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Ime i prezime</Label>
              <Input
                id="edit-fullName"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Petar Petrović"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefon (opciono)</Label>
              <Input
                id="edit-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+381 64 123 4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Novi email (ostavite prazno da zadržite postojeći)</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="novi@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova lozinka (ostavite prazno da zadržite postojeću)</Label>
              <Input
                id="edit-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimalno 6 karaktera"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="w-full sm:w-auto">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Obriši
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Brisanje korisnika</AlertDialogTitle>
                  <AlertDialogDescription>
                    Da li ste sigurni da želite da obrišete korisnika {user?.full_name}?
                    Ova akcija se ne može poništiti.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Otkaži</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? "Brisanje..." : "Obriši"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Otkaži
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Čuvanje..." : "Sačuvaj"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
