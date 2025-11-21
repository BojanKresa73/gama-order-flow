import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const CONFIG = {
  pageWidth: 595.28, // A5 landscape width in points
  pageHeight: 419.53, // A5 landscape height in points
  margin: 24,
  logo: { width: 180, gap: 16 },
  table: {
    cols: { rbr: 40, filename: 250, details: 160, quantity: 60 },
    rowHeight: 22,
    headerBg: rgb(0.95, 0.95, 0.95),
  },
  signature: { lineWidth: 180, yOffset: 60 },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}.`;
}

function isSupportedFont(bytes: ArrayBuffer) {
  const sig = String.fromCharCode(...new Uint8Array(bytes).slice(0, 4));
  return sig === '\x00\x01\x00\x00' || sig === 'OTTO';
}

export async function generateDeliveryNotePDF(
  workOrder: any,
  fileEntries: any[]
): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Load fonts
    const regularFontUrl = Deno.env.get('FONT_REGULAR_URL');
    const boldFontUrl = Deno.env.get('FONT_BOLD_URL');
    if (!regularFontUrl || !boldFontUrl) {
      throw new Error('Font URLs not configured');
    }
    const [regularResp, boldResp] = await Promise.all([
      fetch(regularFontUrl),
      fetch(boldFontUrl),
    ]);
    const regularBytes = await regularResp.arrayBuffer();
    const boldBytes = await boldResp.arrayBuffer();
    if (!isSupportedFont(regularBytes) || !isSupportedFont(boldBytes)) {
      throw new Error('Invalid font format');
    }
    const notoFont = await pdfDoc.embedFont(regularBytes, { subset: true });
    const notoBold = await pdfDoc.embedFont(boldBytes, { subset: true });

    // Load logo
    let logoImg: any = null;
    let logoHeight = 0;
    const logoUrl = Deno.env.get('LOGO_URL');
    if (logoUrl) {
      try {
        const logoResp = await fetch(logoUrl, { cache: 'no-store' });
        if (logoResp.ok) {
          const logoBytes = await logoResp.arrayBuffer();
          logoImg = await pdfDoc.embedPng(logoBytes);
          const aspectRatio = logoImg.height / logoImg.width;
          logoHeight = CONFIG.logo.width * aspectRatio;
        }
      } catch (err) {
        console.warn('Failed to load logo:', err);
      }
    }

    const companyX = CONFIG.margin + CONFIG.logo.width + CONFIG.logo.gap;
    const tableStartY = CONFIG.pageHeight - CONFIG.margin - 160;
    const signatureY = CONFIG.signature.yOffset;

    // Helper: draw header on page
    const drawHeader = (page: any) => {
      const { height } = page.getSize();
      let y = height - CONFIG.margin;

      // Logo
      if (logoImg) {
        page.drawImage(logoImg, {
          x: CONFIG.margin,
          y: height - CONFIG.margin - logoHeight,
          width: CONFIG.logo.width,
          height: logoHeight,
        });
      }

      // Company info
      page.drawText('GAMA UNITED d.o.o.', { x: companyX, y, size: 11, font: notoBold });
      y -= 14;
      page.drawText('Šumadijska 29, 11000 Beograd', { x: companyX, y, size: 10, font: notoFont });
      y -= 14;
      page.drawText('PIB: 112345678 | MB: 21234567', { x: companyX, y, size: 10, font: notoFont });
    };

    // Helper: draw meta section
    const drawMeta = (page: any, startY: number): number => {
      let y = startY;
      page.drawText('OTPREMNICA', { x: CONFIG.margin, y, size: 18, font: notoBold });
      y -= 24;
      
      // Use work order number as delivery number
      const deliveryNumber = workOrder.display_order_number || workOrder.order_number;
      page.drawText(`Broj: ${deliveryNumber}`, { x: CONFIG.margin, y, size: 11, font: notoFont });
      y -= 16;
      page.drawText(
        `Datum otvaranja: ${formatDate(workOrder.created_at)}`,
        { x: CONFIG.margin, y, size: 10, font: notoFont }
      );
      y -= 14;
      page.drawText(
        `Datum zatvaranja: ${formatDate(workOrder.closed_at || new Date().toISOString())}`,
        { x: CONFIG.margin, y, size: 10, font: notoFont }
      );
      y -= 16;
      page.drawText('Klijent:', { x: CONFIG.margin, y, size: 11, font: notoBold });
      y -= 14;
      page.drawText(workOrder.clients?.name || 'N/A', { x: CONFIG.margin, y, size: 10, font: notoFont });
      if (workOrder.clients?.pib) {
        y -= 14;
        page.drawText(`PIB: ${workOrder.clients.pib}`, { x: CONFIG.margin, y, size: 10, font: notoFont });
      }
      y -= 20;
      return y;
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
      const texts = [
        String(rbr),
        (entry.filename || 'N/A').substring(0, 35),
        (entry.plate_formats?.format_name || 'N/A').substring(0, 25),
        String(entry.quantity || 0),
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
    drawHeader(currentPage);
    let y = drawMeta(currentPage, tableStartY);
    y -= 8;
    currentPage.drawText('Stavke:', { x: CONFIG.margin, y, size: 11, font: notoBold });
    y -= 20;
    y = drawTableHeader(currentPage, y);

    let pageNum = 1;
    const pages = [currentPage];

    fileEntries.forEach((entry, idx) => {
      const needsNewPage = y < signatureY + 40;
      if (needsNewPage) {
        currentPage = pdfDoc.addPage([CONFIG.pageWidth, CONFIG.pageHeight]);
        pages.push(currentPage);
        pageNum++;
        drawHeader(currentPage);
        y = CONFIG.pageHeight - CONFIG.margin - 80;
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
