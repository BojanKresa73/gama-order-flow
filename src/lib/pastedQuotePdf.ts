import { PDFDocument, rgb, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import notoRegular from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoBold from "@/assets/fonts/NotoSans-Bold.ttf?url";
import memorandumUrl from "@/assets/gama-memorandum.png";
import type { QuoteSigner } from "./quotePdf";

export interface PastedQuoteData {
  quoteNumber: string;
  date: Date;
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  clientPib?: string;
  clientAddress?: string;
  bodyHtml: string;
  totalEur?: number | null;
  notes?: string;
  signer: QuoteSigner;
}

const NAVY = rgb(0.098, 0.129, 0.243);
const CYAN = rgb(0.294, 0.749, 0.925);
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

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let out = clean;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out.trim()}…`;
}

// ————— HTML → simple block model —————
type Inline = { text: string; bold: boolean; italic: boolean; underline: boolean };
type Cell = { runs: Inline[]; header: boolean; align: "left" | "center" | "right" };
type Block =
  | { kind: "p" | "h1" | "h2" | "h3"; align: "left" | "center" | "right"; runs: Inline[] }
  | { kind: "li"; ordered: boolean; index: number; runs: Inline[] }
  | { kind: "img"; src: string; align: "left" | "center" | "right"; width?: number; height?: number }
  | { kind: "table"; rows: Cell[][] }
  | { kind: "hr" };

function parseHtmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement | null;
  const blocks: Block[] = [];
  if (!root) return blocks;

  const walk = (
    node: Node,
    ctx: { bold: boolean; italic: boolean; underline: boolean; align: "left" | "center" | "right" },
    push: (r: Inline) => void
  ) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || "").replace(/\s+/g, " ");
      if (t) push({ text: t, bold: ctx.bold, italic: ctx.italic, underline: ctx.underline });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const next = { ...ctx };
    if (tag === "b" || tag === "strong") next.bold = true;
    if (tag === "i" || tag === "em") next.italic = true;
    if (tag === "u") next.underline = true;
    for (const c of Array.from(el.childNodes)) walk(c, next, push);
  };

  const alignOf = (el: HTMLElement): "left" | "center" | "right" => {
    const a = (el.style.textAlign || el.getAttribute("align") || "").toLowerCase();
    if (a === "center") return "center";
    if (a === "right") return "right";
    return "left";
  };

  const collectImages = (el: HTMLElement, align: "left" | "center" | "right") => {
    for (const img of Array.from(el.querySelectorAll("img"))) {
      const src = img.getAttribute("src") || "";
      if (!src) continue;
      const w = parseInt(img.getAttribute("width") || "0", 10) || undefined;
      const h = parseInt(img.getAttribute("height") || "0", 10) || undefined;
      blocks.push({ kind: "img", src, align, width: w, height: h });
    }
  };

  const handleBlock = (el: HTMLElement) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "img") {
      const src = el.getAttribute("src") || "";
      if (src) {
        const w = parseInt(el.getAttribute("width") || "0", 10) || undefined;
        const h = parseInt(el.getAttribute("height") || "0", 10) || undefined;
        blocks.push({ kind: "img", src, align: "left", width: w, height: h });
      }
      return;
    }
    if (tag === "ul" || tag === "ol") {
      const ordered = tag === "ol";
      let idx = 0;
      for (const li of Array.from(el.children)) {
        if (li.tagName.toLowerCase() !== "li") continue;
        idx += 1;
        const runs: Inline[] = [];
        walk(li, { bold: false, italic: false, underline: false, align: "left" }, (r) => runs.push(r));
        blocks.push({ kind: "li", ordered, index: idx, runs });
        collectImages(li as HTMLElement, "left");
      }
      return;
    }
    if (tag === "hr") {
      blocks.push({ kind: "hr" });
      return;
    }
    if (tag === "br") {
      blocks.push({ kind: "p", align: "left", runs: [{ text: "", bold: false, italic: false, underline: false }] });
      return;
    }
    if (tag === "table") {
      const rows: Cell[][] = [];
      for (const row of Array.from(el.querySelectorAll("tr"))) {
        const cells: Cell[] = [];
        for (const c of Array.from(row.querySelectorAll("th,td"))) {
          const cellEl = c as HTMLElement;
          const header = cellEl.tagName.toLowerCase() === "th";
          const runs: Inline[] = [];
          walk(cellEl, { bold: header, italic: false, underline: false, align: "left" }, (r) => runs.push(r));
          cells.push({ runs, header, align: alignOf(cellEl) });
        }
        if (cells.length) rows.push(cells);
      }
      if (rows.length) blocks.push({ kind: "table", rows });
      collectImages(el, "left");
      return;
    }
    const kind: Block["kind"] =
      tag === "h1" ? "h1" : tag === "h2" ? "h2" : tag === "h3" ? "h3" : "p";
    const runs: Inline[] = [];
    walk(el, { bold: false, italic: false, underline: false, align: "left" }, (r) => runs.push(r));
    const align = alignOf(el);
    if (runs.some((r) => r.text.trim())) {
      blocks.push({ kind, align, runs } as Block);
    }
    collectImages(el, align);
  };

  for (const c of Array.from(root.childNodes)) {
    if (c.nodeType === Node.ELEMENT_NODE) {
      handleBlock(c as HTMLElement);
    } else if (c.nodeType === Node.TEXT_NODE) {
      const t = (c.textContent || "").trim();
      if (t) blocks.push({ kind: "p", align: "left", runs: [{ text: t, bold: false, italic: false, underline: false }] });
    }
  }
  return blocks;
}

// Word-wrap a sequence of styled runs into visual lines that fit maxWidth
function wrapRuns(
  runs: Inline[],
  reg: PDFFont,
  bold: PDFFont,
  size: number,
  maxWidth: number
): Inline[][] {
  const words: Inline[] = [];
  for (const r of runs) {
    const parts = r.text.split(/(\s+)/);
    for (const p of parts) {
      if (!p) continue;
      words.push({ ...r, text: p });
    }
  }
  const lines: Inline[][] = [];
  let cur: Inline[] = [];
  let curW = 0;
  const widthOf = (w: Inline) => (w.bold ? bold : reg).widthOfTextAtSize(w.text, size);
  for (const w of words) {
    const ww = widthOf(w);
    if (curW + ww > maxWidth && cur.length && w.text.trim()) {
      lines.push(cur);
      cur = [];
      curW = 0;
      if (!w.text.trim()) continue; // skip leading whitespace on new line
    }
    cur.push(w);
    curW += ww;
  }
  if (cur.length) lines.push(cur);
  return lines.length ? lines : [[{ text: "", bold: false, italic: false, underline: false }]];
}

function lineWidth(line: Inline[], reg: PDFFont, bold: PDFFont, size: number) {
  return line.reduce((s, w) => s + (w.bold ? bold : reg).widthOfTextAtSize(w.text, size), 0);
}

export async function generatePastedQuotePdf(data: PastedQuoteData): Promise<Uint8Array> {
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

  const drawBg = (p: PDFPage) => {
    const { width, height } = p.getSize();
    p.drawImage(memo, { x: 0, y: 0, width, height });
  };

  let page = doc.addPage([595.28, 841.89]);
  drawBg(page);
  const { width: PW, height: PH } = page.getSize();

  const HEADER_INSET = 140;
  const FOOTER_INSET = 110;
  const SIDE_INSET = 55;
  const LEFT = SIDE_INSET;
  const RIGHT = PW - SIDE_INSET;
  const TOP = PH - HEADER_INSET;
  const BOTTOM = FOOTER_INSET;
  const CONTENT_W = RIGHT - LEFT;

  let y = TOP;

  // Title + meta (identical to calc quote)
  page.drawText("PONUDA", { x: LEFT, y: y - 4, size: 24, font: bold, color: NAVY });
  page.drawRectangle({ x: LEFT, y: y - 12, width: 44, height: 2.5, color: CYAN });

  const metaSize = 9;
  const numVal = data.quoteNumber;
  const dateVal = formatDate(data.date);
  page.drawText("Broj ponude", { x: RIGHT - reg.widthOfTextAtSize("Broj ponude", metaSize), y: y + 8, size: metaSize, font: reg, color: GRAY });
  page.drawText(numVal, { x: RIGHT - bold.widthOfTextAtSize(numVal, 11), y: y - 6, size: 11, font: bold, color: NAVY });
  page.drawText("Datum", { x: RIGHT - reg.widthOfTextAtSize("Datum", metaSize), y: y - 22, size: metaSize, font: reg, color: GRAY });
  page.drawText(dateVal, { x: RIGHT - reg.widthOfTextAtSize(dateVal, 10), y: y - 34, size: 10, font: reg, color: INK });

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
    page.drawText(fit(sub.join("  ·  "), reg, 9, CONTENT_W - 32), { x: LEFT + 14, y: y - 48, size: 9, font: reg, color: GRAY });
  }

  y -= cardH + 20;

  // ————— Body (parsed HTML) —————
  const blocks = parseHtmlToBlocks(data.bodyHtml || "");
  const BASE = 10.5;

  const ensurePage = (need: number) => {
    if (y - need < BOTTOM + 80) {
      page = doc.addPage([595.28, 841.89]);
      drawBg(page);
      y = TOP;
    }
  };

  const drawLine = (line: Inline[], size: number, x: number, yy: number) => {
    let cx = x;
    for (const run of line) {
      const f = run.bold ? bold : reg;
      page.drawText(run.text, { x: cx, y: yy, size, font: f, color: INK });
      const w = f.widthOfTextAtSize(run.text, size);
      if (run.underline && run.text.trim()) {
        page.drawRectangle({ x: cx, y: yy - 1.5, width: w, height: 0.5, color: INK });
      }
      cx += w;
    }
  };

  // Preload images referenced in blocks (data: URIs and same-origin URLs)
  const imgCache = new Map<string, { img: PDFImage; w: number; h: number } | null>();
  for (const b of blocks) {
    if (b.kind !== "img") continue;
    if (imgCache.has(b.src)) continue;
    try {
      const res = await fetch(b.src);
      const buf = await res.arrayBuffer();
      const head = new Uint8Array(buf).slice(0, 4);
      const isPng = head[0] === 0x89 && head[1] === 0x50;
      const embedded = isPng ? await doc.embedPng(buf) : await doc.embedJpg(buf);
      imgCache.set(b.src, { img: embedded, w: embedded.width, h: embedded.height });
    } catch {
      imgCache.set(b.src, null);
    }
  }

  for (const b of blocks) {
    if (b.kind === "hr") {
      ensurePage(16);
      y -= 6;
      page.drawRectangle({ x: LEFT, y, width: CONTENT_W, height: 0.5, color: GRAY });
      y -= 10;
      continue;
    }

    if (b.kind === "img") {
      const rec = imgCache.get(b.src);
      if (!rec) continue;

      // Convert HTML pixel hints (mammoth/Word export in px) to PDF points (1px ≈ 0.75pt)
      const PX_TO_PT = 0.75;
      const natW = rec.w;
      const natH = rec.h;
      const ratio = natH > 0 ? natW / natH : 1;

      // Detect signature-like images: wide aspect, no explicit dimensions,
      // typically the last image in the body → cap width more tightly.
      const isSignatureLike = !b.width && !b.height && ratio > 2 && ratio < 8;

      // Hard caps
      const MAX_W_DEFAULT = Math.min(CONTENT_W, 360);
      const MAX_W_SIG = Math.min(CONTENT_W, 240);
      const maxW = isSignatureLike ? MAX_W_SIG : MAX_W_DEFAULT;

      // Available vertical space on the current page (leave signature footer area free)
      const availH = Math.max(60, y - (BOTTOM + 60));
      const MAX_H_ABS = 220;
      const maxH = Math.min(MAX_H_ABS, availH);

      // Preferred size from HTML hints if present, otherwise natural size (in pt)
      let w = b.width ? b.width * PX_TO_PT : natW * PX_TO_PT;
      let h = b.height ? b.height * PX_TO_PT : natH * PX_TO_PT;
      // Keep aspect ratio if only one dim provided
      if (b.width && !b.height && ratio > 0) h = w / ratio;
      if (b.height && !b.width && ratio > 0) w = h * ratio;

      // Scale down to fit caps (never scale up above natural pt size to avoid pixelation)
      const scale = Math.min(maxW / w, maxH / h, 1);
      w = w * scale;
      h = h * scale;

      // Placement: default to centered for standalone/signature-like; honor explicit align
      let x: number;
      if (b.align === "right") x = RIGHT - w;
      else if (b.align === "left" && !isSignatureLike) x = LEFT;
      else x = LEFT + (CONTENT_W - w) / 2;

      // Ensure we have room, page-break if not
      ensurePage(h + 14);
      y -= 4;
      y -= h;
      page.drawImage(rec.img, { x, y, width: w, height: h });
      y -= 8;
      continue;
    }


    if (b.kind === "table") {
      const TSIZE = 9;
      const CPAD = 5;
      const LINE_H = TSIZE + 3;
      const nCols = Math.max(...b.rows.map((r) => r.length));
      if (!nCols) continue;
      // Normalize rows to nCols cells
      const rows = b.rows.map((r) => {
        const copy = r.slice();
        while (copy.length < nCols) copy.push({ runs: [], header: false, align: "left" });
        return copy;
      });
      // Compute preferred column widths from longest single word / short content
      const measure = (runs: Inline[], bld: boolean) => {
        const text = runs.map((r) => r.text).join("").replace(/\s+/g, " ").trim();
        const f = bld ? bold : reg;
        return { full: f.widthOfTextAtSize(text, TSIZE), text };
      };
      const colMax = new Array(nCols).fill(0);
      const colMin = new Array(nCols).fill(0);
      for (const r of rows) {
        for (let i = 0; i < nCols; i++) {
          const cell = r[i];
          const { full, text } = measure(cell.runs, cell.header);
          colMax[i] = Math.max(colMax[i], full + CPAD * 2);
          const longestWord = text.split(/\s+/).reduce((m, w) => {
            const ww = (cell.header ? bold : reg).widthOfTextAtSize(w, TSIZE);
            return Math.max(m, ww);
          }, 0);
          colMin[i] = Math.max(colMin[i], longestWord + CPAD * 2);
        }
      }
      // Fit to CONTENT_W: start from colMax, shrink largest columns down to colMin
      let widths = colMax.slice();
      const total = () => widths.reduce((s, w) => s + w, 0);
      while (total() > CONTENT_W) {
        // find widest column above its min
        let idx = -1, best = 0;
        for (let i = 0; i < nCols; i++) {
          const room = widths[i] - colMin[i];
          if (room > best) { best = room; idx = i; }
        }
        if (idx < 0) break;
        const overflow = total() - CONTENT_W;
        widths[idx] = Math.max(colMin[idx], widths[idx] - Math.min(overflow, best));
      }
      // If still smaller than CONTENT_W, scale up proportionally
      const t2 = total();
      if (t2 < CONTENT_W && t2 > 0) {
        const scale = CONTENT_W / t2;
        widths = widths.map((w) => w * scale);
      }

      // Wrap each cell into lines according to its column width
      const wrapCells = (r: Cell[]) =>
        r.map((cell, i) => {
          const maxW = widths[i] - CPAD * 2;
          return wrapRuns(cell.runs, reg, bold, TSIZE, Math.max(maxW, 20));
        });

      y -= 6;
      for (let ri = 0; ri < rows.length; ri++) {
        const r = rows[ri];
        const wrapped = wrapCells(r);
        const rowH = Math.max(LINE_H, ...wrapped.map((ls) => ls.length * LINE_H)) + CPAD;
        ensurePage(rowH + 4);
        // Background for header row
        const isHeaderRow = r.every((c) => c.header) || (ri === 0 && r.some((c) => c.header));
        if (isHeaderRow) {
          page.drawRectangle({ x: LEFT, y: y - rowH, width: CONTENT_W, height: rowH, color: SOFT });
        }
        // Cell content + right border
        let cx = LEFT;
        for (let i = 0; i < nCols; i++) {
          const cw = widths[i];
          const cell = r[i];
          const lines = wrapped[i];
          let ty = y - CPAD - TSIZE;
          for (const line of lines) {
            let tx = cx + CPAD;
            if (cell.align === "center") {
              const lw = lineWidth(line, reg, bold, TSIZE);
              tx = cx + (cw - lw) / 2;
            } else if (cell.align === "right") {
              const lw = lineWidth(line, reg, bold, TSIZE);
              tx = cx + cw - CPAD - lw;
            }
            for (const run of line) {
              const f = (run.bold || cell.header) ? bold : reg;
              page.drawText(run.text, { x: tx, y: ty, size: TSIZE, font: f, color: INK });
              tx += f.widthOfTextAtSize(run.text, TSIZE);
            }
            ty -= LINE_H;
          }
          cx += cw;
        }
        // Borders: bottom + outer verticals
        const bColor = rgb(0.82, 0.85, 0.9);
        page.drawRectangle({ x: LEFT, y: y - rowH, width: CONTENT_W, height: 0.5, color: bColor });
        let vx = LEFT;
        for (let i = 0; i <= nCols; i++) {
          page.drawRectangle({ x: vx, y: y - rowH, width: 0.5, height: rowH, color: bColor });
          if (i < nCols) vx += widths[i];
        }
        if (ri === 0) {
          page.drawRectangle({ x: LEFT, y, width: CONTENT_W, height: 0.5, color: bColor });
        }
        y -= rowH;
      }
      y -= 6;
      continue;
    }


    let size = BASE;
    let leadingBefore = 6;
    let leadingAfter = 4;
    if (b.kind === "h1") { size = 18; leadingBefore = 12; leadingAfter = 6; }
    else if (b.kind === "h2") { size = 15; leadingBefore = 10; leadingAfter = 5; }
    else if (b.kind === "h3") { size = 12.5; leadingBefore = 8; leadingAfter = 4; }

    // Bold-ify entire heading
    const runs = b.kind === "h1" || b.kind === "h2" || b.kind === "h3"
      ? (b as any).runs.map((r: Inline) => ({ ...r, bold: true }))
      : (b as any).runs;

    const indent = b.kind === "li" ? 22 : 0;
    const maxW = CONTENT_W - indent;
    const lines = wrapRuns(runs, reg, bold, size, maxW);

    y -= leadingBefore;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      ensurePage(size + 4);
      let x = LEFT + indent;
      const align = (b as any).align as "left" | "center" | "right" | undefined;
      if (align === "center" || align === "right") {
        const lw = lineWidth(line, reg, bold, size);
        if (align === "center") x = LEFT + (CONTENT_W - lw) / 2;
        else x = RIGHT - lw;
      }
      if (b.kind === "li" && i === 0) {
        const marker = b.ordered ? `${b.index}.` : "•";
        page.drawText(marker, { x: LEFT + 4, y, size, font: reg, color: INK });
      }
      drawLine(line, size, x, y);
      y -= size + 4;
    }
    y -= leadingAfter;
  }

  // Total box (optional)
  if (typeof data.totalEur === "number" && data.totalEur > 0) {
    ensurePage(60);
    y -= 10;
    page.drawRectangle({ x: LEFT, y, width: CONTENT_W, height: 0.7, color: NAVY });
    y -= 30;
    const totalBoxW = 230;
    page.drawRectangle({ x: RIGHT - totalBoxW, y: y - 4, width: totalBoxW, height: 32, color: NAVY });
    page.drawRectangle({ x: RIGHT - totalBoxW, y: y - 4, width: 3, height: 32, color: CYAN });
    page.drawText("UKUPNO", { x: RIGHT - totalBoxW + 14, y: y + 12, size: 9, font: reg, color: rgb(0.75, 0.85, 0.95) });
    page.drawText("(bez PDV-a)", { x: RIGHT - totalBoxW + 14, y: y + 2, size: 7.5, font: reg, color: rgb(0.6, 0.72, 0.85) });
    const totalStr = `${fmt(data.totalEur)} EUR`;
    const tw = bold.widthOfTextAtSize(totalStr, 14);
    page.drawText(totalStr, { x: RIGHT - 12 - tw, y: y + 6, size: 14, font: bold, color: rgb(1, 1, 1) });
    y -= 22;
  }

  if (data.notes && data.notes.trim()) {
    ensurePage(30);
    y -= 10;
    page.drawText("Napomena", { x: LEFT, y, size: 9, font: bold, color: NAVY });
    y -= 12;
    const lines = wrapRuns(
      [{ text: data.notes, bold: false, italic: false, underline: false }],
      reg, bold, 9, CONTENT_W
    );
    for (const line of lines) {
      ensurePage(14);
      drawLine(line, 9, LEFT, y);
      y -= 12;
    }
  }

  // Signature bottom-right
  const sigY = Math.max(BOTTOM + 40, Math.min(y - 30, 200));
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
