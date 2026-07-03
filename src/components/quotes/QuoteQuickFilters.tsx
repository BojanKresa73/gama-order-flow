import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QuickFilterKey =
  | "all"
  | "mine"
  | "expiring_soon"
  | "stale_sent"
  | "high_value"
  | "this_month";

const FILTERS: { key: QuickFilterKey; label: string }[] = [
  { key: "all", label: "Sve" },
  { key: "mine", label: "Moje" },
  { key: "expiring_soon", label: "Ističu uskoro (3d)" },
  { key: "stale_sent", label: "Bez odgovora >7d" },
  { key: "high_value", label: "Visoke vrednosti" },
  { key: "this_month", label: "Ovaj mesec" },
];

export function QuoteQuickFilters({
  value,
  onChange,
}: {
  value: QuickFilterKey;
  onChange: (k: QuickFilterKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => (
        <Button
          key={f.key}
          size="sm"
          variant={value === f.key ? "default" : "outline"}
          className={cn("h-8 rounded-full")}
          onClick={() => onChange(f.key)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}
