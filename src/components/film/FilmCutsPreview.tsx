import { useMemo } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from "xlsx";

interface FilmSettings {
  roll_width_mm: number;
  side_margin_mm: number;
  lead_trim_mm: number;
  tail_trim_mm: number;
  gap_mm: number;
  waste_percent: number;
  cost_eur_per_m: number;
  price_eur_per_m: number;
}

interface FilmJob {
  file_name: string;
  width_mm: number;
  height_mm: number;
  qty: number;
  allow_rotate_90: boolean;
  margin_mm: number;
  note?: string;
}

interface CutInfo {
  file_name: string;
  rotation_deg: number;
  copies_per_row: number;
  rows_needed: number;
  m_per_piece: number;
  total_m: number;
  note?: string;
}

interface FilmCutsPreviewProps {
  filmJobs: FilmJob[];
  filmSettings: FilmSettings;
  clientDiscount: number;
}

function computeCuts(job: FilmJob, settings: FilmSettings): CutInfo | null {
  const ROLL_WIDTH_MM = 508;
  const MAX_COMPONENT_WIDTH_MM = 500;

  // Check if dimensions exceed maximum allowed width
  if (job.width_mm > MAX_COMPONENT_WIDTH_MM || job.height_mm > MAX_COMPONENT_WIDTH_MM) {
    return null;
  }

  let best: { rotation: number; copies: number; rows: number; totalMm: number } | null = null;

  // Try 0° orientation
  const copiesPerRow0 = Math.floor(ROLL_WIDTH_MM / job.width_mm);
  if (copiesPerRow0 >= 1) {
    const rows0 = Math.ceil(job.qty / copiesPerRow0);
    const total0Mm = rows0 * job.height_mm;
    best = { rotation: 0, copies: copiesPerRow0, rows: rows0, totalMm: total0Mm };
  }

  // Try 90° orientation if allowed
  if (job.allow_rotate_90) {
    const copiesPerRow90 = Math.floor(ROLL_WIDTH_MM / job.height_mm);
    if (copiesPerRow90 >= 1) {
      const rows90 = Math.ceil(job.qty / copiesPerRow90);
      const total90Mm = rows90 * job.width_mm;
      
      if (!best || total90Mm < best.totalMm) {
        best = { rotation: 90, copies: copiesPerRow90, rows: rows90, totalMm: total90Mm };
      }
    }
  }

  if (!best) return null;

  // Apply waste percentage
  const wastePercent = settings.waste_percent || 3;
  const totalMmWithWaste = best.totalMm * (1 + wastePercent / 100);
  
  // Convert to meters and round up to centimeter (0.01 m)
  const totalLengthM = Math.ceil(totalMmWithWaste / 10) / 100;
  const mPerPiece = totalLengthM / job.qty;

  return {
    file_name: job.file_name,
    rotation_deg: best.rotation,
    copies_per_row: best.copies,
    rows_needed: best.rows,
    m_per_piece: Number(mPerPiece.toFixed(4)),
    total_m: Number(totalLengthM.toFixed(2)),
    note: job.note,
  };
}

export const FilmCutsPreview = ({ 
  filmJobs, 
  filmSettings, 
  clientDiscount 
}: FilmCutsPreviewProps) => {
  const COST_EUR_PER_M = 12.5;
  const PRICE_EUR_PER_M = 17;

  const cutsData = useMemo(() => {
    return filmJobs
      .map(job => computeCuts(job, filmSettings))
      .filter((cut): cut is CutInfo => cut !== null);
  }, [filmJobs, filmSettings]);

  const totalMeters = useMemo(() => {
    return cutsData.reduce((sum, cut) => sum + cut.total_m, 0);
  }, [cutsData]);

  const handleExport = () => {
    const costTotal = totalMeters * COST_EUR_PER_M;
    const sellingTotal = totalMeters * PRICE_EUR_PER_M;
    const discountedTotal = clientDiscount > 0 
      ? sellingTotal * (1 - clientDiscount / 100)
      : sellingTotal;

    // Prepare data for export
    const worksheetData = [
      ["RASPORED REZOVA FILMOVANJA"],
      [],
      ["Naziv fajla", "Širina (mm)", "Visina (mm)", "Količina", "Orijentacija", "Kopija po redu", "Redova", "m/kom", "Ukupno m", "Napomena"],
      ...filmJobs.map((job, index) => {
        const cut = cutsData[index];
        return [
          job.file_name,
          job.width_mm,
          job.height_mm,
          job.qty,
          cut ? `${cut.rotation_deg}°` : "-",
          cut?.copies_per_row || "-",
          cut?.rows_needed || "-",
          cut?.m_per_piece.toFixed(4) || "-",
          cut?.total_m.toFixed(2) || "-",
          job.note || "",
        ];
      }),
      [],
      ["SAŽETAK"],
      ["Ukupno metara", totalMeters.toFixed(2), "m"],
      ["Nabavna cena", `€${COST_EUR_PER_M.toFixed(2)}/m`, `€${costTotal.toFixed(2)}`],
      ["Prodajna cena", `€${PRICE_EUR_PER_M.toFixed(2)}/m`, `€${sellingTotal.toFixed(2)}`],
      ["Marža", "", `€${(sellingTotal - costTotal).toFixed(2)} (${((sellingTotal - costTotal) / sellingTotal * 100).toFixed(1)}%)`],
    ];

    if (clientDiscount > 0) {
      worksheetData.push(
        ["Rabat", `${clientDiscount}%`, `€${discountedTotal.toFixed(2)}`],
        ["Ušteda", "", `€${(sellingTotal - discountedTotal).toFixed(2)}`]
      );
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Naziv fajla
      { wch: 12 }, // Širina
      { wch: 12 }, // Visina
      { wch: 10 }, // Količina
      { wch: 12 }, // Orijentacija
      { wch: 15 }, // Kopija po redu
      { wch: 10 }, // Redova
      { wch: 10 }, // m/kom
      { wch: 12 }, // Ukupno m
      { wch: 30 }, // Napomena
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Raspored rezova");

    // Save file
    XLSX.writeFile(wb, `filmovanje_raspored_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (cutsData.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Dodajte stavke filmovanja da biste videli raspored rezova.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Raspored rezova</h3>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export XLSX
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naziv fajla</TableHead>
              <TableHead>Orijentacija</TableHead>
              <TableHead>Kopija po redu</TableHead>
              <TableHead>Redova potrebno</TableHead>
              <TableHead>m/kom</TableHead>
              <TableHead>Ukupno m</TableHead>
              <TableHead>Napomena</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cutsData.map((cut, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{cut.file_name}</TableCell>
                <TableCell>{cut.rotation_deg}°</TableCell>
                <TableCell>{cut.copies_per_row}</TableCell>
                <TableCell>{cut.rows_needed}</TableCell>
                <TableCell>{cut.m_per_piece.toFixed(4)}</TableCell>
                <TableCell className="font-semibold">{cut.total_m.toFixed(2)} m</TableCell>
                <TableCell className="text-muted-foreground">{cut.note || "-"}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell colSpan={5} className="text-right">Ukupno:</TableCell>
              <TableCell>{totalMeters.toFixed(2)} m</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
