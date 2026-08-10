import { describe, it, expect } from "vitest";
import { toDrawdown, toRollingSharpe } from "./results";

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
