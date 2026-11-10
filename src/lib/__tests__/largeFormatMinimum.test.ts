import { describe, expect, it } from "vitest";
import { applyLargeFormatMinimum } from "../largeFormatMinimum";

describe("minimumi kao na gamaunited.rs", () => {
  it("rolna: minimum 10 EUR po celoj stavci", () => {
    expect(applyLargeFormatMinimum(0.5 * 4, "roll").totalPrice).toBe(10);
  });
  it("ploča: minimum 20 EUR po celoj stavci", () => {
    expect(applyLargeFormatMinimum(0.5 * 4, "sheet").totalPrice).toBe(20);
  });
  it("iznos iznad minimuma ostaje nepromenjen", () => {
    expect(applyLargeFormatMinimum(35, "sheet").totalPrice).toBe(35);
  });
  it("ne nagađa vrstu materijala", () => {
    expect(() => applyLargeFormatMinimum(3, null)).toThrow();
  });
});