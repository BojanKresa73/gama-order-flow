import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocalDigitalJob } from "./LocalDigitalJobsTable";
import { calculateWorkOrderTotals } from "@/lib/digitalCalculations";
import * as XLSX from "xlsx";

interface DigitalJobsSummaryProps {
  jobs: LocalDigitalJob[];
  clientRabatProcenat?: number;
}

export const DigitalJobsSummary = ({ jobs, clientRabatProcenat = 0 }: DigitalJobsSummaryProps) => {
  // Calculate totals using new simplified logic
  const totals = calculateWorkOrderTotals(jobs);
  const { totalSheets, totalColorClicks, totalMonoClicks, totalAmount } = totals;
  const amountWithDiscount = totalAmount * (1 - clientRabatProcenat / 100);

  const handleExportXLSX = () => {
    const worksheetData = [
      ["DIGITALNA ŠTAMPA - SAŽETAK"],
      [],
      ["Naziv", "Štampa", "Tiraž", "Papir", "Format tabaka"],
      ...jobs.map(job => [
        job.name || job.file_name || "-",
        job.print_sides || "-",
        job.qty || 0,
        job.paper_type || "-",
        job.machine_sheet_format || "-",
      ]),
      [],
      ["UKUPNO"],
      ["Ukupno tabaka:", totalSheets],
      ["Color klikovi:", totalColorClicks],
      ["Mono klikovi:", totalMonoClicks],
      ["Ukupna cena (€):", totalAmount.toFixed(2)],
    ];

    if (clientRabatProcenat > 0) {
      worksheetData.push(
        [`Rabat (${clientRabatProcenat}%):`, (totalAmount - amountWithDiscount).toFixed(2)],
        ["Sa rabatom (€):", amountWithDiscount.toFixed(2)]
      );
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Digitalna štampa");
    
    XLSX.writeFile(workbook, `digitalna_stampa_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (jobs.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <div>
              <div className="text-sm text-muted-foreground">Ukupno tabaka</div>
              <div className="text-2xl font-bold">{totalSheets}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Klikovi</div>
              <div className="text-lg font-semibold">
                <span className="text-primary">Color: {totalColorClicks}</span>
                <span className="mx-2">|</span>
                <span className="text-muted-foreground">Mono: {totalMonoClicks}</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Cena</div>
              <div className="text-2xl font-bold text-primary">€{totalAmount.toFixed(2)}</div>
            </div>
            {clientRabatProcenat > 0 && (
              <div>
                <div className="text-sm text-muted-foreground">Sa rabatom ({clientRabatProcenat}%)</div>
                <div className="text-2xl font-bold text-green-600">€{amountWithDiscount.toFixed(2)}</div>
              </div>
            )}
          </div>
          <Button
            type="button"
            onClick={handleExportXLSX}
            variant="outline"
            className="ml-4"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export XLSX
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
