// Izveštaj za knjigovođu – samo čitanje iz sinhronizovanih podataka (org 79412).
export type IssueCategory = "stari_dug" | "dobavljac" | "dokument" | "prelazni" | "amortizacija" | "zalihe";

export interface Issue {
  key: string;
  category: IssueCategory;
  title: string;
  amount: number | null;
  question: string;
  source: string;
  detail?: string;
}

export const CATEGORY_LABEL: Record<IssueCategory, string> = {
  stari_dug: "Stara potraživanja (početno stanje)",
  dobavljac: "Razlike kod dobavljača",
  dokument: "Dokumenti za proveru",
  prelazni: "Neuparena prelazna knjiženja",
  amortizacija: "Amortizacija",
  zalihe: "Zalihe ploča",
};

const n = (v: unknown) => (v == null || v === "" ? null : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

function docQuestion(d: any): string {
  const reason = String(d.reason ?? "");
  if (reason.startsWith("Nacrt")) return "Da li ovaj nacrt treba proknjižiti ili obrisati u Minimaxu?";
  if (reason.startsWith("Ukupno 0")) return "Kojim avansom ili uplatom je zatvoren ovaj dokument sa iznosom 0 i da li je PDV iz PDV evidencije ispravno iskazan?";
  if (d.currency && d.currency !== "RSD") return "Da li su kurs i PDV evidencija ovog dokumenta u stranoj valuti ispravni?";
  if (reason.startsWith("Nema")) return "Da li je ovaj dokument proknjižen i pod kojim brojem naloga?";
  return "Zašto se PDV evidencija razlikuje od iznosa dokumenta (carina, nepriznati PDV, više stopa) i da li je knjiženje ispravno?";
}

export function buildIssues(c: any, rec: any, pc: any): Issue[] {
  const out: Issue[] = [];
  const fy = rec?.first_year ?? 2025;

  for (const p of rec?.partners?.kupci ?? []) {
    const opening = n(p.opening) ?? 0;
    if (Math.abs(opening) <= 1) continue;
    out.push({
      key: `stari_dug:${p.partner}`, category: "stari_dug", title: p.partner, amount: r2(opening),
      question: `Da li ${p.partner} stvarno duguje ${fmtRsd(opening)} RSD iz perioda pre Minimaxa, ili su njegove uplate trebalo da zatvore taj stari dug umesto novih faktura?`,
      source: `Nalog otvaranja ${fy}, konto 204`,
      detail: `Konto ${fmtRsd(p.ledger)} · otvorene fakture ${fmtRsd(p.docs_open)} · neobjašnjeno ${fmtRsd(p.residual)}`,
    });
  }

  for (const p of rec?.partners?.dobavljaci ?? []) {
    const res = n(p.residual) ?? 0;
    if (Math.abs(res) <= 10) continue;
    out.push({
      key: `dobavljac:${p.partner}`, category: "dobavljac", title: p.partner, amount: r2(res),
      question: `Zašto se stanje dobavljača ${p.partner} na kontu 435 razlikuje od otvorenih faktura za ${fmtRsd(res)} RSD (uplata bez fakture, faktura bez knjiženja ili pogrešan partner)?`,
      source: "Konto 435 i ulazne fakture",
      detail: `Konto ${fmtRsd(p.ledger)} · otvorene fakture ${fmtRsd(p.docs_open)} · početno ${fmtRsd(p.opening)}`,
    });
  }

  for (const d of c?.review ?? []) {
    const j = (d.journals ?? []).map((x: any) => `${x.type} ${x.date}`).join(", ");
    out.push({
      key: `dokument:${d.direction}:${d.minimax_id}`, category: "dokument",
      title: `${d.partner ?? "—"} · ${d.number ?? "—"} · ${d.date ?? "—"}`, amount: n(d.total_rsd),
      question: docQuestion(d),
      source: `Minimax ${d.direction === "issued" ? "izlazni" : "ulazni"} dokument ID ${d.minimax_id}${j ? ` · knjiženja: ${j}` : " · bez knjiženja"}`,
      detail: `${d.reason ?? ""}${d.currency && d.currency !== "RSD" ? ` · valuta ${d.currency}` : ""}`,
    });
  }

  const names: Record<string, string> = {};
  for (const b of rec?.banks ?? []) names[b.code] = b.name;
  const byAcc = new Map<string, { count: number; net: number }>();
  for (const u of rec?.transit?.unpaired ?? []) {
    const a = byAcc.get(u.account) ?? { count: 0, net: 0 };
    a.count += 1; a.net += (u.side === "D" ? 1 : -1) * Number(u.amount);
    byAcc.set(u.account, a);
  }
  for (const [acc, a] of [...byAcc.entries()].sort((x, y) => Math.abs(y[1].net) - Math.abs(x[1].net))) {
    const name = names[acc] ?? "";
    const va = /vazduhoplov/i.test(name);
    out.push({
      key: `prelazni:${acc}`, category: "prelazni", title: `${acc} ${name}`.trim(), amount: r2(a.net),
      question: va
        ? `Na kontu ${acc} (Vazduhoplovna akademija) je ${a.count} neuparenih uplata fizičkih lica preko UniCredit banke, neto ${fmtRsd(a.net)} RSD. Kom kupcu i kojim fakturama treba rasporediti ove uplate?`
        : `Zašto prelazni račun ${acc} nije na nuli (${a.count} neuparenih stavki, neto ${fmtRsd(a.net)} RSD) i sa kojim knjiženjem treba da se zatvori?`,
      source: `Glavna knjiga, konto ${acc}`,
      detail: `${a.count} stavki`,
    });
  }

  if (pc) {
    const dep = n(pc.depreciation_booked) ?? 0;
    if (dep === 0) out.push({
      key: `amortizacija:${pc.year}`, category: "amortizacija", title: `Amortizacija ${pc.year}`, amount: null,
      question: `Kada i u kom iznosu će biti obračunata amortizacija za ${pc.year}. (prethodna godina: ${fmtRsd(pc.depreciation_prev_year)} RSD, knjižena tek 31.12.)?`,
      source: "Glavna knjiga, konta 540",
    });
    if (!pc.inventory_accounts_used) out.push({
      key: `zalihe:${pc.year}`, category: "zalihe", title: "Ploče na lageru", amount: null,
      question: "Nabavka ploča ide direktno u trošak, a konta zaliha se ne koriste. Da li na kraju godine treba evidentirati ploče na lageru kao zalihu i umanjiti trošak?",
      source: "Glavna knjiga, klase 1 i 5",
    });
  }
  return out;
}

export function fmtRsd(v: unknown) {
  return v == null ? "—" : Number(v).toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function categoryTotals(issues: Issue[]) {
  const t: Record<string, { count: number; amount: number }> = {};
  for (const i of issues) {
    const x = (t[i.category] ??= { count: 0, amount: 0 });
    x.count += 1; x.amount = r2(x.amount + (i.amount ?? 0));
  }
  return t;
}

export const PROFIT_WARNING =
  "Privremena računovodstvena dobit prema dostupnim knjiženjima. Nedostaju završni obračuni (amortizacija, porez na dobit, zalihe, razgraničenja). Nije raspoloživ novac niti konačna poreska dobit.";
