import type { EquityPoint, RunSummary } from "@/types/domain";
import type { StrategyChartData, SummaryTableItem } from "@/hooks/api/use-strategy-results";
import type { StrategyPerformanceDetail } from "@/hooks/api/use-strategy-performance";
import { toDrawdown, toRollingSharpe } from "./results";
import { toPeriodChanges, yearOf, type Point } from "./mft-results";

// HFT `/api/runs/{id}` equity + summary → the shapes the six Figma-15204 Results screens already
// consume (XALPHA `/charts` + `/performance` + `/summary-table`). Those screens were built from
// HFT Create Strategy Results and belong on MFT-type (bar) runs, which still publish the HFT
// run artifacts — not the XALPHA strategy/stage endpoints.

/** HFT `EquityPoint.ts` is unix ms; MFT `Point.t` is unix seconds. */
function toUnixSec(ts: number): number {
  return ts > 1e12 ? Math.floor(ts / 1000) : ts;
}

export function equityToPoints(equity: EquityPoint[] | undefined): Point[] {
  if (!equity) return [];
  const out: Point[] = [];
  for (const p of equity) {
    const ts = Number(p.ts);
    const v = Number(p.equity ?? p.pnl);
    if (Number.isFinite(ts) && Number.isFinite(v)) out.push({ t: toUnixSec(ts), v });
  }
  return out;
}

function toChart(points: Point[]): StrategyChartData {
  return { times: points.map((p) => p.t), values: points.map((p) => p.v) };
}

/**
 * Cumulative PnL → the four series the MFT screens slice. `returns` is percent of the curve's
 * first |equity| sample (or 1), matching the MFT mock's "+1.5 / -0.8" percent units so
 * `monthlyReturns` can compound them.
 */
export function runToMftCharts(equity: EquityPoint[] | undefined): {
  pnls: StrategyChartData;
  returns: StrategyChartData;
  drawdown: StrategyChartData;
  sharpe: StrategyChartData;
} {
  const pnlsPts = equityToPoints(equity);
  const start = pnlsPts[0]?.v;
  const denom = start && start !== 0 ? Math.abs(start) : 1;
  const returnPts = toPeriodChanges(pnlsPts).map((p) => ({ t: p.t, v: (p.v / denom) * 100 }));
  const drawdownPts = toDrawdown(equity ?? []).map((d) => ({ t: toUnixSec(d.ts), v: d.pct }));
  const sharpePts = toRollingSharpe(equity ?? []).map((d) => ({ t: toUnixSec(d.ts), v: d.value }));
  return {
    pnls: toChart(pnlsPts),
    returns: toChart(returnPts),
    drawdown: toChart(drawdownPts),
    sharpe: toChart(sharpePts),
  };
}

export function runToMftPerf(summary: RunSummary | undefined): StrategyPerformanceDetail | undefined {
  if (!summary) return undefined;
  return {
    analysis: {
      start_value: 0,
      end_value: summary.net_pnl,
      total_return: summary.return_pct ?? undefined,
      total_fee: summary.cost_bps != null ? summary.cost_bps / 10_000 : undefined,
      total_trades: summary.total_trades,
    },
    performance: {
      cumulative_return: summary.return_pct ?? undefined,
      sharpe: summary.sharpe_annualized || summary.sharpe,
      sortino: summary.sortino,
      calmar: summary.calmar,
      max_drawdown: summary.max_drawdown_pct ?? undefined,
      win_rate: summary.win_rate,
    },
  };
}

export function runToMftSummaryRows(
  equity: EquityPoint[] | undefined,
  summary: RunSummary | undefined,
): SummaryTableItem[] {
  const pts = equityToPoints(equity);
  const years = [...new Set(pts.map((p) => yearOf(p.t)))].sort((a, b) => a - b);
  if (years.length === 0) {
    if (!summary) return [];
    return [
      {
        time: String(new Date().getUTCFullYear()),
        sharpe: summary.sharpe_annualized || summary.sharpe,
        cagr: summary.return_pct ?? undefined,
        max_drawdown: summary.max_drawdown_pct ?? undefined,
        calmar: summary.calmar,
      },
    ];
  }
  return years.map((y) => {
    const slice = pts.filter((p) => yearOf(p.t) === y);
    const start = slice[0]?.v ?? 0;
    const end = slice[slice.length - 1]?.v ?? 0;
    const denom = start !== 0 ? Math.abs(start) : 1;
    return {
      time: String(y),
      cagr: (end - start) / denom,
    };
  });
}
