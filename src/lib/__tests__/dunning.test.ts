import { describe, it, expect } from "vitest";
import { isOverdue, daysLate } from "../dunning";

describe("opomene – van valute", () => {
  it("rok prošao i ima otvoreno = van valute", () => expect(isOverdue("2026-10-01", 1000, "2026-10-16")).toBe(true));
  it("rok danas nije van valute", () => expect(isOverdue("2026-10-16", 1000, "2026-10-16")).toBe(false));
  it("plaćeno nije van valute", () => expect(isOverdue("2026-10-01", 0, "2026-10-16")).toBe(false));
  it("broj dana kašnjenja", () => expect(daysLate("2026-10-01", "2026-10-16")).toBe(15));
});
