import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

// Brand colors
const COLORS = {
  primary: rgb(0.118, 0.251, 0.686), // #1e40af - deep blue
  primaryLight: rgb(0.231, 0.510, 0.965), // #3b82f6 - bright blue
  textDark: rgb(0.216, 0.255, 0.318), // #374151 - dark gray
  textMuted: rgb(0.420, 0.447, 0.502), // #6b7280 - muted gray
  border: rgb(0.878, 0.886, 0.902), // #e0e2e7 - light border
  headerBg: rgb(0.118, 0.251, 0.686), // blue header
  rowAlt: rgb(0.969, 0.976, 0.996), // #f7f9fe - very light blue
  white: rgb(1, 1, 1),
};

const CONFIG = {
  pageWidth: 595.28, // A4 width in points (A5 landscape = A4 portrait rotated)
  pageHeight: 419.53, // A4 height / sqrt(2) ≈ A5 landscape height
  margin: 30,
  logo: { width: 120 },
  table: {
    cols: { rbr: 35, filename: 230, details: 130, quantity: 105 },
    rowHeight: 24,
    headerBg: COLORS.headerBg,
  },
  signature: { lineWidth: 160, yOffset: 60 },
};

// Module-level cache for assets
let cachedRegularFont: ArrayBuffer | null = null;
let cachedBoldFont: ArrayBuffer | null = null;
let cachedLogo: any | null = null;
let cachedLogoHeight: number = 0;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}.`;
}

function getDetailsText(entry: any, orderKind: string): string {
  // For CTP orders, show plate format
  if (orderKind === 'CTP') {
    if (entry.plate_formats?.format_name) {
      return entry.plate_formats.format_name;
    }
    return 'Format ploče';
  }
  
// For FILMOVANJE, show consumed length per item
  if (orderKind === 'FILMOVANJE') {
    // Calculate film usage on the fly
    const ROLL_WIDTH_MM = 500;
    const widthMm = Number(entry.width_mm ?? entry.width ?? 0);
    const heightMm = Number(entry.height_mm ?? entry.height ?? 0);
    const qty = Number(entry.qty ?? entry.quantity ?? 1);
    
    const fit0 = Math.floor(ROLL_WIDTH_MM / widthMm);
    const fit90 = Math.floor(ROLL_WIDTH_MM / heightMm);
    const use90 = fit90 > fit0;
    const across = Math.max(fit0, fit90, 1);
    const pieceM = (use90 ? widthMm : heightMm) / 1000;
    const rows = Math.ceil(qty / across);
    const totalM = rows * pieceM;
    
    return `Potrošeno: ${totalM.toFixed(2)} m`;
  }
  
  // For DIGITALA, show format only for sheet mode (not product mode)
  if (orderKind === 'DIGITALA') {
    // If file_type is digital_product or no machine_sheet_format, it's product mode - no format needed
    if (entry.file_type === 'digital_product' || (!entry.machine_sheet_format && !entry.machineSheetFormat)) {
      return '-';
    }
    const sheetFormat = entry.machine_sheet_format || entry.machineSheetFormat || '488x330';
    return `Format: ${sheetFormat}`;
  }
  
  // For RAZNO, no specific details needed
  if (orderKind === 'RAZNO') {
    return '-';
  }
  
  return 'N/A';
}

// Get quantity text for digital jobs - product mode vs sheet mode
function getQuantityText(entry: any, orderKind: string, workOrder: any): string {
  if (orderKind === 'DIGITALA') {
    // Product mode: just show the quantity (run_quantity)
    if (entry.file_type === 'digital_product') {
      return String(entry.quantity || workOrder.run_quantity || 1);
    }
    // Sheet mode: quantity already formatted as "X tab. Y/Z"
    if (entry.file_type === 'digital_sheet') {
      return String(entry.quantity || `${(entry.obim || 1) * (entry.qty || 1)} tab. ${entry.print_sides || '4/0'}`);
    }
    // Fallback for legacy data
    if (workOrder.job_name && workOrder.run_quantity) {
      return String(workOrder.run_quantity);
    }
    const obim = Number(entry.obim || 1);
    const qty = Number(entry.qty || entry.quantity || 1);
    const totalSheets = entry.computed_total_sheets || (obim * qty);
    const printSides = entry.print_sides || entry.printSides || '4/0';
    return `${totalSheets} tab. ${printSides}`;
  }
  
  // For RAZNO (OSTALO) orders, use work order level run_quantity
  if (orderKind === 'RAZNO') {
    return String(workOrder.run_quantity || entry.quantity || entry.qty || 1);
  }
  
  return String(entry.quantity || entry.qty || 1);
}

function isSupportedFont(bytes: ArrayBuffer) {
  const sig = String.fromCharCode(...new Uint8Array(bytes).slice(0, 4));
  return sig === '\x00\x01\x00\x00' || sig === 'OTTO';
}

async function loadAssets(pdfDoc: any) {
  // Load fonts (with caching)
  if (!cachedRegularFont || !cachedBoldFont) {
    const regularFontUrl = Deno.env.get('FONT_REGULAR_URL');
    const boldFontUrl = Deno.env.get('FONT_BOLD_URL');
    if (!regularFontUrl || !boldFontUrl) {
      throw new Error('Font URLs not configured');
    }
    const [regularResp, boldResp] = await Promise.all([
      fetch(regularFontUrl),
      fetch(boldFontUrl),
    ]);
    cachedRegularFont = await regularResp.arrayBuffer();
    cachedBoldFont = await boldResp.arrayBuffer();
    if (!isSupportedFont(cachedRegularFont) || !isSupportedFont(cachedBoldFont)) {
      throw new Error('Invalid font format');
    }
  }
  
  const notoFont = await pdfDoc.embedFont(cachedRegularFont, { subset: true });
  const notoBold = await pdfDoc.embedFont(cachedBoldFont, { subset: true });

  // Load logo (with caching)
  if (!cachedLogo) {
    const logoUrl = Deno.env.get('LOGO_URL');
    if (logoUrl) {
      try {
        const logoResp = await fetch(logoUrl);
        if (logoResp.ok) {
          const logoBytes = await logoResp.arrayBuffer();
          cachedLogo = await pdfDoc.embedPng(logoBytes);
          const aspectRatio = cachedLogo.height / cachedLogo.width;
          cachedLogoHeight = CONFIG.logo.width * aspectRatio;
        }
      } catch (err) {
        console.warn('Failed to load logo:', err);
      }
    }
  }

  return { notoFont, notoBold, logoImg: cachedLogo, logoHeight: cachedLogoHeight };
}

export async function generateDeliveryNotePDF(
  workOrder: any,
  fileEntries: any[]
): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const { notoFont, notoBold, logoImg, logoHeight } = await loadAssets(pdfDoc);

    const signatureY = CONFIG.signature.yOffset + 10;

    // Helper: draw first page header (logo + company LEFT, client info TOP RIGHT)
    const drawFirstPageHeader = (page: any): number => {
      const { height } = page.getSize();
      const rightX = CONFIG.pageWidth - CONFIG.margin - 220;

      // LEFT: Logo
      let leftY = height - CONFIG.margin;
      if (logoImg) {
        page.drawImage(logoImg, {
          x: CONFIG.margin,
          y: leftY - logoHeight,
          width: CONFIG.logo.width,
          height: logoHeight,
        });
        leftY = leftY - logoHeight - 8;
      }

      // Company info below logo
      page.drawText('GAMA UNITED d.o.o.', { x: CONFIG.margin, y: leftY, size: 9, font: notoBold, color: COLORS.primary });
      leftY -= 12;
      page.drawText('Veljka Milićevića 2/10, 11000 Beograd', { x: CONFIG.margin, y: leftY, size: 8, font: notoFont, color: COLORS.textDark });
      leftY -= 11;
      page.drawText('PIB: 114876455', { x: CONFIG.margin, y: leftY, size: 8, font: notoFont, color: COLORS.textDark });

      // TOP RIGHT: Client block
      let rightY = height - CONFIG.margin;
      page.drawText('OTPREMNICA', { x: rightX, y: rightY, size: 18, font: notoBold, color: COLORS.primary });
      rightY -= 24;

      const deliveryNumber = workOrder.display_order_number || workOrder.order_number;
      page.drawText(`Br. naloga: ${deliveryNumber}`, { x: rightX, y: rightY, size: 9, font: notoFont, color: COLORS.textDark });
      rightY -= 13;
      page.drawText(`Datum: ${formatDate(workOrder.closed_at || new Date().toISOString())}`, { x: rightX, y: rightY, size: 9, font: notoFont, color: COLORS.textDark });
      rightY -= 16;

      page.drawText('Klijent:', { x: rightX, y: rightY, size: 9, font: notoBold, color: COLORS.textMuted });
      rightY -= 13;
      const clientName = (workOrder.client?.name || workOrder.clients?.name || 'N/A').substring(0, 30);
      page.drawText(clientName, { x: rightX, y: rightY, size: 10, font: notoBold, color: COLORS.textDark });
      
      if (workOrder.client?.email || workOrder.clients?.email) {
        rightY -= 13;
        const email = (workOrder.client?.email || workOrder.clients?.email || '').substring(0, 30);
        page.drawText(email, { x: rightX, y: rightY, size: 8, font: notoFont, color: COLORS.textMuted });
      }

      if (workOrder.client?.pib || workOrder.clients?.pib) {
        rightY -= 13;
        page.drawText(`PIB: ${workOrder.client?.pib || workOrder.clients?.pib}`, { x: rightX, y: rightY, size: 8, font: notoFont, color: COLORS.textMuted });
      }

      return Math.min(leftY, rightY) - 18;
    };

    // Helper: draw items label before table
    const drawItemsLabel = (page: any, startY: number): number => {
      page.drawText('Stavke:', { x: CONFIG.margin, y: startY, size: 11, font: notoBold, color: COLORS.primary });
      return startY - 14;
    };

    // Helper: draw table header
    const drawTableHeader = (page: any, y: number): number => {
      const { rbr, filename, details, quantity } = CONFIG.table.cols;
      const tableWidth = rbr + filename + details + quantity;
      
      // Blue header background with rounded corners effect
      page.drawRectangle({
        x: CONFIG.margin,
        y: y - CONFIG.table.rowHeight,
        width: tableWidth,
        height: CONFIG.table.rowHeight,
        color: COLORS.headerBg,
      });
      
      let x = CONFIG.margin + 8;
      const headers = ['#', 'Naziv fajla', 'Detalji', 'Količina'];
      const widths = [rbr, filename, details, quantity];
      headers.forEach((h, i) => {
        page.drawText(h, { x, y: y - 16, size: 10, font: notoBold, color: COLORS.white });
        x += widths[i];
      });
      return y - CONFIG.table.rowHeight - 2;
    };

    // Helper: draw table row
    let rowIndex = 0;
    const drawTableRow = (page: any, y: number, rbr: number, entry: any): number => {
      const { rbr: rbrW, filename: fnW, details: detW, quantity: qtyW } = CONFIG.table.cols;
      const tableWidth = rbrW + fnW + detW + qtyW;
      
      // Alternating row background
      if (rowIndex % 2 === 1) {
        page.drawRectangle({
          x: CONFIG.margin,
          y: y - CONFIG.table.rowHeight,
          width: tableWidth,
          height: CONFIG.table.rowHeight,
          color: COLORS.rowAlt,
        });
      }
      
      // Bottom border for row
      page.drawLine({
        start: { x: CONFIG.margin, y: y - CONFIG.table.rowHeight },
        end: { x: CONFIG.margin + tableWidth, y: y - CONFIG.table.rowHeight },
        thickness: 0.5,
        color: COLORS.border,
      });
      
      let x = CONFIG.margin + 8;
      const orderKind = workOrder.kind || 'CTP';
      const texts = [
        String(rbr),
        (entry.filename || entry.file_name || 'N/A').substring(0, 40),
        getDetailsText(entry, orderKind).substring(0, 22),
        getQuantityText(entry, orderKind, workOrder).substring(0, 18),
      ];
      const widths = [rbrW, fnW, detW, qtyW];
      texts.forEach((t, i) => {
        page.drawText(t, { x, y: y - 16, size: 9, font: notoFont, color: COLORS.textDark });
        x += widths[i];
      });
      rowIndex++;
      return y - CONFIG.table.rowHeight;
    };

    // Helper: draw signature block
    const drawSignature = (page: any) => {
      const y = signatureY;
      // Signature line
      page.drawLine({
        start: { x: CONFIG.margin, y },
        end: { x: CONFIG.margin + CONFIG.signature.lineWidth, y },
        thickness: 0.75,
        color: COLORS.textMuted,
      });
      page.drawText('Robu preuzeo', { x: CONFIG.margin, y: y - 12, size: 9, font: notoFont, color: COLORS.textMuted });

      // ID line
      const idX = CONFIG.margin + CONFIG.signature.lineWidth + 25;
      page.drawLine({
        start: { x: idX, y },
        end: { x: idX + 110, y },
        thickness: 0.75,
        color: COLORS.textMuted,
      });
      page.drawText('Broj lične karte', { x: idX, y: y - 12, size: 9, font: notoFont, color: COLORS.textMuted });

      // Date line
      const dateX = idX + 130;
      page.drawLine({
        start: { x: dateX, y },
        end: { x: dateX + 90, y },
        thickness: 0.75,
        color: COLORS.textMuted,
      });
      page.drawText('Datum', { x: dateX, y: y - 12, size: 9, font: notoFont, color: COLORS.textMuted });
    };

    // Helper: draw pagination
    const drawPagination = (page: any, pageNum: number, totalPages: number) => {
      const text = `Strana ${pageNum}/${totalPages}`;
      const width = notoFont.widthOfTextAtSize(text, 9);
      page.drawText(text, {
        x: CONFIG.pageWidth - CONFIG.margin - width,
        y: 16,
        size: 9,
        font: notoFont,
        color: COLORS.textMuted,
      });
    };

    // Build pages
    let currentPage = pdfDoc.addPage([CONFIG.pageWidth, CONFIG.pageHeight]);
    
    // First page: header + items label + table
    let y = drawFirstPageHeader(currentPage);
    y = drawItemsLabel(currentPage, y);
    y = drawTableHeader(currentPage, y);

    let pageNum = 1;
    const pages = [currentPage];

    fileEntries.forEach((entry, idx) => {
      const needsNewPage = y < signatureY + 55;
      if (needsNewPage) {
        // Subsequent pages: no full header, just minimal continuation
        currentPage = pdfDoc.addPage([CONFIG.pageWidth, CONFIG.pageHeight]);
        pages.push(currentPage);
        pageNum++;
        y = CONFIG.pageHeight - CONFIG.margin - 20;
        // Draw small continuation indicator
        currentPage.drawText('(nastavak)', { x: CONFIG.margin, y, size: 9, font: notoFont, color: rgb(0.5, 0.5, 0.5) });
        y -= 15;
        y = drawTableHeader(currentPage, y);
      }
      y = drawTableRow(currentPage, y, idx + 1, entry);
    });

    // Draw signature and pagination on all pages
    pages.forEach((p, i) => {
      drawSignature(p);
      if (pages.length > 1) {
        drawPagination(p, i + 1, pages.length);
      }
    });

    return pdfDoc.save();
  } catch (err: any) {
    console.error('PDF generation error:', err?.message, err?.stack);
    throw new Error(`PDF error: ${err?.message}`);
  }
}
