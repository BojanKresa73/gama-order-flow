import * as XLSX from "xlsx";
import { PDFDocument, rgb, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import notoRegular from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoBold from "@/assets/fonts/NotoSans-Bold.ttf?url";
import { CATEGORY_LABEL, Issue, categoryTotals, fmtRsd, PROFIT_WARNING } from "./bookkeeperReport";

type Res = Record<string, { confirmation_document: string; confirmed_on: string; note?: string | null }>;

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function exportExcel(issues: Issue[], res: Res, profit: { year: number; result: number } | null, date: string) {
  const wb = XLSX.utils.book_new();
  const t = categoryTotals(issues);
  const summary: any[][] = [["Gama United – izveštaj za knjigovođu", date], ["Minimax organizacija 79412, samo čitanje"], [],
    ["Oblast", "Broj", "Iznos RSD", "Razjašnjeno"]];
  for (const k of Object.keys(CATEGORY_LABEL)) {
    const items = issues.filter((i) => i.category === k);
    summary.push([CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL], t[k]?.count ?? 0, t[k]?.amount ?? 0, items.filter((i) => res[i.key]).length]);
  }
  if (profit) summary.push([], [`Privremena dobit ${profit.year}`, "", profit.result], [PROFIT_WARNING]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Sažetak");
  const rows = issues.map((i) => ({
    Oblast: CATEGORY_LABEL[i.category], Stavka: i.title, "Iznos RSD": i.amount, Pitanje: i.question,
    Izvor: i.source, Detalji: i.detail ?? "", Status: res[i.key] ? "Razjašnjeno" : "Otvoreno",
    "Dokument potvrde": res[i.key]?.confirmation_document ?? "", "Datum potvrde": res[i.key]?.confirmed_on ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 40 }, { wch: 16 }, { wch: 80 }, { wch: 45 }, { wch: 45 }, { wch: 12 }, { wch: 25 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, "Pitanja");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Gama_United_izvestaj_knjigovodja_${date}.xlsx`);
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []; let cur = "";
  for (const w of text.split(/\s+/)) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > width && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function exportPdf(issues: Issue[], res: Res, profit: { year: number; result: number } | null, date: string) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const [rb, bb] = await Promise.all([fetch(notoRegular).then((r) => r.arrayBuffer()), fetch(notoBold).then((r) => r.arrayBuffer())]);
  const f = await pdf.embedFont(rb, { subset: true }), b = await pdf.embedFont(bb, { subset: true });
  const W = 595, H = 842, M = 40, CW = W - 2 * M;
  let page = pdf.addPage([W, H]); let y = H - M;
  const need = (h: number) => { if (y - h < M) { page = pdf.addPage([W, H]); y = H - M; } };
  const text = (s: string, font = f, size = 9, color = rgb(0, 0, 0), indent = 0) => {
    for (const l of wrap(s, font, size, CW - indent)) { need(size + 3); page.drawText(l, { x: M + indent, y: y - size, size, font, color }); y -= size + 3; }
  };
  text("Gama United – izveštaj za knjigovođu", b, 15); text(`Datum: ${date} · Minimax organizacija 79412 · samo čitanje, izvorna knjiženja nisu menjana`, f, 8, rgb(0.35, 0.35, 0.35)); y -= 6;
  const t = categoryTotals(issues);
  for (const k of Object.keys(CATEGORY_LABEL)) {
    const items = issues.filter((i) => i.category === k);
    text(`${CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL]}: ${t[k]?.count ?? 0} stavki, ${items.some((i) => i.amount != null) ? fmtRsd(t[k]?.amount ?? 0) + " RSD" : "iznos nije poznat"}, razjašnjeno ${items.filter((i) => res[i.key]).length}`, f, 9);
  }
  if (profit) { y -= 4; text(`Privremena dobit ${profit.year}: ${fmtRsd(profit.result)} RSD`, b, 10); text(PROFIT_WARNING, f, 8, rgb(0.7, 0.1, 0.1)); }
  for (const k of Object.keys(CATEGORY_LABEL)) {
    const items = issues.filter((i) => i.category === k);
    if (!items.length) continue;
    y -= 10; need(40); text(CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL], b, 12);
    items.forEach((i, idx) => {
      y -= 3; need(50);
      text(`${idx + 1}. ${i.title}${i.amount != null ? ` – ${fmtRsd(i.amount)} RSD` : ""}${res[i.key] ? "  [RAZJAŠNJENO]" : ""}`, b, 9);
      text(`Pitanje: ${i.question}`, f, 8.5, rgb(0, 0, 0), 10);
      text(`Izvor: ${i.source}${i.detail ? ` · ${i.detail}` : ""}`, f, 7.5, rgb(0.4, 0.4, 0.4), 10);
      if (res[i.key]) text(`Potvrda: ${res[i.key].confirmation_document}, ${res[i.key].confirmed_on}`, f, 7.5, rgb(0.1, 0.45, 0.2), 10);
    });
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`Strana ${i + 1} / ${pages.length}`, { x: W - M - 60, y: 20, size: 7, font: f, color: rgb(0.5, 0.5, 0.5) }));
  download(new Blob([(await pdf.save()).slice().buffer as ArrayBuffer], { type: "application/pdf" }), `Gama_United_izvestaj_knjigovodja_${date}.pdf`);
}
