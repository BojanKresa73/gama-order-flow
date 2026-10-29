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

import { jobBaseName as jb2, groupEntriesForExport as g2 } from "../ctpExportGrouping";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("brojač tabaka", () => {
  i2("spaja 'tabaci 01.new' ... 'tabaci 26.new' u jednu stavku", () => {
    const entries = Array.from({ length: 26 }, (_, k) => ({
      filename: `26512_ed_primary st 1 2027_tabaci ${String(k + 1).padStart(2, "0")}.new.pdf`,
      quantity: 4, format_name: "745x605",
    }));
    const g = g2(entries, () => 100);
    e2(g).toHaveLength(1);
    e2(g[0].quantity).toBe(104);
    e2(g[0].baseName).toBe("26512_ed_primary st 1 2027_tabaci");
  });
  i2("ne dira godinu u nazivu", () => {
    e2(jb2("26500_ED_eaq 1-2027 large_tabaci.pdf")).toBe("26500_ED_eaq 1-2027 large_tabaci");
  });
});

import { jobBaseName as jb3, groupEntriesForExport as g3 } from "../ctpExportGrouping";
import { describe as d3, it as i3, expect as e3 } from "vitest";
d3("oznaka Copy", () => {
  i3("Copy ostaje u nazivu posla", () => {
    e3(jb3("70.007 - Copy.pdf")).toBe("70.007 - Copy");
    e3(jb3("70.007 - Copy.new.pdf")).toBe("70.007 - Copy");
  });
  i3("Copy se ne spaja sa originalom", () => {
    const entries = [
      { filename: "70.007.pdf", quantity: 12, format_name: "1040x800" },
      { filename: "70.007 - Copy.pdf", quantity: 12, format_name: "1040x800" },
    ];
    const g = g3(entries, () => 2.4);
    e3(g).toHaveLength(2);
    e3(g.map((x) => x.baseName)).toEqual(["70.007", "70.007 - Copy"]);
    e3(g.map((x) => x.quantity)).toEqual([12, 12]);
  });
});

