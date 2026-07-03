import { useMemo, useState } from "react";
import { QuoteItem, useUpdateMaterialCostInQuote } from "@/hooks/useQuotesPro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Layers, RefreshCw } from "lucide-react";

interface Props {
  quoteId: string;
  items: QuoteItem[];
  defaultMarkupPercent: number;
}

interface MaterialAgg {
  material_id: string;
  material_name: string;
  itemCount: number;
  currentCost: number;
  totalArea: number;
}

export function MaterialsCostPanel({ quoteId, items, defaultMarkupPercent }: Props) {
  const update = useUpdateMaterialCostInQuote();
  const [draftCosts, setDraftCosts] = useState<Record<string, number>>({});

  const aggregated = useMemo<MaterialAgg[]>(() => {
    const map = new Map<string, MaterialAgg>();
    items.forEach((it) => {
      if (!it.material_id) return;
      const key = it.material_id;
      const cur = map.get(key);
      const cost = Number(it.cost_per_m2 || 0);
      const area = Number(it.area_m2 || 0) * Number(it.quantity || 0);
      if (cur) {
        cur.itemCount += 1;
        cur.totalArea += area;
        if (!cur.currentCost && cost) cur.currentCost = cost;
      } else {
        map.set(key, {
          material_id: key,
          material_name: it.material_name || "—",
          itemCount: 1,
          currentCost: cost,
          totalArea: area,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.itemCount - a.itemCount);
  }, [items]);

  if (aggregated.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Materijali u ponudi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nema stavki sa povezanim materijalom. Dodaj stavku i izaberi materijal iz kataloga.
          </p>
        </CardContent>
      </Card>
    );
  }

  const applyAll = async () => {
    const changed = Object.entries(draftCosts).filter(([id, v]) => {
      const orig = aggregated.find((a) => a.material_id === id)?.currentCost ?? 0;
      return v !== orig && v > 0;
    });
    for (const [materialId, newCost] of changed) {
      await update.mutateAsync({
        quoteId,
        materialId,
        newCostPerM2: newCost,
        defaultMarkupPercent,
      });
    }
    setDraftCosts({});
  };

  const hasChanges = Object.entries(draftCosts).some(([id, v]) => {
    const orig = aggregated.find((a) => a.material_id === id)?.currentCost ?? 0;
    return v !== orig && v > 0;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" />
          Materijali u ponudi
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Promena cene → automatski preračun svih stavki koje koriste taj materijal.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {aggregated.map((a) => {
          const draft = draftCosts[a.material_id];
          const value = draft ?? a.currentCost;
          const changed = draft !== undefined && draft !== a.currentCost;
          return (
            <div
              key={a.material_id}
              className="flex items-center gap-2 border-b pb-2 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.material_name}</div>
                <div className="text-xs text-muted-foreground">
                  {a.itemCount} stavki • {a.totalArea.toFixed(1)} m² ukupno
                </div>
              </div>
              <Input
                type="number"
                step="0.01"
                value={value || ""}
                placeholder="RSD/m²"
                onChange={(e) =>
                  setDraftCosts((p) => ({
                    ...p,
                    [a.material_id]: Number(e.target.value) || 0,
                  }))
                }
                className={`h-8 w-28 text-right ${changed ? "border-amber-500" : ""}`}
              />
            </div>
          );
        })}

        {hasChanges && (
          <Button
            onClick={applyAll}
            disabled={update.isPending}
            className="w-full gap-2"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${update.isPending ? "animate-spin" : ""}`} />
            Primeni i preračunaj
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
