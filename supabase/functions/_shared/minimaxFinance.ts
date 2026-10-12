// Pure classification rules for Minimax (Gama United, org 79412) documents.
// Read-only logic; used by the future sync and covered by tests.

export const UNITED_ORG_ID = "79412";
export const BLOCKED_ORG_IDS = ["52515", "51495"] as const; // GDC, Gama Studio

export function assertUnitedOrg(orgId: string | number) {
  const id = String(orgId);
  if (id !== UNITED_ORG_ID) throw new Error(`Zabranjena organizacija ${id}`);
}

export type IssuedKind = "predracun" | "avansni_racun" | "storno" | "knjizno_odobrenje" | "faktura";

export interface IssuedDoc {
  IssuedInvoiceId: number;
  InvoiceType: string; // R | P
  DocumentNumbering?: { Name?: string | null } | null;
  DateCreditNote?: string | null;
  InvoiceValue: number | null; // domestic currency (RSD)
  PaidValue: number | null;
  PaymentStatus?: string | null;
}

export function classifyIssued(d: IssuedDoc): IssuedKind {
  const num = d.DocumentNumbering?.Name ?? "";
  if (d.InvoiceType === "P") return "predracun";
  if (num.startsWith("AR")) return "avansni_racun";
  if (num.toLowerCase().startsWith("storno")) return "storno";
  if (d.DateCreditNote || (d.InvoiceValue ?? 0) < 0) return "knjizno_odobrenje";
  return "faktura";
}

/** Open receivable effect in RSD. null = unknown (never silently 0). */
export function openReceivable(d: IssuedDoc): number | null {
  const k = classifyIssued(d);
  if (k === "predracun" || k === "avansni_racun") return 0; // proforma: no claim; advance: cash already received
  return openAmount(d.InvoiceValue, d.PaidValue);
}

/** Credit notes, storno and proformas are never a cash inflow. Cash comes only from bank journals. */
export function isCashInflow(source: "bank_journal" | IssuedKind): boolean {
  return source === "bank_journal";
}

/** Counts in revenue: invoices + storno/credit notes (negative). Proforma and advance invoices do not
 * (advance is recognised through the final invoice, which deducts the advance row). */
export function countsAsRevenue(k: IssuedKind): boolean {
  return k === "faktura" || k === "storno" || k === "knjizno_odobrenje";
}

export interface VatRow {
  VatBase: number; Vat: number; ServicesVatBase: number; ServicesVat: number;
  NonDeductibleVatBase: number; NonDeductibleVat: number; ServicesNonDeductibleVatBase: number; ServicesNonDeductibleVat: number;
}

export interface VatSummary { base: number | null; vat: number | null; non_deductible: number | null; status: "ok" | "potrebna_provera" }

/** Base/VAT from Minimax VAT records; total must match document total, else "Potrebna provera". */
export function summarizeVat(rows: VatRow[] | null | undefined, totalRsd: number | null): VatSummary {
  if (!rows || !rows.length || totalRsd == null) return { base: null, vat: null, non_deductible: null, status: "potrebna_provera" };
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const base = r2(rows.reduce((a, r) => a + r.VatBase + r.ServicesVatBase, 0));
  const vat = r2(rows.reduce((a, r) => a + r.Vat + r.ServicesVat, 0));
  const nd = r2(rows.reduce((a, r) => a + r.NonDeductibleVatBase + r.NonDeductibleVat + r.ServicesNonDeductibleVatBase + r.ServicesNonDeductibleVat, 0));
  const ok = Math.abs(base + vat + nd - totalRsd) < 0.05;
  return ok ? { base, vat, non_deductible: nd, status: "ok" } : { base: null, vat: null, non_deductible: null, status: "potrebna_provera" };
}

/** Journal ↔ received invoice link: Year-Number alone is NOT unique (advance numbering repeats). */
export function receivedJournalKey(year: number, number: number, docRef: string | null | undefined) {
  return `${year}-${number};${(docRef ?? "").trim()}`;
}
/** Minimax PR descriptions vary: "PR:2025-1;ref", "PR;2025-1;ref", "PR:AR2025-1;ref" (advance numbering). */
export function journalDescriptionKey(desc: string) {
  return desc.trim().replace(/^PR[:;]\s*/, "").replace(/^AR(?=\d{4}-)/, "").trim();
}

/** Idempotent upsert by original Minimax ID. */
export function dedupeKey(kind: "issued" | "received" | "journal", minimaxId: number | string) {
  return `${UNITED_ORG_ID}:${kind}:${minimaxId}`;
}
export function mergeById<T extends { key: string }>(existing: T[], incoming: T[]): T[] {
  const m = new Map(existing.map((e) => [e.key, e]));
  for (const i of incoming) m.set(i.key, i);
  return [...m.values()];
}

/** Line totals are in document currency; InvoiceValue is in RSD. */
export function toRsd(amountDocCurrency: number, exchangeRate: number | null | undefined): number | null {
  if (exchangeRate == null || !(exchangeRate > 0)) return null;
  return Math.round(amountDocCurrency * exchangeRate * 100) / 100;
}

export type ReceivedKind = "nacrt" | "avans_dobavljacu" | "knjizno_odobrenje_dobavljaca" | "faktura";

export interface ReceivedDoc {
  Status?: string | null; InvoiceValue: number | null; InvoiceAmount?: number | null;
  DocumentReference?: string | null; DocumentNumbering?: { Name?: string | null } | null;
}

/** Received docs: draft (O) is never posted; negative = supplier credit note; "avans" numbering = advance to supplier. */
export function classifyReceived(d: ReceivedDoc): ReceivedKind {
  if (d.Status === "O") return "nacrt";
  const v = d.InvoiceValue ?? d.InvoiceAmount ?? 0;
  if (v < 0) return "knjizno_odobrenje_dobavljaca";
  const tag = `${d.DocumentNumbering?.Name ?? ""} ${d.DocumentReference ?? ""}`.toLowerCase();
  if (tag.includes("avans")) return "avans_dobavljacu";
  return "faktura";
}

/** Open payable/receivable from header values; null when unknown (never 0). */
export function openAmount(total: number | null | undefined, paid: number | null | undefined): number | null {
  if (total == null || paid == null) return null;
  // Minimax reports PaidValue as an absolute (closed) amount, also for storno/credit notes with negative totals.
  const open = Math.sign(total) * (Math.abs(total) - Math.abs(paid));
  return Math.round(open * 100) / 100 || 0;
}

/** "4392 - Ostale obaveze" -> "4392" */
export function accountCodeFromName(name: string | null | undefined): string | null {
  const m = /^\s*([0-9]+)\s*-/.exec(name ?? "");
  return m ? m[1] : null;
}

/** Deductible VAT excludes non-deductible VAT. */
export function deductibleVat(s: VatSummary): number | null {
  return s.status === "ok" ? s.vat : null;
}

export interface LedgerRow { year: number; journal_type: string; debit: number; credit: number }

/** Account balance across years without double counting: an opening entry (OTV) in a later year only
 * carries forward rows already present in earlier years, so it is excluded. The first year's OTV is
 * the real pre-Minimax opening balance and stays. side = which side increases the balance. */
export function ledgerBalance(rows: LedgerRow[], side: "debit" | "credit"): number {
  if (!rows.length) return 0;
  const first = Math.min(...rows.map((r) => r.year));
  const s = rows.filter((r) => !(r.journal_type === "OTV" && r.year > first))
    .reduce((a, r) => a + (side === "debit" ? r.debit - r.credit : r.credit - r.debit), 0);
  return Math.round(s * 100) / 100;
}

/** Carry-forward amount that a naive sum would double count. */
export function carriedOpening(rows: LedgerRow[], side: "debit" | "credit"): number {
  if (!rows.length) return 0;
  const first = Math.min(...rows.map((r) => r.year));
  const s = rows.filter((r) => r.journal_type === "OTV" && r.year > first)
    .reduce((a, r) => a + (side === "debit" ? r.debit - r.credit : r.credit - r.debit), 0);
  return Math.round(s * 100) / 100;
}
