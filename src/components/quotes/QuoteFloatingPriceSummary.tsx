import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Quote } from "@/hooks/useQuotesPro";

interface Props {
  quote: Quote;
}

const fmt = (v: number) =>
  v.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function QuoteFloatingPriceSummary({ quote }: Props) {
  const [open, setOpen] = useState(true);
  const EUR = Number(quote.exchange_rate_used) || 117.55;

  const totalEur = Number(quote.total_price) / EUR;
  const discountPct = Number(quote.discount_percent || 0);
  const discountEur = (Number(quote.total_price) * discountPct) / 100 / EUR;
  const finalEur = Number(quote.final_price) / EUR;
  const installEur =
    (quote.items || []).reduce(
      (s, it: any) => s + Number(it.installation_cost || 0),
      0
    ) / EUR;
  const terrainEur = Number((quote as any).terrain_visits_cost || 0) / EUR;
  const terrainCount = Number((quote as any).terrain_visits_count || 0);
  const itemsOnlyEur = totalEur - installEur;

  if (!open) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed right-3 top-1/2 -translate-y-1/2 z-40 h-auto flex-col gap-1 py-3 px-2 rounded-l-lg rounded-r-none shadow-lg animate-fade-in"
      >
        <Receipt className="h-4 w-4" />
        <span className="text-[10px] font-bold tabular-nums">{fmt(finalEur)} €</span>
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed right-3 top-24 z-40 w-64 rounded-lg border bg-card shadow-xl animate-scale-in"
      )}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">Struktura cene</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setOpen(false)}
          title="Sakri"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5 p-3 text-xs">
        <Row label="Stavke (bez montaže)" value={`${fmt(itemsOnlyEur)} €`} />
        {installEur > 0 && (
          <Row
            label="+ Montaža"
            value={`${fmt(installEur)} €`}
            accent="text-purple-700 dark:text-purple-300"
          />
        )}
        <div className="border-t pt-1.5">
          <Row label="Suma stavki" value={`${fmt(totalEur)} €`} bold />
        </div>
        {terrainEur > 0 && (
          <Row
            label={`+ Izlazak na teren${terrainCount > 1 ? ` (×${terrainCount})` : ""}`}
            value={`${fmt(terrainEur)} €`}
            accent="text-amber-700 dark:text-amber-400"
          />
        )}
        {discountPct > 0 && (
          <Row
            label={`Popust ${discountPct}%`}
            value={`-${fmt(discountEur)} €`}
            accent="text-destructive"
          />
        )}
        <div className="mt-2 flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
            Ukupno
          </span>
          <span className="text-sm font-bold tabular-nums text-primary">
            {fmt(finalEur)} €
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn("text-muted-foreground", accent)}>{label}</span>
      <span
        className={cn("tabular-nums", bold ? "font-semibold" : "font-medium", accent)}
      >
        {value}
      </span>
    </div>
  );
}
