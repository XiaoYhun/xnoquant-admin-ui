import { describe, it, expect } from "vitest";
import { formatCurrency, formatPercent, formatCompact } from "./utils";

describe("formatters", () => {
  it("formats VND currency without decimals", () => {
    expect(formatCurrency(3_000_000_000)).toBe("3,000,000,000 ₫");
  });
  it("formats percent with sign and 2 decimals", () => {
    expect(formatPercent(12.5)).toBe("+12.50%");
    expect(formatPercent(-3.1)).toBe("-3.10%");
  });
  it("formats compact numbers", () => {
    expect(formatCompact(1_200_000)).toBe("1.2M");
  });
});
