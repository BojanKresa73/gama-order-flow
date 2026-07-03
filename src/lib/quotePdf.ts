import { PDFDocument, rgb, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import notoRegular from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoBold from "@/assets/fonts/NotoSans-Bold.ttf?url";
import memorandumUrl from "@/assets/gama-memorandum.png";

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
  clientPib?: string;
  clientAddress?: string;
  notes?: string;
  items: QuoteItemPdf[];
  total: number;
  signer: QuoteSigner;
}

const NAVY = rgb(0.098, 0.129, 0.243); // #19213e — logo navy
const CYAN = rgb(0.294, 0.749, 0.925); // #4bbfec — logo cyan accent
const INK = rgb(0.11, 0.13, 0.2);
const GRAY = rgb(0.42, 0.45, 0.52);
const SOFT = rgb(0.94, 0.95, 0.97);

const fmt = (n: number) =>
  new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const formatDate = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}.`;
};

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  return await r.arrayBuffer();
}

function drawBackground(page: PDFPage, memo: PDFImage) {
  const { width, height } = page.getSize();
  page.drawImage(memo, { x: 0, y: 0, width, height });
}

// Wrap helper
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxWidth) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let out = clean;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out.trim()}…`;
}

export async function generateQuotePdf(data: QuoteData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regBuf, boldBuf, memoBuf] = await Promise.all([
    fetchBytes(notoRegular),
    fetchBytes(notoBold),
    fetchBytes(memorandumUrl),
  ]);
  const reg = await doc.embedFont(regBuf, { subset: true });
  const bold = await doc.embedFont(boldBuf, { subset: true });
  const memo = await doc.embedPng(memoBuf);

  let page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  drawBackground(page, memo);

  // Safe content area — memorandum has logo top (~90pt) and footer band bottom (~85pt)
  const TOP = height - 130;
  const BOTTOM = 110;
  const LEFT = 55;
  const RIGHT = width - 55;
  const CONTENT_W = RIGHT - LEFT;

  let y = TOP;

  // Title block
  page.drawText("PONUDA", { x: LEFT, y: y - 4, size: 24, font: bold, color: NAVY });
  // Cyan underline accent — a small elegant bar
  page.drawRectangle({ x: LEFT, y: y - 12, width: 44, height: 2.5, color: CYAN });

  // Meta right
  const metaSize = 9;
  const numLabel = "Broj ponude";
  const dateLabel = "Datum";
  const numVal = data.quoteNumber;
  const dateVal = formatDate(data.date);
  const metaX = RIGHT;
  page.drawText(numLabel, {
    x: metaX - reg.widthOfTextAtSize(numLabel, metaSize),
    y: y + 8,
    size: metaSize,
    font: reg,
    color: GRAY,
  });
  page.drawText(numVal, {
    x: metaX - bold.widthOfTextAtSize(numVal, 11),
    y: y - 6,
    size: 11,
    font: bold,
    color: NAVY,
  });
  page.drawText(dateLabel, {
    x: metaX - reg.widthOfTextAtSize(dateLabel, metaSize),
    y: y - 22,
    size: metaSize,
    font: reg,
    color: GRAY,
  });
  page.drawText(dateVal, {
    x: metaX - reg.widthOfTextAtSize(dateVal, 10),
    y: y - 34,
    size: 10,
    font: reg,
    color: INK,
  });

  y -= 50;

  // Client card
  const cardH = 68;
  page.drawRectangle({ x: LEFT, y: y - cardH, width: CONTENT_W, height: cardH, color: SOFT });
  page.drawRectangle({ x: LEFT, y: y - cardH, width: 2.5, height: cardH, color: CYAN });
  page.drawText("KUPAC", { x: LEFT + 14, y: y - 15, size: 8, font: bold, color: GRAY });

  const clientTitle = fit(data.clientCompany || data.clientName, bold, 13, CONTENT_W - 32);
  page.drawText(clientTitle, { x: LEFT + 14, y: y - 32, size: 13, font: bold, color: NAVY });

  const sub: string[] = [];
  if (data.clientCompany && data.clientName) sub.push(data.clientName);
  if (data.clientAddress) sub.push(data.clientAddress);
  if (data.clientPib) sub.push("PIB: " + data.clientPib);
  if (data.clientEmail) sub.push(data.clientEmail);
  if (sub.length) {
    page.drawText(fit(sub.join("  ·  "), reg, 9, CONTENT_W - 32), {
      x: LEFT + 14,
      y: y - 48,
      size: 9,
      font: reg,
      color: GRAY,
    });
  }

  y -= cardH + 20;

  // Table
  const cols = {
    rb: LEFT + 10,
    name: LEFT + 34,
    dim: LEFT + 240,
    qty: LEFT + 300,
    sides: LEFT + 330,
    unit: RIGHT - 64,
    total: RIGHT - 12,
  };

  const drawTableHeader = () => {
    const headerH = 22;
    page.drawRectangle({ x: LEFT, y: y - headerH, width: CONTENT_W, height: headerH, color: NAVY });
    const headerBaseline = y - 14;
    const th = (t: string, x: number, right = false) => {
      const w = right ? bold.widthOfTextAtSize(t, 8) : 0;
      page.drawText(t, { x: right ? x - w : x, y: headerBaseline, size: 8, font: bold, color: rgb(1, 1, 1) });
    };
    th("#", cols.rb);
    th("ARTIKAL", cols.name);
    th("DIM.", cols.dim);
    th("KOL.", cols.qty);
    th("ŠTAMPA", cols.sides);
    th("CENA/KOM", cols.unit, true);
    th("UKUPNO", cols.total, true);
    y -= headerH + 16;
  };

  // Header band
  drawTableHeader();

  const ensurePage = () => {
    if (y < BOTTOM + 80) {
      page = doc.addPage([595.28, 841.89]);
      drawBackground(page, memo);
      y = height - 130;
      drawTableHeader();
    }
  };

  data.items.forEach((it, idx) => {
    ensurePage();
    const rowH = 23;
    if (idx % 2 === 1) {
      page.drawRectangle({ x: LEFT, y: y - 8, width: CONTENT_W, height: rowH, color: rgb(0.97, 0.97, 0.98) });
    }
    const td = (t: string, x: number, right = false, f: PDFFont = reg, size = 9, color = INK) => {
      const w = right ? f.widthOfTextAtSize(t, size) : 0;
      page.drawText(t, { x: right ? x - w : x, y: y, size, font: f, color });
    };
    td(String(idx + 1), cols.rb);
    td(fit(it.materialName, reg, 9, cols.dim - cols.name - 12), cols.name);
    td(`${it.widthCm}×${it.heightCm}`, cols.dim);
    td(String(it.qty), cols.qty);
    td(fit(it.printSides, reg, 9, cols.unit - cols.sides - 48), cols.sides);
    td(fmt(it.unitPrice), cols.unit, true);
    td(fmt(it.lineTotal), cols.total, true, bold, 9, NAVY);
    y -= rowH;
  });

  // Total
  y += 4;
  page.drawRectangle({ x: LEFT, y: y - 2, width: CONTENT_W, height: 0.7, color: NAVY });
  y -= 30;
  const totalBoxW = 230;
  page.drawRectangle({ x: RIGHT - totalBoxW, y: y - 4, width: totalBoxW, height: 32, color: NAVY });
  page.drawRectangle({ x: RIGHT - totalBoxW, y: y - 4, width: 3, height: 32, color: CYAN });
  page.drawText("UKUPNO", {
    x: RIGHT - totalBoxW + 14,
    y: y + 12,
    size: 9,
    font: reg,
    color: rgb(0.75, 0.85, 0.95),
  });
  page.drawText("(bez PDV-a)", {
    x: RIGHT - totalBoxW + 14,
    y: y + 2,
    size: 7.5,
    font: reg,
    color: rgb(0.6, 0.72, 0.85),
  });
  const totalStr = `${fmt(data.total)} EUR`;
  const tw = bold.widthOfTextAtSize(totalStr, 14);
  page.drawText(totalStr, { x: RIGHT - 12 - tw, y: y + 6, size: 14, font: bold, color: rgb(1, 1, 1) });

  y -= 22;
  page.drawText("Cene su izražene u evrima bez PDV-a. Ponuda važi 15 dana od datuma izdavanja.", {
    x: LEFT, y, size: 8.5, font: reg, color: GRAY,
  });
  y -= 12;
  page.drawText("Rok isporuke i uslovi plaćanja se dogovaraju za svaki posao posebno.", {
    x: LEFT, y, size: 8.5, font: reg, color: GRAY,
  });

  if (data.notes && data.notes.trim()) {
    y -= 20;
    ensurePage();
    page.drawText("Napomena", { x: LEFT, y, size: 9, font: bold, color: NAVY });
    y -= 12;
    for (const l of wrap(data.notes, reg, 9, CONTENT_W)) {
      ensurePage();
      page.drawText(l, { x: LEFT, y, size: 9, font: reg, color: INK });
      y -= 12;
    }
  }

  // Signature — bottom right, above memorandum footer
  const sigY = Math.max(BOTTOM + 40, Math.min(y - 40, 200));
  const sigX = RIGHT - 200;
  page.drawRectangle({ x: sigX, y: sigY + 18, width: 200, height: 0.6, color: GRAY });
  page.drawText(data.signer.fullName || "—", { x: sigX, y: sigY + 4, size: 10, font: bold, color: NAVY });
  if (data.signer.jobTitle) {
    page.drawText(data.signer.jobTitle, { x: sigX, y: sigY - 8, size: 8, font: reg, color: GRAY });
  }
  const contactParts: string[] = [];
  if (data.signer.phone) contactParts.push(data.signer.phone);
  if (data.signer.email) contactParts.push(data.signer.email);
  if (contactParts.length) {
    page.drawText(contactParts.join("  ·  "), { x: sigX, y: sigY - 20, size: 8, font: reg, color: GRAY });
  }

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
