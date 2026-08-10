import { describe, it, expect } from "vitest";
import { aggregateTurnover, normalizeTurnover } from "./turnover-curve";

describe("normalizeTurnover", () => {
  it("accepts the documented flat array shape", () => {
    expect(normalizeTurnover([{ ts: 1, turnover: 10 }])).toEqual([{ ts: 1, turnover: 10 }]);
  });

  it("accepts wrapped / alternate field names", () => {
    expect(
      normalizeTurnover({
        points: [{ timestamp: 2, value: 5 }, { ts: "nope", turnover: 1 }, null],
      }),
    ).toEqual([{ ts: 2, turnover: 5 }]);
  });

  it("returns [] for garbage", () => {
    expect(normalizeTurnover(null)).toEqual([]);
    expect(normalizeTurnover({})).toEqual([]);
  });
});

describe("aggregateTurnover", () => {
  it("sums points into daily bars", () => {
    // Local-noon timestamps so the calendar day doesn't flip across timezones.
    const day1 = new Date(2025, 0, 1, 12).getTime();
    const day1b = new Date(2025, 0, 1, 18).getTime();
    const day2 = new Date(2025, 0, 2, 12).getTime();
    const bars = aggregateTurnover(
      [
        { ts: day1, turnover: 10 },
        { ts: day1b, turnover: 5 },
        { ts: day2, turnover: 3 },
      ],
      "Daily",
    );
    expect(bars.map((b) => b.value)).toEqual([15, 3]);
  });
});
