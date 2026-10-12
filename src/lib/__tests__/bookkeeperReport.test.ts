import { describe, it, expect } from "vitest";
import { buildIssues, categoryTotals } from "../bookkeeperReport";

const rec = {
  first_year: 2025,
  partners: {
    kupci: [{ partner: "Birograf", opening: 620000, ledger: 1, docs_open: 1, residual: 0 }, { partner: "Bez starog", opening: 0, residual: 0 }],
    dobavljaci: [{ partner: "Intra", residual: 161040 }, { partner: "OK", residual: 5 }],
  },
  banks: [{ code: "24192", name: "Vazduhoplovna akademija" }],
  transit: { unpaired: [{ account: "24192", side: "P", amount: 100 }, { account: "24192", side: "D", amount: 30 }] },
};
const c = { review: [{ direction: "received", minimax_id: 1, partner: "X", number: "1", total_rsd: 50, reason: "Nacrt", journals: [] }] };
const pc = { year: 2026, depreciation_booked: 0, inventory_accounts_used: 0 };

describe("izveštaj za knjigovođu", () => {
  const issues = buildIssues(c, rec, pc);
  it("stari dug samo za kupce sa početnim stanjem", () => expect(issues.filter((i) => i.category === "stari_dug").map((i) => i.title)).toEqual(["Birograf"]));
  it("dobavljač samo kad je razlika veća od 10 RSD", () => expect(issues.filter((i) => i.category === "dobavljac").map((i) => i.amount)).toEqual([161040]));
  it("prelazne stavke se neto sabiraju po kontu", () => expect(issues.find((i) => i.key === "prelazni:24192")?.amount).toBe(-70));
  it("Vazduhoplovna akademija dobija posebno pitanje", () => expect(issues.find((i) => i.key === "prelazni:24192")?.question).toMatch(/Vazduhoplovna/));
  it("amortizacija i zalihe se dodaju kad nisu knjižene", () => expect(issues.filter((i) => ["amortizacija", "zalihe"].includes(i.category)).length).toBe(2));
  it("svaki problem ima pitanje", () => expect(issues.every((i) => i.question.endsWith("?"))).toBe(true));
  it("zbir po oblastima", () => expect(categoryTotals(issues).dokument).toEqual({ count: 1, amount: 50 }));
});
