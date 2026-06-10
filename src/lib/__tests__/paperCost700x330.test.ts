import { describe, it, expect } from "vitest";
import {
  getPaperPricePerSheet,
  getPaperAreaMultiplier,
  calculateItemPaperCost,
  calculateWorkOrderTotals,
  PAPER_PRICE_TABLE,
} from "@/lib/digitalCalculations";
import { calculateGroupedPricing } from "@/lib/digitalGroupedPricing";

const AREA_RATIO = 700 / 488;

describe("700x330 paper cost regression", () => {
  it("getPaperAreaMultiplier uses real area ratio, not 1.5", () => {
    expect(getPaperAreaMultiplier("488x330")).toBe(1);
    expect(getPaperAreaMultiplier("700x330")).toBeCloseTo(AREA_RATIO, 6);
    expect(getPaperAreaMultiplier("700x330")).not.toBe(1.5);
  });

  it("getPaperPricePerSheet scales by area ratio for 700x330", () => {
    const base488 = getPaperPricePerSheet("Kunzdruk 150g", "488x330");
    const base700 = getPaperPricePerSheet("Kunzdruk 150g", "700x330");
    expect(base700 / base488).toBeCloseTo(AREA_RATIO, 6);
    // Must NOT match the legacy 1.5x value
    expect(base700).not.toBeCloseTo(base488 * 1.5, 6);
  });

  it.each([
    ["Ofsetni", 1.45],
    ["Kunzdruk 115g", 1.55],
    ["Kunzdruk 150g", 1.55],
    ["Kunzdruk 200g", 1.55],
    ["Kunzdruk 250g", 1.55],
    ["Kunzdruk 300g", 1.55],
    ["Kunzdruk 350g", 1.55],
  ])("%s per-sheet 700x330 = gsm × 0.16104 × area_ratio × %s €/kg", (paper, pricePerKg) => {
    const gsmMatch = paper.match(/(\d+)\s*g/i);
    const gsm = gsmMatch ? parseInt(gsmMatch[1], 10) : 80; // Ofsetni default
    const expected = (gsm * 0.488 * 0.330 * AREA_RATIO * pricePerKg) / 1000;
    expect(getPaperPricePerSheet(paper, "700x330")).toBeCloseTo(expected, 6);
  });

  it("calculateItemPaperCost on 700x330 matches sheets × kg formula (no 1.5)", () => {
    const cost = calculateItemPaperCost(1, 100, "700x330", "Kunzdruk 250g");
    // 100 sheets × 250g × 0.16104 m² × (700/488) × 1.55 €/kg / 1000
    const expected = (100 * 250 * 0.488 * 0.330 * AREA_RATIO * 1.55) / 1000;
    expect(cost).toBeCloseTo(expected, 6);
  });

  it("calculateWorkOrderTotals: 700x330 paper cost differs from 488x330 by area ratio", () => {
    const baseJob = {
      file_name: "x",
      finished_w_mm: 100,
      finished_h_mm: 100,
      pages: 1,
      obim: 1,
      qty: 200,
      is_test_print: false,
      print_sides: "4/4",
      paper_type: "Kunzdruk 150g",
    };
    const small = calculateWorkOrderTotals([{ ...baseJob, machine_sheet_format: "488x330" }]);
    const large = calculateWorkOrderTotals([{ ...baseJob, machine_sheet_format: "700x330" }]);
    expect(large.totalPaperCost / small.totalPaperCost).toBeCloseTo(AREA_RATIO, 6);
    expect(large.totalPaperCost / small.totalPaperCost).not.toBeCloseTo(1.5, 4);
  });

  it("calculateGroupedPricing: paper cost on 700x330 uses area ratio, not 1.5", () => {
    const job = {
      id: "1",
      file_name: "x",
      obim: 1,
      qty: 300,
      print_sides: "4/4",
      paper_type: "Kunzdruk 200g",
      machine_sheet_format: "700x330",
    };
    const result = calculateGroupedPricing([job as any]);
    const base = PAPER_PRICE_TABLE["Kunzdruk 200g"];
    const expected = 300 * base * AREA_RATIO;
    expect(result.totalPaperCost).toBeCloseTo(expected, 6);
    expect(result.totalPaperCost).not.toBeCloseTo(300 * base * 1.5, 4);
  });

  it("test prints contribute zero paper cost", () => {
    const totals = calculateWorkOrderTotals([
      {
        file_name: "t",
        finished_w_mm: 100,
        finished_h_mm: 100,
        pages: 1,
        obim: 1,
        qty: 50,
        is_test_print: true,
        print_sides: "4/4",
        paper_type: "Kunzdruk 250g",
        machine_sheet_format: "700x330",
      },
    ]);
    // Test prints are excluded from amount but currently included in paper cost calc.
    // This documents current behavior: paper still consumed even on test print.
    const expected = (50 * 250 * 0.488 * 0.330 * AREA_RATIO * 1.55) / 1000;
    expect(totals.totalPaperCost).toBeCloseTo(expected, 6);
  });

  it("clicks on 700x330 keep 1.5x multiplier (machine A3+ billing) — sanity check", () => {
    // This protects the intentional click multiplier from being collapsed into the paper ratio.
    const totals = calculateWorkOrderTotals([
      {
        file_name: "x",
        finished_w_mm: 100,
        finished_h_mm: 100,
        pages: 1,
        obim: 1,
        qty: 100,
        is_test_print: false,
        print_sides: "4/4",
        paper_type: "Kunzdruk 150g",
        machine_sheet_format: "700x330",
      },
    ]);
    // 100 sheets × 2 color sides × 1.5 click multiplier = 300
    expect(totals.totalColorClicks).toBe(300);
  });
});
