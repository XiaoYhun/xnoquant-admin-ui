import { describe, it, expect } from "vitest";
import {
  compound,
  drawdownEpisodes,
  filterByPeriod,
  lossStreaks,
  monthlyReturns,
  sliceStage,
  toPeriodChanges,
  toPoints,
  topDrawdowns,
  worstLossStreak,
  yearsOf,
  type Point,
} from "./mft-results";

/** Unix seconds for a UTC date, so the tests don't drift with the runner's timezone. */
const ts = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 1000;

const pts = (...pairs: [number, number][]): Point[] => pairs.map(([t, v]) => ({ t, v }));

describe("toPoints", () => {
  it("zips times with values", () => {
    expect(toPoints({ times: [1, 2, 3], values: [10, 20, 30] })).toEqual([
      { t: 1, v: 10 },
      { t: 2, v: 20 },
      { t: 3, v: 30 },
    ]);
  });

  it("stops at the shorter array and drops non-finite samples", () => {
    expect(toPoints({ times: [1, 2, 3], values: [10, 20] })).toHaveLength(2);
    expect(toPoints({ times: [1, 2], values: [10, NaN] })).toEqual([{ t: 1, v: 10 }]);
  });

  it("treats missing data as empty", () => {
    expect(toPoints(undefined)).toEqual([]);
    expect(toPoints({})).toEqual([]);
  });
});

describe("sliceStage", () => {
  const data = { times: [1, 2, 3, 4], values: [1, 2, 3, 4], stages: { train: { from: 2, to: 3 } } };

  it("keeps the stage's inclusive range", () => {
    expect(sliceStage(toPoints(data), data, "train").map((p) => p.t)).toEqual([2, 3]);
  });

  it("passes everything through when the stage has no range", () => {
    expect(sliceStage(toPoints(data), data, "live")).toHaveLength(4);
    expect(sliceStage(toPoints(data), data, undefined)).toHaveLength(4);
  });
});

describe("filterByPeriod / yearsOf", () => {
  const points = pts(
    [ts(2020, 3, 1), 1],
    [ts(2021, 5, 2), 2],
    [ts(2021, 6, 3), 3],
    [ts(2022, 1, 4), 4],
  );

  it("lists each year once, ascending", () => {
    expect(yearsOf(points)).toEqual([2020, 2021, 2022]);
  });

  it("returns everything for All (no year)", () => {
    expect(filterByPeriod(points, {})).toHaveLength(4);
  });

  it("filters by year, then by month within it", () => {
    expect(filterByPeriod(points, { year: 2021 }).map((p) => p.v)).toEqual([2, 3]);
    expect(filterByPeriod(points, { year: 2021, month: 6 }).map((p) => p.v)).toEqual([3]);
    expect(filterByPeriod(points, { year: 2021, month: 12 })).toEqual([]);
  });
});

describe("toPeriodChanges", () => {
  it("differences a cumulative series, keeping the first sample as its own change", () => {
    expect(toPeriodChanges(pts([1, 10], [2, 25], [3, 20])).map((p) => p.v)).toEqual([10, 15, -5]);
  });

  it("is empty for an empty series", () => {
    expect(toPeriodChanges([])).toEqual([]);
  });
});

describe("compound", () => {
  it("chains percent returns rather than adding them", () => {
    // +10% then -10% loses 1%, which a naive sum would report as break-even.
    expect(compound([10, -10])).toBeCloseTo(-1, 10);
    expect(compound([100, 100])).toBeCloseTo(300, 10);
    expect(compound([])).toBe(0);
  });
});

describe("monthlyReturns", () => {
  it("buckets by year and month, leaving untouched months undefined", () => {
    const rows = monthlyReturns(
      pts([ts(2021, 1, 5), 10], [ts(2021, 1, 20), -10], [ts(2021, 3, 1), 5], [ts(2022, 2, 1), 2]),
    );
    expect(rows.map((r) => r.year)).toEqual([2021, 2022]);

    const y21 = rows[0];
    expect(y21.months[0]).toBeCloseTo(-1, 10); // Jan: +10% then -10% compounded
    expect(y21.months[1]).toBeUndefined(); // Feb had no samples
    expect(y21.months[2]).toBeCloseTo(5, 10);
    expect(y21.total).toBeCloseTo(compound([-1, 5]), 10);

    expect(rows[1].months[1]).toBeCloseTo(2, 10);
  });

  it("has no rows for an empty series", () => {
    expect(monthlyReturns([])).toEqual([]);
  });
});

describe("lossStreaks", () => {
  it("counts runs of consecutive negative periods by length", () => {
    // -,+,-,-,+,-,-,-  →  one run of 1, one of 2, one of 3
    const points = pts([1, -1], [2, 1], [3, -1], [4, -2], [5, 1], [6, -1], [7, -1], [8, -1]);
    expect(lossStreaks(points)).toEqual([
      { length: 1, count: 1 },
      { length: 2, count: 1 },
      { length: 3, count: 1 },
    ]);
  });

  it("closes a streak that runs to the end of the series", () => {
    expect(lossStreaks(pts([1, 1], [2, -1], [3, -1]))).toEqual([{ length: 2, count: 1 }]);
  });

  it("treats a flat period as ending the streak, not extending it", () => {
    expect(lossStreaks(pts([1, -1], [2, 0], [3, -1]))).toEqual([{ length: 1, count: 2 }]);
  });

  it("aggregates repeats of the same length", () => {
    expect(lossStreaks(pts([1, -1], [2, 1], [3, -1]))).toEqual([{ length: 1, count: 2 }]);
  });
});

describe("worstLossStreak", () => {
  it("reports the longest run and what it cost", () => {
    const points = pts([1, -1], [2, 1], [3, -2], [4, -3], [5, 1]);
    expect(worstLossStreak(points)).toEqual({ length: 2, total: -5 });
  });

  it("is undefined when nothing lost", () => {
    expect(worstLossStreak(pts([1, 1], [2, 0]))).toBeUndefined();
    expect(worstLossStreak([])).toBeUndefined();
  });
});

describe("drawdownEpisodes", () => {
  it("splits an underwater series into episodes with trough, length and recovery", () => {
    // idx: 0    1   2   3   4   5   6   7
    //      0   -1  -3  -2   0  -5  -1   0
    const points = pts([0, 0], [1, -1], [2, -3], [3, -2], [4, 0], [5, -5], [6, -1], [7, 0]);
    const eps = drawdownEpisodes(points);
    expect(eps).toEqual([
      { start: 1, trough: 2, depth: -3, length: 2, recovery: 2 },
      { start: 5, trough: 5, depth: -5, length: 1, recovery: 2 },
    ]);
  });

  it("keeps a final episode that never recovered, with no recovery figure", () => {
    const eps = drawdownEpisodes(pts([0, 0], [1, -2], [2, -4]));
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({ start: 1, trough: 2, depth: -4, length: 2 });
    expect(eps[0].recovery).toBeUndefined();
  });

  it("finds nothing in a series that never goes underwater", () => {
    expect(drawdownEpisodes(pts([0, 0], [1, 0], [2, 1]))).toEqual([]);
    expect(drawdownEpisodes([])).toEqual([]);
  });
});

describe("topDrawdowns", () => {
  it("ranks by depth and caps the list", () => {
    const points = pts(
      [0, -1], [1, 0], [2, -9], [3, 0], [4, -5], [5, 0], [6, -3], [7, 0],
    );
    expect(topDrawdowns(points, 2).map((e) => e.depth)).toEqual([-9, -5]);
    expect(topDrawdowns(points).map((e) => e.depth)).toEqual([-9, -5, -3, -1]);
  });
});
