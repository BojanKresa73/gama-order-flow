// Source of truth: GDC Order — src/components/quotes/ImportTenderDialog.tsx
// Adapted only where integration with THIS project's schema is required.
// See .lovable/plan.md for the port scope.

import { useState, useMemo, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ClipboardPaste, Loader2 } from "lucide-react";
import {
  ParsedTenderRow,
  parseTenderWorkbook,
  autoMatchMaterials,
  recomputeRow,
  extractDimensionsMm,
  normalizePrintSides,
} from "@/lib/tenderImport";
import { computeLargeFormatPricing, defaultTonerCostEur, EUR_TO_RSD } from "@/lib/quotePricing";
import { calculateItemPrice, calculateItemClickCost, calculatePiecesPerSheet } from "@/lib/digitalCalculations";
import { useLargeFormatMaterials } from "@/hooks/useLargeFormatMaterials";
import { useLargeFormatMaterialsWithPrices } from "@/hooks/useLargeFormatPricing";
import { useBulkInsertQuoteItemsPro, useRecalculateQuoteTotalsPro } from "@/hooks/useQuotesPro";
import { useLogAiCorrection } from "@/hooks/useAiCorrections";
import { supabase } from "@/integrations/supabase/client";
import { resolveMaterialEurPerM2 } from "@/lib/materialPriceFallback";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  defaultMarkupPercent: number;
  existingItemsCount: number;
  /** "file" prikazuje upload, "paste" prikazuje textarea */
  initialMode?: "file" | "paste";
  onImported?: () => void;
}

const ACCEPTED_FILE_TYPES = ".xlsx,.xls,.docx,.doc,.txt,.eml,.msg";

export function ImportTenderDialog({
  open,
  onOpenChange,
  quoteId,
  defaultMarkupPercent,
  existingItemsCount,
  initialMode = "file",
  onImported,
}: Props) {
  const [rows, setRows] = useState<ParsedTenderRow[]>([]);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [pasteText, setPasteText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiSnapshotRef = useRef<Map<number, { source: string; output: Record<string, unknown> }>>(new Map());
  const { data: materials } = useLargeFormatMaterials();
  const { data: materialsWithPrices } = useLargeFormatMaterialsWithPrices();
  const bulkInsert = useBulkInsertQuoteItemsPro();
  const recalc = useRecalculateQuoteTotalsPro();
  const logCorrection = useLogAiCorrection();

  const priceByMaterialId = useMemo(() => {
    const map = new Map<string, number>();
    (materialsWithPrices || []).forEach((m) => {
      const p = Number(m.price?.supplier_price_per_m2 || 0);
      if (p > 0) map.set(m.id, p);
    });
    return map;
  }, [materialsWithPrices]);

  const matOptions = useMemo(
    () =>
      (materials || []).map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
      })),
    [materials]
  );

  const finalizeRows = (parsed: ParsedTenderRow[]) => {
    if (parsed.length === 0) {
      toast.error("Nije pronađena nijedna stavka");
      return;
    }
    const matched = autoMatchMaterials(parsed, matOptions).map((r) => {
      if (r.productType === "digital") {
        const w = Math.max(1, Number(r.widthMm) || 210);
        const h = Math.max(1, Number(r.heightMm) || 297);
        const sheet = r.sheetFormat || "488x330";
        const sides = normalizePrintSides(r.printSides, "4/0");
        const qty = Math.max(1, Math.round(r.yearlyQty || 1));
        const obim = Math.max(1, Number(r.pages) || 1);
        const nUp = Math.max(1, calculatePiecesPerSheet(w, h, sheet));
        const sheets = Math.ceil(qty / nUp) * obim;
        const totalEur = calculateItemPrice(1, sheets, sheet, sides);
        const { totalClickCost } = calculateItemClickCost(1, sheets, sheet, sides);
        const unitPriceEur = qty > 0 ? totalEur / qty : 0;
        const unitCostEur = qty > 0 ? totalClickCost / qty : 0;
        return recomputeRow({
          ...r,
          printSides: sides,
          uom: "pcs",
          minQtyPerOrder: null,
          matchedMaterialId: null,
          matchedMaterialName: null,
          markupPercent: 0,
          costPerUnit: unitPriceEur,
          tonerCostPerM2Eur: unitCostEur, // stashed nabavna
          finishingCost: 0,
          customUnitPrice: null,
          unitPrice: unitPriceEur,
          lineTotal: unitPriceEur * qty,
        });
      }
      let autoCost = 0;
      if (r.matchedMaterialId && r.uom === "m2") {
        const direct = priceByMaterialId.get(r.matchedMaterialId) ?? 0;
        if (direct > 0) {
          autoCost = direct;
        } else {
          const matRow = (materialsWithPrices || []).find((m) => m.id === r.matchedMaterialId);
          const { eurPerM2 } = resolveMaterialEurPerM2(matRow, materialsWithPrices || []);
          autoCost = eurPerM2;
        }
      }
      return recomputeRow({
        ...r,
        markupPercent: defaultMarkupPercent,
        costPerUnit: r.costPerUnit > 0 ? r.costPerUnit : autoCost,
      });
    });
    setRows(matched);
    setStep("preview");
    const matchedCount = matched.filter((r) => r.matchedMaterialId).length;
    const pricedCount = matched.filter((r) => r.costPerUnit > 0).length;
    const digitalCount = matched.filter((r) => r.productType === "digital").length;
    toast.success(
      `Učitano ${matched.length} stavki (digital: ${digitalCount}). Mapirano: ${matchedCount}, cena iz cenovnika: ${pricedCount}.`
    );
  };

  const parseWithAi = async (text: string) => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-tender-text", {
        body: {
          text,
          materials: matOptions.map((m) => ({ id: m.id, name: m.name, category: m.category })),
          defaultMarkupPercent,
        },
      });
      if (error) throw error;
      const aiRows: any[] = data?.rows || [];
      if (aiRows.length === 0) {
        toast.error("AI nije pronašao stavke u tekstu");
        return;
      }
      aiSnapshotRef.current = new Map();
      const parsed: ParsedTenderRow[] = aiRows.map((r, idx) => {
        const row: ParsedTenderRow = {
          rowIndex: idx,
          code: r.code,
          productName: r.productName,
          category: r.category,
          rawDescription: r.rawDescription,
          material: r.material,
          printSides: r.printSides,
          finishing: r.finishing,
          format: r.format,
          minQtyPerOrder: r.minQtyPerOrder,
          uom: r.uom,
          yearlyQty: r.yearlyQty,
          monthlyQty: r.monthlyQty,
          perStoreQty: r.perStoreQty,
          comment: r.comment,
          matchedMaterialId: r.matchedMaterialId,
          matchedMaterialName: r.matchedMaterialName,
          productType: r.productType === "digital" ? "digital" : "large_format",
          paperType: r.paperType ?? null,
          paperGsm: r.paperGsm ?? null,
          pages: r.pages ?? null,
          widthMm: r.widthMm ?? null,
          heightMm: r.heightMm ?? null,
          sheetFormat: r.sheetFormat === "700x330" ? "700x330" : "488x330",
          costPerUnit: 0,
          tonerCostPerM2Eur: defaultTonerCostEur(r.material || r.rawDescription),
          finishingCost: 0,
          markupPercent: defaultMarkupPercent,
          customUnitPrice: null,
          unitPrice: 0,
          lineTotal: 0,
        };
        aiSnapshotRef.current.set(idx, {
          source: r.rawDescription || r.productName || r.category || "",
          output: {
            material: r.material ?? null,
            materialName: r.matchedMaterialName ?? null,
            printSides: r.printSides ?? null,
            finishing: r.finishing ?? null,
            format: r.format ?? null,
            uom: r.uom ?? null,
            minQtyPerOrder: r.minQtyPerOrder ?? null,
            yearlyQty: r.yearlyQty ?? null,
          },
        });
        return row;
      });
      finalizeRows(parsed);
    } catch (e: any) {
      console.error(e);
      toast.error("AI parsiranje neuspešno: " + (e.message || "nepoznata greška"));
    } finally {
      setAiLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const parsed = parseTenderWorkbook(buf);
        if (parsed.length === 0) {
          toast.info("Excel nije prepoznat kao tender — probavam AI parsiranje...");
          const text = await file.text().catch(() => "");
          if (text) await parseWithAi(text);
          return;
        }
        finalizeRows(parsed);
        return;
      }
      if (name.endsWith(".docx") || name.endsWith(".doc")) {
        const mammoth = await import("mammoth");
        const buf = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        await parseWithAi(result.value);
        return;
      }
      if (name.endsWith(".txt") || name.endsWith(".eml") || name.endsWith(".msg")) {
        const text = await file.text();
        await parseWithAi(text);
        return;
      }
      toast.error("Nepodržan tip fajla. Podržano: .xlsx, .docx, .txt, .eml");
    } catch (e: any) {
      toast.error("Greška pri čitanju fajla: " + e.message);
    }
  };

  const updateRow = (idx: number, patch: Partial<ParsedTenderRow>) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = recomputeRow({ ...copy[idx], ...patch });
      return copy;
    });
  };

  const handleMaterialChange = (idx: number, materialId: string) => {
    const mat = matOptions.find((m) => m.id === materialId);
    const autoCost = priceByMaterialId.get(materialId) ?? 0;
    const current = rows[idx];
    updateRow(idx, {
      matchedMaterialId: materialId,
      matchedMaterialName: mat?.name || null,
      tonerCostPerM2Eur: defaultTonerCostEur(mat?.name || null),
      costPerUnit:
        current?.uom === "m2" && (!current.costPerUnit || current.costPerUnit === 0)
          ? autoCost
          : current?.costPerUnit ?? 0,
    });
  };

  const totalSum = rows.reduce((s, r) => s + r.lineTotal, 0);
  const unmappedCount = rows.filter((r) => r.productType !== "digital" && !r.matchedMaterialId && r.material).length;
  const noCostCount = rows.filter((r) => r.productType !== "digital" && r.costPerUnit === 0).length;

  const handleImport = async () => {
    const items = rows.map((r, i) => {
      const qty = Math.max(1, Math.round(r.yearlyQty || 1));

      // === DIGITAL ===
      if (r.productType === "digital") {
        const w = Math.max(1, Number(r.widthMm) || extractDimensionsMm(r.format || r.rawDescription || "")?.widthMm || 210);
        const h = Math.max(1, Number(r.heightMm) || extractDimensionsMm(r.format || r.rawDescription || "")?.heightMm || 297);
        const sheet = r.sheetFormat || "488x330";
        const sides = normalizePrintSides(r.printSides, "4/0");
        const obim = Math.max(1, Number(r.pages) || 1);
        const nUp = Math.max(1, calculatePiecesPerSheet(w, h, sheet));
        const sheets = Math.ceil(qty / nUp) * obim;
        const totalEur = calculateItemPrice(1, sheets, sheet, sides);
        const { totalClickCost } = calculateItemClickCost(1, sheets, sheet, sides);
        const customPriceRsd = r.customUnitPrice != null ? r.customUnitPrice * EUR_TO_RSD : null;
        const unitPriceRsd = customPriceRsd ?? (qty > 0 ? (totalEur / qty) * EUR_TO_RSD : 0);
        const unitCostRsd = qty > 0 ? (totalClickCost / qty) * EUR_TO_RSD : 0;
        return {
          quote_id: quoteId,
          item_type: "digital" as const,
          name: r.productName ? `${r.code} ${r.productName}` : `${r.code} ${r.category}`,
          description: r.productName && r.productName !== r.category ? `${r.category} — ${r.rawDescription}` : r.rawDescription,
          quantity: qty,
          width_mm: w,
          height_mm: h,
          pages: obim,
          print_sides: sides,
          paper_type: r.paperType,
          paper_gsm: r.paperGsm,
          sheet_format: sheet,
          material_id: null,
          material_name: r.paperType || r.material || null,
          area_m2: null,
          service_id: null,
          service_name: null,
          unit_cost: unitCostRsd,
          unit_price: unitPriceRsd,
          custom_price: customPriceRsd,
          line_total: unitPriceRsd * qty,
          supplier_name: null,
          supplier_price: null,
          cost_per_m2: null,
          finishing_cost: 0,
          markup_percent: null,
          source_category: r.category,
          min_qty_per_order: r.minQtyPerOrder,
          yearly_qty: r.yearlyQty,
          order_index: existingItemsCount + i,
        };
      }

      // === LARGE FORMAT ===
      const costPerM2Rsd = r.uom === "m2" ? r.costPerUnit * EUR_TO_RSD : 0;
      const finishingRsd = r.finishingCost * EUR_TO_RSD;
      const customPriceRsd = r.customUnitPrice != null ? r.customUnitPrice * EUR_TO_RSD : null;

      const pricing = computeLargeFormatPricing({
        areaM2: r.uom === "m2" ? (r.minQtyPerOrder ?? 1) : 0,
        quantity: qty,
        costPerM2: costPerM2Rsd,
        tonerCostPerM2Eur: r.uom === "m2" ? r.tonerCostPerM2Eur || 0 : 0,
        finishingCost: finishingRsd,
        markupPercent: r.markupPercent,
        customPrice: customPriceRsd,
      });
      const unitCost =
        r.uom === "m2" ? pricing.unitCost : (r.costPerUnit + r.finishingCost) * EUR_TO_RSD;
      const unitPrice =
        r.uom === "m2" ? pricing.unitPrice : customPriceRsd ?? r.unitPrice * EUR_TO_RSD;
      const lineTotal = unitPrice * qty;

      return {
        quote_id: quoteId,
        item_type: "large_format" as const,
        name: r.productName ? `${r.code} ${r.productName}` : `${r.code} ${r.category}`,
        description: r.productName && r.productName !== r.category ? `${r.category} — ${r.rawDescription}` : r.rawDescription,
        quantity: qty,
        width_mm: extractDimensionsMm(r.format || r.rawDescription || "")?.widthMm ?? null,
        height_mm: extractDimensionsMm(r.format || r.rawDescription || "")?.heightMm ?? null,
        pages: null,
        print_sides: r.printSides,
        paper_type: null,
        paper_gsm: null,
        sheet_format: r.format,
        material_id: r.matchedMaterialId,
        material_name: r.matchedMaterialName || r.material,
        area_m2: r.uom === "m2" ? r.minQtyPerOrder : null,
        service_id: null,
        service_name: null,
        unit_cost: unitCost,
        unit_price: unitPrice,
        custom_price: customPriceRsd,
        line_total: lineTotal,
        supplier_name: null,
        supplier_price: null,
        cost_per_m2: r.uom === "m2" ? costPerM2Rsd : null,
        finishing_cost: finishingRsd,
        markup_percent: r.markupPercent !== defaultMarkupPercent ? r.markupPercent : null,
        source_category: r.category,
        min_qty_per_order: r.minQtyPerOrder,
        yearly_qty: r.yearlyQty,
        order_index: existingItemsCount + i,
      };
    });

    await bulkInsert.mutateAsync({ quoteId, items: items as any });
    await recalc.mutateAsync(quoteId).catch(() => {});

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const snap = aiSnapshotRef.current.get(r.rowIndex);
      if (!snap) continue;
      const finalOutput = {
        material: r.material ?? null,
        materialName: r.matchedMaterialName ?? null,
        printSides: r.printSides ?? null,
        finishing: r.finishing ?? null,
        format: r.format ?? null,
        uom: r.uom ?? null,
        minQtyPerOrder: r.minQtyPerOrder ?? null,
        yearlyQty: r.yearlyQty ?? null,
      };
      logCorrection.mutate({
        type: "tender_parse",
        sourceText: snap.source,
        aiOutput: snap.output,
        correctedOutput: finalOutput,
        quoteId,
      });
    }

    toast.success(`Uvezeno ${items.length} stavki — cene iz cenovnika automatski usklađene`);
    onImported?.();
    handleClose();
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("upload");
    setRows([]);
    setPasteText("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {initialMode === "paste" ? "Nalepi tekst zahteva" : "Uvezi zahtev"}
          </DialogTitle>
          <DialogDescription>
            {initialMode === "paste"
              ? "Nalepi tekst iz emaila, ponude ili tendera — AI će izvući stavke."
              : "Podržani formati: Excel (.xlsx), Word (.docx), tekst (.txt), email (.eml)."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && initialMode === "file" && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
            {aiLoading ? (
              <>
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">AI obrađuje fajl...</p>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                <Label htmlFor="tender-file" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md">
                    <Upload className="h-4 w-4" />
                    Izaberi fajl
                  </div>
                  <Input
                    id="tender-file"
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </Label>
                <p className="text-xs text-muted-foreground mt-3">
                  .xlsx · .docx · .txt · .eml
                </p>
                <p className="text-sm text-muted-foreground mt-4 text-center max-w-md">
                  Excel sa strukturom kolona B(#), C(opis), D(min), E(UOM), F(god. kol.) parsiramo direktno.
                  Ostale formate AI obrađuje automatski.
                </p>
              </>
            )}
          </div>
        )}

        {step === "upload" && initialMode === "paste" && (
          <div className="space-y-3">
            <Textarea
              placeholder="Nalepi ovde tekst zahteva, emaila ili tendera..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={14}
              disabled={aiLoading}
              className="font-mono text-sm"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => parseWithAi(pasteText)}
                disabled={!pasteText.trim() || aiLoading}
                className="gap-2"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI obrađuje...
                  </>
                ) : (
                  <>
                    <ClipboardPaste className="h-4 w-4" />
                    Parsiraj tekst
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{rows.length} stavki</Badge>
              {unmappedCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {unmappedCount} bez materijala
                </Badge>
              )}
              {noCostCount > 0 && (
                <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  {noCostCount} bez nabavne cene
                </Badge>
              )}
              <Badge variant="default" className="gap-1 ml-auto">
                <CheckCircle2 className="h-3 w-3" />
                Ukupno: {totalSum.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
              </Badge>
            </div>

            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead className="min-w-[200px]">Stavka</TableHead>
                    <TableHead className="min-w-[200px]">Materijal iz kataloga</TableHead>
                    <TableHead className="w-24 text-right">UOM</TableHead>
                    <TableHead className="w-28 text-right">Min/porudž.</TableHead>
                    <TableHead className="w-28 text-right">God. kol.</TableHead>
                    <TableHead className="w-32 text-right">Nabavna /UOM (EUR)</TableHead>
                    <TableHead className="w-28 text-right">Toner EUR/m²</TableHead>
                    <TableHead className="w-28 text-right">Dorada (EUR)</TableHead>
                    <TableHead className="w-28 text-right">Marža %</TableHead>
                    <TableHead className="w-32 text-right">Jed. cena (EUR)</TableHead>
                    <TableHead className="w-36 text-right">Ukupno (EUR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm">{r.productName || r.category}</div>
                          {r.productType === "digital" ? (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">Digital</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">Veliki format</Badge>
                          )}
                        </div>
                        {r.productName && r.productName !== r.category && (
                          <div className="text-[11px] text-muted-foreground">{r.category}</div>
                        )}
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {r.material && (
                            <span className="text-foreground">{r.material}</span>
                          )}
                          {r.printSides && ` • ${r.printSides}`}
                          {r.finishing && ` • ${r.finishing}`}
                          {r.productType === "digital" && r.widthMm && r.heightMm && ` • ${r.widthMm}×${r.heightMm}mm`}
                          {r.productType === "digital" && r.pages && r.pages > 1 && ` • obim ${r.pages}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.productType === "digital" ? (
                          <div className="text-xs text-muted-foreground leading-relaxed">
                            <div className="font-medium text-foreground">Digitalna štampa</div>
                            <div>{r.paperGsm ? `${r.paperGsm} g ` : ""}{r.paperType || r.material || "papir"}</div>
                            <div>{r.sheetFormat || "488x330"} · {normalizePrintSides(r.printSides, "4/0")}</div>
                          </div>
                        ) : (
                          <Select
                            value={r.matchedMaterialId || ""}
                            onValueChange={(v) => handleMaterialChange(idx, v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="— izaberi —" />
                            </SelectTrigger>
                            <SelectContent>
                              {matOptions.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}{" "}
                                  <span className="text-muted-foreground text-xs">
                                    ({m.category})
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">{r.uom}</TableCell>
                      <TableCell className="text-right text-xs">
                        {r.minQtyPerOrder ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {r.yearlyQty.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {r.productType === "digital" ? (
                          <div className="text-right text-xs text-muted-foreground">tarifa</div>
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            value={r.costPerUnit || ""}
                            onChange={(e) =>
                              updateRow(idx, { costPerUnit: Number(e.target.value) || 0 })
                            }
                            className="h-8 text-right"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {r.productType === "digital" ? (
                          <div className="text-right text-xs text-muted-foreground">—</div>
                        ) : (
                          <Input
                            type="number"
                            step="0.1"
                            value={r.tonerCostPerM2Eur || ""}
                            disabled={r.uom !== "m2"}
                            onChange={(e) =>
                              updateRow(idx, {
                                tonerCostPerM2Eur: Number(e.target.value) || 0,
                              })
                            }
                            className="h-8 text-right"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={r.finishingCost || ""}
                          onChange={(e) =>
                            updateRow(idx, { finishingCost: Number(e.target.value) || 0 })
                          }
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        {r.productType === "digital" ? (
                          <div className="text-right text-xs text-muted-foreground">tarifa</div>
                        ) : (
                          <Input
                            type="number"
                            value={r.markupPercent}
                            onChange={(e) =>
                              updateRow(idx, { markupPercent: Number(e.target.value) || 0 })
                            }
                            className="h-8 text-right pr-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {r.unitPrice.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {r.lineTotal.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Odustani
          </Button>
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => { setStep("upload"); setRows([]); }}>
                ← Nazad
              </Button>
              <Button onClick={handleImport} disabled={bulkInsert.isPending}>
                {bulkInsert.isPending ? "Uvozim..." : `Uvezi ${rows.length} stavki`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
