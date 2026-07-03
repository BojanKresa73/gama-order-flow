import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: string) => void;
}

/**
 * Minimal quick-add client used from Quote flows.
 * Creates a lightweight client row (name required, PIB/city/email optional).
 */
export function QuickAddClientDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [pib, setPib] = useState("");
  const [email, setEmail] = useState("");
  const [grad, setGrad] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Naziv klijenta je obavezan");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          name: name.trim(),
          pib: pib.trim() || null,
          email: email.trim() || null,
          grad: grad.trim() || null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Klijent kreiran");
      onCreated(data.id);
      setName(""); setPib(""); setEmail(""); setGrad("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Greška pri kreiranju");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Brzo dodaj klijenta
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Naziv *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>PIB</Label>
              <Input value={pib} onChange={(e) => setPib(e.target.value)} />
            </div>
            <div>
              <Label>Grad</Label>
              <Input value={grad} onChange={(e) => setGrad(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Ostale podatke (adresa, telefon, rok plaćanja) možeš dopuniti kasnije u Klijentima.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
          <Button onClick={handleCreate} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Kreiraj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
