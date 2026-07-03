import { useMemo, useState } from "react";
import { Printer, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useDigitalPriceList } from "@/hooks/useDigitalPriceList";
import { useDigitalPaperTypes } from "@/hooks/useDigitalPaperTypes";
import { useKasiranjeSettings } from "@/hooks/useKasiranjeSettings";
import {
  useAddQuoteItem,
  useUpdateQuoteItem,
  useDeleteQuoteItem,
  useRecalculateQuoteTotals,
  type QuoteItem,
} from "@/hooks/useQuotesPro";

interface Props {
  quoteId: string;
  items: QuoteItem[];
}

/**
 * DigitalWorkspacePanel — brzi editor za digitalne poslove u ponudi.
 * Prikazuje sve stavke `item_type='digital'` sa inline izmenom ključnih polja
 * (papir, obim, tiraž, cena po arku iz GDC price-liste).
 */
export function DigitalWorkspacePanel({ quoteId, items }: Props) {
  const digitalItems = useMemo(() => items.filter((i) => i.item_type === "digital"), [items]);
  const { data: priceList = [] } = useDigitalPriceList();
  const { data: paperTypes = [] } = useDigitalPaperTypes();
  const { data: kas } = useKasiranjeSettings();

  const add = useAddQuoteItem();
  const upd = useUpdateQuoteItem();
  const del = useDeleteQuoteItem();
  const recalc = useRecalculateQuoteTotals();

  const [drafts, setDrafts] = useState<Record<string, Partial<QuoteItem>>>({});

  function draftFor(item: QuoteItem): Partial<QuoteItem> {
    return { ...item, ...(drafts[item.id] ?? {}) };
  }

  function patchDraft(id: string, patch: Partial<QuoteItem>) {
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? {}), ...patch } }));
  }

  async function persist(id: string) {
    const patch = drafts[id];
    if (!patch) return;
    try {
      await upd.mutateAsync({ id, quote_id: quoteId, ...patch } as any);
      await recalc.mutateAsync(quoteId);
      setDrafts((d) => {
        const c = { ...d };
        delete c[id];
        return c;
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Greška");
    }
  }

  async function addNew() {
    try {
      await add.mutateAsync({
        quote_id: quoteId,
        item_type: "digital",
        name: "Digitalna štampa",
        description: null,
        quantity: 100,
        width_mm: null, height_mm: null,
        pages: 2, print_sides: "4/0",
        paper_type: paperTypes[0]?.name ?? null,
        paper_gsm: 300, sheet_format: "SRA3",
        material_id: null, material_name: null, area_m2: null,
        service_id: null, service_name: null,
        unit_cost: 0, unit_price: 0.35, custom_price: null,
        line_total: 35, supplier_name: null, supplier_price: null,
        cost_per_m2: null, finishing_cost: 0, markup_percent: 50,
        source_category: "digital", min_qty_per_order: null, yearly_qty: null,
        order_index: items.length,
        toner_cost_per_m2_eur: kas?.tonerPerM2Eur ?? 1.1,
      } as any);
      await recalc.mutateAsync(quoteId);
      toast.success("Digitalna stavka dodata");
    } catch (e: any) {
      toast.error(e?.message ?? "Greška");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Printer className="h-4 w-4" /> Digitalna štampa ({digitalItems.length})
        </CardTitle>
        <Button size="sm" onClick={addNew} disabled={add.isPending}>
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {digitalItems.length === 0 && (
          <p className="text-sm text-muted-foreground">Nema digitalnih stavki.</p>
        )}
        {digitalItems.map((item) => {
          const d = draftFor(item);
          const dirty = !!drafts[item.id];
          const totalSheets = Number(d.quantity ?? 0) * Number(d.pages ?? 1);
          return (
            <div key={item.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Input
                  className="h-8 font-medium"
                  value={d.name ?? ""}
                  onChange={(e) => patchDraft(item.id, { name: e.target.value })}
                />
                <div className="flex gap-1">
                  {dirty && (
                    <Button size="sm" variant="outline" onClick={() => persist(item.id)}>Sačuvaj</Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={async () => {
                    await del.mutateAsync({ id: item.id, quote_id: quoteId });
                    await recalc.mutateAsync(quoteId);
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">Papir</Label>
                  <Select
                    value={d.paper_type ?? ""}
                    onValueChange={(v) => patchDraft(item.id, { paper_type: v })}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {paperTypes.map((p) => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Gramaža</Label>
                  <Input className="h-8" type="number" value={d.paper_gsm ?? ""} onChange={(e) => patchDraft(item.id, { paper_gsm: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <Label className="text-xs">Format</Label>
                  <Input className="h-8" value={d.sheet_format ?? ""} onChange={(e) => patchDraft(item.id, { sheet_format: e.target.value || null })} />
                </div>
                <div>
                  <Label className="text-xs">Print</Label>
                  <Select
                    value={d.print_sides ?? "4/0"}
                    onValueChange={(v) => patchDraft(item.id, { print_sides: v })}
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["4/0", "4/4", "1/0", "1/1"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tiraž</Label>
                  <Input className="h-8" type="number" value={d.quantity ?? 1} onChange={(e) => patchDraft(item.id, { quantity: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label className="text-xs">Obim</Label>
                  <Input className="h-8" type="number" value={d.pages ?? 1} onChange={(e) => patchDraft(item.id, { pages: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label className="text-xs">Cena/arak</Label>
                  <Input className="h-8" type="number" step="0.01" value={d.unit_price ?? 0} onChange={(e) => patchDraft(item.id, { unit_price: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Arka ukupno</Label>
                  <Input className="h-8" disabled value={totalSheets} />
                </div>
              </div>

              {priceList.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  GDC price-list: {priceList.length} nivoa dostupno
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
