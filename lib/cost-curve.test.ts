import { describe, it, expect } from "vitest";
import { lastCumulative, normalizeCostCurve, toCostSeries } from "./cost-curve";

describe("normalizeCostCurve", () => {
  it("accepts CostPoint[]", () => {
    expect(normalizeCostCurve([{ ts: 1, fee: 2, cumulative: 2 }])).toEqual([
      { ts: 1, fee: 2, cumulative: 2 },
    ]);
  });

  it("drops malformed rows", () => {
    expect(normalizeCostCurve([{ ts: 1, fee: 2 }, null, { ts: 3, fee: 1, cumulative: 3 }])).toEqual([
      { ts: 3, fee: 1, cumulative: 3 },
    ]);
  });
});

describe("toCostSeries / lastCumulative", () => {
  it("orders by ts and reports the latest cumulative", () => {
    const pts = normalizeCostCurve([
      { ts: 20, fee: 5, cumulative: 15 },
      { ts: 10, fee: 10, cumulative: 10 },
    ]);
    expect(toCostSeries(pts).map((p) => p.cumulative)).toEqual([10, 15]);
    expect(lastCumulative(pts)).toBe(15);
  });
});
