import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Trash2, Printer, Image as ImageIcon, Wrench, Package, ChevronDown, ChevronRight,
  Calculator, Sparkles,
} from "lucide-react";
import { MaterialCombobox } from "./MaterialCombobox";
import {
  useLargeFormatMaterialsWithPrices, getApplicablePrice,
} from "@/hooks/useLargeFormatPricing";
import type { QuoteItem, QuoteItemType } from "@/hooks/useQuotesPro";
import { defaultTonerCostEur, computeInstallationCostEur } from "@/lib/quotePricing";

interface Props {
  items: QuoteItem[];
  quoteId: string;
  canEdit: boolean;
  onChange: (itemId: string, patch: Record<string, any>) => Promise<void> | void;
  onDelete: (itemId: string) => Promise<void> | void;
}

const typeConfig: Record<QuoteItemType, { label: string; icon: typeof Printer; color: string }> = {
  digital:      { label: "Digitalna",    icon: Printer,   color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  large_format: { label: "Veliki format", icon: ImageIcon, color: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  service:      { label: "Usluga",       icon: Wrench,    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  razno:        { label: "Razno",        icon: Package,   color: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
};

const ITEM_TYPES: { value: QuoteItemType; label: string }[] = [
  { value: "large_format", label: "Veliki format" },
  { value: "digital", label: "Digitalna štampa" },
  { value: "service", label: "Usluga" },
  { value: "razno", label: "Razno" },
];

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n ?? 0));

const FINISHING_FIELDS: { key: keyof QuoteItem; label: string }[] = [
  { key: "finishing_grommets",   label: "Ringle" },
  { key: "finishing_weld_edges", label: "Varenje ivica" },
  { key: "finishing_sleeve",     label: "Sleeve" },
  { key: "finishing_joining",    label: "Spajanje" },
  { key: "finishing_lamination", label: "Plastifikacija" },
  { key: "finishing_cutting",    label: "Sečenje" },
  { key: "finishing_creasing",   label: "Biguvanje" },
  { key: "finishing_ruter",      label: "Ruter" },
  { key: "finishing_v_cut",      label: "V-Cut" },
  { key: "finishing_kasiranje",  label: "Kaširanje" },
  { key: "finishing_lepljenje",  label: "Lepljenje" },
];

export function QuoteItemsTable({ items, quoteId, canEdit, onChange, onDelete }: Props) {
  const { data: materials = [] } = useLargeFormatMaterialsWithPrices();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Package className="h-8 w-8 mb-2 opacity-60" />
        <p className="text-sm">Nema stavki. Dodaj prvu stavku ponude.</p>
      </div>
    );
  }

  /* ---------- helpers ---------- */

  const computeAreaM2 = (w: number | null, h: number | null, qty: number) => {
    if (!w || !h) return 0;
    return (Number(w) * Number(h) * Math.max(1, qty)) / 1_000_000;
  };

  const applyMaterial = async (it: QuoteItem, materialId: string | null) => {
    const mat = materials.find((m) => m.id === materialId) ?? null;
    const area = computeAreaM2(it.width_mm, it.height_mm, it.quantity);
    const costPerM2 = mat?.price ? getApplicablePrice(mat.price, area) : 0;
    const toner = defaultTonerCostEur(mat?.name ?? it.material_name);
    const unitPrice = costPerM2 * area + toner * area + Number(it.finishing_cost ?? 0);
    await onChange(it.id, {
      material_id: mat?.id ?? null,
      material_name: mat?.name ?? null,
      source_category: mat?.category ?? null,
      cost_per_m2: costPerM2,
      area_m2: area,
      unit_cost: costPerM2 * area + toner * area,
      unit_price: unitPrice,
      line_total: unitPrice * Math.max(1, it.quantity),
    });
  };

  const recomputeLF = async (it: QuoteItem, patch: Partial<QuoteItem>) => {
    const merged = { ...it, ...patch } as QuoteItem;
    const area = computeAreaM2(merged.width_mm, merged.height_mm, merged.quantity);
    const costPerM2 = Number(merged.cost_per_m2 ?? 0);
    const toner = defaultTonerCostEur(merged.material_name);
    const unitPrice = costPerM2 * area + toner * area + Number(merged.finishing_cost ?? 0);
    const install = computeInstallationCostEur(area, {
      standardEnabled: !!merged.installation_standard_enabled,
      standardPricePerM2Eur: Number(merged.installation_price_per_m2 ?? 0),
      standardFixedStartEur: Number(merged.installation_fixed_start ?? 0),
      highEnabled: !!merged.installation_high_enabled,
      highPricePerM2Eur: Number(merged.installation_high_price_per_m2 ?? 0),
      highFixedStartEur: Number(merged.installation_high_fixed_start ?? 0),
    });
    await onChange(it.id, {
      ...patch,
      area_m2: area,
      unit_cost: costPerM2 * area + toner * area,
      unit_price: unitPrice,
      installation_cost: install,
      line_total: unitPrice * Math.max(1, merged.quantity) + install,
    });
  };

  /* ---------- render ---------- */

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead className="w-32">Tip</TableHead>
          <TableHead>Naziv / Materijal</TableHead>
          <TableHead className="w-40">Dim (mm)</TableHead>
          <TableHead className="w-20 text-right">Kol.</TableHead>
          <TableHead className="w-28 text-right">Jed. cena €</TableHead>
          <TableHead className="w-28 text-right">Ukupno €</TableHead>
          {canEdit && <TableHead className="w-24" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((it, idx) => {
          const info = typeConfig[it.item_type];
          const Icon = info.icon;
          const isExpanded = expandedId === it.id;
          const isLF = it.item_type === "large_format";
          const area = it.area_m2 ?? computeAreaM2(it.width_mm, it.height_mm, it.quantity);
          const installTotal = Number(it.installation_cost ?? 0);

          return (
            <>
              <TableRow key={it.id} className={isExpanded ? "bg-muted/30 align-top" : "align-top"}>
                <TableCell className="text-muted-foreground pt-3">{idx + 1}</TableCell>

                <TableCell className="pt-2">
                  {canEdit ? (
                    <Select
                      value={it.item_type}
                      onValueChange={(v) => onChange(it.id, { item_type: v })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary" className={`gap-1 ${info.color}`}>
                      <Icon className="h-3 w-3" /> {info.label}
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="space-y-1.5">
                  <Input
                    className="h-8"
                    defaultValue={it.name}
                    disabled={!canEdit}
                    onBlur={(e) => e.target.value !== it.name && onChange(it.id, { name: e.target.value })}
                    placeholder="Naziv stavke"
                  />
                  {isLF && (
                    <MaterialCombobox
                      materials={materials}
                      value={it.material_id}
                      onChange={(matId) => applyMaterial(it, matId)}
                      disabled={!canEdit}
                    />
                  )}
                  <div className="flex flex-wrap gap-1">
                    {it.material_name && (
                      <Badge variant="outline" className="font-normal text-[10px]">
                        {it.material_name}
                      </Badge>
                    )}
                    {area > 0 && (
                      <Badge variant="outline" className="font-normal text-[10px]">
                        {fmt(area)} m²
                      </Badge>
                    )}
                    {installTotal > 0 && (
                      <Badge variant="outline" className="font-normal text-[10px] border-amber-500 text-amber-600">
                        Montaža {fmt(installTotal)} €
                      </Badge>
                    )}
                    {Number(it.finishing_cost ?? 0) > 0 && (
                      <Badge variant="outline" className="font-normal text-[10px]">
                        Dorada {fmt(it.finishing_cost)} €
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex gap-1">
                    <Input
                      className="h-8 w-16" type="number" placeholder="Š"
                      defaultValue={it.width_mm ?? ""}
                      disabled={!canEdit}
                      onBlur={(e) => recomputeLF(it, {
                        width_mm: e.target.value === "" ? null : Number(e.target.value),
                      })}
                    />
                    <Input
                      className="h-8 w-16" type="number" placeholder="V"
                      defaultValue={it.height_mm ?? ""}
                      disabled={!canEdit}
                      onBlur={(e) => recomputeLF(it, {
                        height_mm: e.target.value === "" ? null : Number(e.target.value),
                      })}
                    />
                  </div>
                </TableCell>

                <TableCell>
                  <Input
                    className="h-8 w-16 text-right" type="number"
                    defaultValue={it.quantity}
                    disabled={!canEdit}
                    onBlur={(e) => recomputeLF(it, { quantity: Math.max(1, Number(e.target.value)) })}
                  />
                </TableCell>

                <TableCell>
                  <Input
                    className="h-8 w-24 text-right tabular-nums" type="number" step="0.01"
                    defaultValue={Number(it.unit_price ?? 0).toFixed(2)}
                    disabled={!canEdit}
                    onBlur={(e) => {
                      const up = Number(e.target.value);
                      onChange(it.id, {
                        unit_price: up,
                        line_total: up * Math.max(1, it.quantity) + Number(it.installation_cost ?? 0),
                      });
                    }}
                  />
                </TableCell>

                <TableCell className="text-right font-medium tabular-nums pt-3">
                  {fmt(it.line_total)}
                </TableCell>

                {canEdit && (
                  <TableCell className="pt-1.5">
                    <div className="flex items-center gap-0.5 justify-end">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setExpandedId(isExpanded ? null : it.id)}
                        title="Montaža i dorada"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Obriši stavku?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Ukloniti "{it.name}" iz ponude?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Otkaži</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(it.id)}>Obriši</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                )}
              </TableRow>

              {isExpanded && (
                <TableRow key={`${it.id}-x`} className="bg-muted/20">
                  <TableCell />
                  <TableCell colSpan={7} className="pb-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Description */}
                      <div className="space-y-2 md:col-span-3">
                        <Label className="text-xs">Opis / napomena</Label>
                        <Textarea
                          rows={2}
                          defaultValue={it.description ?? ""}
                          disabled={!canEdit}
                          onBlur={(e) => e.target.value !== (it.description ?? "") &&
                            onChange(it.id, { description: e.target.value || null })
                          }
                        />
                      </div>

                      {/* Installation */}
                      <div className="rounded-md border bg-background p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold flex items-center gap-1">
                            <Wrench className="h-3.5 w-3.5" /> Montaža / Teren
                          </div>
                          <Badge variant="outline" className="font-normal">
                            {fmt(installTotal)} €
                          </Badge>
                        </div>

                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={!!it.installation_standard_enabled}
                            disabled={!canEdit}
                            onCheckedChange={(v) =>
                              recomputeLF(it, { installation_standard_enabled: !!v })
                            }
                          />
                          Standardna
                        </label>
                        {it.installation_standard_enabled && (
                          <div className="grid grid-cols-2 gap-1">
                            <Input
                              className="h-7 text-xs" type="number" step="0.01"
                              placeholder="€/m²"
                              defaultValue={it.installation_price_per_m2 ?? ""}
                              disabled={!canEdit}
                              onBlur={(e) => recomputeLF(it, {
                                installation_price_per_m2: Number(e.target.value) || 0,
                              })}
                            />
                            <Input
                              className="h-7 text-xs" type="number" step="0.01"
                              placeholder="Fiksni start €"
                              defaultValue={it.installation_fixed_start ?? ""}
                              disabled={!canEdit}
                              onBlur={(e) => recomputeLF(it, {
                                installation_fixed_start: Number(e.target.value) || 0,
                              })}
                            />
                          </div>
                        )}

                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={!!it.installation_high_enabled}
                            disabled={!canEdit}
                            onCheckedChange={(v) =>
                              recomputeLF(it, { installation_high_enabled: !!v })
                            }
                          />
                          Rad na visini
                        </label>
                        {it.installation_high_enabled && (
                          <div className="grid grid-cols-2 gap-1">
                            <Input
                              className="h-7 text-xs" type="number" step="0.01"
                              placeholder="€/m²"
                              defaultValue={it.installation_high_price_per_m2 ?? ""}
                              disabled={!canEdit}
                              onBlur={(e) => recomputeLF(it, {
                                installation_high_price_per_m2: Number(e.target.value) || 0,
                              })}
                            />
                            <Input
                              className="h-7 text-xs" type="number" step="0.01"
                              placeholder="Fiksni start €"
                              defaultValue={it.installation_high_fixed_start ?? ""}
                              disabled={!canEdit}
                              onBlur={(e) => recomputeLF(it, {
                                installation_high_fixed_start: Number(e.target.value) || 0,
                              })}
                            />
                          </div>
                        )}
                      </div>

                      {/* Finishing */}
                      <div className="rounded-md border bg-background p-3 space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5" /> Dorada
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-[11px] text-muted-foreground">Cena €</Label>
                            <Input
                              className="h-7 w-24 text-right text-xs" type="number" step="0.01"
                              defaultValue={Number(it.finishing_cost ?? 0).toFixed(2)}
                              disabled={!canEdit}
                              onBlur={(e) => recomputeLF(it, {
                                finishing_cost: Number(e.target.value) || 0,
                              })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                          {FINISHING_FIELDS.map((f) => (
                            <label key={String(f.key)} className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={!!(it as any)[f.key]}
                                disabled={!canEdit}
                                onCheckedChange={(v) => onChange(it.id, { [f.key]: !!v })}
                              />
                              {f.label}
                            </label>
                          ))}
                        </div>
                        <Textarea
                          rows={2}
                          className="text-xs"
                          placeholder="Napomena o doradi"
                          defaultValue={it.finishing_notes ?? ""}
                          disabled={!canEdit}
                          onBlur={(e) => e.target.value !== (it.finishing_notes ?? "") &&
                            onChange(it.id, { finishing_notes: e.target.value || null })
                          }
                        />
                      </div>

                      {/* Recompute helper */}
                      {canEdit && isLF && (
                        <div className="md:col-span-3 flex justify-end">
                          <Button
                            variant="outline" size="sm" className="gap-1"
                            onClick={() => recomputeLF(it, {})}
                          >
                            <Calculator className="h-3.5 w-3.5" /> Preračunaj cenu
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}
