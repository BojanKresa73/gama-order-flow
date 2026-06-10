import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  calculateGroupedPricing, 
  formatTierLabel,
  PREP_HOUR_RATE,
  type DigitalJobItem,
  type GroupedPricingItem
} from "@/lib/digitalGroupedPricing";
import { getProgressiveBreakdown } from "@/lib/digitalCalculations";

/**
 * Extract pieces count from item name (e.g., "flajer 27 kom" → 27)
 */
function extractPiecesFromName(name: string): number | null {
  const match = name.match(/(\d+)\s*kom\b/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Calculate price per piece for an item
 * Formula: (broj tabaka × cena po tabaku) / broj komada
 * Uses pieces_count if set, otherwise tries to parse from name, otherwise uses qty
 */
function calculatePricePerPiece(
  item: GroupedPricingItem, 
  pricePerSheet: number, 
  formatMultiplier: number
): { totalPieces: number; pricePerPiece: number } {
  // Total price for item = sheets × price_per_sheet × format_multiplier
  const itemPrice = item.sheets * pricePerSheet * formatMultiplier;
  
  // Determine total pieces (komada):
  // Priority: explicit piecesCount > parsed from name > default to qty (tiraz)
  // pieces_count is the TOTAL number of pieces for this item, not per copy
  let totalPieces = item.qty;
  if (item.piecesCount && item.piecesCount > 0) {
    totalPieces = item.piecesCount;
  } else {
    const parsed = extractPiecesFromName(item.name);
    if (parsed && parsed > 0) {
      totalPieces = parsed;
    }
  }
  // €/kom = total item price / total pieces
  const pricePerPiece = totalPieces > 0 ? itemPrice / totalPieces : 0;
  return { totalPieces, pricePerPiece };
}

interface DigitalPricingBreakdownProps {
  jobs: DigitalJobItem[];
  clientRabatProcenat?: number;
  prepHours?: number;
}

export const DigitalPricingBreakdown = ({ 
  jobs, 
  clientRabatProcenat = 0,
  prepHours = 0
}: DigitalPricingBreakdownProps) => {
  if (jobs.length === 0) return null;

  const pricing = calculateGroupedPricing(jobs, prepHours);

  // Aggregate finishings across all jobs (stashed on first job per product)
  const allFinishings = jobs.flatMap((j) => j.finishings ?? []);
  const finishingsTotal = jobs.reduce((s, j) => s + (j.finishings_total || 0), 0);
  const grandTotal = pricing.totalWithPrep + finishingsTotal;

  const amountWithDiscount = grandTotal * (1 - clientRabatProcenat / 100);
  const discountAmount = grandTotal - amountWithDiscount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Kalkulacija cene po grupama</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Groups breakdown */}
        {pricing.groups.map((group, groupIndex) => (
          <div key={`${group.coverage}-${group.format}`} className="space-y-3">
            {/* Group header */}
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm font-semibold">
                {group.coverage}
              </Badge>
              <Badge variant="outline" className="text-sm">
                {group.format}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Kategorija: {formatTierLabel(group.tier)}
              </span>
            </div>

            {/* Items in group */}
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[35%]">Naziv</TableHead>
                  <TableHead className="text-center">Obim</TableHead>
                  <TableHead className="text-center">Tiraž</TableHead>
                  <TableHead className="text-right">Tabaka</TableHead>
                  <TableHead className="text-right">€/kom</TableHead>
                  {group.format === '760x330' && (
                    <TableHead className="text-right">× 1.5</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((item, itemIndex) => {
                  const perPieceInfo = calculatePricePerPiece(
                    item, 
                    group.pricePerSheetBase, 
                    group.formatMultiplier
                  );
                  
                  return (
                    <TableRow key={itemIndex}>
                      <TableCell className="font-medium">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-center">{item.obim}</TableCell>
                      <TableCell className="text-center">{item.qty}</TableCell>
                      <TableCell className="text-right">{item.sheets}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-muted-foreground">
                        €{perPieceInfo.pricePerPiece.toFixed(3)}
                      </TableCell>
                      {group.format === '760x330' && (
                        <TableCell className="text-right text-muted-foreground">
                          {item.sheetsForTier}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                
                {/* Group subtotal row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={4}>Ukupno {group.coverage} {group.format}</TableCell>
                  <TableCell></TableCell>
                  {group.format === '760x330' && (
                    <TableCell className="text-right">{group.totalSheetsForTier}</TableCell>
                  )}
                </TableRow>
              </TableBody>
            </Table>

            {/* Group calculation - progressive tier breakdown */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium mb-2">
                Progresivni obračun po segmentima ({group.format === '760x330' ? `${group.totalSheetsForTier} ekv. tabaka` : `${group.totalSheets} tabaka`}):
              </div>
              {getProgressiveBreakdown(group.totalSheetsForTier, group.coverage).map((seg, i) => (
                <div key={i} className="flex justify-between text-sm pl-2">
                  <span className="text-muted-foreground">
                    Segment {seg.minQty}–{seg.maxQty === Infinity ? '∞' : seg.maxQty}: {seg.sheetsInTier} × {seg.pricePerSheet.toFixed(2)} €
                  </span>
                  <span className="font-medium">{seg.subtotal.toFixed(2)} €</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Prosečna cena po tabaku ({group.coverage}):</span>
                <span>{group.pricePerSheetBase.toFixed(3)} €</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Ukupno za grupu {group.coverage} {group.format}:</span>
                <span className="text-primary">{group.groupTotal.toFixed(2)} €</span>
              </div>
            </div>

            {groupIndex < pricing.groups.length - 1 && (
              <Separator className="my-4" />
            )}
          </div>
        ))}

        {/* Final totals */}
        <div className="border-t-2 pt-4 space-y-3">
          <h4 className="font-semibold text-base">Ukupno</h4>
          
          {/* Sum of all groups */}
          <div className="space-y-1">
            {pricing.groups.map((group) => (
              <div key={`sum-${group.coverage}-${group.format}`} className="flex justify-between text-sm">
                <span>{group.coverage} {group.format}:</span>
                <span>{group.groupTotal.toFixed(2)} €</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Prep hours if applicable */}
          {pricing.prepCost > 0 && (
            <>
              <div className="flex justify-between text-sm bg-blue-50 dark:bg-blue-950/30 p-2 rounded">
                <span>Priprema ({prepHours} sati × {PREP_HOUR_RATE} €):</span>
                <span className="font-medium text-blue-600">{pricing.prepCost.toFixed(2)} €</span>
              </div>
            </>
          )}

          {/* Total price */}
          <div className="flex justify-between text-lg font-bold">
            <span>Ukupna cena:</span>
            <span className="text-primary">{pricing.totalWithPrep.toFixed(2)} €</span>
          </div>

          {/* Discount if applicable */}
          {clientRabatProcenat > 0 && (
            <>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Rabat ({clientRabatProcenat}%):</span>
                <span>- {discountAmount.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-green-600">
                <span>Sa rabatom:</span>
                <span>{amountWithDiscount.toFixed(2)} €</span>
              </div>
            </>
          )}

          <Separator />

          {/* Costs and RUC */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trošak papira:</span>
              <span>{pricing.totalPaperCost.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trošak klikova (Color: {pricing.totalColorClicks}, Mono: {pricing.totalMonoClicks}):</span>
              <span>{pricing.totalClickCost.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ukupan trošak:</span>
              <span>{pricing.totalCost.toFixed(2)} €</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>RUC (Razlika u ceni):</span>
              <span className={pricing.ruc >= 0 ? "text-green-600" : "text-red-600"}>
                {pricing.ruc.toFixed(2)} € ({pricing.rucPercent.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 pt-3 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold">{pricing.totalSheets}</div>
              <div className="text-xs text-muted-foreground">Ukupno tabaka</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-primary">{pricing.totalColorClicks}</div>
              <div className="text-xs text-muted-foreground">Color klikovi</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{pricing.totalMonoClicks}</div>
              <div className="text-xs text-muted-foreground">Mono klikovi</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
