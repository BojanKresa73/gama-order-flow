import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

export function ClientContactsDialog({ open, onOpenChange, clientId, clientName }: Props) {
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    if (open && clientId) void fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_contacts")
      .select("*")
      .eq("client_id", clientId)
      .order("name");
    if (error) toast.error("Greška pri učitavanju: " + error.message);
    setContacts((data as ClientContact[]) || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    const name = newContact.name.trim();
    const email = newContact.email.trim();
    if (!name || !email) {
      toast.error("Unesite ime i email komercijaliste");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("client_contacts").insert({
      client_id: clientId,
      name,
      email,
      phone: newContact.phone.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Greška pri čuvanju: " + error.message);
      return;
    }
    setNewContact({ name: "", email: "", phone: "" });
    toast.success("Komercijalista dodat");
    void fetchContacts();
  };

  const handleUpdate = async (id: string, patch: Partial<ClientContact>) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from("client_contacts").update(patch).eq("id", id);
    if (error) toast.error("Greška pri izmeni: " + error.message);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("client_contacts").delete().eq("id", id);
    if (error) {
      toast.error("Greška pri brisanju: " + error.message);
      return;
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
    toast.success("Komercijalista obrisan");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Komercijalisti — {clientName}</DialogTitle>
          <DialogDescription>
            Kada se na radnom nalogu izabere komercijalista, obaveštenje sa otpremnicom ide samo
            na njegov email (ne i na glavni email klijenta).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {contacts.length === 0 && (
              <p className="text-sm text-muted-foreground">Još nema unetih komercijalista.</p>
            )}

            {contacts.map((c) => (
              <div key={c.id} className="grid grid-cols-12 gap-2 items-center border rounded-md p-2">
                <Input
                  className="col-span-3"
                  value={c.name}
                  onChange={(e) => setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                  onBlur={(e) => handleUpdate(c.id, { name: e.target.value.trim() })}
                  placeholder="Ime i prezime"
                />
                <Input
                  className="col-span-4"
                  type="email"
                  value={c.email}
                  onChange={(e) => setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, email: e.target.value } : x)))}
                  onBlur={(e) => handleUpdate(c.id, { email: e.target.value.trim() })}
                  placeholder="email@firma.rs"
                />
                <Input
                  className="col-span-2"
                  value={c.phone || ""}
                  onChange={(e) => setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, phone: e.target.value } : x)))}
                  onBlur={(e) => handleUpdate(c.id, { phone: e.target.value.trim() || null })}
                  placeholder="Telefon"
                />
                <div className="col-span-2 flex items-center gap-2">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) => handleUpdate(c.id, { is_active: v })}
                  />
                  <span className="text-xs text-muted-foreground">Aktivan</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="col-span-1"
                  onClick={() => handleDelete(c.id)}
                  title="Obriši"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <div className="border-t pt-4 space-y-2">
              <Label>Dodaj komercijalistu</Label>
              <div className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-3"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Ime i prezime"
                />
                <Input
                  className="col-span-4"
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="email@firma.rs"
                />
                <Input
                  className="col-span-3"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="Telefon (opciono)"
                />
                <Button className="col-span-2" onClick={handleAdd} disabled={saving}>
                  <Plus className="h-4 w-4 mr-1" />
                  Dodaj
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zatvori
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
