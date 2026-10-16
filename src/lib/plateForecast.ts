/** Plate stock forecasting rules: goods in transit count only from their expected arrival day. */
export type Arrival = { inDays: number; qty: number };
export const NO_CONSUMPTION = 999;

const DAY = 86400000;
const dayNum = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / DAY);

/**
 * Splits open procurement orders for one format into dated future arrivals and
 * "uncertain" quantity (no expected date, or expected date already passed but not arrived).
 */
export function pendingForFormat(orders: any[], formatId: string, todayIso: string) {
  const today = dayNum(todayIso);
  const arrivals: Arrival[] = [];
  let uncertain = 0, total = 0;
  for (const o of orders || []) {
    if (!o || o.status === "arrived" || o.status === "cancelled" || o.actual_arrival_date) continue;
    const qty = (o.procurement_order_items || [])
      .filter((i: any) => i?.plate_format_id === formatId)
      .reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
    if (qty <= 0) continue;
    total += qty;
    const exp = o.expected_arrival_date ? dayNum(o.expected_arrival_date) : NaN;
    if (!Number.isFinite(exp) || exp < today) uncertain += qty;
    else arrivals.push({ inDays: exp - today, qty });
  }
  return { arrivals, uncertain, total };
}

/** Days until stockout: physical stock first; a delivery helps only if stock lasts until it arrives. */
export function daysOfCover(stock: number, avgDaily: number, arrivals: Arrival[] = []): number {
  if (!(avgDaily > 0)) return NO_CONSUMPTION;
  let s = Math.max(0, stock || 0), day = 0;
  for (const a of [...arrivals].sort((x, y) => x.inDays - y.inDays)) {
    const runout = day + s / avgDaily;
    if (runout < a.inDays) return runout;
    s -= avgDaily * (a.inDays - day);
    day = a.inDays;
    s += a.qty;
  }
  return day + s / avgDaily;
}

/** Average daily consumption over the window from first entry until today (not until last entry). */
export function avgDailySince(total: number, firstIso: string | null, todayIso: string): { avg: number; days: number } {
  if (!firstIso || !(total > 0)) return { avg: 0, days: 0 };
  const days = Math.max(1, dayNum(todayIso) - dayNum(firstIso) + 1);
  return { avg: total / days, days };
}

/** Loads all rows of a PostgREST query in 1000-row pages (server cap is 1000 per request). */
export async function fetchAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>, size = 1000, max = 100000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}
