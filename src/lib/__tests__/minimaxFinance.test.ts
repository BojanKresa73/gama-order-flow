import { describe, it, expect } from "vitest";
import {
  assertUnitedOrg, classifyIssued, openReceivable, isCashInflow, countsAsRevenue,
  summarizeVat, receivedJournalKey, journalDescriptionKey, dedupeKey, mergeById, toRsd,
} from "../minimaxFinance";

const doc = (o: any) => ({ IssuedInvoiceId: 1, InvoiceType: "R", DocumentNumbering: { Name: "IR-" }, InvoiceValue: 100, PaidValue: 0, ...o });
const vr = (o: any = {}) => ({ VatBase: 0, Vat: 0, ServicesVatBase: 0, ServicesVat: 0, NonDeductibleVatBase: 0, NonDeductibleVat: 0, ServicesNonDeductibleVatBase: 0, ServicesNonDeductibleVat: 0, ...o });

describe("organizacija", () => {
  it("dozvoljava samo 79412", () => expect(() => assertUnitedOrg("79412")).not.toThrow());
  it("odbija GDC 52515", () => expect(() => assertUnitedOrg("52515")).toThrow());
  it("odbija Gama Studio 51495", () => expect(() => assertUnitedOrg(51495)).toThrow());
});

describe("vrste dokumenata", () => {
  it("predračun je odvojen", () => expect(classifyIssued(doc({ InvoiceType: "P", DocumentNumbering: null }))).toBe("predracun"));
  it("AR- je avansni račun", () => expect(classifyIssued(doc({ DocumentNumbering: { Name: "AR-" }, InvoiceValue: 0 }))).toBe("avansni_racun"));
  it("Storno numeracija je storno", () => expect(classifyIssued(doc({ DocumentNumbering: { Name: "Storno" }, InvoiceValue: -32361.66 }))).toBe("storno"));
  it("negativan IR sa datumom odobrenja je knjižno odobrenje", () =>
    expect(classifyIssued(doc({ InvoiceValue: -56445.49, DateCreditNote: "2025-10-24" }))).toBe("knjizno_odobrenje"));
  it("predračun i avansni račun ne ulaze u prihod", () => {
    expect(countsAsRevenue("predracun")).toBe(false);
    expect(countsAsRevenue("avansni_racun")).toBe(false);
  });
});

describe("potraživanja i novac", () => {
  it("avans se ne računa dva puta: avansni račun ne pravi potraživanje", () =>
    expect(openReceivable(doc({ DocumentNumbering: { Name: "AR-" }, InvoiceValue: 0, PaidValue: 0 }))).toBe(0));
  it("knjižno odobrenje nije novčani priliv", () => expect(isCashInflow("knjizno_odobrenje")).toBe(false));
  it("storno nije novčani priliv", () => expect(isCashInflow("storno")).toBe(false));
  it("samo izvod banke je priliv", () => expect(isCashInflow("bank_journal")).toBe(true));
  it("nedostajući iznos nije nula", () => expect(openReceivable(doc({ PaidValue: null }))).toBeNull());
});

describe("PDV ulaznih faktura", () => {
  it("osnovica i PDV iz PDV evidencije (Grafikum 54.560,40)", () =>
    expect(summarizeVat([vr({ VatBase: 45467, Vat: 9093.4 })], 54560.4)).toEqual({ base: 45467, vat: 9093.4, non_deductible: 0, status: "ok" }));
  it("nepriznat PDV se čuva posebno", () =>
    expect(summarizeVat([vr({ NonDeductibleVatBase: 156.67, NonDeductibleVat: 31.33 })], 188).non_deductible).toBe(188));
  it("bez PDV evidencije -> Potrebna provera, ne nula", () =>
    expect(summarizeVat([], 1000)).toEqual({ base: null, vat: null, non_deductible: null, status: "potrebna_provera" }));
  it("zbir se ne slaže -> Potrebna provera", () =>
    expect(summarizeVat([vr({ VatBase: 153243.73 })], 0).status).toBe("potrebna_provera"));
});

describe("povezivanje i duplikati", () => {
  it("broj+referenca razlikuje dva dokumenta 2025-1", () =>
    expect(receivedJournalKey(2025, 1, "25-3A1-000531")).not.toBe(receivedJournalKey(2025, 1, "25-3C1-000159")));
  it("opis knjiženja sa i bez PR: daje isti ključ", () =>
    expect(journalDescriptionKey("PR:2025-1;25-3A1-000531")).toBe(receivedJournalKey(2025, 1, "25-3A1-000531")));
  it("ponovni uvoz ne duplira", () => {
    const a = [{ key: dedupeKey("issued", 16181991), v: 1 }];
    expect(mergeById(a, [{ key: dedupeKey("issued", 16181991), v: 2 }])).toHaveLength(1);
  });
  it("EUR stavke se preračunavaju po kursu dokumenta (110 € × 117,3875)", () => expect(toRsd(110, 117.3875)).toBe(12912.63));
  it("bez kursa nema iznosa", () => expect(toRsd(110, null)).toBeNull());
});

import { classifyReceived, openAmount, accountCodeFromName, deductibleVat } from "../minimaxFinance";
import { readFileSync } from "node:fs";

describe("ulazni dokumenti i sinhronizacija", () => {
  it("nacrt nije faktura", () => expect(classifyReceived({ Status: "O", InvoiceValue: 100 })).toBe("nacrt"));
  it("negativan ulazni = odobrenje dobavljača", () => expect(classifyReceived({ Status: "P", InvoiceValue: -500 })).toBe("knjizno_odobrenje_dobavljaca"));
  it("avans dobavljaču", () => expect(classifyReceived({ Status: "P", InvoiceValue: 10, DocumentReference: "Avans 12" })).toBe("avans_dobavljacu"));
  it("nepoznato plaćeno -> otvoreno je null", () => expect(openAmount(1000, null)).toBeNull());
  it("otvoreno = ukupno - plaćeno", () => expect(openAmount(1000, 400)).toBe(600));
  it("zatvoren storno nije dvostruko otvoren", () => expect(openAmount(-32361.66, 32361.66)).toBe(0));
  it("delimično zatvoreno odobrenje ostaje negativno", () => expect(openAmount(-1000, 400)).toBe(-600));
  it("šifra konta iz naziva", () => expect(accountCodeFromName("4392 - Ostale obaveze iz poslovanja")).toBe("4392"));
  it("nepriznati PDV nije odbitni", () => {
    const s = summarizeVat([{ VatBase: 100, Vat: 20, ServicesVatBase: 0, ServicesVat: 0, NonDeductibleVatBase: 0, NonDeductibleVat: 10, ServicesNonDeductibleVatBase: 0, ServicesNonDeductibleVat: 0 }], 130);
    expect(deductibleVat(s)).toBe(20);
  });
  it("serverska kopija pravila je identična testiranoj", () =>
    expect(readFileSync("supabase/functions/_shared/minimaxFinance.ts", "utf8")).toBe(readFileSync("src/lib/minimaxFinance.ts", "utf8")));
});

import { ledgerBalance, carriedOpening, classifyIssued as ci2, openReceivable as or2 } from "../minimaxFinance";
describe("bez duplog računanja", () => {
  // Konto 204: početno 2025 = 100, faktura 2025 = 50, ista faktura preneta 01.01.2026 (OTV) = 50, faktura 2026 = 30
  const rows = [
    { year: 2025, journal_type: "OTV", debit: 100, credit: 0 },
    { year: 2025, journal_type: "IR", debit: 50, credit: 0 },
    { year: 2026, journal_type: "OTV", debit: 50, credit: 0 },
    { year: 2026, journal_type: "IR", debit: 30, credit: 0 },
  ];
  it("preneta faktura iz 2025 se ne računa dvaput", () => expect(ledgerBalance(rows, "debit")).toBe(180));
  it("prvo početno stanje ostaje uključeno", () => expect(ledgerBalance(rows.slice(0, 1), "debit")).toBe(100));
  it("iznos duplog prenosa je izdvojen", () => expect(carriedOpening(rows, "debit")).toBe(50));
  it("obaveze (potražna strana) isto", () =>
    expect(ledgerBalance(rows.map((r) => ({ ...r, debit: r.credit, credit: r.debit })), "credit")).toBe(180));
  it("PR opis sa ; i AR prefiksom se povezuje", () => {
    expect(journalDescriptionKey("PR;2025-138;GCEMEARSD0000212839")).toBe("2025-138;GCEMEARSD0000212839");
    expect(journalDescriptionKey("PR:AR2025-1;25-3C1-000159")).toBe("2025-1;25-3C1-000159");
  });
  it("storno i originalna faktura se ne zatvaraju dvaput", () => {
    const f = { IssuedInvoiceId: 1, InvoiceType: "R", DocumentNumbering: { Name: "IR" }, InvoiceValue: 1000, PaidValue: 1000 };
    const st = { IssuedInvoiceId: 2, InvoiceType: "R", DocumentNumbering: { Name: "Storno" }, InvoiceValue: -1000, PaidValue: 1000 };
    expect(ci2(st)).toBe("storno");
    expect((or2(f) ?? 0) + (or2(st) ?? 0)).toBe(0);
  });
});
