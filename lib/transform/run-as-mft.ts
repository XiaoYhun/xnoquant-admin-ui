import type { EquityPoint, PeriodSummary, RunSummary } from "@/types/domain";
import type { StrategyChartData, SummaryTableItem } from "@/hooks/api/use-strategy-results";
import type { StrategyPerformanceDetail } from "@/hooks/api/use-strategy-performance";
import { startingCapital, toDrawdown, toRollingSharpe } from "./results";
import { toPeriodChanges, yearOf, type PeriodSelection, type Point } from "./mft-results";

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
 * Cumulative PnL → the four series the MFT screens slice. `returns` is percent of the capital the
 * run actually deployed, in the "+1.5 / -0.8" units `monthlyReturns` compounds.
 *
 * That base has to be real. This used to divide by the curve's first |equity| sample and fall
 * back to `1` when the curve started at zero — which every PnL-style curve does — turning a
 * 2,000,000 VND day into +200,000,000% and compounding a year of them into "-70.5T%". The run's
 * own capital (`net_pnl / return_pct`) is the only honest denominator, and when the summary has
 * no `return_pct` there is no percentage to state: the series comes back empty and the percent
 * metrics dash, which is what the control plane does with the same run.
 */
export function runToMftCharts(
  equity: EquityPoint[] | undefined,
  summary?: RunSummary,
): {
  pnls: StrategyChartData;
  returns: StrategyChartData;
  drawdown: StrategyChartData;
  sharpe: StrategyChartData;
} {
  const pnlsPts = equityToPoints(equity);
  const capital = startingCapital(summary);
  const returnPts = capital
    ? toPeriodChanges(pnlsPts).map((p) => ({ t: p.t, v: (p.v / capital) * 100 }))
    : [];
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
      // Annualized, like the Sharpe above it: the raw `sortino` is per-closing-trade, so reading
      // it here printed 0.12 against the control plane's 2.18 for the same run.
      sortino: summary.sortino_annualized || summary.sortino,
      calmar: summary.calmar,
      max_drawdown: summary.max_drawdown_pct ?? undefined,
      win_rate: summary.win_rate,
    },
  };
}

/**
 * The whole-run summary, narrowed to one Period-row selection — what `runToMftPerf` needs to
 * answer the Overview KPI cards and metric strip for the SELECTED period instead of always the
 * whole run.
 *
 * Only two selections have a real per-period answer: "All" (`period.year == null`) is the whole
 * run by definition, and a whole calendar year with its own `/periodic-summary` bucket is that
 * bucket's `summary` — computed by the backend over that window alone (see `PeriodSummary` in
 * types/domain.ts), so its fields are already window-scoped rather than cumulative. Every other
 * selection falls back to the whole run UNCHANGED: a month has no bucket at all, and a year backed
 * only by quarterly buckets can't be answered by summing them (Sharpe and max drawdown aren't
 * additive across sub-periods). That is a real gap in what the API offers, not something to paper
 * over with a wrong number.
 */
export function summaryForPeriod(
  whole: RunSummary | undefined,
  periods: PeriodSummary[] | undefined,
  period: PeriodSelection,
): RunSummary | undefined {
  if (period.year == null) return whole;
  if (period.month == null) {
    const bucket = periods?.find((p) => p.label === String(period.year));
    if (bucket) {
      // Same guard as `realSummary` (hooks/api/use-runs.ts): an oversized bucket's fields are all
      // zeroed placeholders, not real figures, and a whole-run number would misrepresent the
      // period rather than honestly showing "no data".
      return bucket.summary.oversized ? undefined : bucket.summary;
    }
  }
  return whole;
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
  // Same rule as the returns series above: a year's growth is only a percentage against capital
  // the run actually deployed. Without `return_pct` there is no base, and the year carries no
  // CAGR rather than one measured against a denominator of 1.
  const capital = startingCapital(summary);
  return years.map((y) => {
    const slice = pts.filter((p) => yearOf(p.t) === y);
    const start = slice[0]?.v ?? 0;
    const end = slice[slice.length - 1]?.v ?? 0;
    return {
      time: String(y),
      cagr: capital ? (end - start) / capital : undefined,
    };
  });
}
