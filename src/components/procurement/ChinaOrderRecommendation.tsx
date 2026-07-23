import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Ship, AlertTriangle, MapPin, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  plateFormats: any[];
  orders: any[];
}

const LEAD_MONTHS = 3;
const SAFETY_MONTHS = 2;
const COVER_MONTHS = LEAD_MONTHS + SAFETY_MONTHS;

const LOCAL_FORMATS = new Set(["450x370", "510x400"]);

const PHASED_OUT: Record<string, string> = {
  "730x605": "745x605",
  "740x605": "745x605",
  "1030x785": "1030x790",
};

const normalize = (name: string) =>
  (name || "").toLowerCase().replace(/×/g, "x").replace(/\s/g, "");

const parseDims = (name: string): { w: number; h: number } | null => {
  const n = normalize(name);
  const m = n.match(/^(\d+)x(\d+)$/);
  if (!m) return null;
  return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
};

const m2PerPlate = (name: string): number => {
  const d = parseDims(name);
  if (!d) return 0;
  return (d.w * d.h) / 1_000_000;
};

export function ChinaOrderRecommendation({ plateFormats, orders }: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const { data: monthlyData, isLoading } = useQuery({
    queryKey: ["china-order-monthly-consumption"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_format_monthly_consumption");
      if (error) throw error;
      return (data || []) as Array<{ format_id: string; month: string; total: number }>;
    },
    staleTime: 60000,
  });

  const rows = useMemo(() => {
    if (!plateFormats.length) return [];

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dayOfMonth = now.getDate();
    const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const formatByNorm = new Map<string, any>();
    plateFormats.forEach((f) => formatByNorm.set(normalize(f.format_name), f));

    const byFormatMonth = new Map<string, Map<string, number>>();
    (monthlyData || []).forEach((r) => {
      const m = r.month.substring(0, 7);
      if (!byFormatMonth.has(r.format_id)) byFormatMonth.set(r.format_id, new Map());
      byFormatMonth.get(r.format_id)!.set(m, (byFormatMonth.get(r.format_id)!.get(m) || 0) + r.total);
    });

    const pendingByFormat = new Map<string, number>();
    orders
      .filter((o) => o.status !== "arrived" && o.status !== "cancelled")
      .forEach((o) => {
        (o.procurement_order_items || []).forEach((i: any) => {
          pendingByFormat.set(i.plate_format_id, (pendingByFormat.get(i.plate_format_id) || 0) + (i.quantity || 0));
        });
      });

    const activeChinaFormats = plateFormats.filter((f) => {
      const n = normalize(f.format_name);
      return !LOCAL_FORMATS.has(n) && !PHASED_OUT[n];
    });

    return activeChinaFormats
      .map((format) => {
        const normName = normalize(format.format_name);

        const contributingIds: string[] = [format.id];
        Object.entries(PHASED_OUT).forEach(([old, next]) => {
          if (next === normName) {
            const oldFmt = formatByNorm.get(old);
            if (oldFmt) contributingIds.push(oldFmt.id);
          }
        });

        const merged = new Map<string, number>();
        contributingIds.forEach((id) => {
          const m = byFormatMonth.get(id);
          if (m) m.forEach((v, k) => merged.set(k, (merged.get(k) || 0) + v));
        });

        const sortedMonths = Array.from(merged.keys()).sort().reverse();
        const completeMonths = sortedMonths.filter((m) => m !== currentMonthKey).slice(0, 6);
        const completeAvg =
          completeMonths.length > 0
            ? completeMonths.reduce((s, m) => s + (merged.get(m) || 0), 0) / completeMonths.length
            : 0;

        const currentTotal = merged.get(currentMonthKey) || 0;
        const currentProjected = dayOfMonth > 0 ? (currentTotal / dayOfMonth) * daysInCurrentMonth : 0;

        let monthlyAvg = completeAvg;
        if (currentTotal > 0 && completeMonths.length > 0) {
          monthlyAvg = completeAvg * 0.7 + currentProjected * 0.3;
        } else if (completeMonths.length === 0 && currentTotal > 0) {
          monthlyAvg = currentProjected;
        }

        let totalStock = format.current_stock || 0;
        const phasedOutStocks: { name: string; qty: number }[] = [];
        Object.entries(PHASED_OUT).forEach(([old, next]) => {
          if (next === normName) {
            const oldFmt = formatByNorm.get(old);
            if (oldFmt && oldFmt.current_stock > 0) {
              totalStock += oldFmt.current_stock;
              phasedOutStocks.push({ name: oldFmt.format_name, qty: oldFmt.current_stock });
            }
          }
        });

        const pending = pendingByFormat.get(format.id) || 0;
        const available = totalStock + pending;
        const coverageMonths = monthlyAvg > 0 ? available / monthlyAvg : 999;

        const rop = monthlyAvg * (LEAD_MONTHS + SAFETY_MONTHS);
        const target = monthlyAvg * COVER_MONTHS;
        const shouldOrder = available < rop;
        const rawRecommended = Math.max(0, target - available);
        const recommendedOrder = Math.ceil(rawRecommended / 100) * 100;

        const perPlateM2 = m2PerPlate(format.format_name);
        const recommendedM2 = recommendedOrder * perPlateM2;

        let urgency: "critical" | "warning" | "soon" | "ok" = "ok";
        if (coverageMonths < LEAD_MONTHS) urgency = "critical";
        else if (coverageMonths < LEAD_MONTHS + 1) urgency = "warning";
        else if (shouldOrder) urgency = "soon";

        return {
          format,
          normName,
          totalStock,
          phasedOutStocks,
          pending,
          available,
          monthlyAvg: Math.round(monthlyAvg),
          coverageMonths,
          shouldOrder,
          recommendedOrder,
          perPlateM2,
          recommendedM2,
          urgency,
          completeMonthsUsed: completeMonths.length,
        };
      })
      .sort((a, b) => a.coverageMonths - b.coverageMonths);
  }, [plateFormats, orders, monthlyData]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalToOrder = rows.reduce((s, r) => s + r.recommendedOrder, 0);
  const totalM2All = rows.reduce((s, r) => s + r.recommendedM2, 0);
  const criticalCount = rows.filter((r) => r.urgency === "critical").length;

  const selectableRows = rows.filter((r) => r.recommendedOrder > 0);
  const selectedRows = selectableRows.filter((r) => selected[r.format.id]);
  const selectedQty = selectedRows.reduce((s, r) => s + r.recommendedOrder, 0);
  const selectedM2 = selectedRows.reduce((s, r) => s + r.recommendedM2, 0);
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selected[r.format.id]);

  const toggleAll = () => {
    if (allSelected) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      selectableRows.forEach((r) => (next[r.format.id] = true));
      setSelected(next);
    }
  };

  const handleCopy = async () => {
    const source = selectedRows.length > 0 ? selectedRows : selectableRows;
    if (source.length === 0) {
      toast.error("Nema formata za kopiranje");
      return;
    }
    const header = ["Format", "Količina (kom)", "m² po ploči", "Ukupno m²"].join("\t");
    const lines = source.map((r) =>
      [
        r.format.format_name,
        r.recommendedOrder,
        r.perPlateM2.toFixed(4).replace(".", ","),
        r.recommendedM2.toFixed(2).replace(".", ","),
      ].join("\t")
    );
    const totalQty = source.reduce((s, r) => s + r.recommendedOrder, 0);
    const totalM2 = source.reduce((s, r) => s + r.recommendedM2, 0);
    const totalLine = ["UKUPNO", totalQty, "", totalM2.toFixed(2).replace(".", ",")].join("\t");
    const text = [header, ...lines, totalLine].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`Kopirano ${source.length} formata u clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Greška pri kopiranju");
    }
  };

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5 text-primary" />
              Ako bih danas poručio ploče iz Kine…
            </CardTitle>
            <CardDescription className="mt-1">
              Formula: prosek 6 kompletnih meseci (+ tekući mesec projektovan) × {COVER_MONTHS} meseci − (lager + na putu).<br />
              Lead time: {LEAD_MONTHS} meseca &nbsp;·&nbsp; Sigurnosna zaliha: {SAFETY_MONTHS} meseca &nbsp;·&nbsp; Zaokruženo na 100 kom.
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Ukupno za porudžbinu</div>
            <div className="text-2xl font-bold text-primary">
              {totalToOrder.toLocaleString("sr-RS")}
            </div>
            <div className="text-xs text-muted-foreground">
              ploča · {totalM2All.toLocaleString("sr-RS", { maximumFractionDigits: 0 })} m²
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              {criticalCount} format(a) ima manje od {LEAD_MONTHS} meseca pokrivenosti — može nestati pre dolaska sledeće pošiljke!
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-md bg-muted/40 border">
          <div className="text-sm">
            {selectedRows.length > 0 ? (
              <>
                <span className="font-semibold text-primary">
                  {selectedRows.length} izabrano
                </span>
                {" · "}
                {selectedQty.toLocaleString("sr-RS")} ploča
                {" · "}
                {selectedM2.toLocaleString("sr-RS", { maximumFractionDigits: 2 })} m²
              </>
            ) : (
              <span className="text-muted-foreground">
                Selektuj formate ili kopiraj sve
              </span>
            )}
          </div>
          <Button onClick={handleCopy} size="sm" variant="secondary" className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Kopirano" : selectedRows.length > 0 ? "Kopiraj izabrano" : "Kopiraj sve"}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selektuj sve"
                  />
                </TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="text-right">Lager</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Na putu</TableHead>
                <TableHead className="text-right hidden md:table-cell">Prosek/mes</TableHead>
                <TableHead className="text-right">Pokrivenost</TableHead>
                <TableHead className="text-right">Poruči</TableHead>
                <TableHead className="text-right">m²</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const canSelect = r.recommendedOrder > 0;
                return (
                  <TableRow
                    key={r.format.id}
                    className={
                      r.urgency === "critical"
                        ? "bg-destructive/10"
                        : r.urgency === "warning"
                        ? "bg-orange-500/10"
                        : r.urgency === "soon"
                        ? "bg-yellow-500/5"
                        : ""
                    }
                  >
                    <TableCell>
                      {canSelect && (
                        <Checkbox
                          checked={!!selected[r.format.id]}
                          onCheckedChange={(v) =>
                            setSelected((prev) => ({ ...prev, [r.format.id]: !!v }))
                          }
                          aria-label={`Selektuj ${r.format.format_name}`}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{r.format.format_name}</div>
                      {r.phasedOutStocks.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          uklj. {r.phasedOutStocks.map((p) => `${p.name} (${p.qty})`).join(", ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {r.totalStock.toLocaleString("sr-RS")}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {r.pending > 0 ? r.pending.toLocaleString("sr-RS") : "—"}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      <div>{r.monthlyAvg.toLocaleString("sr-RS")}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.completeMonthsUsed} mes. podataka
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          r.urgency === "critical"
                            ? "destructive"
                            : r.urgency === "warning"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {r.coverageMonths >= 99 ? "∞" : `${r.coverageMonths.toFixed(1)} mes`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.recommendedOrder > 0 ? (
                        <span className="font-bold text-primary">
                          {r.recommendedOrder.toLocaleString("sr-RS")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.recommendedM2 > 0 ? (
                        <span className="font-medium">
                          {r.recommendedM2.toLocaleString("sr-RS", { maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="border-t-2 font-bold bg-muted/30">
                <TableCell colSpan={6} className="text-right">
                  UKUPNO
                </TableCell>
                <TableCell className="text-right text-primary">
                  {totalToOrder.toLocaleString("sr-RS")}
                </TableCell>
                <TableCell className="text-right text-primary">
                  {totalM2All.toLocaleString("sr-RS", { maximumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="text-xs text-muted-foreground p-3 rounded-md bg-muted/40 space-y-1">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <MapPin className="h-3.5 w-3.5" /> Formati koji se NE poručuju iz Kine
          </div>
          <div>• <strong>450×370, 510×400</strong> — B3 formati, kupuju se lokalno.</div>
          <div>• <strong>730×605, 740×605</strong> — ukinuti, prebačeni na <strong>745×605</strong>.</div>
          <div>• <strong>1030×785</strong> — ukinut, zameniće ga <strong>1030×790</strong> (skraćivanjem po potrebi).</div>
        </div>
      </CardContent>
    </Card>
  );
}
