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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Package,
  Layers,
  Wrench,
  FileText,
  BookOpen,
  Layout,
  ClipboardList,
  Check,
} from "lucide-react";
import { useDigitalPaperTypes } from "@/hooks/useDigitalPaperTypes";
import { useDigitalProductTypes } from "@/hooks/useDigitalProductTypes";
import {
  useDigitalFinishingTypes,
  useDigitalFinishingPrices,
} from "@/hooks/useDigitalFinishings";
import {
  SHEET_FORMATS,
  PRINT_MODES,
  PAPER_PRICE_TABLE,
  COLOR_CLICK_COST_BASE,
  MONO_CLICK_COST_BASE,
  getCoverageSides,
  getSheetMultiplier,
  getProgressiveBreakdown,
} from "@/lib/digitalCalculations";
import { calculateGroupedPricing } from "@/lib/digitalGroupedPricing";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
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

const PRODUCT_ICONS: Record<string, typeof FileText> = {
  katalog: BookOpen,
  flajer: FileText,
  vizit: Layout,
  poster: Layout,
  blok: ClipboardList,
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
  const [tab, setTab] = useState<"product" | "material" | "finishings">("product");

  useEffect(() => {
    if (!products) return;
    const p = products.find((x) => x.code === draft.product_code);
    if (!p) return;
    setDraft((d) => ({
      ...d,
      paper_type: p.default_paper || d.paper_type,
      print_sides: p.default_print_sides || d.print_sides,
      machine_sheet_format: p.default_machine_sheet_format || d.machine_sheet_format,
      has_cover: p.supports_cover ? d.has_cover : false,
      page_count: p.supports_pages ? d.page_count || 8 : 1,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.product_code, products]);

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

  const getVariantsForCode = (code: string) =>
    (finishingPrices ?? []).filter((p) => p.finishing_code === code);

  const isFinishingActive = (code: string) =>
    draft.finishings.some((f) => f.code === code);

  const toggleFinishing = (code: string) => {
    setDraft((d) => {
      const exists = d.finishings.find((f) => f.code === code);
      if (exists) {
        return { ...d, finishings: d.finishings.filter((f) => f.code !== code) };
      }
      const variants = getVariantsForCode(code);
      if (variants.length === 0) return d;
      return {
        ...d,
        finishings: [
          ...d.finishings,
          { code, variant: variants[0].variant, qty: d.qty },
        ],
      };
    });
  };

  const updateFinishing = (
    code: string,
    patch: Partial<{ variant: string; qty: number }>
  ) => {
    setDraft((d) => ({
      ...d,
      finishings: d.finishings.map((f) =>
        f.code === code ? { ...f, ...patch } : f
      ),
    }));
  };

  const preview = useMemo(() => {
    if (!finishingTypes || !finishingPrices) {
      return { jobs: [], finishings: [], finishingsTotal: 0 };
    }
    return buildProductJobs(draft, finishingTypes, finishingPrices);
  }, [draft, finishingTypes, finishingPrices]);

  const printPricing = useMemo(() => {
    if (preview.jobs.length === 0) return null;
    try {
      return calculateGroupedPricing(preview.jobs as any, 0);
    } catch {
      return null;
    }
  }, [preview.jobs]);

  const printTotal = printPricing?.totalWithPrep ?? 0;
  const paperCost = printPricing?.totalPaperCost ?? 0;
  const clickCost = printPricing?.totalClickCost ?? 0;
  const grandTotal = printTotal + preview.finishingsTotal;
  const pricePerPiece = draft.qty > 0 ? grandTotal / draft.qty : 0;


  const handleAdd = () => {
    if (!finishingTypes || !finishingPrices) return;
    const built = buildProductJobs(draft, finishingTypes, finishingPrices);
    onAdd(built.jobs);
    onOpenChange(false);
    setDraft(DEFAULT_DRAFT);
    setTab("product");
  };

  const finishingsCount = draft.finishings.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="text-lg">Dodaj proizvod (digitalna štampa)</DialogTitle>
          <DialogDescription className="text-xs">
            Konfiguriši proizvod kroz korake — sistem generiše stavke naloga sa cenom.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-0 flex-1 overflow-hidden">
          {/* LEFT: tabbed form */}
          <div className="overflow-y-auto px-6 py-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="grid grid-cols-3 w-full mb-5">
                <TabsTrigger value="product" className="gap-2">
                  <Package className="h-4 w-4" />
                  <span>1. Proizvod</span>
                </TabsTrigger>
                <TabsTrigger value="material" className="gap-2">
                  <Layers className="h-4 w-4" />
                  <span>2. Materijal</span>
                </TabsTrigger>
                <TabsTrigger value="finishings" className="gap-2">
                  <Wrench className="h-4 w-4" />
                  <span>
                    3. Dorade{finishingsCount > 0 ? ` (${finishingsCount})` : ""}
                  </span>
                </TabsTrigger>
              </TabsList>

              {/* === STEP 1: PRODUCT === */}
              <TabsContent value="product" className="space-y-5 mt-0">
                <div>
                  <Label className="mb-2 block">Tip proizvoda</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {products?.map((p) => {
                      const Icon = PRODUCT_ICONS[p.code] ?? FileText;
                      const active = draft.product_code === p.code;
                      return (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({ ...d, product_code: p.code }))
                          }
                          className={cn(
                            "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all",
                            active
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/40 hover:bg-muted/50"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-5 w-5",
                              active ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                          <span className="text-sm font-medium leading-tight">
                            {p.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {currentProduct?.description && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {currentProduct.description}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Naziv stavke</Label>
                    <Input
                      value={draft.name}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, name: e.target.value }))
                      }
                      placeholder="npr. Katalog leto 2026"
                    />
                  </div>
                  <div>
                    <Label>Tiraž (primeraka)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={draft.qty}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          qty: Math.max(1, +e.target.value || 1),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Format strane</Label>
                    <Select
                      value={draft.page_format}
                      onValueChange={(v) =>
                        setDraft((d) => ({ ...d, page_format: v }))
                      }
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
                  {currentProduct?.supports_pages ? (
                    <div>
                      <Label>Broj strana (sa koricama)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={draft.page_count}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            page_count: +e.target.value || 1,
                          }))
                        }
                      />
                    </div>
                  ) : (
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
                  )}
                </div>

                {draft.page_format === "CUSTOM" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Širina (mm)</Label>
                      <Input
                        type="number"
                        value={draft.page_width_mm}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            page_width_mm: +e.target.value || 0,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Visina (mm)</Label>
                      <Input
                        type="number"
                        value={draft.page_height_mm}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            page_height_mm: +e.target.value || 0,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={() => setTab("material")}>
                    Dalje: Materijal →
                  </Button>
                </div>
              </TabsContent>

              {/* === STEP 2: MATERIAL === */}
              <TabsContent value="material" className="space-y-5 mt-0">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Unutrašnjost</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Papir</Label>
                      <Select
                        value={draft.paper_type}
                        onValueChange={(v) =>
                          setDraft((d) => ({ ...d, paper_type: v }))
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
                      <Label>Štampa</Label>
                      <Select
                        value={draft.print_sides}
                        onValueChange={(v) =>
                          setDraft((d) => ({ ...d, print_sides: v }))
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
                    {currentProduct?.supports_pages && (
                      <div className="col-span-2">
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
                    )}
                  </div>
                </div>

                {currentProduct?.supports_cover && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold">Posebne korice</h3>
                        </div>
                        <Switch
                          checked={draft.has_cover}
                          onCheckedChange={(v) =>
                            setDraft((d) => ({ ...d, has_cover: !!v }))
                          }
                        />
                      </div>

                      {draft.has_cover && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
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
                    </div>
                  </>
                )}

                <div className="flex justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTab("product")}
                  >
                    ← Nazad
                  </Button>
                  <Button type="button" onClick={() => setTab("finishings")}>
                    Dalje: Dorade →
                  </Button>
                </div>
              </TabsContent>

              {/* === STEP 3: FINISHINGS === */}
              <TabsContent value="finishings" className="space-y-3 mt-0">
                <p className="text-xs text-muted-foreground">
                  Klikni doradu da je uključiš. Cene se računaju iz cenovnika.
                </p>

                <div className="space-y-2">
                  {finishingTypes?.map((t) => {
                    const active = isFinishingActive(t.code);
                    const variants = getVariantsForCode(t.code);
                    const current = draft.finishings.find((f) => f.code === t.code);
                    const previewLine = preview.finishings.find(
                      (p) => p.name === t.name
                    );
                    return (
                      <div
                        key={t.code}
                        className={cn(
                          "rounded-lg border transition-all overflow-hidden",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleFinishing(t.code)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                "h-5 w-5 rounded border flex items-center justify-center transition-colors",
                                active
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/40"
                              )}
                            >
                              {active && <Check className="h-3.5 w-3.5" />}
                            </div>
                            <span className="text-sm font-medium">{t.name}</span>
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {t.category}
                            </span>
                          </div>
                          {active && previewLine && (
                            <span className="text-sm font-semibold text-primary">
                              {previewLine.total.toFixed(2)} €
                            </span>
                          )}
                        </button>

                        {active && current && (
                          <div className="px-3 pb-3 pt-1 grid grid-cols-[1fr_120px] gap-2 border-t border-primary/10">
                            {variants.length > 1 ? (
                              <Select
                                value={current.variant}
                                onValueChange={(v) =>
                                  updateFinishing(t.code, { variant: v })
                                }
                              >
                                <SelectTrigger className="h-9">
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
                            ) : (
                              <div className="text-xs text-muted-foreground self-center">
                                {variants[0]?.variant || "—"}
                              </div>
                            )}
                            <Input
                              type="number"
                              min={1}
                              className="h-9"
                              value={current.qty || draft.qty}
                              onChange={(e) =>
                                updateFinishing(t.code, {
                                  qty: +e.target.value || 0,
                                })
                              }
                              placeholder="Količina"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTab("material")}
                  >
                    ← Nazad
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT: sticky summary */}
          <aside className="border-l bg-muted/30 overflow-y-auto px-5 py-4 space-y-4 hidden md:block">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Sažetak
              </h4>
              <div className="space-y-1 text-sm">
                <SummaryRow label="Proizvod" value={currentProduct?.name ?? "—"} />
                <SummaryRow label="Tiraž" value={`${draft.qty} kom`} />
                <SummaryRow
                  label="Format"
                  value={
                    draft.page_format === "CUSTOM"
                      ? `${draft.page_width_mm}×${draft.page_height_mm} mm`
                      : draft.page_format
                  }
                />
                {currentProduct?.supports_pages && (
                  <SummaryRow label="Strana" value={String(draft.page_count)} />
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Stavke naloga
              </h4>
              {preview.jobs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">—</p>
              ) : (
                <div className="space-y-1.5">
                  {preview.jobs.map((j, i) => (
                    <div key={i} className="text-xs">
                      <div className="font-medium">{j.name}</div>
                      <div className="text-muted-foreground">
                        {j.obim} × {j.qty} = {(j.obim || 0) * (j.qty || 0)} tab.
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {preview.finishings.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Dorade
                  </h4>
                  <div className="space-y-1">
                    {preview.finishings.map((f, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate pr-2">
                          {f.name}
                          {f.variant ? ` — ${f.variant}` : ""}
                        </span>
                        <span className="font-medium tabular-nums">
                          {f.total.toFixed(2)} €
                        </span>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Ukupno dorade</span>
                    <span className="text-primary tabular-nums">
                      {preview.finishingsTotal.toFixed(2)} €
                    </span>
                  </div>
                </div>
              </>
            )}

            {printPricing && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Kalkulacija
                  </h4>
                  <div className="space-y-1 text-xs">
                    {printPricing.groups.map((g, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground truncate pr-2">
                          Štampa {g.coverage} {g.format} ({g.totalSheets} tab.)
                        </span>
                        <span className="font-medium tabular-nums">
                          {g.groupTotal.toFixed(2)} €
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trošak papira</span>
                      <span className="tabular-nums">{paperCost.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trošak klikova</span>
                      <span className="tabular-nums">{clickCost.toFixed(2)} €</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="rounded-lg bg-primary/10 p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Štampa</span>
                <span className="tabular-nums font-medium">{printTotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Dorade</span>
                <span className="tabular-nums font-medium">
                  {preview.finishingsTotal.toFixed(2)} €
                </span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between text-base font-bold">
                <span>Ukupno</span>
                <span className="text-primary tabular-nums">
                  {grandTotal.toFixed(2)} €
                </span>
              </div>
              {draft.qty > 0 && grandTotal > 0 && (
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Cena po komadu</span>
                  <span className="tabular-nums">{pricePerPiece.toFixed(3)} €</span>
                </div>
              )}
            </div>
          </aside>
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button onClick={handleAdd}>
            Dodaj na nalog{grandTotal > 0 ? ` — ${grandTotal.toFixed(2)} €` : ""}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}
