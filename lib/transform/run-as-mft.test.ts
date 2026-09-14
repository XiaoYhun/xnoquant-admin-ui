import { describe, expect, it } from "vitest";
import { equityToPoints, runToMftCharts, runToMftPerf, summaryForPeriod } from "./run-as-mft";
import type { EquityPoint, PeriodSummary, RunSummary } from "@/types/domain";

describe("run-as-mft", () => {
  it("converts millisecond equity timestamps to unix seconds", () => {
    const pts = equityToPoints([
      { ts: 1_700_000_000_000, equity: 10, pnl: 10 },
      { ts: 1_700_086_400_000, equity: 15, pnl: 15 },
    ]);
    expect(pts[0].t).toBe(1_700_000_000);
    expect(pts[1].v).toBe(15);
  });

  it("leaves second-scale timestamps alone", () => {
    const pts = equityToPoints([{ ts: 1_700_000_000, equity: 1, pnl: 1 }]);
    expect(pts[0].t).toBe(1_700_000_000);
  });

  it("builds a pnls series and a percent returns series from cumulative equity", () => {
    // `net_pnl / return_pct` = 100 deployed, so the +10 second period is a +10% one.
    const charts = runToMftCharts(
      [
        { ts: 1_700_000_000_000, equity: 100, pnl: 100 },
        { ts: 1_700_086_400_000, equity: 110, pnl: 110 },
      ],
      { net_pnl: 12, return_pct: 0.12 } as RunSummary,
    );
    expect(charts.pnls.values).toEqual([100, 110]);
    expect(charts.returns.values?.[1]).toBeCloseTo(10);
  });

  it("states no returns at all when the run has no capital base to divide by", () => {
    // A PnL curve starting at zero with no `return_pct` used to fall back to a denominator of 1,
    // which turned each period's raw PnL into a percentage in the millions.
    const charts = runToMftCharts([
      { ts: 1_700_000_000_000, equity: 0, pnl: 0 },
      { ts: 1_700_086_400_000, equity: 2_000_000, pnl: 2_000_000 },
    ]);
    expect(charts.returns.values).toEqual([]);
    // The PnL and drawdown series are unaffected — both have a base of their own.
    expect(charts.pnls.values).toEqual([0, 2_000_000]);
  });

  it("maps run summary ratios onto the MFT performance payload", () => {
    const perf = runToMftPerf({
      net_pnl: 50,
      return_pct: 0.12,
      sharpe_annualized: 1.8,
      sharpe: 0.4,
      sortino: 2,
      calmar: 1.1,
      max_drawdown_pct: -0.08,
      win_rate: 0.55,
      total_trades: 10,
      cost_bps: 21.2,
    } as RunSummary);
    expect(perf?.performance?.cumulative_return).toBe(0.12);
    expect(perf?.performance?.sharpe).toBe(1.8);
    expect(perf?.analysis?.total_fee).toBeCloseTo(0.00212);
  });

  describe("summaryForPeriod", () => {
    const whole = { net_pnl: 100, return_pct: 1 } as RunSummary;
    const bucket2024 = { net_pnl: 10, return_pct: 0.1 } as RunSummary;
    const periods: PeriodSummary[] = [
      { label: "2023", start_date: "2023-01-01", end_date: "2023-12-31", summary: { net_pnl: 5 } as RunSummary },
      { label: "2024", start_date: "2024-01-01", end_date: "2024-12-31", summary: bucket2024 },
    ];

    it("answers 'All' with the whole run", () => {
      expect(summaryForPeriod(whole, periods, {})).toBe(whole);
    });

    it("answers a year with its own bucket's summary", () => {
      expect(summaryForPeriod(whole, periods, { year: 2024 })).toBe(bucket2024);
    });

    it("falls back to the whole run when a month is selected", () => {
      // No per-month endpoint exists, even though the year has a bucket.
      expect(summaryForPeriod(whole, periods, { year: 2024, month: 3 })).toBe(whole);
    });

    it("falls back to the whole run when the run only has quarterly buckets", () => {
      // A sub-year backtest buckets by quarter ("2024 Q3"), so a bare-year label never matches.
      const quarterly: PeriodSummary[] = [
        { label: "2024 Q1", start_date: "2024-01-01", end_date: "2024-03-31", summary: bucket2024 },
      ];
      expect(summaryForPeriod(whole, quarterly, { year: 2024 })).toBe(whole);
    });

    it("falls back to the whole run when periods haven't loaded", () => {
      expect(summaryForPeriod(whole, undefined, { year: 2024 })).toBe(whole);
    });

    it("drops an oversized bucket instead of showing it, like realSummary", () => {
      const oversized: PeriodSummary[] = [
        { label: "2024", start_date: "2024-01-01", end_date: "2024-12-31", summary: { oversized: true } as RunSummary },
      ];
      expect(summaryForPeriod(whole, oversized, { year: 2024 })).toBeUndefined();
    });
  });
});
