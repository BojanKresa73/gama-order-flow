import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocalDigitalJob } from "./LocalDigitalJobsTable";
import { calculateGroupedPricing, formatTierLabel } from "@/lib/digitalGroupedPricing";
import { useAuthz } from "@/hooks/useAuthz";
import * as XLSX from "xlsx";

interface DigitalJobsSummaryProps {
  jobs: LocalDigitalJob[];
  clientRabatProcenat?: number;
  prepHours?: number;
}

export const DigitalJobsSummary = ({ jobs, clientRabatProcenat = 0, prepHours = 0 }: DigitalJobsSummaryProps) => {
  const { isSuper, isAdmin } = useAuthz();
  const canSeePrices = isSuper || isAdmin;

  // Calculate totals using new grouped logic
  const pricing = calculateGroupedPricing(jobs, prepHours);
  const {
    totalSheets,
    totalColorClicks,
    totalMonoClicks,
    totalAmount,
    totalPaperCost,
    totalClickCost,
    ruc,
    rucPercent,
    groups,
    prepCost,
    totalWithPrep,
    externalServicesTotal,
  } = pricing;
  // Aggregate finishings across all jobs (each product stashes finishings on first job)
  const finishingsTotal = jobs.reduce((sum, j) => sum + (j.finishings_total || 0), 0);
  const grandTotal = totalWithPrep + finishingsTotal;
  const amountWithDiscount = grandTotal * (1 - clientRabatProcenat / 100);

  const handleExportXLSX = () => {
    const worksheetData: (string | number)[][] = [
      ["DIGITALNA ŠTAMPA - SAŽETAK"],
      [],
      ["Naziv", "Obim", "Štampa", "Tiraž", "Papir", "Format tabaka"],
      ...jobs.map(job => [
        job.name || job.file_name || "-",
        job.obim || 1,
        job.print_sides || "-",
        job.qty || 0,
        job.paper_type || "-",
        job.machine_sheet_format || "-",
      ]),
      [],
      ["KALKULACIJA PO GRUPAMA"],
    ];

    // Add groups breakdown
    for (const group of groups) {
      worksheetData.push([]);
      worksheetData.push([`${group.coverage} ${group.format}`]);
      worksheetData.push(["Stavka", "Obim", "Tiraž", "Tabaka"]);
      
      for (const item of group.items) {
        worksheetData.push([item.name, item.obim, item.qty, item.sheets]);
      }
      
      worksheetData.push([
        `Ukupno: ${group.totalSheets} tab.`,
        `Kategorija: ${formatTierLabel(group.tier)}`,
        `Cena/tab: ${group.pricePerSheetBase.toFixed(2)} €`,
        `Iznos: ${group.groupTotal.toFixed(2)} €`
      ]);
    }

    worksheetData.push([]);
    worksheetData.push(["UKUPNO"]);
    worksheetData.push(["Ukupno tabaka:", totalSheets]);
    worksheetData.push(["Color klikovi:", totalColorClicks]);
    worksheetData.push(["Mono klikovi:", totalMonoClicks]);

    // Only include prices for admins/superusers
    if (canSeePrices) {
      worksheetData.push(
        ["Štampa (€):", totalAmount.toFixed(2)],
        ["Priprema (€):", prepCost.toFixed(2)],
        ["Ukupno (€):", totalWithPrep.toFixed(2)],
        ["Papir (€):", totalPaperCost.toFixed(2)],
        ["Klikovi (€):", totalClickCost.toFixed(2)],
        ["RUC (€):", ruc.toFixed(2)],
        ["RUC (%):", rucPercent.toFixed(1) + "%"]
      );

      if (clientRabatProcenat > 0) {
        worksheetData.push(
          [`Rabat (${clientRabatProcenat}%):`, (totalWithPrep - amountWithDiscount).toFixed(2)],
          ["Sa rabatom (€):", amountWithDiscount.toFixed(2)]
        );
      }
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Digitalna štampa");
    
    XLSX.writeFile(workbook, `digitalna_stampa_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (jobs.length === 0) return null;

  // Total pieces: sum qty per product group (avoid double-counting cover+interior)
  const seenGroups = new Set<string>();
  let totalPieces = 0;
  for (const j of jobs) {
    const key = j.product_group_id || `__solo_${j.id || Math.random()}`;
    if (seenGroups.has(key)) continue;
    seenGroups.add(key);
    const groupJobs = j.product_group_id
      ? jobs.filter((x) => x.product_group_id === j.product_group_id)
      : [j];
    totalPieces += Math.max(...groupJobs.map((g) => g.qty || 0));
  }

  const totalCost = totalPaperCost + totalClickCost;
  const revenue = grandTotal;
  const revenuePerPiece = totalPieces > 0 ? revenue / totalPieces : 0;
  const costPerPiece = totalPieces > 0 ? totalCost / totalPieces : 0;
  const rucPerPiece = totalPieces > 0 ? ruc / totalPieces : 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Header row: quantity + export */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b">
          <div className="flex gap-8">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Tabaka</div>
              <div className="text-2xl font-bold">{totalSheets}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Komada</div>
              <div className="text-2xl font-bold">{totalPieces}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Klikovi</div>
              <div className="text-sm font-semibold mt-1">
                <span className="text-primary">C: {totalColorClicks}</span>
                <span className="mx-1.5 text-muted-foreground">/</span>
                <span>M: {totalMonoClicks}</span>
              </div>
            </div>
          </div>
          <Button type="button" onClick={handleExportXLSX} variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export XLSX
          </Button>
        </div>

        {canSeePrices && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* IZLAZ (Prihod) */}
            <div className="rounded-lg border bg-blue-50/40 dark:bg-blue-950/20 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Izlaz (prihod)</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Štampa</span><span>€{totalAmount.toFixed(2)}</span></div>
                {prepCost > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Priprema</span><span>€{prepCost.toFixed(2)}</span></div>
                )}
                {finishingsTotal > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Dorade</span><span>€{finishingsTotal.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between pt-1.5 mt-1.5 border-t font-semibold">
                  <span>Ukupno</span><span className="text-blue-600">€{revenue.toFixed(2)}</span>
                </div>
                {clientRabatProcenat > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Sa rabatom ({clientRabatProcenat}%)</span><span>€{amountWithDiscount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* TROŠAK */}
            <div className="rounded-lg border bg-orange-50/40 dark:bg-orange-950/20 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Trošak</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Papir</span><span>€{totalPaperCost.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Klikovi</span><span>€{totalClickCost.toFixed(2)}</span></div>
                <div className="flex justify-between pt-1.5 mt-1.5 border-t font-semibold">
                  <span>Ukupno</span><span className="text-orange-600">€{totalCost.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* RUC */}
            <div className="rounded-lg border bg-green-50/40 dark:bg-green-950/20 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">RUC</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-muted-foreground">Iznos</span>
                  <span className="text-2xl font-bold text-green-600">€{ruc.toFixed(2)}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Marža</span><span className="font-semibold text-green-600">{rucPercent.toFixed(1)}%</span></div>
                <div className="flex justify-between pt-1.5 mt-1.5 border-t text-xs">
                  <span className="text-muted-foreground">RUC / kom</span><span className="font-semibold">€{rucPerPiece.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {canSeePrices && totalPieces > 0 && (
          <div className="grid grid-cols-3 gap-4 pt-3 border-t text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cena / kom</span>
              <span className="font-semibold text-blue-600">€{revenuePerPiece.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trošak / kom</span>
              <span className="font-semibold text-orange-600">€{costPerPiece.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">RUC / kom</span>
              <span className="font-semibold text-green-600">€{rucPerPiece.toFixed(4)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
