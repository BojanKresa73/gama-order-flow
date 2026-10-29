import { describe, it, expect } from "vitest";
import { jobBaseName, groupEntriesForExport, invoiceJobName, compareOrderNumbers } from "../ctpExportGrouping";

const e = (filename: string, quantity = 4) => ({ filename, quantity, format_name: "745x605" });

describe("CTP grupisanje za izvoz", () => {
  it("dunav: 5 signatura po 4 ploče postaje jedna stavka od 20 ploča", () => {
    const entries = [1, 2, 3, 4, 5].map(n => e(`dunav 745x605 izbori brosura ispravka.p000${n}.pdf`));
    entries.push(e("dunav 745x605 Milijana montaza 129.new.pdf"));
    const g = groupEntriesForExport(entries, () => 1000);
    expect(g).toHaveLength(2);
    expect(g[0].baseName).toBe("dunav 745x605 izbori brosura ispravka");
    expect(g[0].quantity).toBe(20);
    expect(g[1].quantity).toBe(4);
    expect(g[1].merged).toBe(false);
  });
  it("različita cena ne spaja stavke", () => {
    const g = groupEntriesForExport([e("a.p0001.pdf", 1), e("a.p0002.pdf", 2)], x => (x.quantity === 1 ? 1 : 2));
    expect(g).toHaveLength(2);
  });
  it("naziv bez oznake strane ostaje isti", () => {
    expect(jobBaseName("3d print 745x605 hugg0030A.pdf")).toBe("3d print 745x605 hugg0030A");
  });
  it("oznaka Preps se uklanja", () => {
    expect(jobBaseName("Katalog aktivni odmor engleski final__PREPS.p0008.pdf")).toBe("Katalog aktivni odmor engleski final");
  });
  it("prefiks klijent + dimenzija se skida za fakturu", () => {
    expect(invoiceJobName("dunav 745x605 izbori brosura ispravka")).toBe("izbori brosura ispravka");
    expect(invoiceJobName("dunav 745×605 Milijana montaza 129.new")).toBe("Milijana montaza 129.new");
    expect(invoiceJobName("Katalog leto")).toBe("Katalog leto");
  });
  it("nalozi se ređaju po broju", () => {
    const l = ["DIG-2026-000120", "DIG-2026-000045", "DIG-2026-000101"].sort(compareOrderNumbers);
    expect(l).toEqual(["DIG-2026-000045", "DIG-2026-000101", "DIG-2026-000120"]);
  });
});
