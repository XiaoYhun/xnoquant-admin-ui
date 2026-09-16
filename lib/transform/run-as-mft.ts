import type { EquityPoint, PeriodSummary, RunSummary } from "@/types/domain";
import type { StrategyChartData, SummaryTableItem } from "@/hooks/api/use-strategy-results";
import type { StrategyPerformanceDetail } from "@/hooks/api/use-strategy-performance";
import { startingCapital, toDrawdown, toRollingSharpe } from "./results";
import { kellyCriterion, payoffRatio, recoveryFactor } from "./derived-metrics";
import {
  annualizedSharpe,
  calmarRatio,
  maxDrawdown,
  monthOf,
  quarterOf,
  toPeriodChanges,
  yearOf,
  type PeriodSelection,
  type Point,
} from "./mft-results";

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
  // `total_fee` here has to be a fraction of CAPITAL, the same basis `performance.cumulative_return`
  // uses — every consumer (Cost & Edge's Gross/Net/Cost-Drag rows, Overview's Cost Drag KPI) adds
  // or divides it against that return. `cost_bps` is cost per unit of traded NOTIONAL instead — an
  // unrelated denominator — which is why it used to print a near-zero "Total Cost -0.01%" for a run
  // that actually spent 5.37% of its capital on fees.
  const capital = startingCapital(summary);
  return {
    analysis: {
      start_value: 0,
      end_value: summary.net_pnl,
      total_return: summary.return_pct ?? undefined,
      total_fee: capital ? summary.total_fee / capital : undefined,
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
      // F-074: the run path has no server field for these two — same ported formulas the
      // control plane uses (see lib/transform/derived-metrics.ts).
      volatility: summary.volatility_annualized ?? undefined,
      win_loss_ratio: payoffRatio(summary) ?? undefined,
      recovery_factor: recoveryFactor(summary) ?? undefined,
      // The summary reports both tail figures; without them the Risk panel printed "—" for VaR and
      // CVaR on every run, while Yearly Statistics read the very same fields. Kelly has no server
      // field at all — same ported formula the control plane uses (./derived-metrics).
      var: summary.var_95_pct ?? undefined,
      cvar: summary.cvar_95_pct ?? undefined,
      kelly_criterion: kellyCriterion(summary) ?? undefined,
    },
  };
}

/**
 * The whole-run summary, narrowed to one Period-row selection — what `runToMftPerf` needs to
 * answer the Overview KPI cards and metric strip for the SELECTED period instead of always the
 * whole run.
 *
 * Three selections have a real per-period answer: "All" (`period.year == null`) is the whole run
 * by definition, and a whole calendar year OR quarter with its own `/periodic-summary` bucket
 * (labelled "2024" or "2024 Q3" — see `PeriodSummary` in types/domain.ts) is that bucket's
 * `summary`, computed by the backend over that window alone, so its fields are already
 * window-scoped rather than cumulative. Every other selection falls back to the whole run
 * UNCHANGED: a month has no bucket at all, and a year backed only by quarterly buckets can't be
 * answered by summing them (Sharpe and max drawdown aren't additive across sub-periods). That is a
 * real gap in what the API offers, not something to paper over with a wrong number.
 */
export function summaryForPeriod(
  whole: RunSummary | undefined,
  periods: PeriodSummary[] | undefined,
  period: PeriodSelection,
): RunSummary | undefined {
  if (period.year == null) return whole;
  const label =
    period.month != null
      ? undefined
      : period.quarter != null
        ? `${period.year} Q${period.quarter}`
        : String(period.year);
  if (label) {
    const bucket = periods?.find((p) => p.label === label);
    if (bucket) {
      // Same guard as `realSummary` (hooks/api/use-runs.ts): an oversized bucket's fields are all
      // zeroed placeholders, not real figures, and a whole-run number would misrepresent the
      // period rather than honestly showing "no data".
      return bucket.summary.oversized ? undefined : bucket.summary;
    }
  }
  return whole;
}

/**
 * A `/periodic-summary` bucket for exactly one calendar year, or `undefined` when there isn't one
 * (a live/paper run has none at all, and a sub-year backtest buckets by quarter instead — see
 * `PeriodSummary`'s doc comment) or the backend flagged it oversized. Shared by every function
 * below that fills a row from the bucket first and a locally-derived figure second.
 */
function yearBucket(periods: PeriodSummary[] | undefined, year: number): RunSummary | undefined {
  const bucket = periods?.find((p) => p.label === String(year));
  // Same guard as `realSummary`/`summaryForPeriod`: an oversized bucket's fields are all zeroed
  // placeholders, not real figures.
  return bucket && !bucket.summary.oversized ? bucket.summary : undefined;
}

/**
 * F-063: `/periodic-summary` is the only source with a per-year Sharpe, max drawdown, profit
 * factor and Calmar (`/summary-table`'s XALPHA equivalent, which `runToMftSummaryRows` used to be
 * limited to, has no counterpart on the run path) — reading it here is what fills the Overview
 * Yearly Summary table's four blank columns for a run-scoped view. CAGR keeps its equity-curve
 * fallback for a year the bucket doesn't cover.
 */
export function runToMftSummaryRows(
  equity: EquityPoint[] | undefined,
  summary: RunSummary | undefined,
  periods: PeriodSummary[] | undefined,
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
        profit_factor: summary.profit_factor ?? undefined,
        calmar: summary.calmar,
      },
    ];
  }
  // Same rule as the returns series above: a year's growth is only a percentage against capital
  // the run actually deployed. Without `return_pct` there is no base, and the year carries no
  // CAGR rather than one measured against a denominator of 1.
  const capital = startingCapital(summary);
  return years.map((y) => {
    const bucket = yearBucket(periods, y);
    if (bucket) {
      return {
        time: String(y),
        sharpe: bucket.sharpe_annualized || bucket.sharpe,
        cagr: bucket.return_pct ?? undefined,
        max_drawdown: bucket.max_drawdown_pct ?? undefined,
        profit_factor: bucket.profit_factor ?? undefined,
        calmar: bucket.calmar,
      };
    }
    const slice = pts.filter((p) => yearOf(p.t) === y);
    const start = slice[0]?.v ?? 0;
    const end = slice[slice.length - 1]?.v ?? 0;
    return {
      time: String(y),
      cagr: capital ? (end - start) / capital : undefined,
    };
  });
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * F-070: one row per month or quarter of `year` — the Overview summary table's Monthly/Quarterly
 * variant. Each bucket prefers an EXACT `/periodic-summary` match: only a quarter ever gets one
 * (the backend never buckets by month, see `PeriodSummary`'s doc comment), and only for a sub-year
 * backtest. Otherwise it derives from `series`, already stage-sliced but not period-filtered:
 * return over the whole run's capital base (same rule `runToMftSummaryRows` uses for a year),
 * annualized Sharpe of the bucket's own returns and max drawdown of its own drawdown series, with
 * Calmar off those two. Profit factor has no series fallback, so it stays `undefined` ("—")
 * wherever no bucket answers it — never invented.
 */
export function bucketedSummaryRows(
  mode: "month" | "quarter",
  year: number,
  series: { pnls: Point[]; returns: Point[]; drawdown: Point[] },
  periods: PeriodSummary[] | undefined,
  wholeSummary: RunSummary | undefined,
): SummaryTableItem[] {
  const capital = startingCapital(wholeSummary);
  const buckets = mode === "month" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1, 2, 3, 4];
  // Deltas against the previous sample on the WHOLE curve, so a bucket with one point still
  // measures growth from the last sample before it (Jan's first sample carries its own value).
  const pnlDeltas = toPeriodChanges(series.pnls);

  return buckets.map((n) => {
    const time = mode === "month" ? MONTH_LABELS[n - 1] : `Q${n}`;
    const inBucket = (t: number) =>
      yearOf(t) === year && (mode === "month" ? monthOf(t) === n : quarterOf(t) === n);

    if (mode === "quarter") {
      const bucket = periods?.find((p) => p.label === `${year} Q${n}`);
      const bucketSummary = bucket && !bucket.summary.oversized ? bucket.summary : undefined;
      if (bucketSummary) {
        return {
          time,
          sharpe: bucketSummary.sharpe_annualized || bucketSummary.sharpe,
          cagr: bucketSummary.return_pct ?? undefined,
          max_drawdown: bucketSummary.max_drawdown_pct ?? undefined,
          profit_factor: bucketSummary.profit_factor ?? undefined,
          calmar: bucketSummary.calmar,
        };
      }
    }

    const deltas = pnlDeltas.filter((p) => inBucket(p.t));
    const cagr = capital && deltas.length
      ? deltas.reduce((sum, p) => sum + p.v, 0) / capital
      : undefined;
    const maxDd = maxDrawdown(series.drawdown.filter((p) => inBucket(p.t)));
    return {
      time,
      sharpe: annualizedSharpe(series.returns.filter((p) => inBucket(p.t))),
      cagr,
      max_drawdown: maxDd,
      calmar: calmarRatio(cagr, maxDd),
    };
  });
}
