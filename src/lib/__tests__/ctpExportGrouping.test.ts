import { describe, it, expect } from "vitest";
import { jobBaseName, groupEntriesForExport } from "../ctpExportGrouping";

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
});
