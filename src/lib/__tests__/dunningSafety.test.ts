import { describe, it, expect } from "vitest";
import { sumAmounts, summarizeResults } from "../dunning";
import { parsePartnerIds, isValidEmail, isWinningClaim } from "../../../supabase/functions/_shared/dunningRules";

describe("opomene – zbirovi i rezultati", () => {
  it("sabira iznose koji stižu kao tekst", () => {
    const t = sumAmounts([{ open_rsd: "1000.50", overdue_rsd: "200" }, { open_rsd: 99.5, overdue_rsd: null }]);
    expect(t).toEqual({ open: 1100, over: 200 });
  });
  it("ID bez rezultata sa servera je neuspeh", () => {
    const r = summarizeResults([1, 2, 3], [{ id: 1 }, { id: 2, error: "Nema email-a" }]);
    expect(r.sent.map((x) => x.id)).toEqual([1]);
    expect(r.failed.map((x) => x.id)).toEqual([2, 3]);
  });
  it("neispravan odgovor = svi neuspešni", () => expect(summarizeResults([5], undefined).failed).toHaveLength(1));
});

describe("opomene – serverska validacija", () => {
  it("odbija negativan, decimalni i tekstualni ID", () => {
    expect(parsePartnerIds([-1]).error).toBeTruthy();
    expect(parsePartnerIds([1.5]).error).toBeTruthy();
    expect(parsePartnerIds(["abc"]).error).toBeTruthy();
  });
  it("uklanja duplikate ID-jeva", () => expect(parsePartnerIds([7, "7", 8]).ids).toEqual([7, 8]));
  it("najviše 300 kupaca", () => expect(parsePartnerIds(Array.from({ length: 301 }, (_, i) => i + 1)).error).toBeTruthy());
  it("prazan izbor se odbija", () => expect(parsePartnerIds([]).error).toBeTruthy());
  it("email: jedna adresa, bez liste", () => {
    expect(isValidEmail("a@b.rs")).toBe(true);
    expect(isValidEmail("a@b.rs, c@d.rs")).toBe(false);
    expect(isValidEmail("a@b.rs\nBcc: x@y.rs")).toBe(false);
  });
  it("istog dana šalje samo najraniji zahtev", () => {
    const claims = [{ id: "b", sent_at: "2026-10-16T10:00:01Z" }, { id: "a", sent_at: "2026-10-16T10:00:00Z" }];
    expect(isWinningClaim("a", claims)).toBe(true);
    expect(isWinningClaim("b", claims)).toBe(false);
  });
});
