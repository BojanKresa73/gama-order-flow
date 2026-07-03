import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useClients } from "@/hooks/useClients";
import { useUpdateQuote } from "@/hooks/useQuotesPro";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quoteId: string;
  currentClientId: string | null;
}

export function ChangeClientDialog({ open, onOpenChange, quoteId, currentClientId }: Props) {
  const { data: clients = [] } = useClients();
  const [clientId, setClientId] = useState<string>(currentClientId ?? "");
  const upd = useUpdateQuote();

  async function save() {
    if (!clientId) return;
    try {
      await upd.mutateAsync({ id: quoteId, client_id: clientId } as any);
      toast.success("Klijent izmenjen");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Greška");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promeni klijenta</DialogTitle>
          <DialogDescription>Promena klijenta na postojećoj ponudi.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Klijent</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Izaberi klijenta" /></SelectTrigger>
            <SelectContent>
              {clients.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
          <Button onClick={save} disabled={upd.isPending || !clientId}>
            {upd.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Sačuvaj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
