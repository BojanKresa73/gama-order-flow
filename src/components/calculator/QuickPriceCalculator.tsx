import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Calculator, Sparkles, Copy, Check, Plus, Trash2, History, FileText,
  RotateCcw, Save, FolderOpen, Layers,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuthz } from "@/hooks/useAuthz";
import { useCanUseQuickCalc } from "@/lib/auth/quickCalcAccess";
import {
  useLargeFormatMaterialsWithPrices,
  getApplicablePrice,
} from "@/hooks/useLargeFormatPricing";
import { MaterialCombobox } from "@/components/quotes/MaterialCombobox";
import { supabase } from "@/integrations/supabase/client";
import { defaultTonerCostEur, type PrintSides } from "@/lib/quotePricing";
import { useKasiranjeSettings } from "@/hooks/useKasiranjeSettings";
import { computeKasiranjeCostEur } from "@/lib/kasiranjeCost";
import { QuoteDialog } from "@/components/calculator/QuoteDialog";
import type { QuoteItemPdf } from "@/lib/quotePdf";

interface Props {
  variant?: "button" | "tile";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

const DEFAULT_MARKUP = 300;
const HISTORY_KEY = "quickCalc:history:v1";
const SAVED_LISTS_KEY = "quickCalc:savedLists:v1";
const HISTORY_MAX = 10;

const fmtEur = (n: number) =>
  new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0) + " EUR";

type PriceSource = "margin" | "pricelist" | "custom";

interface CalcSnapshot {
  ts: number;
  materialId: string | null;
  materialName: string;
  widthCm: number;
  heightCm: number;
  qty: number;
  printSides: PrintSides;
  markup: number;
  finishingEur: number;
  tonerEurOverride: string;
  customPriceStr: string;
  priceSource: PriceSource;
  kasiranje?: boolean;
  unitPrice: number;
  lineTotal: number;
  areaPerUnitM2: number;
  baseCostPerUnit: number;
  profitTotal: number;
}

interface ListItem extends CalcSnapshot {
  id: string;
}

function loadLocalHistory(): CalcSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CalcSnapshot[];
  } catch {
    return [];
  }
}

function saveLocalHistory(list: CalcSnapshot[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch { /* ignore */ }
}

async function fetchRemoteHistory(): Promise<CalcSnapshot[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await (supabase as any)
    .from("quick_calc_history")
    .select("snapshot, created_at")
    .order("created_at", { ascending: false })
    .limit(HISTORY_MAX);
  if (error || !data) return [];
  return data.map((r: any) => r.snapshot as CalcSnapshot);
}

async function pushRemoteHistory(snap: CalcSnapshot) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await (supabase as any).from("quick_calc_history").insert({
    user_id: auth.user.id,
    snapshot: snap as any,
  });
  const { data: rows } = await (supabase as any)
    .from("quick_calc_history")
    .select("id, created_at")
    .order("created_at", { ascending: false });
  if (rows && rows.length > HISTORY_MAX) {
    const toDelete = rows.slice(HISTORY_MAX).map((r: any) => r.id);
    if (toDelete.length > 0) {
      await (supabase as any).from("quick_calc_history").delete().in("id", toDelete);
    }
  }
}

async function clearRemoteHistory() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await (supabase as any).from("quick_calc_history").delete().eq("user_id", auth.user.id);
}

interface SavedList {
  name: string;
  ts: number;
  items: ListItem[];
}

function loadSavedLists(): SavedList[] {
  try {
    const raw = localStorage.getItem(SAVED_LISTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedList[];
  } catch { return []; }
}

function persistSavedLists(lists: SavedList[]) {
  try { localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(lists)); } catch { /* ignore */ }
}

export function QuickPriceCalculator({
  variant = "button",
  className,
  open: openProp,
  onOpenChange,
  hideTrigger,
}: Props) {
  const { isSuper, isAdmin } = useAuthz();
  const canUse = useCanUseQuickCalc();
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setOpenInternal(v); };
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"calc" | "list" | "history">("calc");

  const [widthCm, setWidthCm] = useState(100);
  const [heightCm, setHeightCm] = useState(70);
  const [qty, setQty] = useState(1);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [printSides, setPrintSides] = useState<PrintSides>("4/0");
  const [markup, setMarkup] = useState(DEFAULT_MARKUP);
  const [finishingEur, setFinishingEur] = useState(0);
  const [customPriceStr, setCustomPriceStr] = useState("");
  const [tonerEurOverride, setTonerEurOverride] = useState<string>("");
  const [priceSource, setPriceSource] = useState<PriceSource>("margin");
  const [kasiranje, setKasiranje] = useState(false);
  const { data: kasiranjeResolved } = useKasiranjeSettings();

  const [items, setItems] = useState<ListItem[]>([]);
  const [history, setHistory] = useState<CalcSnapshot[]>([]);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [listName, setListName] = useState("");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteItems, setQuoteItems] = useState<QuoteItemPdf[]>([]);
  const [quoteTotal, setQuoteTotal] = useState(0);

  const openQuoteFromList = () => {
    if (items.length === 0) { toast.error("Lista je prazna"); return; }
    setQuoteItems(items.map((it) => ({
      materialName: it.materialName,
      widthCm: it.widthCm,
      heightCm: it.heightCm,
      qty: it.qty,
      printSides: it.printSides,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
    })));
    setQuoteTotal(listTotal);
    setQuoteOpen(true);
  };

  const openQuoteFromCalc = () => {
    if (!hasMaterial) { toast.error("Izaberi materijal"); return; }
    setQuoteItems([{
      materialName: material?.name ?? "",
      widthCm, heightCm, qty, printSides,
      unitPrice: result.unitPrice, lineTotal: result.lineTotal,
    }]);
    setQuoteTotal(result.lineTotal);
    pushHistory(buildSnapshot());
    setQuoteOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    setHistory(loadLocalHistory());
    setSavedLists(loadSavedLists());
    fetchRemoteHistory().then((remote) => {
      if (remote.length > 0) {
        setHistory(remote);
        saveLocalHistory(remote);
      }
    }).catch(() => { /* ignore */ });
  }, [open]);

  const saveCurrentList = () => {
    const name = listName.trim();
    if (!name) { toast.error("Unesi naziv liste"); return; }
    if (items.length === 0) { toast.error("Lista je prazna"); return; }
    setSavedLists((prev) => {
      const filtered = prev.filter((l) => l.name !== name);
      const next = [{ name, ts: Date.now(), items }, ...filtered];
      persistSavedLists(next);
      return next;
    });
    setListName("");
    toast.success(`Lista "${name}" sačuvana`);
  };

  const loadSavedList = (name: string) => {
    const list = savedLists.find((l) => l.name === name);
    if (!list) return;
    setItems(list.items.map((it) => ({ ...it, id: crypto.randomUUID() })));
    setTab("list");
    toast.success(`Učitana lista "${name}"`);
  };

  const deleteSavedList = (name: string) => {
    setSavedLists((prev) => {
      const next = prev.filter((l) => l.name !== name);
      persistSavedLists(next);
      return next;
    });
    toast.success(`Lista "${name}" obrisana`);
  };

  const { data: materials = [], isLoading: materialsLoading, error: materialsError } =
    useLargeFormatMaterialsWithPrices();

  const material = useMemo(
    () => materials.find((m) => m.id === materialId) ?? null,
    [materials, materialId]
  );

  const areaPerUnitM2 = (Number(widthCm || 0) / 100) * (Number(heightCm || 0) / 100);
  const totalAreaM2 = areaPerUnitM2 * Math.max(0, Number(qty || 0));

  const supplierCostPerM2 = Number(material?.price?.supplier_price_per_m2 ?? 0);
  const tierPricePerM2 = material?.price ? getApplicablePrice(material.price, totalAreaM2) : 0;

  const autoTonerEur = defaultTonerCostEur(material?.name ?? "");
  const tonerEur = tonerEurOverride === "" ? autoTonerEur : Number(tonerEurOverride);

  const customPriceEur = customPriceStr === "" ? null : Number(customPriceStr);
  const hasMaterial = !!material;

  const result = useMemo(() => {
    const kasi = kasiranje
      ? computeKasiranjeCostEur({
          areaM2: totalAreaM2,
          film: kasiranjeResolved.film,
          tonerPerM2Eur: kasiranjeResolved.tonerPerM2Eur,
          labor: kasiranjeResolved.labor,
        })
      : null;
    const filmSupplierPerM2 = kasiranjeResolved.film?.price?.supplier_price_per_m2 ?? 0;
    const kasiRevenueTotal = kasi?.totalEur ?? 0;
    const kasiCostTotal = kasi ? filmSupplierPerM2 * kasi.areaM2 + kasi.tonerCostEur : 0;
    const kasiRevenuePerUnit = qty > 0 ? kasiRevenueTotal / qty : 0;
    const kasiCostPerUnit = qty > 0 ? kasiCostTotal / qty : 0;

    if (!hasMaterial) {
      return {
        materialCostPerUnit: 0, tonerCostPerUnit: 0, baseCostPerUnit: 0,
        calculatedUnitPrice: 0, pricelistUnitPrice: 0, unitPrice: 0, lineTotal: 0,
        profitPerUnit: 0, profitTotal: 0, materialCostTotal: 0, tonerCostTotal: 0,
        kasi, kasiRevenueTotal, kasiCostTotal,
      };
    }
    const sidesMult = printSides === "4/4" ? 2 : 1;
    const materialCostPerUnit = supplierCostPerM2 * areaPerUnitM2;
    const tonerCostPerUnit = tonerEur * sidesMult * areaPerUnitM2;
    const finishingPerUnit = qty > 0 ? finishingEur / qty : 0;
    const baseCostPerUnit = materialCostPerUnit + tonerCostPerUnit + finishingPerUnit + kasiCostPerUnit;
    const calculatedUnitPrice = baseCostPerUnit * (1 + markup / 100) + kasiRevenuePerUnit - kasiCostPerUnit;
    const pricelistUnitPrice = tierPricePerM2 * areaPerUnitM2 + finishingPerUnit + kasiRevenuePerUnit;
    let unitPrice = calculatedUnitPrice;
    if (priceSource === "pricelist") unitPrice = pricelistUnitPrice;
    else if (priceSource === "custom" && customPriceEur != null) unitPrice = customPriceEur;
    const lineTotal = unitPrice * qty;
    const profitPerUnit = unitPrice - baseCostPerUnit;
    return {
      materialCostPerUnit, tonerCostPerUnit, baseCostPerUnit,
      calculatedUnitPrice, pricelistUnitPrice, unitPrice, lineTotal,
      profitPerUnit, profitTotal: profitPerUnit * qty,
      materialCostTotal: materialCostPerUnit * qty,
      tonerCostTotal: tonerCostPerUnit * qty,
      kasi, kasiRevenueTotal, kasiCostTotal,
    };
  }, [hasMaterial, areaPerUnitM2, totalAreaM2, qty, supplierCostPerM2, tonerEur, finishingEur, markup, customPriceEur, printSides, priceSource, tierPricePerM2, kasiranje, kasiranjeResolved.film, kasiranjeResolved.tonerPerM2Eur, kasiranjeResolved.labor]);

  if (!isSuper && !isAdmin && !canUse) return null;

  const buildSnapshot = (): CalcSnapshot => ({
    ts: Date.now(),
    materialId, materialName: material?.name ?? "",
    widthCm, heightCm, qty, printSides, markup, finishingEur,
    tonerEurOverride, customPriceStr, priceSource, kasiranje,
    unitPrice: result.unitPrice, lineTotal: result.lineTotal,
    areaPerUnitM2, baseCostPerUnit: result.baseCostPerUnit,
    profitTotal: result.profitTotal,
  });

  const restoreSnapshot = (s: CalcSnapshot) => {
    setMaterialId(s.materialId);
    setWidthCm(s.widthCm);
    setHeightCm(s.heightCm);
    setQty(s.qty);
    setPrintSides(s.printSides);
    setMarkup(s.markup);
    setFinishingEur(s.finishingEur);
    setTonerEurOverride(s.tonerEurOverride);
    setCustomPriceStr(s.customPriceStr);
    setPriceSource(s.priceSource ?? "margin");
    setKasiranje(!!s.kasiranje);
    setTab("calc");
  };

  const pushHistory = (snap: CalcSnapshot) => {
    setHistory((prev) => {
      const next = [snap, ...prev].slice(0, HISTORY_MAX);
      saveLocalHistory(next);
      return next;
    });
    pushRemoteHistory(snap).catch(() => { /* ignore */ });
  };

  const addToList = () => {
    if (!hasMaterial) { toast.error("Izaberi materijal"); return; }
    const snap = buildSnapshot();
    const item: ListItem = { ...snap, id: crypto.randomUUID() };
    setItems((prev) => [...prev, item]);
    pushHistory(snap);
    toast.success("Stavka dodata na listu");
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const listTotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const listProfit = items.reduce((sum, i) => sum + i.profitTotal, 0);

  const copyAll = async () => {
    const lines: string[] = [];
    if (items.length > 0) {
      lines.push(`Brzi kalkulator — ${items.length} stavki`);
      items.forEach((it, idx) => {
        lines.push(`${idx + 1}. ${it.materialName} | ${it.widthCm}×${it.heightCm} cm × ${it.qty} = ${fmtEur(it.lineTotal)}`);
      });
      lines.push(`UKUPNO: ${fmtEur(listTotal)}   Profit: ${fmtEur(listProfit)}`);
    } else {
      if (!hasMaterial) { toast.error("Nema šta da se kopira"); return; }
      lines.push(
        `Brzi kalkulator — ${material?.name ?? ""}`,
        `Dimenzije: ${widthCm} × ${heightCm} cm  |  Kol: ${qty}  |  Štampa: ${printSides}`,
        `Površina/kom: ${areaPerUnitM2.toFixed(3)} m²   Ukupno: ${totalAreaM2.toFixed(3)} m²`,
        `Nabavna: ${supplierCostPerM2.toFixed(2)} EUR/m²   Toner: ${tonerEur.toFixed(2)} EUR/m²`,
        `Dorada (ukupno): ${fmtEur(finishingEur)}   Marža: ${markup}%`,
        `Cena/kom: ${fmtEur(result.unitPrice)}`,
        `Prodajna cena/m²: ${areaPerUnitM2 > 0 ? fmtEur(result.unitPrice / areaPerUnitM2) : fmtEur(0)}`,
        `UKUPNO: ${fmtEur(result.lineTotal)}   Profit: ${fmtEur(result.profitTotal)}`
      );
      pushHistory(buildSnapshot());
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      toast.success("Proračun kopiran");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Kopiranje nije uspelo");
    }
  };

  const trigger =
    variant === "tile" ? (
      <Button
        variant="outline"
        className={className ?? "h-20 flex-col gap-2 rounded-2xl"}
      >
        <Calculator className="h-6 w-6" strokeWidth={2.2} />
        <span className="font-semibold">Brzi kalkulator</span>
      </Button>
    ) : (
      <Button variant="outline" size="sm" className={className}>
        <Calculator className="h-4 w-4 mr-2" />
        Brzi kalkulator
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Brzi kalkulator cene
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Cene materijala i kaširanja se čitaju uživo iz GDC Order cenovnika.
          </p>
        </DialogHeader>

        {materialsError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs p-2">
            Ne mogu da učitam cenovnik iz GDC Order-a. Proveri da li je anon SELECT dozvoljen na tabelama.
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calc">
              <Calculator className="h-3.5 w-3.5 mr-1.5" /> Kalkulator
            </TabsTrigger>
            <TabsTrigger value="list">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Lista{items.length > 0 && <Badge className="ml-1.5 h-5 px-1.5">{items.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-3.5 w-3.5 mr-1.5" /> Istorija
            </TabsTrigger>
          </TabsList>

          {/* ===== CALC TAB ===== */}
          <TabsContent value="calc" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Širina (cm)</Label>
                <Input type="number" min={0} value={widthCm} onChange={(e) => setWidthCm(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Visina (cm)</Label>
                <Input type="number" min={0} value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Količina</Label>
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Strane štampe</Label>
                <Select value={printSides} onValueChange={(v) => setPrintSides(v as PrintSides)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4/0">4/0 (jednostrano)</SelectItem>
                    <SelectItem value="4/4">4/4 (dvostrano)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Materijal <span className="text-destructive">*</span></Label>
                <MaterialCombobox
                  materials={materials}
                  value={materialId}
                  onChange={setMaterialId}
                  invalid={!hasMaterial}
                  disabled={materialsLoading}
                />
                {!hasMaterial && (
                  <p className="text-xs text-destructive">
                    {materialsLoading ? "Učitavam cenovnik..." : "Materijal je obavezan — bez njega kalkulacija je 0."}
                  </p>
                )}
                {material && !material.price && (
                  <p className="text-xs text-amber-600">Za izabrani materijal nije unesena nabavna cena.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Marža (%)</Label>
                <Input type="number" value={markup} onChange={(e) => setMarkup(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Dorada — ukupno (EUR)</Label>
                <Input type="number" min={0} step="0.01" value={finishingEur} onChange={(e) => setFinishingEur(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Toner (EUR/m²)</Label>
                <Input type="number" step="0.01" placeholder={`auto: ${autoTonerEur.toFixed(2)}`} value={tonerEurOverride} onChange={(e) => setTonerEurOverride(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Custom cena/kom (EUR, opc.)</Label>
                <Input type="number" min={0} step="0.01" placeholder="ostavi prazno za auto" value={customPriceStr} onChange={(e) => { setCustomPriceStr(e.target.value); if (e.target.value !== "") setPriceSource("custom"); }} />
              </div>
              <div className="md:col-span-2 flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="qc-kasiranje" className="flex items-center gap-2 cursor-pointer">
                    <Layers className="h-4 w-4 text-primary" />
                    Kaširanje (PVC folija + toner + usluga)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Uključi za materijale koji se kaširaju (npr. Leksan). Dodaje se u cenu i troškove.
                  </p>
                </div>
                <Switch id="qc-kasiranje" checked={kasiranje} onCheckedChange={setKasiranje} />
              </div>
            </div>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Površina</div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Po kom.</span>
                      <span className="font-mono">{areaPerUnitM2.toFixed(3)} m²</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Ukupno ({qty} kom)</span>
                      <span className="font-mono font-semibold">{totalAreaM2.toFixed(3)} m²</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2 pt-2 border-t">
                      {widthCm} × {heightCm} cm · štampa {printSides}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Potrošnja (toner + materijal)</div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Toner / kom.</span>
                      <span className="font-mono">{fmtEur(result.tonerCostPerUnit)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Materijal / kom.</span>
                      <span className="font-mono">{fmtEur(result.materialCostPerUnit)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm mt-1 pt-1 border-t">
                      <span className="text-muted-foreground">Ukupno (toner + mat.)</span>
                      <span className="font-mono font-semibold">{fmtEur(result.tonerCostTotal + result.materialCostTotal)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2 pt-2 border-t space-y-0.5">
                      <div>Toner: {tonerEur.toFixed(2)} EUR/m² · Nabavna: {supplierCostPerM2.toFixed(2)} EUR/m²</div>
                      <div>Bazni trošak / kom.: {fmtEur(result.baseCostPerUnit)} (uklj. doradu)</div>
                    </div>
                  </div>

                  <div className={`rounded-lg border p-3 ${priceSource === "pricelist" ? "bg-primary/10 border-primary" : "bg-background"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cenovnik (tier)</div>
                      <Button type="button" size="sm" variant={priceSource === "pricelist" ? "default" : "outline"} className="h-6 px-2 text-[11px]" disabled={!material?.price || tierPricePerM2 <= 0} onClick={() => setPriceSource("pricelist")}>
                        {priceSource === "pricelist" ? "✓ Aktivno" : "Koristi"}
                      </Button>
                    </div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Cena / m²</span>
                      <span className="font-mono">{tierPricePerM2.toFixed(2)} EUR/m²</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Cena / kom.</span>
                      <span className="font-mono">{fmtEur(result.pricelistUnitPrice)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm mt-1 pt-1 border-t">
                      <span className="text-muted-foreground">Ukupno</span>
                      <span className="font-mono font-semibold">{fmtEur(result.pricelistUnitPrice * qty)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2 pt-2 border-t">
                      Tier prema ukupnoj površini {totalAreaM2.toFixed(2)} m²
                    </div>
                  </div>

                  <div className={`rounded-lg border p-3 ${priceSource === "margin" ? "bg-primary/10 border-primary" : "bg-background"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Marža ({markup}%)</div>
                      <Button type="button" size="sm" variant={priceSource === "margin" ? "default" : "outline"} className="h-6 px-2 text-[11px]" onClick={() => setPriceSource("margin")}>
                        {priceSource === "margin" ? "✓ Aktivno" : "Koristi"}
                      </Button>
                    </div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Cena / m²</span>
                      <span className="font-mono">{areaPerUnitM2 > 0 ? fmtEur(result.calculatedUnitPrice / areaPerUnitM2).replace(" EUR", "") : "0,00"} EUR/m²</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Cena / kom.</span>
                      <span className="font-mono">{fmtEur(result.calculatedUnitPrice)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm mt-1 pt-1 border-t">
                      <span className="text-muted-foreground">Ukupno</span>
                      <span className="font-mono font-semibold">{fmtEur(result.calculatedUnitPrice * qty)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2 pt-2 border-t">
                      Bazni trošak × (1 + {markup}%)
                    </div>
                  </div>
                </div>

                {customPriceEur != null && (
                  <div className={`rounded-lg border p-2 flex items-center justify-between text-sm ${priceSource === "custom" ? "bg-primary/10 border-primary" : "bg-background"}`}>
                    <span className="text-muted-foreground">Custom cena: <span className="font-mono">{fmtEur(customPriceEur)}/kom</span></span>
                    <Button type="button" size="sm" variant={priceSource === "custom" ? "default" : "outline"} className="h-6 px-2 text-[11px]" onClick={() => setPriceSource("custom")}>
                      {priceSource === "custom" ? "✓ Aktivno" : "Koristi"}
                    </Button>
                  </div>
                )}

                {result.kasi && (
                  <div className="rounded-lg border border-amber-400/60 bg-amber-500/5 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5" /> Kaširanje
                      </span>
                      <span className="font-semibold">{fmtEur(result.kasi.totalEur)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {result.kasi.filmName} · {result.kasi.filmPricePerM2Eur.toFixed(2)} €/m² + toner {result.kasi.tonerPerM2Eur.toFixed(2)} €/m² × {result.kasi.areaM2.toFixed(2)} m² = {fmtEur(result.kasi.filmCostEur + result.kasi.tonerCostEur)}
                    </div>
                    {result.kasi.hasLabor && (
                      <div className="text-muted-foreground">
                        Usluga: {result.kasi.laborName} · {result.kasi.laborPerM2Eur.toFixed(2)} €/m² (min {result.kasi.laborStartEur.toFixed(2)} €) = <span className="font-semibold text-foreground">{fmtEur(result.kasi.laborCostEur)}</span>
                      </div>
                    )}
                    {!result.kasi.hasFilm && (
                      <div className="text-destructive">⚠ Nije podešena podrazumevana folija (kasiranje_settings).</div>
                    )}
                  </div>
                )}

                <div className="border-t pt-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Ukupno (izvor: {priceSource === "margin" ? "marža" : priceSource === "pricelist" ? "cenovnik" : "custom"})
                    </div>
                    <div className="text-2xl font-bold text-primary">{fmtEur(result.lineTotal)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Profit ukupno</div>
                    <div className={`text-lg font-semibold ${result.profitTotal < 0 ? "text-destructive" : ""}`}>{fmtEur(result.profitTotal)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!hasMaterial} onClick={addToList}>
                <Plus className="h-4 w-4 mr-2" /> Dodaj na listu
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!hasMaterial} onClick={openQuoteFromCalc}>
                <FileText className="h-4 w-4 mr-2" /> Napravi ponudu
              </Button>
              <Button type="button" size="sm" onClick={copyAll}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Kopirano" : "Kopiraj"}
              </Button>
            </div>
          </TabsContent>

          {/* ===== LIST TAB ===== */}
          <TabsContent value="list" className="space-y-3 mt-4">
            {savedLists.length > 0 && (
              <Card className="border-dashed">
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5" /> Sačuvane liste
                  </div>
                  <div className="space-y-1.5">
                    {savedLists.map((l) => (
                      <div key={l.name} className="flex items-center gap-2 text-sm">
                        <button type="button" onClick={() => loadSavedList(l.name)} className="flex-1 text-left hover:underline truncate">
                          <span className="font-medium">{l.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {l.items.length} stavki · {new Date(l.ts).toLocaleDateString("sr-RS")}
                          </span>
                        </button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => loadSavedList(l.name)} title="Učitaj">
                          <FolderOpen className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteSavedList(l.name)} title="Obriši">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Lista je prazna. Idi na "Kalkulator", popuni i klikni "Dodaj na listu".
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <Card key={it.id}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="text-xs font-mono text-muted-foreground w-6">{idx + 1}.</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{it.materialName}</div>
                          <div className="text-xs text-muted-foreground">
                            {it.widthCm}×{it.heightCm} cm × {it.qty} kom · {it.printSides} · marža {it.markup}%
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{fmtEur(it.lineTotal)}</div>
                          <div className="text-xs text-muted-foreground">{fmtEur(it.unitPrice)}/kom</div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => restoreSnapshot(it)} title="Učitaj u kalkulator">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeItem(it.id)} title="Obriši">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">UKUPNO ({items.length} stavki)</div>
                      <div className="text-2xl font-bold text-primary">{fmtEur(listTotal)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Profit ukupno</div>
                      <div className="text-lg font-semibold">{fmtEur(listProfit)}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3 flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[200px] space-y-1">
                      <Label className="text-xs">Sačuvaj listu pod imenom</Label>
                      <Input
                        value={listName}
                        onChange={(e) => setListName(e.target.value)}
                        placeholder="npr. Klijent X — banner kampanja"
                        onKeyDown={(e) => { if (e.key === "Enter") saveCurrentList(); }}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={saveCurrentList}>
                      <Save className="h-4 w-4 mr-2" /> Sačuvaj
                    </Button>
                  </CardContent>
                </Card>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setItems([])}>
                    Isprazni listu
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={copyAll}>
                    <Copy className="h-4 w-4 mr-2" /> Kopiraj sve
                  </Button>
                  <Button type="button" size="sm" onClick={openQuoteFromList}>
                    <FileText className="h-4 w-4 mr-2" /> Napravi ponudu
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ===== HISTORY TAB ===== */}
          <TabsContent value="history" className="space-y-3 mt-4">
            {history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nema sačuvanih proračuna. Klikni "Dodaj na listu" ili "Kopiraj" — proračun se automatski sačuva ovde.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {history.map((h, idx) => (
                    <Card key={h.ts + "-" + idx} className="cursor-pointer hover:bg-accent/40" onClick={() => restoreSnapshot(h)}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{h.materialName || "(bez materijala)"}</div>
                          <div className="text-xs text-muted-foreground">
                            {h.widthCm}×{h.heightCm} cm × {h.qty} · {new Date(h.ts).toLocaleString("sr-RS")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{fmtEur(h.lineTotal)}</div>
                          <div className="text-xs text-muted-foreground">{fmtEur(h.unitPrice)}/kom</div>
                        </div>
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    saveLocalHistory([]);
                    setHistory([]);
                    clearRemoteHistory().catch(() => {});
                  }}>
                    Obriši istoriju
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
      <QuoteDialog open={quoteOpen} onOpenChange={setQuoteOpen} items={quoteItems} total={quoteTotal} />
    </Dialog>
  );
}
