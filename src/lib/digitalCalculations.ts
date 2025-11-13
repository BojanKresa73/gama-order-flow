export interface DigitalSettings {
  sheet_width_mm: number;
  sheet_height_mm: number;
  waste_percent: number;
}

export interface PriceListEntry {
  break_qty: number;
  price_per_sheet: number;
}

export interface DigitalJob {
  finished_w_mm: number;
  finished_h_mm: number;
  pages: number;
  qty: number;
  is_test_print: boolean;
  print_sides: string; // e.g. "4/4", "4/0", "1/1", etc.
}

export interface ComputedDigitalJob {
  computed_nup: number;
  computed_sheets_per_copy: number;
  computed_total_sheets: number;
  computed_color_clicks: number;
  computed_mono_clicks: number;
  computed_price_per_sheet: number;
  computed_line_total: number;
}

export function computeDigitalJob(
  job: DigitalJob,
  settings: DigitalSettings,
  priceList: PriceListEntry[]
): ComputedDigitalJob | { error: string } {
  // Validate inputs
  if (!job.finished_w_mm || !job.finished_h_mm || !job.pages || !job.qty) {
    return {
      computed_nup: 0,
      computed_sheets_per_copy: 0,
      computed_total_sheets: 0,
      computed_color_clicks: 0,
      computed_mono_clicks: 0,
      computed_price_per_sheet: 0,
      computed_line_total: 0,
    };
  }

  // 1) Calculate N-up (best orientation)
  const nup0_w = Math.floor(settings.sheet_width_mm / job.finished_w_mm);
  const nup0_h = Math.floor(settings.sheet_height_mm / job.finished_h_mm);
  const nup0 = nup0_w * nup0_h;

  // Try 90° rotation
  const nup90_w = Math.floor(settings.sheet_width_mm / job.finished_h_mm);
  const nup90_h = Math.floor(settings.sheet_height_mm / job.finished_w_mm);
  const nup90 = nup90_w * nup90_h;

  const nup = Math.max(nup0, nup90);

  if (nup < 1) {
    return { error: "Format ne staje na 488×330" };
  }

  // 2) Calculate sheets per copy
  const printSides = job.print_sides || "4/4";
  const isDoubleSided = printSides.includes("/") && 
    (printSides === "4/4" || printSides === "4/1" || printSides === "1/1");
  
  const isSingleSided = printSides === "4/0" || printSides === "1/0";

  let sheetsPerCopy: number;
  if (isSingleSided) {
    sheetsPerCopy = Math.ceil(job.pages / (1 * nup));
  } else if (isDoubleSided) {
    sheetsPerCopy = Math.ceil(job.pages / (2 * nup));
  } else {
    // Default to double-sided
    sheetsPerCopy = Math.ceil(job.pages / (2 * nup));
  }

  const totalSheets = Math.ceil(job.qty * sheetsPerCopy);

  // 3) Calculate clicks
  // Parse print_sides to determine color/mono for front and back
  const [front, back] = printSides.split("/");
  
  let colorSidesPerSheet = 0;
  let monoSidesPerSheet = 0;

  // Front side
  if (front === "4") {
    colorSidesPerSheet += 1;
  } else if (front === "1") {
    monoSidesPerSheet += 1;
  }

  // Back side (if exists)
  if (back) {
    if (back === "4") {
      colorSidesPerSheet += 1;
    } else if (back === "1") {
      monoSidesPerSheet += 1;
    }
  }

  const totalColorClicks = totalSheets * colorSidesPerSheet;
  const totalMonoClicks = totalSheets * monoSidesPerSheet;

  // 4) Interpolate price per sheet
  let pricePerSheet = 0;

  if (priceList.length > 0) {
    // Sort price list by break_qty ascending
    const sortedPriceList = [...priceList].sort((a, b) => a.break_qty - b.break_qty);

    if (totalSheets >= 500) {
      // Use price at 500 or highest break
      const entry500 = sortedPriceList.find(p => p.break_qty === 500);
      if (entry500) {
        pricePerSheet = entry500.price_per_sheet;
      } else {
        // Use highest break available
        pricePerSheet = sortedPriceList[sortedPriceList.length - 1].price_per_sheet;
      }
    } else {
      // Linear interpolation between two nearest breaks
      let lowerBreak: PriceListEntry | null = null;
      let upperBreak: PriceListEntry | null = null;

      for (let i = 0; i < sortedPriceList.length; i++) {
        if (sortedPriceList[i].break_qty <= totalSheets) {
          lowerBreak = sortedPriceList[i];
        }
        if (sortedPriceList[i].break_qty >= totalSheets && !upperBreak) {
          upperBreak = sortedPriceList[i];
        }
      }

      if (lowerBreak && upperBreak && lowerBreak.break_qty !== upperBreak.break_qty) {
        // Interpolate
        const ratio = (totalSheets - lowerBreak.break_qty) / (upperBreak.break_qty - lowerBreak.break_qty);
        pricePerSheet = lowerBreak.price_per_sheet + 
          ratio * (upperBreak.price_per_sheet - lowerBreak.price_per_sheet);
      } else if (lowerBreak) {
        pricePerSheet = lowerBreak.price_per_sheet;
      } else if (upperBreak) {
        pricePerSheet = upperBreak.price_per_sheet;
      } else {
        // Use first price
        pricePerSheet = sortedPriceList[0].price_per_sheet;
      }
    }
  }

  // 5) Calculate line total
  const lineTotal = job.is_test_print ? 0 : totalSheets * pricePerSheet;

  return {
    computed_nup: nup,
    computed_sheets_per_copy: sheetsPerCopy,
    computed_total_sheets: totalSheets,
    computed_color_clicks: totalColorClicks,
    computed_mono_clicks: totalMonoClicks,
    computed_price_per_sheet: pricePerSheet,
    computed_line_total: lineTotal,
  };
}
