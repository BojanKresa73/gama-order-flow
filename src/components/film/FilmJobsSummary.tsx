import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FilmJobsSummaryProps {
  totalMeters: number;
  costPerMeter: number;
  defaultPricePerMeter: number;
  overridePrice: number | null;
  clientDiscount: number;
  onOverridePriceChange: (value: number | null) => void;
}

export const FilmJobsSummary = ({
  totalMeters,
  costPerMeter,
  defaultPricePerMeter,
  overridePrice,
  clientDiscount,
  onOverridePriceChange,
}: FilmJobsSummaryProps) => {
  const effectivePrice = overridePrice ?? defaultPricePerMeter;
  const costTotal = totalMeters * costPerMeter;
  const sellingTotal = totalMeters * effectivePrice;
  const margin = sellingTotal - costTotal;
  const marginPercent = costTotal > 0 ? (margin / costTotal) * 100 : 0;
  
  const discountedTotal = clientDiscount > 0 
    ? sellingTotal * (1 - clientDiscount / 100)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sažetak filmovanja</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-muted-foreground">Ukupno dužnih metara</Label>
            <p className="text-2xl font-bold">{totalMeters.toFixed(2)} m</p>
          </div>
          
          <div>
            <Label className="text-muted-foreground">Naša nabavna</Label>
            <p className="text-2xl font-bold">€{costTotal.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">€{costPerMeter.toFixed(2)}/m</p>
          </div>
          
          <div>
            <Label className="text-muted-foreground">Prodajna</Label>
            <p className="text-2xl font-bold">€{sellingTotal.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              €{effectivePrice.toFixed(2)}/m
              {overridePrice && " (prilagođeno)"}
            </p>
          </div>
          
          <div>
            <Label className="text-muted-foreground">Marža</Label>
            <p className="text-2xl font-bold text-primary">€{margin.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{marginPercent.toFixed(1)}%</p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="filmPriceOverride">
                Cena €/m (prodajna) - override
              </Label>
              <Input
                id="filmPriceOverride"
                type="number"
                step="0.01"
                min="0"
                placeholder={`Default: €${defaultPricePerMeter.toFixed(2)}`}
                value={overridePrice ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  onOverridePriceChange(value ? parseFloat(value) : null);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ostavi prazno za default cenu iz podešavanja
              </p>
            </div>

            {discountedTotal !== null && (
              <div className="flex flex-col justify-end">
                <Label className="text-muted-foreground">
                  Cena sa rabatom ({clientDiscount}%)
                </Label>
                <p className="text-2xl font-bold text-green-600">
                  €{discountedTotal.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ušteda: €{(sellingTotal - discountedTotal).toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
