import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useUpdateQuoteItem,
  useRecalculateQuoteTotals,
  type QuoteItem,
} from "@/hooks/useQuotesPro";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: QuoteItem;
  quoteId: string;
}

export function EditQuoteItemDialog({ open, onOpenChange, item, quoteId }: Props) {
  const [form, setForm] = useState(() => ({
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    width_mm: item.width_mm,
    height_mm: item.height_mm,
    unit_price: item.unit_price,
    custom_price: item.custom_price,
    cost_per_m2: item.cost_per_m2,
    finishing_cost: item.finishing_cost ?? 0,
    markup_percent: item.markup_percent,
    supplier_name: item.supplier_name,
  }));
  const upd = useUpdateQuoteItem();
  const recalc = useRecalculateQuoteTotals();

  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    try {
      await upd.mutateAsync({ id: item.id, quote_id: quoteId, ...form } as any);
      await recalc.mutateAsync(quoteId);
      toast.success("Stavka izmenjena");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Greška");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Izmeni stavku — {item.item_type}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Naziv</Label>
            <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} />
          </div>
          <div>
            <Label>Opis</Label>
            <Textarea rows={2} value={form.description ?? ""} onChange={(e) => patch({ description: e.target.value || null })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Količina</Label>
              <Input type="number" value={form.quantity} onChange={(e) => patch({ quantity: Number(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>Marža %</Label>
              <Input type="number" value={form.markup_percent ?? ""} onChange={(e) => patch({ markup_percent: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <Label>Custom cena</Label>
              <Input type="number" step="0.01" value={form.custom_price ?? ""} onChange={(e) => patch({ custom_price: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>
          {item.item_type === "large_format" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Širina (mm)</Label>
                <Input type="number" value={form.width_mm ?? ""} onChange={(e) => patch({ width_mm: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <Label>Visina (mm)</Label>
                <Input type="number" value={form.height_mm ?? ""} onChange={(e) => patch({ height_mm: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <Label>Cena/m² (€)</Label>
                <Input type="number" step="0.01" value={form.cost_per_m2 ?? ""} onChange={(e) => patch({ cost_per_m2: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Jedinična cena (€)</Label>
              <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => patch({ unit_price: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Dorada (€)</Label>
              <Input type="number" step="0.01" value={form.finishing_cost} onChange={(e) => patch({ finishing_cost: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <Label>Dobavljač</Label>
            <Input value={form.supplier_name ?? ""} onChange={(e) => patch({ supplier_name: e.target.value || null })} />
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
