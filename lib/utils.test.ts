import { describe, it, expect } from "vitest";
import { formatCurrency, formatPercent, formatCompact, formatAmount, formatSignedAmount, isIdQuery, idQueryNeedle } from "./utils";

describe("formatters", () => {
  it("formats VND currency without decimals", () => {
    expect(formatCurrency(3_000_000_000)).toBe("3,000,000,000 đ");
  });
  it("formats percent with sign and 2 decimals", () => {
    expect(formatPercent(12.5)).toBe("+12.50%");
    expect(formatPercent(-3.1)).toBe("-3.10%");
  });
  it("formats compact numbers", () => {
    expect(formatCompact(1_200_000)).toBe("1.2M");
  });

  describe("formatAmount", () => {
    it("groups thousands and always keeps two decimals", () => {
      expect(formatAmount(1_000_000)).toBe("1,000,000.00");
      expect(formatAmount(0)).toBe("0.00");
    });
    it("rounds rather than truncating, so no third decimal leaks through", () => {
      // The old bare toLocaleString() rendered this as "-50,014.108".
      expect(formatAmount(-50_014.10819994224)).toBe("-50,014.11");
    });
    it("puts an explicit + only on gains", () => {
      expect(formatSignedAmount(1_234.5)).toBe("+1,234.50");
      expect(formatSignedAmount(-1_234.5)).toBe("-1,234.50");
      expect(formatSignedAmount(0)).toBe("0.00");
    });
  });
});

describe("formatAmount negative zero", () => {
  it("never emits a signed zero, which callers' own sign prefix turned into '+-0.0'", () => {
    expect(formatAmount(-0)).toBe("0.00");
    expect(formatAmount(-0.0001, 1)).toBe("0.0");
    expect(formatSignedAmount(-0)).toBe("0.00");
  });
});

describe("isIdQuery", () => {
  it("recognises a pasted uuid and the table's short form", () => {
    expect(isIdQuery("019ff517-5293-74b4-a21c-33c4b6be5ef1")).toBe(true);
    expect(isIdQuery("#019ff517-5293")).toBe(true);
    expect(isIdQuery("019ff517")).toBe(true);
  });
  it("leaves real names to the server's name search", () => {
    // "dochian-BO" has non-hex letters; "abc" is too short to risk hijacking.
    expect(isIdQuery("dochian-BO")).toBe(false);
    expect(isIdQuery("abc")).toBe(false);
    expect(isIdQuery("")).toBe(false);
  });
  it("normalises the needle for comparison", () => {
    expect(idQueryNeedle("#019FF517-5293")).toBe("019ff517-5293");
  });
});
