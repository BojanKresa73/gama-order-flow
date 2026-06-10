import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { useDigitalPaperTypes } from "@/hooks/useDigitalPaperTypes";
import { useDigitalProductTypes } from "@/hooks/useDigitalProductTypes";
import {
  useDigitalFinishingTypes,
  useDigitalFinishingPrices,
} from "@/hooks/useDigitalFinishings";
import { SHEET_FORMATS, PRINT_MODES } from "@/lib/digitalCalculations";
import {
  PAGE_FORMAT_PRESETS,
  buildProductJobs,
  type ProductDraft,
} from "@/lib/digitalProductPricing";
import type { LocalDigitalJob } from "./LocalDigitalJobsTable";

interface DigitalProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (jobs: LocalDigitalJob[]) => void;
}

const DEFAULT_DRAFT: ProductDraft = {
  product_code: "katalog",
  name: "",
  qty: 100,
  page_count: 8,
  page_format: "A4",
  page_width_mm: 210,
  page_height_mm: 297,
  machine_sheet_format: "488x330",
  paper_type: "Kunzdruk 135g",
  print_sides: "4/4",
  has_cover: false,
  cover_paper: "Kunzdruk 300g",
  cover_print_sides: "4/4",
  cover_lamination: "none",
  binding_code: "none",
  finishings: [],
};

export const DigitalProductDialog = ({
  open,
  onOpenChange,
  onAdd,
}: DigitalProductDialogProps) => {
  const { data: paperTypes } = useDigitalPaperTypes();
  const { data: products } = useDigitalProductTypes();
  const { data: finishingTypes } = useDigitalFinishingTypes();
  const { data: finishingPrices } = useDigitalFinishingPrices();

  const [draft, setDraft] = useState<ProductDraft>(DEFAULT_DRAFT);

  // When product changes, apply its defaults
  useEffect(() => {
    if (!products) return;
    const p = products.find((x) => x.code === draft.product_code);
    if (!p) return;
    setDraft((d) => ({
      ...d,
      paper_type: p.default_paper || d.paper_type,
      print_sides: p.default_print_sides || d.print_sides,
      machine_sheet_format:
        p.default_machine_sheet_format || d.machine_sheet_format,
      has_cover: p.supports_cover ? d.has_cover : false,
      page_count: p.supports_pages ? d.page_count || 8 : 1,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.product_code, products]);

  // When page format preset changes, set dimensions
  useEffect(() => {
    const preset = PAGE_FORMAT_PRESETS.find((p) => p.code === draft.page_format);
    if (preset && preset.code !== "CUSTOM") {
      setDraft((d) => ({
        ...d,
        page_width_mm: preset.width_mm,
        page_height_mm: preset.height_mm,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.page_format]);

  const currentProduct = products?.find((p) => p.code === draft.product_code);

  // Group finishing types by category for the picker
  const finishingByCategory = useMemo(() => {
    const map: Record<string, typeof finishingTypes> = {};
    (finishingTypes ?? []).forEach((t) => {
      if (!map[t.category]) map[t.category] = [];
      map[t.category]!.push(t);
    });
    return map;
  }, [finishingTypes]);

  const getVariantsForCode = (code: string) =>
    (finishingPrices ?? []).filter((p) => p.finishing_code === code);

  const addFinishing = (code: string) => {
    const variants = getVariantsForCode(code);
    if (variants.length === 0) return;
    setDraft((d) => ({
      ...d,
      finishings: [
        ...d.finishings,
        { code, variant: variants[0].variant, qty: d.qty },
      ],
    }));
  };

  const removeFinishing = (index: number) => {
    setDraft((d) => ({
      ...d,
      finishings: d.finishings.filter((_, i) => i !== index),
    }));
  };

  const updateFinishing = (
    index: number,
    patch: Partial<{ variant: string; qty: number }>
  ) => {
    setDraft((d) => ({
      ...d,
      finishings: d.finishings.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
  };

  // Live preview of finishings cost
  const preview = useMemo(() => {
    if (!finishingTypes || !finishingPrices) {
      return { jobs: [], finishings: [], finishingsTotal: 0 };
    }
    return buildProductJobs(draft, finishingTypes, finishingPrices);
  }, [draft, finishingTypes, finishingPrices]);

  const handleAdd = () => {
    if (!finishingTypes || !finishingPrices) return;
    const built = buildProductJobs(draft, finishingTypes, finishingPrices);
    onAdd(built.jobs);
    onOpenChange(false);
    setDraft(DEFAULT_DRAFT);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj proizvod (digitalna štampa)</DialogTitle>
          <DialogDescription>
            Konfiguriši proizvod, korice, povez i dorade — sistem će generisati
            stavke naloga sa progresivnom cenom štampe.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT: form */}
          <div className="space-y-4">
            <div>
              <Label>Tip proizvoda</Label>
              <Select
                value={draft.product_code}
                onValueChange={(v) => setDraft((d) => ({ ...d, product_code: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentProduct?.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {currentProduct.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Naziv stavke</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="npr. Katalog leto 2026"
                />
              </div>
              <div>
                <Label>Tiraž (broj primeraka)</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.qty}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, qty: Math.max(1, +e.target.value || 1) }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Format strane</Label>
                <Select
                  value={draft.page_format}
                  onValueChange={(v) => setDraft((d) => ({ ...d, page_format: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_FORMAT_PRESETS.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mašinski tabak</Label>
                <Select
                  value={draft.machine_sheet_format}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, machine_sheet_format: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHEET_FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {draft.page_format === "CUSTOM" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Širina (mm)</Label>
                  <Input
                    type="number"
                    value={draft.page_width_mm}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, page_width_mm: +e.target.value || 0 }))
                    }
                  />
                </div>
                <div>
                  <Label>Visina (mm)</Label>
                  <Input
                    type="number"
                    value={draft.page_height_mm}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, page_height_mm: +e.target.value || 0 }))
                    }
                  />
                </div>
              </div>
            )}

            {currentProduct?.supports_pages && (
              <div>
                <Label>Broj strana (sa koricama)</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.page_count}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, page_count: +e.target.value || 1 }))
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Papir unutrašnjosti</Label>
                <Select
                  value={draft.paper_type}
                  onValueChange={(v) => setDraft((d) => ({ ...d, paper_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paperTypes?.map((pt) => (
                      <SelectItem key={pt.id} value={pt.name}>
                        {pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Štampa unutrašnjosti</Label>
                <Select
                  value={draft.print_sides}
                  onValueChange={(v) => setDraft((d) => ({ ...d, print_sides: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRINT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {currentProduct?.supports_cover && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has_cover"
                    checked={draft.has_cover}
                    onCheckedChange={(v) =>
                      setDraft((d) => ({ ...d, has_cover: !!v }))
                    }
                  />
                  <Label htmlFor="has_cover" className="cursor-pointer">
                    Posebne korice (drugi papir)
                  </Label>
                </div>

                {draft.has_cover && (
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div>
                      <Label>Papir korica</Label>
                      <Select
                        value={draft.cover_paper}
                        onValueChange={(v) =>
                          setDraft((d) => ({ ...d, cover_paper: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paperTypes?.map((pt) => (
                            <SelectItem key={pt.id} value={pt.name}>
                              {pt.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Štampa korica</Label>
                      <Select
                        value={draft.cover_print_sides}
                        onValueChange={(v) =>
                          setDraft((d) => ({ ...d, cover_print_sides: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRINT_MODES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>Plastifikacija korica</Label>
                      <Select
                        value={draft.cover_lamination}
                        onValueChange={(v) =>
                          setDraft((d) => ({ ...d, cover_lamination: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Bez plastifikacije</SelectItem>
                          {getVariantsForCode("plastifikacija").map((v) => (
                            <SelectItem key={v.id} value={v.variant}>
                              {v.variant}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT: finishings + preview */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Dorade</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Dodaj dorade (povez, sečenje, numeracija…). Cene se uzimaju iz cenovnika.
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(finishingByCategory).map(([cat, items]) =>
                  items?.map((t) => (
                    <Button
                      key={t.code}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addFinishing(t.code)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {t.name}
                    </Button>
                  ))
                )}
              </div>

              <div className="space-y-2">
                {draft.finishings.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Nema dodatih dorada.
                  </p>
                )}
                {draft.finishings.map((f, i) => {
                  const type = finishingTypes?.find((t) => t.code === f.code);
                  const variants = getVariantsForCode(f.code);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 border rounded-md bg-muted/30"
                    >
                      <Badge variant="secondary" className="text-xs">
                        {type?.name}
                      </Badge>
                      {variants.length > 1 && (
                        <Select
                          value={f.variant}
                          onValueChange={(v) => updateFinishing(i, { variant: v })}
                        >
                          <SelectTrigger className="h-7 w-[160px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {variants.map((v) => (
                              <SelectItem key={v.id} value={v.variant}>
                                {v.variant}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Input
                        type="number"
                        className="h-7 w-20 text-xs"
                        value={f.qty || draft.qty}
                        onChange={(e) =>
                          updateFinishing(i, { qty: +e.target.value || 0 })
                        }
                        title="Količina"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 ml-auto"
                        onClick={() => removeFinishing(i)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
              <div className="font-semibold mb-1">Pregled stavki naloga</div>
              {preview.jobs.map((j, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{j.name}</span>
                  <span>
                    {j.obim} × {j.qty} = {(j.obim || 0) * (j.qty || 0)} tab.
                  </span>
                </div>
              ))}
              {preview.finishings.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <div className="font-semibold mb-1">Dorade</div>
                  {preview.finishings.map((f, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {f.name}
                        {f.variant ? ` — ${f.variant}` : ""}
                      </span>
                      <span className="font-medium">{f.total.toFixed(2)} €</span>
                    </div>
                  ))}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-semibold">
                    <span>Ukupno dorade:</span>
                    <span className="text-primary">
                      {preview.finishingsTotal.toFixed(2)} €
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button onClick={handleAdd}>Dodaj na nalog</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
