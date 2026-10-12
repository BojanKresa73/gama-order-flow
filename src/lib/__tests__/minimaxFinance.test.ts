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
