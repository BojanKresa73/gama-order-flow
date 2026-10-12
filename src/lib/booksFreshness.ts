// Ažurnost knjigovodstva i bankarskih izvoda – samo čitanje.
export type FreshStatus = "azurno" | "provera" | "kasnjenje" | "prelazni";

export interface BankFresh {
  code: string; name: string; transit: boolean;
  booked_balance: number | null; last_statement_booked: string | null;
  statement: { date: string; number?: string | null; balance?: number | null } | null;
  booked_at_statement_date: number | null;
}

export const STATUS_LABEL: Record<FreshStatus, string> = {
  azurno: "Ažurno", provera: "Potrebna provera", kasnjenje: "Potvrđeno kašnjenje", prelazni: "Prelazni račun",
};

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function bankStatus(b: BankFresh, today: string): { status: FreshStatus; text: string; delayDays: number | null } {
  if (b.transit) return { status: "prelazni", text: "Prelazni račun nema svoj izvod; prati se kroz uparivanje.", delayDays: null };
  if (!b.statement) return { status: "provera", text: "Nije unet poslednji izvod iz banke, pa ne možemo potvrditi da je sve proknjiženo.", delayDays: null };
  const booked = b.last_statement_booked;
  if (!booked || b.statement.date > booked) {
    const d = daysBetween(b.statement.date, today);
    return { status: "kasnjenje", delayDays: d, text: `Izvod od ${b.statement.date} postoji u banci, a u Minimaxu je poslednji proknjižen ${booked ?? "nijedan"}. Kasni ${d} dana.` };
  }
  if (b.statement.balance != null && b.booked_at_statement_date != null && Math.abs(Number(b.statement.balance) - Number(b.booked_at_statement_date)) > 1) {
    return { status: "provera", delayDays: null, text: `Stanje na izvodu ${fmt(b.statement.balance)} a u knjigama na isti dan ${fmt(b.booked_at_statement_date)} – razlika ${fmt(Number(b.statement.balance) - Number(b.booked_at_statement_date))}.` };
  }
  return { status: "azurno", delayDays: null, text: `Izvod od ${b.statement.date} je proknjižen${b.statement.balance != null ? " i stanje se slaže" : ""}.` };
}

export function overall(banks: BankFresh[], today: string) {
  const real = banks.filter((b) => !b.transit);
  const st = real.map((b) => ({ b, s: bankStatus(b, today) }));
  const dates = real.map((b) => b.last_statement_booked).filter(Boolean) as string[];
  const upTo = dates.length ? dates.sort()[0] : null;
  const problems = st.filter((x) => x.s.status !== "azurno");
  return { upTo, complete: problems.length === 0 && real.length > 0, problems };
}

const fmt = (v: unknown) => Number(v).toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
