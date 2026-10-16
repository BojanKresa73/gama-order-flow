// Pure validation rules for payment reminders (opomene). No Deno/npm imports so vitest can test it.
export const MAX_PARTNERS = 300;
export const LOG_PENDING = "pending";

/** Validates selected Minimax partner IDs: positive safe integers, deduplicated, max 300. */
export function parsePartnerIds(raw: unknown): { ids: number[]; error?: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ids: [], error: "Nije izabran nijedan klijent" };
  if (raw.length > MAX_PARTNERS) return { ids: [], error: `Najviše ${MAX_PARTNERS} klijenata odjednom` };
  const ids: number[] = [];
  for (const v of raw) {
    const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
    if (!Number.isSafeInteger(n) || n <= 0) return { ids: [], error: "Neispravan ID klijenta" };
    if (!ids.includes(n)) ids.push(n);
  }
  return { ids };
}

/** Accepts exactly one plain email address (no lists, spaces or header injection). */
export function isValidEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[A-Za-z]{2,}$/.test(v.trim());
}

/** Start of the given YYYY-MM-DD day in UTC (ISO) — window for "already sent today". */
export const dayStartIso = (today: string) => `${today}T00:00:00Z`;

/** Among same-day real-send claims (sent/pending) for one partner, only the earliest one may send. */
export function isWinningClaim(myId: string, claims: { id: string; sent_at: string }[]): boolean {
  const sorted = [...claims].sort((a, b) => a.sent_at.localeCompare(b.sent_at) || a.id.localeCompare(b.id));
  return sorted.length > 0 && sorted[0].id === myId;
}
