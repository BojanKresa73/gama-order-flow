import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

// Newsletter-inspired brand colors - modern gradient theme
const COLORS = {
  // Primary gradient colors
  gradientStart: rgb(0.102, 0.212, 0.365),   // #1a365d - dark navy
  gradientMid: rgb(0.173, 0.322, 0.510),     // #2c5282 - medium blue
  gradientEnd: rgb(0.169, 0.420, 0.690),     // #2b6cb0 - bright blue
  
  // Accent colors
  accent: rgb(0.196, 0.506, 0.780),          // #3281c7 - accent blue
  accentLight: rgb(0.235, 0.612, 0.890),     // #3c9ce3 - light accent
  success: rgb(0.220, 0.631, 0.412),         // #38a169 - green
  successLight: rgb(0.282, 0.733, 0.471),    // #48bb78 - light green
  purple: rgb(0.502, 0.353, 0.835),          // #805ad5 - purple
  orange: rgb(0.867, 0.420, 0.125),          // #dd6b20 - orange
  
  // Text colors
  textDark: rgb(0.102, 0.212, 0.365),        // #1a365d - dark navy
  textBody: rgb(0.290, 0.341, 0.388),        // #4a5568 - body text
  textMuted: rgb(0.443, 0.506, 0.580),       // #718096 - gray
  textLight: rgb(0.627, 0.675, 0.725),       // #a0acb9 - light gray
  
  // Backgrounds
  bgLight: rgb(0.941, 0.953, 0.969),         // #f0f3f8 - light bg
  bgCard: rgb(0.961, 0.969, 0.980),          // #f5f7fa - card bg
  bgBlue: rgb(0.922, 0.957, 1),              // #ebf4ff - light blue bg
  bgGreen: rgb(0.941, 1, 0.957),             // #f0fff4 - light green bg
  
  // Borders
  border: rgb(0.886, 0.898, 0.918),          // #e2e5ea
  borderLight: rgb(0.937, 0.945, 0.957),     // #eff1f4
  borderBlue: rgb(0.765, 0.855, 0.980),      // #c3dafe
  borderGreen: rgb(0.604, 0.902, 0.706),     // #9ae6b4
  
  white: rgb(1, 1, 1),
};

const CONFIG = {
  pageWidth: 595.28,  // A4 width
  pageHeight: 841.89, // A4 height
  margin: 40,
  marginRight: 40,
  logo: { width: 80 },
  table: {
    cols: { rbr: 40, filename: 260, details: 130, quantity: 85 },
    rowHeight: 32,
  },
  signature: { lineWidth: 140, yOffset: 85 },
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
  if (orderKind === 'CTP') {
    if (entry.plate_formats?.format_name) {
      return entry.plate_formats.format_name;
    }
    return 'Format ploče';
  }
  
  if (orderKind === 'FILMOVANJE') {
    const ROLL_WIDTH_MM = 500;
    const widthMm = Number(entry.width_mm ?? entry.width ?? 0);
    const heightMm = Number(entry.height_mm ?? entry.height ?? 0);
    const qty = Number(entry.qty ?? entry.quantity ?? 1);
    
    const fit0 = Math.floor(ROLL_WIDTH_MM / widthMm);
    const fit90 = Math.floor(ROLL_WIDTH_MM / heightMm);
    const across = Math.max(fit0, fit90, 1);
    const use90 = fit90 > fit0;
    const pieceM = (use90 ? widthMm : heightMm) / 1000;
    const rows = Math.ceil(qty / across);
    const totalM = rows * pieceM;
    
    return `${totalM.toFixed(2)} m`;
  }
  
  if (orderKind === 'DIGITALA') {
    if (entry.file_type === 'digital_product' || (!entry.machine_sheet_format && !entry.machineSheetFormat)) {
      return '-';
    }
    const sheetFormat = entry.machine_sheet_format || entry.machineSheetFormat || '488x330';
    return sheetFormat;
  }
  
  if (orderKind === 'RAZNO') {
    return '-';
  }
  
  return '-';
}

function getQuantityText(entry: any, orderKind: string, workOrder: any): string {
  if (orderKind === 'DIGITALA') {
    if (entry.file_type === 'digital_product') {
      return String(entry.quantity || workOrder.run_quantity || 1);
    }
    if (entry.file_type === 'digital_sheet') {
      return String(entry.quantity || `${(entry.obim || 1) * (entry.qty || 1)} tab.`);
    }
    if (workOrder.job_name && workOrder.run_quantity) {
      return String(workOrder.run_quantity);
    }
    const obim = Number(entry.obim || 1);
    const qty = Number(entry.qty || entry.quantity || 1);
    const totalSheets = entry.computed_total_sheets || (obim * qty);
    return `${totalSheets} tab.`;
  }
  
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
    const { pageWidth, pageHeight, margin, marginRight } = CONFIG;
    const contentWidth = pageWidth - margin - marginRight;

    const signatureY = CONFIG.signature.yOffset;
    const tableBottomMargin = signatureY + 60;

    // Helper: Draw rounded rectangle
    const drawRoundedRect = (page: any, x: number, y: number, width: number, height: number, color: any, borderColor?: any) => {
      page.drawRectangle({
        x,
        y,
        width,
        height,
        color,
      });
      if (borderColor) {
        page.drawRectangle({
          x,
          y,
          width,
          height,
          borderColor,
          borderWidth: 1,
        });
      }
    };

    // Draw newsletter-style header with gradient simulation
    const drawNewsletterHeader = (page: any): number => {
      const headerHeight = 100;
      
      // Gradient simulation with overlapping rectangles
      page.drawRectangle({
        x: 0,
        y: pageHeight - headerHeight,
        width: pageWidth,
        height: headerHeight,
        color: COLORS.gradientStart,
      });
      
      // Lighter overlay on right side for gradient effect
      page.drawRectangle({
        x: pageWidth * 0.5,
        y: pageHeight - headerHeight,
        width: pageWidth * 0.5,
        height: headerHeight,
        color: COLORS.gradientMid,
        opacity: 0.7,
      });
      
      // Accent bar at bottom
      page.drawRectangle({
        x: 0,
        y: pageHeight - headerHeight,
        width: pageWidth,
        height: 4,
        color: COLORS.accent,
      });
      
      // Curved separator effect (white arc)
      page.drawRectangle({
        x: 0,
        y: pageHeight - headerHeight - 15,
        width: pageWidth,
        height: 18,
        color: COLORS.white,
      });

      let leftY = pageHeight - 35;
      
      // Logo
      if (logoImg) {
        page.drawImage(logoImg, {
          x: margin,
          y: leftY - logoHeight + 8,
          width: CONFIG.logo.width,
          height: logoHeight,
        });
      }

      // Company name - large and bold
      page.drawText('GAMA UNITED', {
        x: margin + (logoImg ? CONFIG.logo.width + 15 : 0),
        y: leftY,
        size: 26,
        font: notoBold,
        color: COLORS.white,
      });

      // Subtitle
      page.drawText('All you can print..', {
        x: margin + (logoImg ? CONFIG.logo.width + 15 : 0),
        y: leftY - 18,
        size: 10,
        font: notoFont,
        color: rgb(1, 1, 1),
        opacity: 0.75,
      });

      // Address line
      page.drawText('Veljka Milićevića 2/10, Beograd | ctp@gamaunited.rs', {
        x: margin + (logoImg ? CONFIG.logo.width + 15 : 0),
        y: leftY - 30,
        size: 8,
        font: notoFont,
        color: rgb(1, 1, 1),
        opacity: 0.6,
      });

      // PIB line
      page.drawText('PIB: 114876455', {
        x: margin + (logoImg ? CONFIG.logo.width + 15 : 0),
        y: leftY - 40,
        size: 8,
        font: notoFont,
        color: rgb(1, 1, 1),
        opacity: 0.6,
      });

      // Right side - Document badge
      const rightX = pageWidth - marginRight;
      
      // OTPREMNICA badge with pill shape
      const badgeText = 'OTPREMNICA';
      const badgeWidth = notoBold.widthOfTextAtSize(badgeText, 11) + 30;
      
      drawRoundedRect(
        page,
        rightX - badgeWidth,
        leftY - 5,
        badgeWidth,
        26,
        rgb(1, 1, 1),
      );
      page.drawRectangle({
        x: rightX - badgeWidth,
        y: leftY - 5,
        width: badgeWidth,
        height: 26,
        opacity: 0.15,
      });
      
      page.drawText(badgeText, {
        x: rightX - badgeWidth + 15,
        y: leftY + 2,
        size: 11,
        font: notoBold,
        color: COLORS.gradientStart,
      });

      // Document number below badge - prefer display_order_number (e.g. CTP-2026-000772), fall back to order_code then order_number
      const deliveryNumber = workOrder.display_order_number || workOrder.order_code || workOrder.order_number;
      const numWidth = notoBold.widthOfTextAtSize(deliveryNumber, 16);
      page.drawText(deliveryNumber, {
        x: rightX - numWidth,
        y: leftY - 30,
        size: 16,
        font: notoBold,
        color: COLORS.white,
      });

      return pageHeight - headerHeight - 25;
    };

    // Draw greeting section
    const drawGreeting = (page: any, startY: number): number => {
      const clientName = workOrder.client?.name || workOrder.clients?.name || 'Klijent';
      
      page.drawText(`Poštovani ${clientName},`, {
        x: margin,
        y: startY,
        size: 18,
        font: notoBold,
        color: COLORS.textDark,
      });
      
      page.drawText('Vaša porudžbina je uspešno završena i spremna za preuzimanje.', {
        x: margin,
        y: startY - 22,
        size: 11,
        font: notoFont,
        color: COLORS.textBody,
      });

      return startY - 50;
    };

    // Draw info cards in newsletter style (2x2 grid)
    const drawInfoCards = (page: any, startY: number): number => {
      const cardWidth = (contentWidth - 15) / 2;
      const cardHeight = 70;
      const gap = 15;

      // Order Type Card (blue theme)
      const orderKindKey = (workOrder.kind || 'CTP') as string;
      const orderTypeLabels: Record<string, string> = {
        'CTP': 'CTP ploče',
        'FILMOVANJE': 'Filmovanje',
        'DIGITALA': 'Digitalna štampa',
        'RAZNO': 'Ostalo',
      };
      const orderTypeLabel = orderTypeLabels[orderKindKey] || workOrder.kind;

      // Card 1: Order Type
      drawRoundedRect(page, margin, startY - cardHeight, cardWidth, cardHeight, COLORS.bgBlue, COLORS.borderBlue);
      
      // Icon circle
      page.drawRectangle({
        x: margin + 15,
        y: startY - cardHeight + 20,
        width: 36,
        height: 36,
        color: COLORS.accent,
      });
      page.drawText('TIP', {
        x: margin + 22,
        y: startY - cardHeight + 33,
        size: 12,
        font: notoBold,
        color: COLORS.white,
      });
      
      page.drawText('TIP NALOGA', {
        x: margin + 60,
        y: startY - 25,
        size: 8,
        font: notoBold,
        color: COLORS.textMuted,
      });
      page.drawText(orderTypeLabel, {
        x: margin + 60,
        y: startY - 42,
        size: 14,
        font: notoBold,
        color: COLORS.textDark,
      });

      // Card 2: Items Count (green theme)
      const rightCardX = margin + cardWidth + gap;
      drawRoundedRect(page, rightCardX, startY - cardHeight, cardWidth, cardHeight, COLORS.bgGreen, COLORS.borderGreen);
      
      page.drawRectangle({
        x: rightCardX + 15,
        y: startY - cardHeight + 20,
        width: 36,
        height: 36,
        color: COLORS.success,
      });
      page.drawText('#', {
        x: rightCardX + 28,
        y: startY - cardHeight + 33,
        size: 16,
        font: notoBold,
        color: COLORS.white,
      });
      
      page.drawText('BROJ STAVKI', {
        x: rightCardX + 60,
        y: startY - 25,
        size: 8,
        font: notoBold,
        color: COLORS.textMuted,
      });
      page.drawText(String(fileEntries.length), {
        x: rightCardX + 60,
        y: startY - 42,
        size: 14,
        font: notoBold,
        color: COLORS.textDark,
      });

      // Second row of cards
      const secondRowY = startY - cardHeight - 10;

      // Card 3: Created Date (purple theme)
      drawRoundedRect(page, margin, secondRowY - cardHeight, cardWidth, cardHeight, COLORS.bgCard, COLORS.border);
      
      page.drawRectangle({
        x: margin + 15,
        y: secondRowY - cardHeight + 20,
        width: 36,
        height: 36,
        color: COLORS.purple,
      });
      page.drawText('DAT', {
        x: margin + 21,
        y: secondRowY - cardHeight + 33,
        size: 12,
        font: notoBold,
        color: COLORS.white,
      });
      
      page.drawText('KREIRAN', {
        x: margin + 60,
        y: secondRowY - 25,
        size: 8,
        font: notoBold,
        color: COLORS.textMuted,
      });
      page.drawText(formatDate(workOrder.created_at), {
        x: margin + 60,
        y: secondRowY - 42,
        size: 13,
        font: notoBold,
        color: COLORS.textDark,
      });

      // Card 4: Closed Date (orange theme)
      drawRoundedRect(page, rightCardX, secondRowY - cardHeight, cardWidth, cardHeight, COLORS.bgCard, COLORS.border);
      
      page.drawRectangle({
        x: rightCardX + 15,
        y: secondRowY - cardHeight + 20,
        width: 36,
        height: 36,
        color: COLORS.orange,
      });
      page.drawText('OK', {
        x: rightCardX + 24,
        y: secondRowY - cardHeight + 33,
        size: 14,
        font: notoBold,
        color: COLORS.white,
      });
      
      page.drawText('ZATVOREN', {
        x: rightCardX + 60,
        y: secondRowY - 25,
        size: 8,
        font: notoBold,
        color: COLORS.textMuted,
      });
      page.drawText(formatDate(workOrder.closed_at || new Date().toISOString()), {
        x: rightCardX + 60,
        y: secondRowY - 42,
        size: 13,
        font: notoBold,
        color: COLORS.textDark,
      });

      // Client info card below
      const clientCardY = secondRowY - cardHeight - 15;
      const clientCardHeight = 55;
      
      drawRoundedRect(page, margin, clientCardY - clientCardHeight, contentWidth, clientCardHeight, COLORS.bgCard, COLORS.border);
      
      page.drawText('KLIJENT', {
        x: margin + 15,
        y: clientCardY - 18,
        size: 8,
        font: notoBold,
        color: COLORS.textMuted,
      });
      
      const clientName = (workOrder.client?.name || workOrder.clients?.name || 'N/A').substring(0, 50);
      page.drawText(clientName, {
        x: margin + 15,
        y: clientCardY - 35,
        size: 14,
        font: notoBold,
        color: COLORS.textDark,
      });
      
      if (workOrder.client?.pib || workOrder.clients?.pib) {
        const pibText = `PIB: ${workOrder.client?.pib || workOrder.clients?.pib}`;
        const pibWidth = notoFont.widthOfTextAtSize(pibText, 10);
        page.drawText(pibText, {
          x: pageWidth - marginRight - pibWidth - 15,
          y: clientCardY - 35,
          size: 10,
          font: notoFont,
          color: COLORS.textMuted,
        });
      }

      return clientCardY - clientCardHeight - 20;
    };

    // Draw items section header
    const drawItemsHeader = (page: any, startY: number): number => {
      // Section title with badge
      page.drawText('PREGLED STAVKI', {
        x: margin,
        y: startY,
        size: 12,
        font: notoBold,
        color: COLORS.gradientStart,
      });

      return startY - 20;
    };

    // Draw modern table header
    const drawTableHeader = (page: any, y: number): number => {
      const { rbr, filename, details, quantity } = CONFIG.table.cols;
      const tableWidth = rbr + filename + details + quantity;
      const headerHeight = 36;
      
      // Header with gradient effect
      page.drawRectangle({
        x: margin,
        y: y - headerHeight,
        width: tableWidth,
        height: headerHeight,
        color: COLORS.gradientStart,
      });
      
      // Column headers
      let x = margin;
      const headers = [
        { text: '#', width: rbr, align: 'center' },
        { text: 'Naziv fajla', width: filename, align: 'left' },
        { text: 'Detalji', width: details, align: 'center' },
        { text: 'Količina', width: quantity, align: 'center' },
      ];
      
      headers.forEach(h => {
        const textWidth = notoBold.widthOfTextAtSize(h.text, 10);
        let textX = x + 12;
        if (h.align === 'center') {
          textX = x + (h.width - textWidth) / 2;
        }
        page.drawText(h.text, {
          x: textX,
          y: y - 22,
          size: 10,
          font: notoBold,
          color: COLORS.white,
        });
        x += h.width;
      });
      
      return y - headerHeight;
    };

    // Draw table row with alternating colors
    let rowIndex = 0;
    const drawTableRow = (page: any, y: number, rbr: number, entry: any): number => {
      const { rbr: rbrW, filename: fnW, details: detW, quantity: qtyW } = CONFIG.table.cols;
      const tableWidth = rbrW + fnW + detW + qtyW;
      const rowHeight = CONFIG.table.rowHeight;
      
      // Alternating row background
      const bgColor = rowIndex % 2 === 0 ? COLORS.white : COLORS.bgLight;
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: bgColor,
      });
      
      // Bottom border
      page.drawLine({
        start: { x: margin, y: y - rowHeight },
        end: { x: margin + tableWidth, y: y - rowHeight },
        thickness: 0.5,
        color: COLORS.border,
      });
      
      // Row content
      let x = margin;
      const orderKind = workOrder.kind || 'CTP';
      
      // Row number (centered, with circle bg)
      const rbrText = String(rbr);
      const rbrWidth = notoFont.widthOfTextAtSize(rbrText, 9);
      page.drawText(rbrText, {
        x: x + (rbrW - rbrWidth) / 2,
        y: y - 20,
        size: 9,
        font: notoFont,
        color: COLORS.textMuted,
      });
      x += rbrW;

      // Filename
      const fileName = (entry.filename || entry.file_name || 'N/A').substring(0, 42);
      page.drawText(fileName, {
        x: x + 12,
        y: y - 20,
        size: 10,
        font: notoFont,
        color: COLORS.textDark,
      });
      x += fnW;

      // Details (centered)
      const detailsText = getDetailsText(entry, orderKind).substring(0, 18);
      const detWidth = notoFont.widthOfTextAtSize(detailsText, 9);
      page.drawText(detailsText, {
        x: x + (detW - detWidth) / 2,
        y: y - 20,
        size: 9,
        font: notoFont,
        color: COLORS.textMuted,
      });
      x += detW;

      // Quantity (centered, bold)
      const qtyText = getQuantityText(entry, orderKind, workOrder).substring(0, 12);
      const qtyWidth = notoBold.widthOfTextAtSize(qtyText, 10);
      page.drawText(qtyText, {
        x: x + (qtyW - qtyWidth) / 2,
        y: y - 20,
        size: 10,
        font: notoBold,
        color: COLORS.textDark,
      });

      rowIndex++;
      return y - rowHeight;
    };

    // Draw summary row
    const drawSummaryRow = (page: any, y: number): number => {
      const { rbr, filename, details, quantity } = CONFIG.table.cols;
      const tableWidth = rbr + filename + details + quantity;
      const rowHeight = CONFIG.table.rowHeight + 6;

      // Summary with gradient bg
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: COLORS.gradientStart,
      });

      // Total text
      page.drawText(`UKUPNO STAVKI: ${fileEntries.length}`, {
        x: margin + rbr + 12,
        y: y - 24,
        size: 11,
        font: notoBold,
        color: COLORS.white,
      });

      return y - rowHeight;
    };

    // Draw modern signature block
    const drawSignature = (page: any) => {
      const y = signatureY;
      const lineY = y + 15;
      const lineWidth = CONFIG.signature.lineWidth;
      const spacing = (contentWidth - lineWidth * 3) / 2;
      
      // Divider with gradient effect
      page.drawLine({
        start: { x: margin + 50, y: y + 40 },
        end: { x: pageWidth - marginRight - 50, y: y + 40 },
        thickness: 1,
        color: COLORS.border,
      });

      const signatures = [
        { label: 'Pripremio', x: margin },
        { label: 'Predao', x: margin + lineWidth + spacing },
        { label: 'Preuzeo', x: margin + (lineWidth + spacing) * 2 },
      ];

      signatures.forEach(sig => {
        page.drawText(sig.label + ':', {
          x: sig.x,
          y: y + 26,
          size: 9,
          font: notoFont,
          color: COLORS.textMuted,
        });
        page.drawLine({
          start: { x: sig.x, y: lineY },
          end: { x: sig.x + lineWidth, y: lineY },
          thickness: 1,
          color: COLORS.textDark,
        });
      });
    };

    // Draw footer with company info
    const drawFooter = (page: any, pageNum: number, totalPages: number) => {
      const footerY = 25;
      
      // Subtle divider
      page.drawLine({
        start: { x: margin, y: footerY + 15 },
        end: { x: pageWidth - marginRight, y: footerY + 15 },
        thickness: 0.5,
        color: COLORS.border,
      });
      
      // Company info
      page.drawText('GAMA UNITED d.o.o. | Veljka Milićevića 2/10, Beograd | ctp@gamaunited.rs | PIB: 114876455', {
        x: margin,
        y: footerY,
        size: 8,
        font: notoFont,
        color: COLORS.textLight,
      });

      // Page number
      if (totalPages > 1) {
        const pageText = `${pageNum} / ${totalPages}`;
        const pageWidth2 = notoFont.widthOfTextAtSize(pageText, 9);
        page.drawText(pageText, {
          x: pageWidth - marginRight - pageWidth2,
          y: footerY,
          size: 9,
          font: notoFont,
          color: COLORS.textMuted,
        });
      }
    };

    // Build pages
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // First page content
    let y = drawNewsletterHeader(currentPage);
    y = drawGreeting(currentPage, y);
    y = drawInfoCards(currentPage, y);
    y = drawItemsHeader(currentPage, y);
    y = drawTableHeader(currentPage, y);

    let pageNum = 1;
    const pages = [currentPage];

    // Draw table rows
    fileEntries.forEach((entry, idx) => {
      const needsNewPage = y < tableBottomMargin + CONFIG.table.rowHeight;
      
      if (needsNewPage) {
        // New page with minimal header
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        pages.push(currentPage);
        pageNum++;
        
        // Continuation header
        currentPage.drawRectangle({
          x: 0,
          y: pageHeight - 55,
          width: pageWidth,
          height: 55,
          color: COLORS.gradientStart,
        });
        
        const deliveryNumber = workOrder.order_number;
        currentPage.drawText(`OTPREMNICA ${deliveryNumber}`, {
          x: margin,
          y: pageHeight - 28,
          size: 14,
          font: notoBold,
          color: COLORS.white,
        });
        
        currentPage.drawText('(nastavak)', {
          x: margin,
          y: pageHeight - 44,
          size: 10,
          font: notoFont,
          color: rgb(1, 1, 1),
          opacity: 0.7,
        });

        y = pageHeight - 75;
        y = drawTableHeader(currentPage, y);
      }
      
      y = drawTableRow(currentPage, y, idx + 1, entry);
    });

    // Draw summary row if space allows
    if (y > tableBottomMargin + CONFIG.table.rowHeight + 15) {
      y = drawSummaryRow(currentPage, y);
    }

    // Draw signature and footer on all pages
    pages.forEach((p, i) => {
      drawSignature(p);
      drawFooter(p, i + 1, pages.length);
    });

    return pdfDoc.save();
  } catch (err: any) {
    console.error('PDF generation error:', err?.message, err?.stack);
    throw new Error(`PDF error: ${err?.message}`);
  }
}
