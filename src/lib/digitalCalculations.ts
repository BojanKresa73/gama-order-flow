export interface DigitalSettings {
  sheet_width_mm: number;
  sheet_height_mm: number;
  waste_percent: number;
  available_sheet_formats?: string[];
}

export interface PriceListEntry {
  break_qty: number;
  price_per_sheet: number;
}

export interface DigitalJob {
  name?: string;
  file_name: string;
  finished_w_mm: number;
  finished_h_mm: number;
  pages: number;
  qty: number;
  is_test_print: boolean;
  print_sides: string; // "4/4", "4/0", "1/1", "4/1", "1/0"
  paper_type?: string;
  machine_sheet_format?: string; // "330x488" or "330x760"
  pieces_per_sheet_override?: number | null;
  test_sheets?: number;
  include_test_in_clicks?: boolean;
  cover_gsm?: number;
  lamination?: string;
  finishing?: string;
}

export interface ComputedDigitalJob {
  computed_nup: number;
  computed_sheets_per_copy: number;
  computed_total_sheets: number;
  computed_color_clicks: number;
  computed_mono_clicks: number;
  computed_price_per_sheet: number;
  computed_line_total: number;
  cover_sheets: number;
  lamination_sheets: number;
  pieces_per_sheet: number;
  sheets_for_production: number;
  sheets_for_test: number;
}

// Parse sheet format string to dimensions
export function parseSheetFormat(format: string): { width: number; height: number } {
  if (format === '330x760') {
    return { width: 330, height: 760 };
  }
  // Default 330x488
  return { width: 330, height: 488 };
}

// Calculate pieces per sheet (N-up) based on finished format and sheet format
export function calculatePiecesPerSheet(
  finishedW: number,
  finishedH: number,
  sheetFormat: string
): number {
  const sheet = parseSheetFormat(sheetFormat);
  
  // Try both orientations of the finished piece
  const nup0_w = Math.floor(sheet.width / finishedW);
  const nup0_h = Math.floor(sheet.height / finishedH);
  const nup0 = nup0_w * nup0_h;

  // Try 90° rotation of finished piece
  const nup90_w = Math.floor(sheet.width / finishedH);
  const nup90_h = Math.floor(sheet.height / finishedW);
  const nup90 = nup90_w * nup90_h;

  return Math.max(nup0, nup90, 1);
}

// Get clicks per sheet based on print mode
export function getClicksPerSheet(printSides: string): { colorClicks: number; monoClicks: number } {
  switch (printSides) {
    case "4/4":
      return { colorClicks: 2, monoClicks: 0 }; // 2 color impressions (front + back)
    case "4/1":
      return { colorClicks: 1, monoClicks: 1 }; // 1 color front, 1 mono back
    case "4/0":
      return { colorClicks: 1, monoClicks: 0 }; // 1 color front only
    case "1/1":
      return { colorClicks: 0, monoClicks: 2 }; // 2 mono impressions
    case "1/0":
      return { colorClicks: 0, monoClicks: 1 }; // 1 mono front only
    default:
      return { colorClicks: 0, monoClicks: 0 };
  }
}

export function computeDigitalJob(
  job: DigitalJob,
  settings: DigitalSettings,
  priceList: PriceListEntry[]
): ComputedDigitalJob | { error: string } {
  // Validate inputs
  if (!job.finished_w_mm || !job.finished_h_mm || !job.qty) {
    return {
      computed_nup: 0,
      computed_sheets_per_copy: 0,
      computed_total_sheets: 0,
      computed_color_clicks: 0,
      computed_mono_clicks: 0,
      computed_price_per_sheet: 0,
      computed_line_total: 0,
      cover_sheets: 0,
      lamination_sheets: 0,
      pieces_per_sheet: 0,
      sheets_for_production: 0,
      sheets_for_test: 0,
    };
  }

  const sheetFormat = job.machine_sheet_format || '330x488';
  const sheet = parseSheetFormat(sheetFormat);

  // 1) Calculate N-up (pieces per sheet)
  const autoNup = calculatePiecesPerSheet(job.finished_w_mm, job.finished_h_mm, sheetFormat);
  const nup = job.pieces_per_sheet_override && job.pieces_per_sheet_override > 0 
    ? job.pieces_per_sheet_override 
    : autoNup;

  if (nup < 1) {
    return { error: `Format ne staje na ${sheetFormat}` };
  }

  // 2) Calculate sheets per copy (for multi-page products)
  const pages = job.pages || 1;
  const printSides = job.print_sides || "4/4";
  const isDoubleSided = ["4/4", "4/1", "1/1"].includes(printSides);
  
  let sheetsPerCopy: number;
  if (isDoubleSided) {
    // Double-sided: each sheet has 2 pages per piece position
    sheetsPerCopy = Math.ceil(pages / (2 * nup));
  } else {
    // Single-sided: each sheet has 1 page per piece position
    sheetsPerCopy = Math.ceil(pages / nup);
  }

  // 3) Calculate production sheets
  const sheetsForProduction = Math.ceil(job.qty * sheetsPerCopy);
  
  // 4) Test sheets handling
  const testSheets = job.test_sheets || 0;
  const includeTestInClicks = job.include_test_in_clicks || false;

  // Total sheets for paper consumption (production + test)
  const totalSheets = sheetsForProduction + testSheets;

  // Sheets for click calculation
  const sheetsForClicks = includeTestInClicks 
    ? sheetsForProduction + testSheets 
    : sheetsForProduction;

  // 5) Calculate clicks
  const { colorClicks: colorClicksPerSheet, monoClicks: monoClicksPerSheet } = getClicksPerSheet(printSides);
  
  let totalColorClicks = sheetsForClicks * colorClicksPerSheet;
  let totalMonoClicks = sheetsForClicks * monoClicksPerSheet;

  // 6) Calculate cover sheets if cover_gsm is set and pages > 4
  let coverSheets = 0;
  if (job.cover_gsm && pages > 4) {
    const coverPages = 2; // Front and back cover
    const coverSheetsPerCopy = isDoubleSided 
      ? Math.ceil(coverPages / (2 * nup))
      : Math.ceil(coverPages / nup);
    coverSheets = Math.ceil(job.qty * coverSheetsPerCopy);
    
    // Add cover clicks to total
    totalColorClicks += coverSheets * colorClicksPerSheet;
    totalMonoClicks += coverSheets * monoClicksPerSheet;
  }

  // 7) Calculate lamination sheets
  let laminationSheets = 0;
  if (job.lamination && job.lamination !== 'none') {
    laminationSheets = totalSheets + coverSheets;
  }

  // Final total sheets for pricing
  const finalTotalSheets = totalSheets + coverSheets;

  // 8) Interpolate price per sheet
  let pricePerSheet = 0;

  if (priceList.length > 0) {
    const sortedPriceList = [...priceList].sort((a, b) => a.break_qty - b.break_qty);

    if (finalTotalSheets >= 500) {
      const entry500 = sortedPriceList.find(p => p.break_qty === 500);
      if (entry500) {
        pricePerSheet = entry500.price_per_sheet;
      } else {
        pricePerSheet = sortedPriceList[sortedPriceList.length - 1].price_per_sheet;
      }
    } else {
      let lowerBreak: PriceListEntry | null = null;
      let upperBreak: PriceListEntry | null = null;

      for (let i = 0; i < sortedPriceList.length; i++) {
        if (sortedPriceList[i].break_qty <= finalTotalSheets) {
          lowerBreak = sortedPriceList[i];
        }
        if (sortedPriceList[i].break_qty >= finalTotalSheets && !upperBreak) {
          upperBreak = sortedPriceList[i];
        }
      }

      if (lowerBreak && upperBreak && lowerBreak.break_qty !== upperBreak.break_qty) {
        const ratio = (finalTotalSheets - lowerBreak.break_qty) / (upperBreak.break_qty - lowerBreak.break_qty);
        pricePerSheet = lowerBreak.price_per_sheet + 
          ratio * (upperBreak.price_per_sheet - lowerBreak.price_per_sheet);
      } else if (lowerBreak) {
        pricePerSheet = lowerBreak.price_per_sheet;
      } else if (upperBreak) {
        pricePerSheet = upperBreak.price_per_sheet;
      } else {
        pricePerSheet = sortedPriceList[0].price_per_sheet;
      }
    }
  }

  // 9) Calculate line total
  const lineTotal = job.is_test_print ? 0 : finalTotalSheets * pricePerSheet;

  return {
    computed_nup: nup,
    computed_sheets_per_copy: sheetsPerCopy,
    computed_total_sheets: finalTotalSheets,
    computed_color_clicks: totalColorClicks,
    computed_mono_clicks: totalMonoClicks,
    computed_price_per_sheet: pricePerSheet,
    computed_line_total: lineTotal,
    cover_sheets: coverSheets,
    lamination_sheets: laminationSheets,
    pieces_per_sheet: nup,
    sheets_for_production: sheetsForProduction,
    sheets_for_test: testSheets,
  };
}

// Aggregate totals by paper type for work order summary
export function aggregateByPaperType(jobs: (DigitalJob & Partial<ComputedDigitalJob>)[]): Map<string, number> {
  const result = new Map<string, number>();
  
  for (const job of jobs) {
    const paperType = job.paper_type || 'Neodređeno';
    const sheets = job.computed_total_sheets || 0;
    result.set(paperType, (result.get(paperType) || 0) + sheets);
  }
  
  return result;
}

// Calculate work order totals
export function calculateWorkOrderTotals(jobs: (DigitalJob & Partial<ComputedDigitalJob>)[]) {
  let totalSheets = 0;
  let totalColorClicks = 0;
  let totalMonoClicks = 0;
  let totalAmount = 0;

  for (const job of jobs) {
    totalSheets += job.computed_total_sheets || 0;
    totalColorClicks += job.computed_color_clicks || 0;
    totalMonoClicks += job.computed_mono_clicks || 0;
    totalAmount += job.computed_line_total || 0;
  }

  return {
    totalSheets,
    totalColorClicks,
    totalMonoClicks,
    totalClicks: totalColorClicks + totalMonoClicks,
    totalAmount,
    sheetsByPaper: aggregateByPaperType(jobs),
  };
}
