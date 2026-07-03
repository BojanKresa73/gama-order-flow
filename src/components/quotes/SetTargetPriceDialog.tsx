import { useState } from "react";
import { Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useUpdateQuote } from "@/hooks/useQuotesPro";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quoteId: string;
  currentTarget: number | null;
  currentFinal: number;
}

export function SetTargetPriceDialog({ open, onOpenChange, quoteId, currentTarget, currentFinal }: Props) {
  const [value, setValue] = useState<string>(currentTarget?.toString() ?? "");
  const upd = useUpdateQuote();

  async function save() {
    const n = value.trim() === "" ? null : Number(value);
    if (n != null && (isNaN(n) || n < 0)) {
      toast.error("Neispravan iznos");
      return;
    }
    try {
      await upd.mutateAsync({ id: quoteId, target_price_eur: n } as any);
      toast.success("Ciljna cena sačuvana");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Greška");
    }
  }

  const gap = currentTarget != null ? currentFinal - currentTarget : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-4 w-4" /> Ciljna cena
          </DialogTitle>
          <DialogDescription>
            Interna cena koju želiš da postigneš za ovu ponudu.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ciljna cena (€)</Label>
            <Input
              type="number" step="0.01"
              placeholder="Ostavi prazno za brisanje"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            Trenutni total: <b>{currentFinal.toFixed(2)} €</b>
            {gap != null && (
              <div className={gap >= 0 ? "text-emerald-600" : "text-destructive"}>
                Razlika: {gap >= 0 ? "+" : ""}{gap.toFixed(2)} €
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
          <Button onClick={save} disabled={upd.isPending}>
            {upd.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Sačuvaj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
