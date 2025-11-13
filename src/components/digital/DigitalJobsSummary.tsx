import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocalDigitalJob } from "./LocalDigitalJobsTable";
import * as XLSX from "xlsx";

interface DigitalJobsSummaryProps {
  jobs: LocalDigitalJob[];
  clientRabatProcenat?: number;
}

export const DigitalJobsSummary = ({ jobs, clientRabatProcenat = 0 }: DigitalJobsSummaryProps) => {
  const totalSheets = jobs.reduce((sum, job) => sum + (job.computed_total_sheets || 0), 0);
  const totalColorClicks = jobs.reduce((sum, job) => sum + (job.computed_color_clicks || 0), 0);
  const totalMonoClicks = jobs.reduce((sum, job) => sum + (job.computed_mono_clicks || 0), 0);
  const totalAmount = jobs.reduce((sum, job) => sum + (job.computed_line_total || 0), 0);
  const amountWithDiscount = totalAmount * (1 - clientRabatProcenat / 100);

  const handleExportXLSX = () => {
    const worksheetData = [
      ["DIGITALNA ŠTAMPA - SAŽETAK"],
      [],
      ["Naziv fajla", "Širina (mm)", "Visina (mm)", "Strane", "Količina", "Probna štampa", "NUP", "Tabaka/kom", "Ukupno tabaka", "Color", "Mono", "€/tabak", "Iznos (€)"],
      ...jobs.map(job => [
        job.file_name,
        job.finished_w_mm,
        job.finished_h_mm,
        job.pages,
        job.qty,
        job.is_test_print ? "Da" : "Ne",
        job.computed_nup || "-",
        job.computed_sheets_per_copy || "-",
        job.computed_total_sheets || "-",
        job.computed_color_clicks || "-",
        job.computed_mono_clicks || "-",
        job.computed_price_per_sheet ? job.computed_price_per_sheet.toFixed(2) : "-",
        job.computed_line_total !== undefined ? job.computed_line_total.toFixed(2) : "-",
      ]),
      [],
      ["UKUPNO"],
      ["Ukupno tabaka:", totalSheets],
      ["Color klikovi:", totalColorClicks],
      ["Mono klikovi:", totalMonoClicks],
      ["Ukupan iznos (€):", totalAmount.toFixed(2)],
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
              <div className="text-sm text-muted-foreground">Ukupan iznos</div>
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
