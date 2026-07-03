import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import notoRegular from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoBold from "@/assets/fonts/NotoSans-Bold.ttf?url";

export interface QuoteItemPdf {
  materialName: string;
  widthCm: number;
  heightCm: number;
  qty: number;
  printSides: string;
  unitPrice: number;
  lineTotal: number;
}

export interface QuoteSigner {
  fullName: string;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface QuoteData {
  quoteNumber: string;
  date: Date;
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  notes?: string;
  items: QuoteItemPdf[];
  total: number;
  signer: QuoteSigner;
}

const BRAND = { name: "GAMA UNITED d.o.o.", addr: "Otona Župančiča 19, Novi Beograd", pib: "PIB: 114876455", phone: "Tel: 063 237 226", web: "www.gama-united.rs" };
const NAVY = rgb(0.043, 0.098, 0.216); // #0b1937
const ACCENT = rgb(0.925, 0.518, 0.106); // #ec841b (orange from Gama)
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT = rgb(0.93, 0.94, 0.96);

const fmt = (n: number) =>
  new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const formatDate = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}.`;
};

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  return await r.arrayBuffer();
}

function drawHeader(page: PDFPage, bold: PDFFont, reg: PDFFont) {
  const { width, height } = page.getSize();
  // Left navy band
  page.drawRectangle({ x: 0, y: 0, width: 8, height, color: NAVY });
  // Top orange accent
  page.drawRectangle({ x: 8, y: height - 4, width: width - 8, height: 4, color: ACCENT });

  // Logo mark (stylized G)
  const cx = 60, cy = height - 55;
  page.drawCircle({ x: cx, y: cy, size: 22, color: NAVY });
  page.drawText("G", { x: cx - 8, y: cy - 9, size: 24, font: bold, color: rgb(1, 1, 1) });

  // Brand text
  page.drawText("GAMA UNITED", { x: 95, y: height - 45, size: 18, font: bold, color: NAVY });
  page.drawText("Print & Media Solutions", { x: 95, y: height - 62, size: 9, font: reg, color: ACCENT });

  // Right meta
  const rx = width - 40;
  const line = (t: string, y: number, f = reg, s = 9, c = GRAY) => {
    const w = f.widthOfTextAtSize(t, s);
    page.drawText(t, { x: rx - w, y, size: s, font: f, color: c });
  };
  line(BRAND.name, height - 42, bold, 10, NAVY);
  line(BRAND.addr, height - 55);
  line(BRAND.pib + " · " + BRAND.phone, height - 66);
  line(BRAND.web, height - 77, reg, 9, ACCENT);
}

function drawFooter(page: PDFPage, reg: PDFFont) {
  const { width } = page.getSize();
  page.drawRectangle({ x: 8, y: 30, width: width - 16, height: 0.5, color: GRAY });
  const footer = `${BRAND.name} · ${BRAND.addr} · ${BRAND.pib} · ${BRAND.phone} · ${BRAND.web}`;
  const w = reg.widthOfTextAtSize(footer, 8);
  page.drawText(footer, { x: (width - w) / 2, y: 18, size: 8, font: reg, color: GRAY });
}

export async function generateQuotePdf(data: QuoteData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regBuf, boldBuf] = await Promise.all([fetchFont(notoRegular), fetchFont(notoBold)]);
  const reg = await doc.embedFont(regBuf, { subset: true });
  const bold = await doc.embedFont(boldBuf, { subset: true });

  let page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  drawHeader(page, bold, reg);

  // Document title
  let y = height - 120;
  page.drawText("PONUDA", { x: 40, y, size: 22, font: bold, color: NAVY });
  page.drawText(`Broj: ${data.quoteNumber}`, { x: 40, y: y - 20, size: 10, font: reg, color: GRAY });
  const dateStr = `Datum: ${formatDate(data.date)}`;
  const dw = reg.widthOfTextAtSize(dateStr, 10);
  page.drawText(dateStr, { x: width - 40 - dw, y: y - 20, size: 10, font: reg, color: GRAY });

  // Client box
  y -= 50;
  page.drawRectangle({ x: 40, y: y - 55, width: width - 80, height: 60, color: LIGHT });
  page.drawRectangle({ x: 40, y: y - 55, width: 3, height: 60, color: ACCENT });
  page.drawText("KUPAC", { x: 52, y: y - 12, size: 8, font: bold, color: GRAY });
  page.drawText(data.clientName, { x: 52, y: y - 26, size: 12, font: bold, color: NAVY });
  if (data.clientCompany) page.drawText(data.clientCompany, { x: 52, y: y - 40, size: 9, font: reg, color: GRAY });
  if (data.clientEmail) page.drawText(data.clientEmail, { x: 52, y: y - 52, size: 9, font: reg, color: GRAY });

  // Table header
  y -= 90;
  const cols = { rb: 40, name: 65, dim: 300, qty: 375, sides: 415, unit: 460, total: width - 45 };
  page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 20, color: NAVY });
  const th = (t: string, x: number, right = false) => {
    const w = right ? bold.widthOfTextAtSize(t, 9) : 0;
    page.drawText(t, { x: right ? x - w : x, y: y + 4, size: 9, font: bold, color: rgb(1, 1, 1) });
  };
  th("#", cols.rb + 2);
  th("Artikal", cols.name);
  th("Dim (cm)", cols.dim);
  th("Kol.", cols.qty);
  th("Štampa", cols.sides);
  th("Cena/kom", cols.unit + 40, true);
  th("Ukupno", cols.total, true);

  y -= 22;
  data.items.forEach((it, idx) => {
    if (y < 150) {
      drawFooter(page, reg);
      page = doc.addPage([595.28, 841.89]);
      drawHeader(page, bold, reg);
      y = height - 120;
    }
    if (idx % 2 === 1) {
      page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 18, color: rgb(0.97, 0.97, 0.98) });
    }
    const td = (t: string, x: number, right = false) => {
      const w = right ? reg.widthOfTextAtSize(t, 9) : 0;
      page.drawText(t, { x: right ? x - w : x, y: y + 2, size: 9, font: reg, color: NAVY });
    };
    td(String(idx + 1), cols.rb + 4);
    const name = it.materialName.length > 40 ? it.materialName.slice(0, 38) + "…" : it.materialName;
    td(name, cols.name);
    td(`${it.widthCm}×${it.heightCm}`, cols.dim);
    td(String(it.qty), cols.qty);
    td(it.printSides, cols.sides);
    td(fmt(it.unitPrice), cols.unit + 40, true);
    td(fmt(it.lineTotal), cols.total, true);
    y -= 18;
  });

  // Total
  y -= 12;
  page.drawRectangle({ x: width - 260, y: y - 22, width: 220, height: 30, color: NAVY });
  page.drawText("UKUPNO (EUR):", { x: width - 250, y: y - 12, size: 11, font: bold, color: rgb(1, 1, 1) });
  const totalStr = fmt(data.total);
  const tw = bold.widthOfTextAtSize(totalStr, 13);
  page.drawText(totalStr, { x: width - 50 - tw, y: y - 14, size: 13, font: bold, color: ACCENT });

  y -= 45;
  page.drawText("Cene su izražene u evrima bez PDV-a. Ponuda važi 15 dana od datuma izdavanja.", {
    x: 40, y, size: 8, font: reg, color: GRAY,
  });
  y -= 12;
  page.drawText("Rok isporuke i uslovi plaćanja se dogovaraju za svaki posao posebno.", {
    x: 40, y, size: 8, font: reg, color: GRAY,
  });

  // Notes
  if (data.notes && data.notes.trim()) {
    y -= 24;
    page.drawText("Napomena:", { x: 40, y, size: 9, font: bold, color: NAVY });
    y -= 12;
    const wrap = (txt: string, maxW: number) => {
      const words = txt.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const t = cur ? cur + " " + w : w;
        if (reg.widthOfTextAtSize(t, 9) > maxW) { if (cur) lines.push(cur); cur = w; } else { cur = t; }
      }
      if (cur) lines.push(cur);
      return lines;
    };
    for (const l of wrap(data.notes, width - 80)) {
      if (y < 140) break;
      page.drawText(l, { x: 40, y, size: 9, font: reg, color: NAVY });
      y -= 12;
    }
  }

  // Signature
  const sigY = Math.min(y - 40, 130);
  page.drawRectangle({ x: width - 240, y: sigY, width: 200, height: 0.5, color: GRAY });
  page.drawText(data.signer.fullName || "—", { x: width - 240, y: sigY - 14, size: 10, font: bold, color: NAVY });
  if (data.signer.jobTitle) {
    page.drawText(data.signer.jobTitle, { x: width - 240, y: sigY - 26, size: 8, font: reg, color: GRAY });
  }
  const contactParts: string[] = [];
  if (data.signer.phone) contactParts.push(data.signer.phone);
  if (data.signer.email) contactParts.push(data.signer.email);
  if (contactParts.length) {
    page.drawText(contactParts.join(" · "), { x: width - 240, y: sigY - 38, size: 8, font: reg, color: GRAY });
  }

  drawFooter(page, reg);
  return await doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function pdfToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
