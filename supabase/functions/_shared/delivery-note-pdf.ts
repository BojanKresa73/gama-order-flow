import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const CONFIG = {
  pageWidth: 595.28, // A4 width in points (A5 landscape = A4 portrait rotated)
  pageHeight: 419.53, // A4 height / sqrt(2) ≈ A5 landscape height
  margin: 30,
  logo: { width: 120 },
  table: {
    cols: { rbr: 35, filename: 260, details: 140, quantity: 65 },
    rowHeight: 22,
    headerBg: rgb(0.93, 0.93, 0.93),
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
    const totalM = Number(entry.computed_total_m ?? entry.total_m ?? 0);
    return `Potrošeno: ${totalM.toFixed(2)} m`;
  }
  
  // For DIGITALA, show format or N/A
  if (orderKind === 'DIGITALA') {
    if (entry.finished_w_mm && entry.finished_h_mm) {
      return `${entry.finished_w_mm}×${entry.finished_h_mm} mm`;
    }
    return 'N/A';
  }
  
  return 'N/A';
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
      page.drawText('GAMA UNITED d.o.o.', { x: CONFIG.margin, y: leftY, size: 8, font: notoBold });
      leftY -= 11;
      page.drawText('Veljka Milićevića 2/10, Beograd', { x: CONFIG.margin, y: leftY, size: 8, font: notoFont });
      leftY -= 11;
      page.drawText('PIB: 1114876455', { x: CONFIG.margin, y: leftY, size: 8, font: notoFont });

      // TOP RIGHT: Client block
      let rightY = height - CONFIG.margin;
      page.drawText('OTPREMNICA', { x: rightX, y: rightY, size: 16, font: notoBold });
      rightY -= 22;

      const deliveryNumber = workOrder.display_order_number || workOrder.order_number;
      page.drawText(`Broj naloga: ${deliveryNumber}`, { x: rightX, y: rightY, size: 9, font: notoFont });
      rightY -= 13;
      page.drawText(`Datum zatvaranja: ${formatDate(workOrder.closed_at || new Date().toISOString())}`, { x: rightX, y: rightY, size: 9, font: notoFont });
      rightY -= 16;

      page.drawText('Klijent:', { x: rightX, y: rightY, size: 9, font: notoBold });
      rightY -= 13;
      const clientName = (workOrder.clients?.name || 'N/A').substring(0, 30);
      page.drawText(clientName, { x: rightX, y: rightY, size: 9, font: notoFont });
      
      if (workOrder.clients?.email) {
        rightY -= 13;
        const email = workOrder.clients.email.substring(0, 30);
        page.drawText(email, { x: rightX, y: rightY, size: 8, font: notoFont });
      }

      if (workOrder.clients?.pib) {
        rightY -= 13;
        page.drawText(`PIB: ${workOrder.clients.pib}`, { x: rightX, y: rightY, size: 8, font: notoFont });
      }

      return Math.min(leftY, rightY) - 18;
    };

    // Helper: draw items label before table
    const drawItemsLabel = (page: any, startY: number): number => {
      page.drawText('Stavke:', { x: CONFIG.margin, y: startY, size: 10, font: notoBold });
      return startY - 12;
    };

    // Helper: draw table header
    const drawTableHeader = (page: any, y: number): number => {
      const { rbr, filename, details, quantity } = CONFIG.table.cols;
      // Gray background
      page.drawRectangle({
        x: CONFIG.margin,
        y: y - CONFIG.table.rowHeight,
        width: rbr + filename + details + quantity,
        height: CONFIG.table.rowHeight,
        color: CONFIG.table.headerBg,
      });
      let x = CONFIG.margin + 4;
      const headers = ['R.br', 'Naziv fajla', 'Detalji', 'Količina'];
      const widths = [rbr, filename, details, quantity];
      headers.forEach((h, i) => {
        page.drawText(h, { x, y: y - 14, size: 10, font: notoBold });
        x += widths[i];
      });
      return y - CONFIG.table.rowHeight - 4;
    };

    // Helper: draw table row
    const drawTableRow = (page: any, y: number, rbr: number, entry: any): number => {
      const { rbr: rbrW, filename: fnW, details: detW, quantity: qtyW } = CONFIG.table.cols;
      let x = CONFIG.margin + 4;
      const orderKind = workOrder.kind || 'CTP';
      const texts = [
        String(rbr),
        (entry.filename || 'N/A').substring(0, 40),
        getDetailsText(entry, orderKind).substring(0, 20),
        String(entry.quantity || entry.qty || 1),
      ];
      const widths = [rbrW, fnW, detW, qtyW];
      texts.forEach((t, i) => {
        page.drawText(t, { x, y: y - 14, size: 9, font: notoFont });
        x += widths[i];
      });
      return y - CONFIG.table.rowHeight;
    };

    // Helper: draw signature block
    const drawSignature = (page: any) => {
      const y = signatureY;
      // Signature line
      page.drawLine({
        start: { x: CONFIG.margin, y },
        end: { x: CONFIG.margin + CONFIG.signature.lineWidth, y },
        thickness: 0.5,
      });
      page.drawText('Robu preuzeo', { x: CONFIG.margin, y: y - 12, size: 9, font: notoFont });

      // ID line
      const idX = CONFIG.margin + CONFIG.signature.lineWidth + 20;
      page.drawLine({
        start: { x: idX, y },
        end: { x: idX + 100, y },
        thickness: 0.5,
      });
      page.drawText('Broj lične karte', { x: idX, y: y - 12, size: 9, font: notoFont });

      // Date line
      const dateX = idX + 120;
      page.drawLine({
        start: { x: dateX, y },
        end: { x: dateX + 80, y },
        thickness: 0.5,
      });
      page.drawText('Datum', { x: dateX, y: y - 12, size: 9, font: notoFont });
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
