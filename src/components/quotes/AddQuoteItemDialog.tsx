import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MaterialCombobox } from "@/components/quotes/MaterialCombobox";
import {
  useLargeFormatMaterialsWithPrices,
  getApplicablePrice,
} from "@/hooks/useLargeFormatPricing";
import { useServicesGDC, priceGdcService } from "@/hooks/useServicesPricingGDC";
import {
  useAddQuoteItem,
  useRecalculateQuoteTotals,
  type QuoteItemType,
} from "@/hooks/useQuotesPro";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quoteId: string;
  orderIndex: number;
  defaultTab?: QuoteItemType;
}

const TAB_LABEL: Record<QuoteItemType, string> = {
  large_format: "LFP",
  digital: "Digital",
  service: "Sitna",
  razno: "Ostalo",
};

const emptyItem = (quote_id: string, item_type: QuoteItemType, orderIndex: number) => ({
  quote_id,
  item_type,
  name: "",
  description: null as string | null,
  quantity: 1,
  width_mm: null as number | null,
  height_mm: null as number | null,
  pages: null as number | null,
  print_sides: "4/0" as string | null,
  paper_type: null as string | null,
  paper_gsm: null as number | null,
  sheet_format: null as string | null,
  material_id: null as string | null,
  material_name: null as string | null,
  area_m2: null as number | null,
  service_id: null as string | null,
  service_name: null as string | null,
  unit_cost: 0,
  unit_price: 0,
  custom_price: null as number | null,
  line_total: 0,
  supplier_name: null as string | null,
  supplier_price: null as number | null,
  cost_per_m2: null as number | null,
  finishing_cost: 0,
  markup_percent: null as number | null,
  source_category: null as string | null,
  min_qty_per_order: null as number | null,
  yearly_qty: null as number | null,
  order_index: orderIndex,
});

export function AddQuoteItemDialog({
  open, onOpenChange, quoteId, orderIndex, defaultTab = "large_format",
}: Props) {
  const [tab, setTab] = useState<QuoteItemType>(defaultTab);
  const [form, setForm] = useState(() => emptyItem(quoteId, defaultTab, orderIndex));
  const materialsQ = useLargeFormatMaterialsWithPrices();
  const servicesQ = useServicesGDC();
  const addItem = useAddQuoteItem();
  const recalc = useRecalculateQuoteTotals();

  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  function switchTab(t: QuoteItemType) {
    setTab(t);
    setForm(emptyItem(quoteId, t, orderIndex));
  }

  const areaM2 = useMemo(() => {
    if (!form.width_mm || !form.height_mm) return 0;
    return (form.width_mm * form.height_mm) / 1_000_000;
  }, [form.width_mm, form.height_mm]);

  const material = form.material_id
    ? materialsQ.data?.find((m) => m.id === form.material_id) ?? null
    : null;

  const derivedCostPerM2 = material ? getApplicablePrice(material.price, areaM2 * form.quantity) : 0;

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Naziv je obavezan");
      return;
    }
    const payload: any = { ...form };

    if (tab === "large_format") {
      const totalArea = areaM2 * form.quantity;
      const cost = derivedCostPerM2 || form.cost_per_m2 || 0;
      const markup = form.markup_percent ?? 30;
      const unit_price = cost * (1 + markup / 100);
      payload.area_m2 = areaM2;
      payload.cost_per_m2 = cost;
      payload.unit_cost = cost * areaM2;
      payload.unit_price = unit_price * areaM2;
      payload.line_total = (form.custom_price ?? payload.unit_price) * form.quantity + (form.finishing_cost || 0);
      payload.material_name = material?.name ?? null;
      payload.source_category = material?.category ?? null;
    } else if (tab === "service") {
      const svc = servicesQ.data?.find((s) => s.id === form.service_id) ?? null;
      const qty = form.quantity;
      const unit = svc ? priceGdcService(svc, 1) : form.unit_price;
      const total = svc ? priceGdcService(svc, qty) : unit * qty;
      payload.service_name = svc?.name ?? form.service_name;
      payload.unit_price = unit;
      payload.line_total = form.custom_price != null ? form.custom_price * qty : total;
    } else {
      // digital / razno — koristimo unit_price/custom_price direktno
      const unit = form.custom_price ?? form.unit_price;
      payload.line_total = unit * form.quantity + (form.finishing_cost || 0);
    }

    try {
      await addItem.mutateAsync(payload);
      await recalc.mutateAsync(quoteId);
      toast.success("Stavka dodata");
      onOpenChange(false);
      setForm(emptyItem(quoteId, tab, orderIndex + 1));
    } catch (e: any) {
      toast.error(e?.message ?? "Greška pri dodavanju");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj stavku ponude</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => switchTab(v as QuoteItemType)}>
          <TabsList className="grid grid-cols-4 w-full">
            {(Object.keys(TAB_LABEL) as QuoteItemType[]).map((k) => (
              <TabsTrigger key={k} value={k}>{TAB_LABEL[k]}</TabsTrigger>
            ))}
          </TabsList>

          {/* Zajednički deo */}
          <div className="grid gap-3 mt-4">
            <div>
              <Label>Naziv *</Label>
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} />
            </div>
            <div>
              <Label>Opis</Label>
              <Textarea
                rows={2}
                value={form.description ?? ""}
                onChange={(e) => patch({ description: e.target.value || null })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Količina</Label>
                <Input
                  type="number" min={1}
                  value={form.quantity}
                  onChange={(e) => patch({ quantity: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Marža %</Label>
                <Input
                  type="number"
                  value={form.markup_percent ?? ""}
                  onChange={(e) => patch({ markup_percent: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Custom cena (jed.)</Label>
                <Input
                  type="number" step="0.01"
                  value={form.custom_price ?? ""}
                  onChange={(e) => patch({ custom_price: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>
          </div>

          <TabsContent value="large_format" className="space-y-3 mt-4">
            <div>
              <Label>Materijal (GDC)</Label>
              <MaterialCombobox
                materials={materialsQ.data ?? []}
                value={form.material_id}
                onChange={(id) => patch({ material_id: id })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Širina (mm)</Label>
                <Input
                  type="number"
                  value={form.width_mm ?? ""}
                  onChange={(e) => patch({ width_mm: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Visina (mm)</Label>
                <Input
                  type="number"
                  value={form.height_mm ?? ""}
                  onChange={(e) => patch({ height_mm: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex flex-wrap gap-6">
              <span>Površina (kom): <b>{areaM2.toFixed(3)} m²</b></span>
              <span>Cena/m² (nabavna): <b>{derivedCostPerM2.toFixed(2)} €</b></span>
              <span>Ukupno m²: <b>{(areaM2 * form.quantity).toFixed(3)}</b></span>
            </div>
            <div>
              <Label>Dorada (fiksni trošak €)</Label>
              <Input
                type="number" step="0.01"
                value={form.finishing_cost}
                onChange={(e) => patch({ finishing_cost: Number(e.target.value) || 0 })}
              />
            </div>
          </TabsContent>

          <TabsContent value="digital" className="space-y-3 mt-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tiraž</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => patch({ quantity: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Strane</Label>
                <Input
                  type="number"
                  value={form.pages ?? ""}
                  onChange={(e) => patch({ pages: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Print</Label>
                <Select value={form.print_sides ?? "4/0"} onValueChange={(v) => patch({ print_sides: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["4/0", "4/4", "1/0", "1/1"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Papir</Label>
                <Input
                  value={form.paper_type ?? ""}
                  onChange={(e) => patch({ paper_type: e.target.value || null })}
                />
              </div>
              <div>
                <Label>Gramaža</Label>
                <Input
                  type="number"
                  value={form.paper_gsm ?? ""}
                  onChange={(e) => patch({ paper_gsm: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Format arka</Label>
                <Input
                  value={form.sheet_format ?? ""}
                  onChange={(e) => patch({ sheet_format: e.target.value || null })}
                />
              </div>
            </div>
            <div>
              <Label>Jedinična cena (€)</Label>
              <Input
                type="number" step="0.01"
                value={form.unit_price}
                onChange={(e) => patch({ unit_price: Number(e.target.value) || 0 })}
              />
            </div>
          </TabsContent>

          <TabsContent value="service" className="space-y-3 mt-4">
            <div>
              <Label>Usluga (GDC cenovnik)</Label>
              <Select
                value={form.service_id ?? ""}
                onValueChange={(v) => {
                  const svc = servicesQ.data?.find((s) => s.id === v);
                  patch({ service_id: v, service_name: svc?.name ?? null, unit_price: Number(svc?.price ?? 0) });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Izaberi uslugu" /></SelectTrigger>
                <SelectContent>
                  {(servicesQ.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {Number(s.price ?? 0).toFixed(2)} €/{s.unit ?? "kom"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jedinična cena (€)</Label>
              <Input
                type="number" step="0.01"
                value={form.unit_price}
                onChange={(e) => patch({ unit_price: Number(e.target.value) || 0 })}
              />
            </div>
          </TabsContent>

          <TabsContent value="razno" className="space-y-3 mt-4">
            <div>
              <Label>Jedinična cena (€)</Label>
              <Input
                type="number" step="0.01"
                value={form.unit_price}
                onChange={(e) => patch({ unit_price: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Dobavljač</Label>
              <Input
                value={form.supplier_name ?? ""}
                onChange={(e) => patch({ supplier_name: e.target.value || null })}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
          <Button onClick={handleSave} disabled={addItem.isPending}>
            {addItem.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Dodaj stavku
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
