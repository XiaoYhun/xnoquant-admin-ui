import { describe, expect, it } from "vitest";
import { monthlyReturnPct, monthlyReturnStats } from "./pnl-buckets";
import type { Point } from "./mft-results";

/** Unix seconds for a UTC date, so the tests don't drift with the runner's timezone. */
const ts = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 1000;

const pts = (...pairs: [number, number][]): Point[] => pairs.map(([t, v]) => ({ t, v }));

describe("monthlyReturnPct", () => {
  it("sums equity deltas within a month as a % of the capital base, first sample included", () => {
    // Jan: +10 (first sample, its own value) then +5 more = +15 of 100 capital = +15%.
    const rows = monthlyReturnPct(
      pts([ts(2024, 1, 5), 10], [ts(2024, 1, 20), 15], [ts(2024, 2, 1), 20]),
      100,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].year).toBe(2024);
    expect(rows[0].months[0]).toBeCloseTo(15, 10); // Jan
    expect(rows[0].months[1]).toBeCloseTo(5, 10); // Feb: +5 delta = +5%
    expect(rows[0].months[2]).toBeUndefined(); // Mar untouched
  });

  it("leaves untouched months undefined rather than zero-filled", () => {
    const rows = monthlyReturnPct(pts([ts(2021, 3, 1), 5]), 100);
    expect(rows[0].months[0]).toBeUndefined();
    expect(rows[0].months[2]).toBeCloseTo(5, 10);
  });

  it("splits across years", () => {
    const rows = monthlyReturnPct(pts([ts(2021, 12, 31), 10], [ts(2022, 1, 1), 15]), 100);
    expect(rows.map((r) => r.year)).toEqual([2021, 2022]);
    expect(rows[0].months[11]).toBeCloseTo(10, 10);
    expect(rows[1].months[0]).toBeCloseTo(5, 10);
  });

  it("is empty for an empty series", () => {
    expect(monthlyReturnPct([], 100)).toEqual([]);
  });
});

describe("monthlyReturnStats", () => {
  it("folds best/worst/positive/total across every row", () => {
    const rows = monthlyReturnPct(
      pts(
        [ts(2021, 1, 1), 10], // Jan +10%
        [ts(2021, 2, 1), 5], // Feb +(5-10) = -5%
        [ts(2021, 3, 1), 8], // Mar +3%
      ),
      100,
    );
    const stats = monthlyReturnStats(rows);
    expect(stats.best).toBeCloseTo(10, 10);
    expect(stats.worst).toBeCloseTo(-5, 10);
    expect(stats.positive).toBe(2);
    expect(stats.total).toBe(3);
  });

  it("reports zeroes with no undefined best/worst when nothing has a value", () => {
    expect(monthlyReturnStats([{ months: new Array(12).fill(undefined) }])).toEqual({
      best: undefined,
      worst: undefined,
      positive: 0,
      total: 0,
    });
    expect(monthlyReturnStats([])).toEqual({ best: undefined, worst: undefined, positive: 0, total: 0 });
  });
});
