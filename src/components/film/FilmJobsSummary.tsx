import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useFilmSettings } from "@/hooks/useFilmSettings";

interface FilmJobsSummaryProps {
  totalMeters: number;
  clientDiscount: number;
}

export const FilmJobsSummary = ({
  totalMeters,
  clientDiscount,
}: FilmJobsSummaryProps) => {
  const { data: filmSettings } = useFilmSettings();
  
  const COST_EUR_PER_M = filmSettings?.cost_eur_per_m ?? 15;
  const PRICE_EUR_PER_M = filmSettings?.price_eur_per_m ?? 22;

  const costTotal = totalMeters * COST_EUR_PER_M;
  const sellingTotal = totalMeters * PRICE_EUR_PER_M;
  const margin = sellingTotal - costTotal;
  const marginPercent = sellingTotal > 0 ? (margin / sellingTotal) * 100 : 0;
  
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
            <Label className="text-muted-foreground">Ukupno m</Label>
            <p className="text-2xl font-bold">{totalMeters.toFixed(2)} m</p>
          </div>
          
          <div>
            <Label className="text-muted-foreground">Nabavna</Label>
            <p className="text-2xl font-bold text-orange-600">€{costTotal.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{COST_EUR_PER_M} €/m</p>
          </div>
          
          <div>
            <Label className="text-muted-foreground">Prodajna</Label>
            <p className="text-2xl font-bold text-green-600">€{sellingTotal.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{PRICE_EUR_PER_M} €/m</p>
          </div>
          
          <div>
            <Label className="text-muted-foreground">Marža</Label>
            <p className="text-2xl font-bold text-blue-600">€{margin.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{marginPercent.toFixed(1)}%</p>
          </div>
        </div>

        {discountedTotal !== null && (
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-muted-foreground">
                  Cena sa rabatom ({clientDiscount}%)
                </Label>
                <p className="text-2xl font-bold text-primary">
                  €{discountedTotal.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <Label className="text-muted-foreground">Ušteda</Label>
                <p className="text-lg font-semibold text-red-600">
                  -€{(sellingTotal - discountedTotal).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
