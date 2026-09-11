import { describe, expect, it } from "vitest";
import { equityToPoints, runToMftCharts, runToMftPerf } from "./run-as-mft";
import type { EquityPoint, RunSummary } from "@/types/domain";

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
});
