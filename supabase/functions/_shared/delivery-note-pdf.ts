import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

// Modern brand colors - professional dark blue theme
const COLORS = {
  primary: rgb(0.102, 0.212, 0.365),      // #1a365d - dark navy
  primaryLight: rgb(0.173, 0.322, 0.510), // #2c5282 - medium blue
  accent: rgb(0.196, 0.506, 0.780),       // #3281c7 - bright blue
  success: rgb(0.220, 0.631, 0.412),      // #38a169 - green
  textDark: rgb(0.102, 0.212, 0.365),     // #1a365d - dark navy
  textMuted: rgb(0.443, 0.506, 0.580),    // #718096 - gray
  textLight: rgb(0.631, 0.675, 0.725),    // #a1acb9 - light gray
  border: rgb(0.886, 0.898, 0.918),       // #e2e5ea - light border
  borderLight: rgb(0.937, 0.945, 0.957),  // #eff1f4 - very light border
  headerBg: rgb(0.102, 0.212, 0.365),     // dark navy header
  rowAlt: rgb(0.973, 0.976, 0.984),       // #f8f9fb - very light blue/gray
  cardBg: rgb(0.961, 0.969, 0.980),       // #f5f7fa - card background
  white: rgb(1, 1, 1),
};

const CONFIG = {
  pageWidth: 595.28,  // A4 width
  pageHeight: 841.89, // A4 height (full page for cleaner look)
  margin: 40,
  marginRight: 40,
  logo: { width: 100 },
  table: {
    cols: { rbr: 40, filename: 260, details: 130, quantity: 85 },
    rowHeight: 28,
    headerBg: COLORS.headerBg,
  },
  signature: { lineWidth: 140, yOffset: 100 },
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
    const tableBottomMargin = signatureY + 50;

    // Draw modern header with gradient effect
    const drawModernHeader = (page: any): number => {
      const headerHeight = 90;
      
      // Header background
      page.drawRectangle({
        x: 0,
        y: pageHeight - headerHeight,
        width: pageWidth,
        height: headerHeight,
        color: COLORS.primary,
      });
      
      // Subtle accent bar at bottom of header
      page.drawRectangle({
        x: 0,
        y: pageHeight - headerHeight,
        width: pageWidth,
        height: 3,
        color: COLORS.accent,
      });

      let leftY = pageHeight - 32;
      
      // Logo
      if (logoImg) {
        const scaledLogoWidth = CONFIG.logo.width;
        const scaledLogoHeight = logoHeight;
        page.drawImage(logoImg, {
          x: margin,
          y: leftY - scaledLogoHeight + 10,
          width: scaledLogoWidth,
          height: scaledLogoHeight,
        });
      }

      // Company name
      page.drawText('GAMA UNITED', {
        x: margin + (logoImg ? CONFIG.logo.width + 15 : 0),
        y: leftY - 5,
        size: 22,
        font: notoBold,
        color: COLORS.white,
      });

      page.drawText('Grafička industrija', {
        x: margin + (logoImg ? CONFIG.logo.width + 15 : 0),
        y: leftY - 22,
        size: 10,
        font: notoFont,
        color: rgb(1, 1, 1),
        opacity: 0.8,
      });

      // Right side - Document title and number
      const rightX = pageWidth - marginRight;
      
      // OTPREMNICA badge
      const badgeText = 'OTPREMNICA';
      const badgeWidth = notoBold.widthOfTextAtSize(badgeText, 12);
      page.drawText(badgeText, {
        x: rightX - badgeWidth,
        y: leftY - 5,
        size: 12,
        font: notoBold,
        color: COLORS.white,
      });

      // Document number
      const deliveryNumber = workOrder.display_order_number || workOrder.order_number;
      const numWidth = notoBold.widthOfTextAtSize(deliveryNumber, 14);
      page.drawText(deliveryNumber, {
        x: rightX - numWidth,
        y: leftY - 26,
        size: 14,
        font: notoBold,
        color: rgb(1, 1, 1),
        opacity: 0.95,
      });

      return pageHeight - headerHeight - 20;
    };

    // Draw info cards (client and order details)
    const drawInfoCards = (page: any, startY: number): number => {
      const cardHeight = 90;
      const cardWidth = (contentWidth - 15) / 2;
      const cardRadius = 8;

      // Left card - Client info
      page.drawRectangle({
        x: margin,
        y: startY - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: COLORS.cardBg,
      });
      page.drawRectangle({
        x: margin,
        y: startY - cardHeight,
        width: cardWidth,
        height: cardHeight,
        borderColor: COLORS.border,
        borderWidth: 1,
      });

      // Client info header
      page.drawRectangle({
        x: margin,
        y: startY - 24,
        width: cardWidth,
        height: 24,
        color: COLORS.primary,
      });
      page.drawText('KLIJENT', {
        x: margin + 12,
        y: startY - 17,
        size: 9,
        font: notoBold,
        color: COLORS.white,
      });

      // Client details
      const clientName = (workOrder.client?.name || workOrder.clients?.name || 'N/A').substring(0, 35);
      page.drawText(clientName, {
        x: margin + 12,
        y: startY - 44,
        size: 12,
        font: notoBold,
        color: COLORS.textDark,
      });

      if (workOrder.client?.pib || workOrder.clients?.pib) {
        page.drawText(`PIB: ${workOrder.client?.pib || workOrder.clients?.pib}`, {
          x: margin + 12,
          y: startY - 60,
          size: 9,
          font: notoFont,
          color: COLORS.textMuted,
        });
      }

      if (workOrder.client?.email || workOrder.clients?.email) {
        const email = (workOrder.client?.email || workOrder.clients?.email || '').substring(0, 35);
        page.drawText(email, {
          x: margin + 12,
          y: startY - 76,
          size: 9,
          font: notoFont,
          color: COLORS.textMuted,
        });
      }

      // Right card - Order info
      const rightCardX = margin + cardWidth + 15;
      page.drawRectangle({
        x: rightCardX,
        y: startY - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: COLORS.cardBg,
      });
      page.drawRectangle({
        x: rightCardX,
        y: startY - cardHeight,
        width: cardWidth,
        height: cardHeight,
        borderColor: COLORS.border,
        borderWidth: 1,
      });

      // Order info header
      page.drawRectangle({
        x: rightCardX,
        y: startY - 24,
        width: cardWidth,
        height: 24,
        color: COLORS.primary,
      });
      page.drawText('DETALJI NALOGA', {
        x: rightCardX + 12,
        y: startY - 17,
        size: 9,
        font: notoBold,
        color: COLORS.white,
      });

      // Order type
      const orderKindKey = (workOrder.kind || 'CTP') as string;
      const orderTypeLabels: Record<string, string> = {
        'CTP': 'CTP ploče',
        'FILMOVANJE': 'Filmovanje',
        'DIGITALA': 'Digitalna štampa',
        'RAZNO': 'Ostalo',
      };
      const orderTypeLabel = orderTypeLabels[orderKindKey] || workOrder.kind;
      
      page.drawText(`Tip: ${orderTypeLabel}`, {
        x: rightCardX + 12,
        y: startY - 44,
        size: 10,
        font: notoBold,
        color: COLORS.textDark,
      });

      // Dates
      const createdDate = formatDate(workOrder.created_at);
      const closedDate = formatDate(workOrder.closed_at || new Date().toISOString());
      
      page.drawText(`Kreiran: ${createdDate}`, {
        x: rightCardX + 12,
        y: startY - 60,
        size: 9,
        font: notoFont,
        color: COLORS.textMuted,
      });

      page.drawText(`Zatvoren: ${closedDate}`, {
        x: rightCardX + 12,
        y: startY - 76,
        size: 9,
        font: notoFont,
        color: COLORS.textMuted,
      });

      return startY - cardHeight - 20;
    };

    // Draw items section label
    const drawItemsLabel = (page: any, startY: number): number => {
      page.drawText('STAVKE', {
        x: margin,
        y: startY,
        size: 11,
        font: notoBold,
        color: COLORS.primary,
      });
      
      // Item count badge
      const countText = `${fileEntries.length}`;
      const countWidth = notoBold.widthOfTextAtSize(countText, 10);
      page.drawRectangle({
        x: margin + 55,
        y: startY - 4,
        width: countWidth + 14,
        height: 18,
        color: COLORS.primary,
      });
      page.drawText(countText, {
        x: margin + 62,
        y: startY + 1,
        size: 10,
        font: notoBold,
        color: COLORS.white,
      });

      return startY - 18;
    };

    // Draw table header
    const drawTableHeader = (page: any, y: number): number => {
      const { rbr, filename, details, quantity } = CONFIG.table.cols;
      const tableWidth = rbr + filename + details + quantity;
      const headerHeight = 32;
      
      // Header background
      page.drawRectangle({
        x: margin,
        y: y - headerHeight,
        width: tableWidth,
        height: headerHeight,
        color: COLORS.headerBg,
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
        const textWidth = notoBold.widthOfTextAtSize(h.text, 9);
        let textX = x + 10;
        if (h.align === 'center') {
          textX = x + (h.width - textWidth) / 2;
        }
        page.drawText(h.text, {
          x: textX,
          y: y - 20,
          size: 9,
          font: notoBold,
          color: COLORS.white,
        });
        x += h.width;
      });
      
      return y - headerHeight;
    };

    // Draw table row
    let rowIndex = 0;
    const drawTableRow = (page: any, y: number, rbr: number, entry: any): number => {
      const { rbr: rbrW, filename: fnW, details: detW, quantity: qtyW } = CONFIG.table.cols;
      const tableWidth = rbrW + fnW + detW + qtyW;
      const rowHeight = CONFIG.table.rowHeight;
      
      // Alternating row background
      if (rowIndex % 2 === 1) {
        page.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: tableWidth,
          height: rowHeight,
          color: COLORS.rowAlt,
        });
      }
      
      // Bottom border
      page.drawLine({
        start: { x: margin, y: y - rowHeight },
        end: { x: margin + tableWidth, y: y - rowHeight },
        thickness: 0.5,
        color: COLORS.borderLight,
      });
      
      // Row content
      let x = margin;
      const orderKind = workOrder.kind || 'CTP';
      
      // Row number (centered)
      const rbrText = String(rbr);
      const rbrWidth = notoFont.widthOfTextAtSize(rbrText, 9);
      page.drawText(rbrText, {
        x: x + (rbrW - rbrWidth) / 2,
        y: y - 18,
        size: 9,
        font: notoFont,
        color: COLORS.textMuted,
      });
      x += rbrW;

      // Filename
      const fileName = (entry.filename || entry.file_name || 'N/A').substring(0, 45);
      page.drawText(fileName, {
        x: x + 10,
        y: y - 18,
        size: 9,
        font: notoFont,
        color: COLORS.textDark,
      });
      x += fnW;

      // Details (centered)
      const detailsText = getDetailsText(entry, orderKind).substring(0, 20);
      const detWidth = notoFont.widthOfTextAtSize(detailsText, 9);
      page.drawText(detailsText, {
        x: x + (detW - detWidth) / 2,
        y: y - 18,
        size: 9,
        font: notoFont,
        color: COLORS.textMuted,
      });
      x += detW;

      // Quantity (centered, bold)
      const qtyText = getQuantityText(entry, orderKind, workOrder).substring(0, 15);
      const qtyWidth = notoBold.widthOfTextAtSize(qtyText, 9);
      page.drawText(qtyText, {
        x: x + (qtyW - qtyWidth) / 2,
        y: y - 18,
        size: 9,
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
      const rowHeight = CONFIG.table.rowHeight + 4;

      // Summary background
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: COLORS.primary,
      });

      // Total text
      page.drawText(`UKUPNO STAVKI: ${fileEntries.length}`, {
        x: margin + rbr + 10,
        y: y - 20,
        size: 10,
        font: notoBold,
        color: COLORS.white,
      });

      return y - rowHeight;
    };

    // Draw signature block
    const drawSignature = (page: any) => {
      const y = signatureY;
      const lineY = y + 20;
      const lineWidth = CONFIG.signature.lineWidth;
      const spacing = (contentWidth - lineWidth * 3) / 2;
      
      // Divider line above signatures
      page.drawLine({
        start: { x: margin, y: y + 45 },
        end: { x: margin + contentWidth, y: y + 45 },
        thickness: 1,
        color: COLORS.border,
      });

      // Prepared by
      page.drawText('Pripremio:', {
        x: margin,
        y: y + 30,
        size: 9,
        font: notoFont,
        color: COLORS.textMuted,
      });
      page.drawLine({
        start: { x: margin, y: lineY },
        end: { x: margin + lineWidth, y: lineY },
        thickness: 1,
        color: COLORS.textDark,
      });

      // Handed over
      const handX = margin + lineWidth + spacing;
      page.drawText('Predao:', {
        x: handX,
        y: y + 30,
        size: 9,
        font: notoFont,
        color: COLORS.textMuted,
      });
      page.drawLine({
        start: { x: handX, y: lineY },
        end: { x: handX + lineWidth, y: lineY },
        thickness: 1,
        color: COLORS.textDark,
      });

      // Received
      const recvX = handX + lineWidth + spacing;
      page.drawText('Preuzeo:', {
        x: recvX,
        y: y + 30,
        size: 9,
        font: notoFont,
        color: COLORS.textMuted,
      });
      page.drawLine({
        start: { x: recvX, y: lineY },
        end: { x: recvX + lineWidth, y: lineY },
        thickness: 1,
        color: COLORS.textDark,
      });
    };

    // Draw footer
    const drawFooter = (page: any, pageNum: number, totalPages: number) => {
      const footerY = 30;
      
      // Company info
      page.drawText('GAMA UNITED d.o.o. | Veljka Milićevića 2/10, 11000 Beograd | PIB: 114876455', {
        x: margin,
        y: footerY,
        size: 8,
        font: notoFont,
        color: COLORS.textLight,
      });

      // Page number
      if (totalPages > 1) {
        const pageText = `Strana ${pageNum} / ${totalPages}`;
        const pageWidth = notoFont.widthOfTextAtSize(pageText, 9);
        page.drawText(pageText, {
          x: pageWidth - marginRight - pageWidth,
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
    let y = drawModernHeader(currentPage);
    y = drawInfoCards(currentPage, y);
    y = drawItemsLabel(currentPage, y);
    y = drawTableHeader(currentPage, y);

    let pageNum = 1;
    const pages = [currentPage];

    // Draw table rows
    fileEntries.forEach((entry, idx) => {
      const needsNewPage = y < tableBottomMargin + CONFIG.table.rowHeight;
      
      if (needsNewPage) {
        // New page
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        pages.push(currentPage);
        pageNum++;
        
        // Draw minimal header on continuation pages
        currentPage.drawRectangle({
          x: 0,
          y: pageHeight - 50,
          width: pageWidth,
          height: 50,
          color: COLORS.primary,
        });
        
        const deliveryNumber = workOrder.display_order_number || workOrder.order_number;
        currentPage.drawText(`OTPREMNICA - ${deliveryNumber} (nastavak)`, {
          x: margin,
          y: pageHeight - 32,
          size: 12,
          font: notoBold,
          color: COLORS.white,
        });

        y = pageHeight - 70;
        y = drawTableHeader(currentPage, y);
      }
      
      y = drawTableRow(currentPage, y, idx + 1, entry);
    });

    // Draw summary row
    if (y > tableBottomMargin + CONFIG.table.rowHeight + 10) {
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
