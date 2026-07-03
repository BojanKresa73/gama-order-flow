import { PDFDocument, rgb, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import notoRegular from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoBold from "@/assets/fonts/NotoSans-Bold.ttf?url";
import memorandumUrl from "@/assets/gama-memorandum.png";
import type { QuoteSigner } from "./quotePdf";

export interface PdfOverlayQuoteData {
  quoteNumber: string;
  date: Date;
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  clientPib?: string;
  clientAddress?: string;
  sourcePdf: ArrayBuffer;
  totalEur?: number | null;
  notes?: string;
  signer: QuoteSigner;
}

const NAVY = rgb(0.098, 0.129, 0.243);
const CYAN = rgb(0.294, 0.749, 0.925);
const INK = rgb(0.11, 0.13, 0.2);
const GRAY = rgb(0.42, 0.45, 0.52);
const SOFT = rgb(0.94, 0.95, 0.97);

const A4: [number, number] = [595.28, 841.89];

const formatDate = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}.`;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  return await r.arrayBuffer();
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let out = clean;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) out = out.slice(0, -1);
  return `${out.trim()}…`;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const tentative = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(tentative, size) <= maxWidth) cur = tentative;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function generatePdfOverlayQuote(data: PdfOverlayQuoteData): Promise<Uint8Array> {
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

  // Load source PDF and embed all its pages
  const srcDoc = await PDFDocument.load(data.sourcePdf, { ignoreEncryption: true });
  const srcCount = srcDoc.getPageCount();
  const embedded = await doc.embedPages(srcDoc.getPages());

  const [PW, PH] = A4;
  const HEADER_INSET = 140;
  const FOOTER_INSET = 110;
  const SIDE_INSET = 55;
  const LEFT = SIDE_INSET;
  const RIGHT = PW - SIDE_INSET;
  const TOP = PH - HEADER_INSET;
  const BOTTOM = FOOTER_INSET;
  const CONTENT_W = RIGHT - LEFT;

  const drawBg = (p: any) => p.drawImage(memo, { x: 0, y: 0, width: PW, height: PH });

  // ————— COVER PAGE —————
  const cover = doc.addPage(A4);
  drawBg(cover);
  let y = TOP;

  cover.drawText("PONUDA", { x: LEFT, y: y - 4, size: 24, font: bold, color: NAVY });
  cover.drawRectangle({ x: LEFT, y: y - 12, width: 44, height: 2.5, color: CYAN });

  const metaSize = 9;
  const numVal = data.quoteNumber;
  const dateVal = formatDate(data.date);
  cover.drawText("Broj ponude", { x: RIGHT - reg.widthOfTextAtSize("Broj ponude", metaSize), y: y + 8, size: metaSize, font: reg, color: GRAY });
  cover.drawText(numVal, { x: RIGHT - bold.widthOfTextAtSize(numVal, 11), y: y - 6, size: 11, font: bold, color: NAVY });
  cover.drawText("Datum", { x: RIGHT - reg.widthOfTextAtSize("Datum", metaSize), y: y - 22, size: metaSize, font: reg, color: GRAY });
  cover.drawText(dateVal, { x: RIGHT - reg.widthOfTextAtSize(dateVal, 10), y: y - 34, size: 10, font: reg, color: INK });

  y -= 50;

  // Client card
  const cardH = 68;
  cover.drawRectangle({ x: LEFT, y: y - cardH, width: CONTENT_W, height: cardH, color: SOFT });
  cover.drawRectangle({ x: LEFT, y: y - cardH, width: 2.5, height: cardH, color: CYAN });
  cover.drawText("KUPAC", { x: LEFT + 14, y: y - 15, size: 8, font: bold, color: GRAY });
  const clientTitle = fit(data.clientCompany || data.clientName, bold, 13, CONTENT_W - 32);
  cover.drawText(clientTitle, { x: LEFT + 14, y: y - 32, size: 13, font: bold, color: NAVY });
  const sub: string[] = [];
  if (data.clientCompany && data.clientName) sub.push(data.clientName);
  if (data.clientAddress) sub.push(data.clientAddress);
  if (data.clientPib) sub.push("PIB: " + data.clientPib);
  if (data.clientEmail) sub.push(data.clientEmail);
  if (sub.length) {
    cover.drawText(fit(sub.join("  ·  "), reg, 9, CONTENT_W - 32), { x: LEFT + 14, y: y - 48, size: 9, font: reg, color: GRAY });
  }
  y -= cardH + 24;

  // Intro line
  cover.drawText("U prilogu ove ponude nalazi se dokument u originalnom formatu.", {
    x: LEFT, y, size: 10.5, font: reg, color: INK,
  });
  y -= 18;
  cover.drawText(`Broj strana priloga: ${srcCount}`, {
    x: LEFT, y, size: 9.5, font: reg, color: GRAY,
  });
  y -= 24;

  // Optional total box
  if (typeof data.totalEur === "number" && data.totalEur > 0) {
    cover.drawRectangle({ x: LEFT, y, width: CONTENT_W, height: 0.7, color: NAVY });
    y -= 30;
    const totalBoxW = 230;
    cover.drawRectangle({ x: RIGHT - totalBoxW, y: y - 4, width: totalBoxW, height: 32, color: NAVY });
    cover.drawRectangle({ x: RIGHT - totalBoxW, y: y - 4, width: 3, height: 32, color: CYAN });
    cover.drawText("UKUPNO", { x: RIGHT - totalBoxW + 14, y: y + 12, size: 9, font: reg, color: rgb(0.75, 0.85, 0.95) });
    cover.drawText("(bez PDV-a)", { x: RIGHT - totalBoxW + 14, y: y + 2, size: 7.5, font: reg, color: rgb(0.6, 0.72, 0.85) });
    const totalStr = `${fmt(data.totalEur)} EUR`;
    const tw = bold.widthOfTextAtSize(totalStr, 14);
    cover.drawText(totalStr, { x: RIGHT - 12 - tw, y: y + 6, size: 14, font: bold, color: rgb(1, 1, 1) });
    y -= 22;
  }

  // Notes
  if (data.notes && data.notes.trim()) {
    y -= 12;
    cover.drawText("Napomena", { x: LEFT, y, size: 9, font: bold, color: NAVY });
    y -= 12;
    for (const line of wrap(data.notes.trim(), reg, 9, CONTENT_W)) {
      if (y < BOTTOM + 60) break;
      cover.drawText(line, { x: LEFT, y, size: 9, font: reg, color: INK });
      y -= 12;
    }
  }

  // Signature (bottom-right on cover)
  const sigY = Math.max(BOTTOM + 40, Math.min(y - 20, 200));
  const sigX = RIGHT - 200;
  cover.drawRectangle({ x: sigX, y: sigY + 18, width: 200, height: 0.6, color: GRAY });
  cover.drawText(data.signer.fullName || "—", { x: sigX, y: sigY + 4, size: 10, font: bold, color: NAVY });
  if (data.signer.jobTitle) {
    cover.drawText(data.signer.jobTitle, { x: sigX, y: sigY - 8, size: 8, font: reg, color: GRAY });
  }
  const contactParts: string[] = [];
  if (data.signer.phone) contactParts.push(data.signer.phone);
  if (data.signer.email) contactParts.push(data.signer.email);
  if (contactParts.length) {
    cover.drawText(contactParts.join("  ·  "), { x: sigX, y: sigY - 20, size: 8, font: reg, color: GRAY });
  }

  // ————— EMBEDDED SOURCE PAGES —————
  const availW = CONTENT_W;
  const availH = TOP - BOTTOM - 20; // small breathing room

  for (let i = 0; i < embedded.length; i++) {
    const ep = embedded[i];
    const p = doc.addPage(A4);
    drawBg(p);

    // Small "Prilog X/N" label under header
    const label = `Prilog — strana ${i + 1}/${srcCount}`;
    p.drawText(label, { x: LEFT, y: TOP + 4, size: 8, font: reg, color: GRAY });

    const srcW = ep.width;
    const srcH = ep.height;
    const scale = Math.min(availW / srcW, availH / srcH, 1);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const x = LEFT + (availW - drawW) / 2;
    const yy = BOTTOM + 10 + (availH - drawH); // top-align inside content area
    p.drawPage(ep, { x, y: yy, width: drawW, height: drawH });
  }

  return await doc.save();
}
