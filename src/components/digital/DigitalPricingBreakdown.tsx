import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  calculateGroupedPricing, 
  formatTierLabel,
  type DigitalJobItem,
  type GroupedPricingItem
} from "@/lib/digitalGroupedPricing";

/**
 * Parse item name to extract pieces count
 * Pattern: "XX tab__YYY description" where YYY is the pieces count
 * Example: "22 tab__130 flajer DZ Grocka 2.new" -> 130 pieces
 */
function extractPiecesFromName(name: string): number | null {
  // Pattern: "N tab__M" where M is the pieces count
  const match = name.match(/\d+\s*tab__(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Calculate price per piece for an item
 */
function calculatePricePerPiece(
  item: GroupedPricingItem, 
  pricePerSheet: number, 
  formatMultiplier: number,
  qty: number
): { pieces: number; pricePerPiece: number } | null {
  const pieces = extractPiecesFromName(item.name);
  if (!pieces || pieces <= 0) return null;
  
  // Total pieces = pieces per copy * qty (tiraz)
  const totalPieces = pieces * qty;
  // Item price = sheets * pricePerSheet * formatMultiplier
  const itemPrice = item.sheets * pricePerSheet * formatMultiplier;
  const pricePerPiece = itemPrice / totalPieces;
  
  return { pieces: totalPieces, pricePerPiece };
}

interface DigitalPricingBreakdownProps {
  jobs: DigitalJobItem[];
  clientRabatProcenat?: number;
}

export const DigitalPricingBreakdown = ({ 
  jobs, 
  clientRabatProcenat = 0 
}: DigitalPricingBreakdownProps) => {
  if (jobs.length === 0) return null;

  const pricing = calculateGroupedPricing(jobs);
  const amountWithDiscount = pricing.totalAmount * (1 - clientRabatProcenat / 100);
  const discountAmount = pricing.totalAmount - amountWithDiscount;

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
                  <TableHead className="w-[40%]">Naziv</TableHead>
                  <TableHead className="text-center">Obim</TableHead>
                  <TableHead className="text-center">Tiraž</TableHead>
                  <TableHead className="text-right">Tabaka</TableHead>
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
                    group.formatMultiplier,
                    item.qty
                  );
                  
                  return (
                    <TableRow key={itemIndex}>
                      <TableCell className="font-medium">
                        <div>{item.name}</div>
                        {perPieceInfo && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {perPieceInfo.pieces} kom × {perPieceInfo.pricePerPiece.toFixed(4)} € = {(perPieceInfo.pieces * perPieceInfo.pricePerPiece).toFixed(2)} €
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.obim}</TableCell>
                      <TableCell className="text-center">{item.qty}</TableCell>
                      <TableCell className="text-right">{item.sheets}</TableCell>
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
                  <TableCell colSpan={3}>Ukupno {group.coverage} {group.format}</TableCell>
                  <TableCell className="text-right">{group.totalSheets} tab.</TableCell>
                  {group.format === '760x330' && (
                    <TableCell className="text-right">{group.totalSheetsForTier}</TableCell>
                  )}
                </TableRow>
              </TableBody>
            </Table>

            {/* Group calculation */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Kategorija cena (na osnovu {group.format === '760x330' ? group.totalSheetsForTier : group.totalSheets} tabaka):</span>
                <span className="font-medium">{formatTierLabel(group.tier)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Cena po tabaku ({group.coverage}):</span>
                <span className="font-medium">{group.pricePerSheetBase.toFixed(2)} €</span>
              </div>
              {group.format === '760x330' && (
                <div className="flex justify-between text-sm">
                  <span>Množilac za format 760×330:</span>
                  <span className="font-medium">× 1.5</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>
                  {group.totalSheets} × {group.pricePerSheetBase.toFixed(2)} €
                  {group.format === '760x330' ? ' × 1.5' : ''}
                </span>
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

          {/* Total price */}
          <div className="flex justify-between text-lg font-bold">
            <span>Ukupna cena:</span>
            <span className="text-primary">{pricing.totalAmount.toFixed(2)} €</span>
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
