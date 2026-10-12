import { describe, it, expect } from "vitest";
import { bankStatus, overall, BankFresh } from "../booksFreshness";

const base: BankFresh = { code: "2410", name: "Tekući", transit: false, booked_balance: 100, last_statement_booked: "2026-10-09", statement: null, booked_at_statement_date: null };
const T = "2026-10-12";

describe("ažurnost izvoda", () => {
  it("bez unetog izvoda je potrebna provera, ne kašnjenje", () => expect(bankStatus(base, T).status).toBe("provera"));
  it("stariji poslednji knjiženi datum sam po sebi ne znači kašnjenje", () => expect(bankStatus({ ...base, last_statement_booked: "2026-08-01" }, T).status).toBe("provera"));
  it("noviji izvod od knjiženog je potvrđeno kašnjenje sa brojem dana", () => {
    const s = bankStatus({ ...base, statement: { date: "2026-10-10" } }, T);
    expect(s.status).toBe("kasnjenje"); expect(s.delayDays).toBe(2);
  });
  it("proknjižen izvod sa istim stanjem je ažurno", () => expect(bankStatus({ ...base, statement: { date: "2026-10-09", balance: 100 }, booked_at_statement_date: 100 }, T).status).toBe("azurno"));
  it("razlika u stanju veća od 1 RSD traži proveru", () => expect(bankStatus({ ...base, statement: { date: "2026-10-09", balance: 150 }, booked_at_statement_date: 100 }, T).status).toBe("provera"));
  it("prelazni račun nema status izvoda", () => expect(bankStatus({ ...base, transit: true }, T).status).toBe("prelazni"));
  it("ažurno do = najraniji poslednji proknjiženi izvod", () => expect(overall([base, { ...base, code: "24101", last_statement_booked: "2026-10-07" }], T).upTo).toBe("2026-10-07"));
});
