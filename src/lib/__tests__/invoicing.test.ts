import { describe, it, expect } from "vitest";
import { isStaleUninvoiced, updateOutcome } from "../invoicing";
import { dayStartIso, isUniqueViolation } from "../../../supabase/functions/_shared/dunningRules";

const now = new Date("2026-10-16T12:00:00Z");
const base = { status: "closed", invoiced_at: null, invalidated_at: null, deleted_at: null };

describe("nefakturisani nalozi stariji od 10 dana", () => {
  it("zatvoren pre 11 dana, nefakturisan = da", () => expect(isStaleUninvoiced({ ...base, closed_at: "2026-10-05T12:00:00Z" }, now)).toBe(true));
  it("zatvoren pre 9 dana = ne", () => expect(isStaleUninvoiced({ ...base, closed_at: "2026-10-07T12:00:00Z" }, now)).toBe(false));
  it("otvoren nalog = ne", () => expect(isStaleUninvoiced({ ...base, status: "open", closed_at: "2026-09-01T00:00:00Z" }, now)).toBe(false));
  it("poništen nalog = ne", () => expect(isStaleUninvoiced({ ...base, invalidated_at: "2026-09-02", closed_at: "2026-09-01T00:00:00Z" }, now)).toBe(false));
  it("fakturisan = ne", () => expect(isStaleUninvoiced({ ...base, invoiced_at: "2026-09-03", closed_at: "2026-09-01T00:00:00Z" }, now)).toBe(false));
  it("izmena bez vraćenih redova = ništa nije sačuvano", () => expect(updateOutcome(3, [])).toEqual({ changed: 0, skipped: 3 }));
});

describe("opomene – beogradski dan", () => {
  it("leto: ponoć u Beogradu = 22:00 UTC prethodnog dana", () => expect(dayStartIso("2026-07-10")).toBe("2026-07-09T22:00:00.000Z"));
  it("zima: ponoć u Beogradu = 23:00 UTC prethodnog dana", () => expect(dayStartIso("2026-12-10")).toBe("2026-12-09T23:00:00.000Z"));
  it("duplikat u bazi se prepoznaje", () => expect(isUniqueViolation({ code: "23505" })).toBe(true));
});
