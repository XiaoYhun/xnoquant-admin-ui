import { describe, expect, it } from "vitest";
import {
  bucketedSummaryRows,
  equityToPoints,
  runToMftCharts,
  runToMftPerf,
  runToMftSummaryRows,
  summaryForPeriod,
} from "./run-as-mft";
import type { EquityPoint, PeriodSummary, RunSummary } from "@/types/domain";
import type { Point } from "./mft-results";

/** Unix seconds for a UTC date, so the tests don't drift with the runner's timezone. */
const ts = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 1000;

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
    // Capital backs out to net_pnl / return_pct = 50 / 0.12 ≈ 416.67, so a 5-unit fee is ≈1.2% of it.
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
      total_fee: 5,
    } as RunSummary);
    expect(perf?.performance?.cumulative_return).toBe(0.12);
    expect(perf?.performance?.sharpe).toBe(1.8);
    expect(perf?.analysis?.total_fee).toBeCloseTo(0.012);
  });

  it("leaves total_fee undefined when the run has no capital base to divide by", () => {
    // Same gap `startingCapital` documents: a live run's `return_pct` is always null.
    const perf = runToMftPerf({ net_pnl: 50, total_fee: 5 } as RunSummary);
    expect(perf?.analysis?.total_fee).toBeUndefined();
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

    it("answers a quarter with its own bucket's summary (F-046)", () => {
      const q3: PeriodSummary[] = [
        { label: "2024 Q3", start_date: "2024-07-01", end_date: "2024-09-30", summary: bucket2024 },
      ];
      expect(summaryForPeriod(whole, q3, { year: 2024, quarter: 3 })).toBe(bucket2024);
    });

    it("falls back to the whole run when the quarter has no bucket", () => {
      expect(summaryForPeriod(whole, periods, { year: 2024, quarter: 3 })).toBe(whole);
    });
  });

  describe("runToMftSummaryRows", () => {
    const equity: EquityPoint[] = [
      { ts: Date.UTC(2023, 0, 1), equity: 0, pnl: 0 },
      { ts: Date.UTC(2023, 11, 31), equity: 5, pnl: 5 },
      { ts: Date.UTC(2024, 0, 1), equity: 5, pnl: 5 },
      { ts: Date.UTC(2024, 11, 31), equity: 15, pnl: 15 },
    ];
    // net_pnl / return_pct = 100 deployed.
    const whole = { net_pnl: 15, return_pct: 0.15 } as RunSummary;

    it("fills Sharpe/max drawdown/profit factor/Calmar from a year's periodic-summary bucket (F-063)", () => {
      const bucket2024 = {
        sharpe_annualized: 1.5,
        sharpe: 0.3,
        return_pct: 0.1,
        max_drawdown_pct: -0.05,
        profit_factor: 1.8,
        calmar: 2,
      } as RunSummary;
      const periods: PeriodSummary[] = [
        { label: "2024", start_date: "2024-01-01", end_date: "2024-12-31", summary: bucket2024 },
      ];
      const rows = runToMftSummaryRows(equity, whole, periods);
      const y2024 = rows.find((r) => r.time === "2024");
      expect(y2024).toMatchObject({
        sharpe: 1.5,
        cagr: 0.1,
        max_drawdown: -0.05,
        profit_factor: 1.8,
        calmar: 2,
      });
    });

    it("falls back to the equity-slice CAGR (and blank everything else) for a year without a bucket", () => {
      const rows = runToMftSummaryRows(equity, whole, undefined);
      const y2023 = rows.find((r) => r.time === "2023");
      // (5 - 0) / 100 capital = +5%.
      expect(y2023?.cagr).toBeCloseTo(0.05, 10);
      expect(y2023?.sharpe).toBeUndefined();
      expect(y2023?.profit_factor).toBeUndefined();
    });

    it("drops an oversized bucket the same way summaryForPeriod does", () => {
      const periods: PeriodSummary[] = [
        { label: "2024", start_date: "2024-01-01", end_date: "2024-12-31", summary: { oversized: true } as RunSummary },
      ];
      const rows = runToMftSummaryRows(equity, whole, periods);
      // Falls through to the series-derived CAGR, not the oversized bucket's placeholder fields.
      expect(rows.find((r) => r.time === "2024")?.sharpe).toBeUndefined();
    });
  });

  describe("bucketedSummaryRows", () => {
    const pts = (...pairs: [number, number][]): Point[] => pairs.map(([t, v]) => ({ t, v }));
    // Cumulative PnL curve for 2024: Jan +10, then flat, then Jul +5 more.
    const pnls = pts([ts(2024, 1, 15), 10], [ts(2024, 7, 15), 15]);
    const wholeSummary = { net_pnl: 15, return_pct: 0.15 } as RunSummary; // capital = 100

    it("has 12 month rows labelled Jan..Dec, deriving CAGR from the equity slice", () => {
      const rows = bucketedSummaryRows("month", 2024, { pnls, returns: [], drawdown: [] }, undefined, wholeSummary);
      expect(rows.map((r) => r.time)).toEqual([
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ]);
      // Jan's only sample is its own value (10) over 100 capital = +10%.
      expect(rows[0].cagr).toBeCloseTo(0.1, 10);
      expect(rows[6].cagr).toBeCloseTo(0.05, 10); // Jul: 15 - 15 (no prior sample in-bucket) ... see below
      expect(rows[1].cagr).toBeUndefined(); // Feb has no PnL sample at all
    });

    it("has 4 quarter rows, preferring an exact periodic-summary bucket when one exists", () => {
      const q1 = { sharpe_annualized: 2, return_pct: 0.08, max_drawdown_pct: -0.02, calmar: 3 } as RunSummary;
      const periods: PeriodSummary[] = [
        { label: "2024 Q1", start_date: "2024-01-01", end_date: "2024-03-31", summary: q1 },
      ];
      const rows = bucketedSummaryRows("quarter", 2024, { pnls, returns: [], drawdown: [] }, periods, wholeSummary);
      expect(rows.map((r) => r.time)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
      expect(rows[0]).toMatchObject({ sharpe: 2, cagr: 0.08, max_drawdown: -0.02, calmar: 3 });
      // Q3 has no bucket, so it derives from the pnls slice instead (15 - 10 = +5% of 100 capital).
      expect(rows[2].cagr).toBeCloseTo(0.05, 10);
    });

    it("leaves profit factor undefined with no bucket to answer it", () => {
      const rows = bucketedSummaryRows("month", 2024, { pnls, returns: [], drawdown: [] }, undefined, wholeSummary);
      expect(rows.every((r) => r.profit_factor === undefined)).toBe(true);
    });
  });
});
