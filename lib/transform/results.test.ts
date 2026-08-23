import { describe, it, expect } from "vitest";
import {
  equityStats,
  startingCapital,
  padDailyPnl,
  toDailyPnlPoints,
  toDrawdown,
  toMonthlyPnl,
  toReturnHistogram,
  niceStep,
  toRollingSharpe,
} from "./results";

describe("toDrawdown", () => {
  it("tracks peak-to-trough pct and absolute drawdown (peak seeded at 0)", () => {
    const series = toDrawdown([
      { ts: 1, equity: 0, pnl: 0 },
      { ts: 2, equity: 100, pnl: 100 },
      { ts: 3, equity: 80, pnl: 80 },
      { ts: 4, equity: 120, pnl: 120 },
      { ts: 5, equity: 90, pnl: 90 },
    ]);
    expect(series.map((p) => p.abs)).toEqual([0, 0, -20, 0, -30]);
    expect(series[0].pct).toBe(0); // peak still ≤ 0 → no %
    expect(series[2].pct).toBeCloseTo(-20);
    expect(series[4].pct).toBeCloseTo(-25); // -30 / 120
  });

  it("treats an underwater start as drawdown from the 0 peak seed", () => {
    const series = toDrawdown([{ ts: 1, equity: -10, pnl: -10 }]);
    expect(series[0].abs).toBe(-10);
    expect(series[0].pct).toBe(0);
  });
});

describe("toRollingSharpe", () => {
  it("uses adaptive window and does not annualize", () => {
    // 9 points → 8 deltas → w = max(3, min(20, floor(8/3))) = 3
    const points = Array.from({ length: 9 }, (_, i) => ({
      ts: i + 1,
      equity: i % 2 === 0 ? 100 + i : 100 - i,
      pnl: 0,
    }));
    const series = toRollingSharpe(points);
    expect(series.length).toBe(6); // deltas 3..8 inclusive with w=3 → indices 2..7 = 6
    // Flat-ish alternating window should be finite (not √252-scaled)
    for (const p of series) {
      expect(Number.isFinite(p.value)).toBe(true);
      expect(Math.abs(p.value)).toBeLessThan(50);
    }
  });

  it("returns 0 when the window stddev is 0", () => {
    const points = [
      { ts: 1, equity: 10, pnl: 10 },
      { ts: 2, equity: 20, pnl: 20 },
      { ts: 3, equity: 30, pnl: 30 },
      { ts: 4, equity: 40, pnl: 40 },
    ];
    // deltas all +10 → std 0 → sharpe 0; force window=3
    const series = toRollingSharpe(points, 3);
    expect(series.every((p) => p.value === 0)).toBe(true);
  });

  it("returns [] when there are fewer deltas than the window", () => {
    expect(toRollingSharpe([{ ts: 1, equity: 1, pnl: 1 }, { ts: 2, equity: 2, pnl: 2 }], 5)).toEqual([]);
  });
});

// Local-midnight timestamps so calendar-day/month bucketing is stable regardless of TZ.
const day = (y: number, m: number, d: number, equity: number) => ({
  ts: new Date(y, m, d, 12).getTime(),
  equity,
  pnl: equity,
});

describe("toMonthlyPnl", () => {
  it("sums daily PnL per calendar month, oldest first", () => {
    // Cumulative equity; day one is measured from a 0 prior close, so starting at 0 adds nothing.
    const points = [
      day(2025, 0, 1, 0),
      day(2025, 0, 2, 100), // Jan +100
      day(2025, 0, 3, 150), // Jan +50
      day(2025, 1, 1, 120), // Feb -30
      day(2025, 1, 2, 220), // Feb +100
    ];
    expect(toMonthlyPnl(points)).toEqual([
      { year: 2025, month: 0, value: 150 },
      { year: 2025, month: 1, value: 70 },
    ]);
  });

  it("counts a single-day curve against a zero prior close", () => {
    expect(toMonthlyPnl([day(2025, 0, 1, 10)])).toEqual([{ year: 2025, month: 0, value: 10 }]);
  });

  it("is empty only when there are no points at all", () => {
    expect(toMonthlyPnl([])).toEqual([]);
  });
});

describe("toDailyPnlPoints", () => {
  // The case that made an intraday run — the norm for HFT — render an empty Performance tab:
  // every reading lands on one calendar day, so differencing consecutive closes yielded nothing.
  it("yields one day for a run that opens and closes within a single calendar day", () => {
    const t = Date.UTC(2026, 7, 10, 5, 28);
    const intraday = [
      { ts: t, equity: -1, pnl: -1 },
      { ts: t + 30_000, equity: -3, pnl: -3 },
      { ts: t + 60_000, equity: -5, pnl: -5 },
    ];
    expect(toDailyPnlPoints(intraday)).toEqual([{ ts: t + 60_000, value: -5 }]);
  });

  it("still differences later days against the previous close", () => {
    expect(toDailyPnlPoints([day(2025, 0, 1, 40), day(2025, 0, 2, 100)]).map((d) => d.value)).toEqual([40, 60]);
  });
});

describe("equityStats", () => {
  it("aggregates day-level PnL", () => {
    const stats = equityStats([
      day(2025, 0, 1, 0),
      day(2025, 0, 2, 100), // +100
      day(2025, 0, 3, 60), //  -40
      day(2025, 0, 4, 90), //  +30
    ]);
    // Day one counts too, at 0 - 0 = 0: four trading days, of which two made money.
    expect(stats).toEqual({
      tradingDays: 4,
      profitDays: 2,
      profitDayPct: 50,
      avgDailyPnl: 22.5,
      bestDay: 100,
      worstDay: -40,
    });
  });

  it("reports a single-day run rather than nothing", () => {
    expect(equityStats([day(2025, 0, 1, 10)])).toMatchObject({ tradingDays: 1, bestDay: 10 });
  });

  it("returns null only for an empty curve", () => {
    expect(equityStats([])).toBeNull();
  });
});

describe("startingCapital", () => {
  const base = { net_pnl: 250 } as Parameters<typeof startingCapital>[0] & object;

  it("inverts return_pct = net_pnl / capital", () => {
    expect(startingCapital({ ...base, return_pct: 0.25 } as never)).toBe(1000);
  });

  it("is null when return_pct is absent, zero, or yields a non-positive capital", () => {
    expect(startingCapital(undefined)).toBeNull();
    expect(startingCapital({ ...base, return_pct: null } as never)).toBeNull();
    expect(startingCapital({ ...base, return_pct: 0 } as never)).toBeNull();
    // Loss over a negative pct would imply negative capital.
    expect(startingCapital({ net_pnl: 250, return_pct: -0.25 } as never)).toBeNull();
  });
});

describe("niceStep", () => {
  it("rounds up to the next 1/2/2.5/5 x 10^k", () => {
    expect([0.11, 0.3, 0.6, 1, 1.4, 2.2, 4, 7, 12].map(niceStep)).toEqual([0.2, 0.5, 1, 1, 2, 2.5, 5, 10, 20]);
  });

  it("falls back to 1 for a degenerate step", () => {
    expect([0, -1, NaN, Infinity].map(niceStep)).toEqual([1, 1, 1, 1]);
  });
});

describe("toReturnHistogram", () => {
  it("bins symmetrically around zero so the sign split lands on a bin edge", () => {
    const bins = toReturnHistogram([-2, -0.5, 0.5, 2], 4);
    expect(bins).toHaveLength(4);
    expect(bins.map((b) => b.count)).toEqual([1, 1, 1, 1]);
    // extent 2, width 1 → centers -1.5, -0.5, 0.5, 1.5; first half is strictly negative.
    expect(bins.map((b) => b.center)).toEqual([-1.5, -0.5, 0.5, 1.5]);
  });

  it("uses half-open bins, so a flat day counts as non-negative", () => {
    // Bins are [-2,-1), [-1,0), [0,1), [1,2] — 0 belongs to the first positive-side bin, which
    // keeps the loss/gain colour split at index bins/2 honest.
    expect(toReturnHistogram([0, -2], 4).map((b) => b.count)).toEqual([1, 0, 1, 0]);
  });

  it("forces an even bin count and keeps the top value in range", () => {
    const bins = toReturnHistogram([-1, 1], 3);
    expect(bins).toHaveLength(4);
    expect(bins[bins.length - 1].count).toBe(1); // +1 clamps into the last bin, not out of it
  });

  it("lays band edges on round multiples of a rounded width", () => {
    // Daily returns in %, spread to ~2.9% — the extent/binCount split used to put edges at
    // 2.9/10 = 0.29% and label the axis -2.61%, -1.74%, … Bands must read in round steps.
    const bins = toReturnHistogram([-2.9, -1.1, -0.4, 0.2, 0.9, 2.4], 20);
    const width = bins[1].lower - bins[0].lower;
    expect(width).toBe(0.5);
    // Every edge is a whole multiple of the width, and zero is one of them.
    for (const b of bins) expect(Math.abs(b.lower / width - Math.round(b.lower / width))).toBeLessThan(1e-9);
    expect(bins.map((b) => b.lower)).toContain(0);
    // Still covers the extremes, still even, still split down the middle at zero.
    expect(bins.length % 2).toBe(0);
    expect(bins[0].lower).toBeLessThanOrEqual(-2.9);
    expect(bins[bins.length - 1].lower + width).toBeGreaterThanOrEqual(2.4);
    expect(bins.reduce((n, b) => n + b.count, 0)).toBe(6);
  });

  it("keeps the loss half exactly the first half of the bands", () => {
    const bins = toReturnHistogram([-3, -0.1, 0, 0.1, 3], 20);
    const half = bins.length / 2;
    expect(bins[half].lower).toBe(0);
    // Two losses below zero, three at-or-above it.
    expect(bins.slice(0, half).reduce((n, b) => n + b.count, 0)).toBe(2);
    expect(bins.slice(half).reduce((n, b) => n + b.count, 0)).toBe(3);
  });

  it("handles an all-flat series and empty input", () => {
    const flat = toReturnHistogram([0, 0, 0], 4);
    expect(flat.reduce((s, b) => s + b.count, 0)).toBe(3);
    expect(toReturnHistogram([])).toEqual([]);
  });
});

describe("padDailyPnl", () => {
  const DAY = 86_400_000;
  const localMidnight = (ts: number) => {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  // A fixed "now" so these assertions don't drift with the wall clock.
  const now = new Date(2026, 7, 20, 14, 30).getTime();
  const today = localMidnight(now);

  it("leaves no data empty, so callers keep their own empty state", () => {
    expect(padDailyPnl([], 7, now)).toEqual([]);
  });

  it("centres a single old day as 3 blanks, the day, 3 blanks", () => {
    const day = today - 10 * DAY;
    const out = padDailyPnl([{ ts: day + 3_600_000, value: 42 }], 7, now);
    expect(out).toHaveLength(7);
    expect(out.map((d) => d.value)).toEqual([0, 0, 0, 42, 0, 0, 0]);
  });

  it("slides back so the right-most column is today rather than the future", () => {
    // Centring a day that IS today would put three bars in the future.
    const out = padDailyPnl([{ ts: now, value: 42 }], 7, now);
    expect(out).toHaveLength(7);
    expect(out.map((d) => d.value)).toEqual([0, 0, 0, 0, 0, 0, 42]);
  });

  it("keeps the window a full week when only part of the padding overflows", () => {
    const out = padDailyPnl([{ ts: today - 2 * DAY, value: 7 }], 7, now);
    expect(out).toHaveLength(7);
    // today-6 … today, with the data on today-2 → index 4.
    expect(out.map((d) => d.value)).toEqual([0, 0, 0, 0, 7, 0, 0]);
  });

  it("does not shrink a run that already spans more than the minimum", () => {
    const points = Array.from({ length: 10 }, (_, i) => ({ ts: today - (9 - i) * DAY + 3_600_000, value: i + 1 }));
    const out = padDailyPnl(points, 7, now);
    expect(out).toHaveLength(10);
    expect(out.map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("fills interior gaps as well as the edges", () => {
    const out = padDailyPnl(
      [
        { ts: today - 6 * DAY + 3_600_000, value: 5 },
        { ts: today - 2 * DAY + 3_600_000, value: 9 },
      ],
      7,
      now,
    );
    // Data spans 5 days, so one blank is added each side: today-7 … today-1.
    expect(out.map((d) => d.value)).toEqual([0, 5, 0, 0, 0, 9, 0]);
  });
});
