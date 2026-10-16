/** Rules for payment reminders (opomene). */
export const isOverdue = (dueDate: string | null, open: number, today: string) =>
  !!dueDate && dueDate < today && open > 0.5;

export const daysLate = (dueDate: string | null, today: string) =>
  dueDate && dueDate < today ? Math.round((Date.parse(today) - Date.parse(dueDate)) / 86400000) : 0;

/** Numeric value of an amount that may arrive as string/null from the database. */
export const toAmount = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

/** Sums open/overdue amounts numerically (never string concatenation). */
export const sumAmounts = (rows: any[]) =>
  rows.reduce((a, p) => ({ open: a.open + toAmount(p?.open_rsd), over: a.over + toAmount(p?.overdue_rsd) }), { open: 0, over: 0 });

export type SendResult = { id: number; partner?: string; to?: string; error?: string | null; warning?: string | null };

/** Splits server results; a missing/invalid result list counts every requested ID as failed. */
export function summarizeResults(requested: number[], results: unknown) {
  const list: SendResult[] = Array.isArray(results) ? results : [];
  const byId = new Map(list.map((r) => [Number(r.id), r]));
  const sent: SendResult[] = [], failed: SendResult[] = [];
  for (const id of requested) {
    const r = byId.get(id);
    if (!r) failed.push({ id, error: "Server nije vratio rezultat" });
    else if (r.error) failed.push(r);
    else sent.push(r);
  }
  return { sent, failed };
}
