import { describe, it, expect } from "vitest";
import { daysOfCover, pendingForFormat, avgDailySince, fetchAllPages } from "../plateForecast";

const today = "2026-10-16";
const order = (exp: string | null, qty: number, status = "ordered") =>
  ({ status, expected_arrival_date: exp, procurement_order_items: [{ plate_format_id: "F", quantity: qty }] });

describe("lager i roba na putu", () => {
  it("bez potrošnje = 999", () => expect(daysOfCover(100, 0)).toBe(999));
  it("samo fizički lager", () => expect(daysOfCover(100, 10)).toBe(10));
  it("pošiljka posle nestanka lagera ne produžava pokrivenost", () =>
    expect(daysOfCover(100, 10, [{ inDays: 30, qty: 1000 }])).toBe(10));
  it("pošiljka pre nestanka lagera se dodaje", () =>
    expect(daysOfCover(100, 10, [{ inDays: 5, qty: 100 }])).toBe(20));
  it("negativan lager se računa kao 0", () => expect(daysOfCover(-50, 10)).toBe(0));
  it("porudžbina bez datuma ili sa prošlim rokom nije dostupna", () => {
    const r = pendingForFormat([order(null, 10), order("2026-10-01", 20), order("2026-11-15", 30), order("2026-11-01", 5, "arrived")], "F", today);
    expect(r.total).toBe(60);
    expect(r.uncertain).toBe(30);
    expect(r.arrivals).toEqual([{ inDays: 30, qty: 30 }]);
  });
});

describe("potrošnja iz istorije lagera", () => {
  it("prosek se deli do danas, ne do poslednjeg unosa", () =>
    expect(avgDailySince(100, "2026-10-07", today)).toEqual({ avg: 10, days: 10 }));
  it("bez unosa = 0", () => expect(avgDailySince(0, null, today).avg).toBe(0));
  it("učitava sve stranice preko 1000 redova", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const all = await fetchAllPages<number>(async (f, t) => ({ data: rows.slice(f, t + 1), error: null }));
    expect(all).toHaveLength(2500);
  });
});
