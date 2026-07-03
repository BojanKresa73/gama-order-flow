import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MaterialWithPrice } from "@/hooks/useLargeFormatPricing";

interface MaterialComboboxProps {
  materials: MaterialWithPrice[];
  value: string | null;
  onChange: (materialId: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
}

export function MaterialCombobox({
  materials,
  value,
  onChange,
  disabled,
  invalid,
}: MaterialComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = materials.find((m) => m.id === value);

  const grouped = React.useMemo(() => {
    const withUsage = materials.filter((m) => (m.usage_count ?? 0) > 0);
    const favorites = [...withUsage]
      .sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0))
      .slice(0, 5);
    const favIds = new Set(favorites.map((m) => m.id));

    const byCategory: Record<string, MaterialWithPrice[]> = {};
    for (const m of materials) {
      const cat = m.category || "Ostalo";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(m);
    }
    const sortedCats = Object.keys(byCategory).sort((a, b) => a.localeCompare(b, "sr"));
    for (const c of sortedCats) {
      byCategory[c].sort((a, b) => a.name.localeCompare(b.name, "sr"));
    }

    const groups: { label: string; items: MaterialWithPrice[] }[] = [];
    if (favorites.length > 0) groups.push({ label: "⭐ Omiljeni", items: favorites });
    for (const c of sortedCats) {
      const items = byCategory[c].filter((m) => !favIds.has(m.id));
      if (items.length > 0) groups.push({ label: c, items });
    }
    return groups;
  }, [materials]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            invalid && "border-destructive ring-2 ring-destructive/30"
          )}
        >
          <span className="truncate">{selected ? selected.name : "Izaberi materijal"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 z-50 bg-popover"
        align="start"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Pretraži materijal..." />
          <CommandList className="max-h-80 overflow-y-auto overscroll-contain">
            <CommandEmpty>Nije pronađen materijal.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground italic">Bez materijala</span>
              </CommandItem>
            </CommandGroup>
            {grouped.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((m) => (
                  <CommandItem
                    key={`${group.label}-${m.id}`}
                    value={`${m.name} ${m.category}`}
                    onSelect={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === m.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{m.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
