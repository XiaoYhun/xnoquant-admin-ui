"use client";
// MFT Results → Performance → "Yearly Statistics" (Figma 15205:58375). Metrics down the side,
// years across the top, grouped into collapsible sections with a metric filter and year toggles.
//
// Three sources feed the grid, which is why a metric declares one `get` taking a scope rather
// than separate lookups. A YEAR column has that year's `/summary-table` row (five metrics) and
// the per-period series narrowed to the year; the ALL column additionally has the whole of
// `/performance`.
//
// Every risk figure prefers the endpoint that reports it and falls back to re-deriving it from
// the series — see the `annualized*` helpers in lib/transform/mft-results. That fallback is what
// fills the year columns. An MFT-type run's rows come from `runToMftSummaryRows`, which buckets
// the equity curve by year and can only answer `cagr` from it; reading the row alone therefore
// left Sharpe, Calmar and Max Drawdown blank across every year, directly beside a CAGR that came
// from the very same row.
//
// What stays "—" is what no source has at all: the MFT engine reports no per-trade records
// bucketed by year (trade counts, win rate, average win/loss), no microstructure (holding time,
// fills, slippage, ticks) and no volatility-regime split.
import { useMemo, useState } from "react";
import { DoubleAltArrowDown, DoubleAltArrowUp, Magnifer, AltArrowDown } from "@solar-icons/react";

import { cn, formatAmount, formatCompact } from "@/lib/utils";
import {
  annualizedSharpe,
  annualizedSortino,
  calmarRatio,
  conditionalValueAtRisk,
  maxDrawdown,
  maxDrawdownDuration,
  monthlyReturns,
  topDrawdowns,
  valueAtRisk,
  worstLossStreak,
  type Point,
} from "@/lib/transform/mft-results";
import { monthlyReturnStats, type MonthlyReturnRow, type MonthlyReturnStats } from "@/lib/transform/pnl-buckets";
import { startingCapital } from "@/lib/transform/results";
import type { SummaryTableItem } from "@/hooks/api/use-strategy-results";
import type { RunSummary } from "@/types/domain";
import type { StrategyPerformanceDetail } from "@/hooks/api/use-strategy-performance";
import { EMPTY, GREEN_TEXT, NEUTRAL_TEXT, RED_TEXT, YELLOW_TEXT } from "./results-chrome";

/** Everything a metric may consult for one column. */
export interface Scope {
  /** The "All" column, which alone may read `/performance`. */
  isAll: boolean;
  /** That year's `/summary-table` row (year columns only). */
  row?: SummaryTableItem;
  /**
   * That window's own `RunSummary`, off `/periodic-summary` — the only source with per-year
   * trade, execution and cost figures, and the one the control plane's grid reads.
   */
  runSummary?: RunSummary;
  perf?: StrategyPerformanceDetail;
  /** Per-period `returns`, already narrowed to this column's year. */
  returns: Point[];
  /** `drawdown` series, already narrowed to this column's year. */
  drawdown: Point[];
  /**
   * Calendar-month returns (% of the run's implied capital base) for this column's window — F-057's
   * source for Best/Worst month and Positive Months (see `monthlyStats` below). Bucketed over the
   * WHOLE equity curve and only then narrowed to the column's year: diffing a curve already sliced
   * to one year turned that year's first delta into all the PnL made before it. `undefined` on the
   * XALPHA (non-run) path, which has no RunSummary to derive a capital base from.
   */
  monthlyRows?: MonthlyReturnRow[];
}

type Format = "ratioPct" | "rate" | "percent" | "number" | "count" | "periods" | "amount" | "hours" | "bps";

interface StatMetric {
  label: string;
  get: (s: Scope) => number | null | undefined;
  format?: Format;
  /** How to colour the value. Defaults to neutral white. */
  tone?: "sign" | "good" | "bad" | "graded";
}

interface StatGroup {
  name: string;
  metrics: StatMetric[];
}

const perf = (s: Scope) => s.perf?.performance;
const analysis = (s: Scope) => s.perf?.analysis;
/** The window's own run summary. Every metric that has one prefers it — it is the engine's own
 *  figure for exactly this window, where everything else is re-derived or whole-run. */
const rs = (s: Scope) => s.runSummary;

/** The window's worst drawdown, as a negative ratio — also Calmar's denominator. */
function drawdownOf(s: Scope): number | undefined {
  return (s.isAll ? perf(s)?.max_drawdown : s.row?.max_drawdown) ?? maxDrawdown(s.drawdown);
}

/** Metrics the MFT engine has no source for, in any column. */
const unavailable = (label: string): StatMetric => ({ label, get: () => undefined });

/**
 * Best/worst/positive-month stats for this column's window (F-057). Equity-delta buckets (see
 * lib/transform/pnl-buckets.ts) are preferred over compounding `s.returns`: `runToMftCharts`
 * returns an EMPTY `returns` series whenever the run has no `return_pct` to scale by, which
 * blanked these three rows for every run-scoped column even where the equity curve had data.
 * Falls back to compounding `s.returns` on the XALPHA (non-run) path, which has no RunSummary/
 * capital base to divide equity deltas by but whose `returns` series is already a genuine percent.
 */
function monthlyStats(s: Scope): MonthlyReturnStats {
  if (s.monthlyRows) return monthlyReturnStats(s.monthlyRows);
  return monthlyReturnStats(monthlyReturns(s.returns));
}

const GROUPS: StatGroup[] = [
  {
    name: "Returns",
    metrics: [
      {
        label: "Net Return",
        // `return_pct` is null on a run with no capital base to divide by, and the control plane
        // dashes it rather than inventing one. The series fallback is for the XALPHA path, whose
        // returns are genuine percents.
        get: (s) => rs(s)?.return_pct ?? (s.isAll ? perf(s)?.cumulative_return : undefined),
        format: "ratioPct",
        tone: "sign",
      },
      {
        label: "Gross Return",
        // Net plus the costs taken out of it, both as fractions of the same capital base
        // (F-064). A window's own `RunSummary` (year columns, and the run-scoped All column)
        // carries `total_fee` in raw PnL units, so it's divided by that same `startingCapital` the
        // rest of this file already uses. The XALPHA (non-run) All column has no RunSummary at
        // all, so it falls back to the capital-fraction `total_fee` `runToMftPerf` put on
        // `analysis` for that same reason — which is where this used to stop, leaving every year
        // column blank.
        get: (s) => {
          const summary = rs(s);
          if (summary) {
            const capital = startingCapital(summary);
            return capital && summary.return_pct != null
              ? summary.return_pct + summary.total_fee / capital
              : undefined;
          }
          if (!s.isAll) return undefined;
          const net = perf(s)?.cumulative_return;
          const fee = analysis(s)?.total_fee;
          return net != null && fee != null ? net + fee : undefined;
        },
        format: "ratioPct",
        tone: "sign",
      },
      {
        label: "CAGR",
        get: (s) => rs(s)?.cagr ?? (s.isAll ? perf(s)?.annual_return : s.row?.cagr),
        format: "ratioPct",
        tone: "sign",
      },
      {
        // The control plane carries this under Returns rather than Trades: the share of trades
        // that made money is a property of the return stream, and it is the same `win_rate` the
        // Trades group reports below.
        label: "Positive Trades",
        get: (s) => rs(s)?.win_rate ?? (s.isAll ? perf(s)?.win_rate : undefined),
        format: "rate",
        tone: "graded",
      },
      {
        label: "Best month",
        get: (s) => monthlyStats(s).best,
        format: "percent",
        tone: "good",
      },
      {
        label: "Worst month",
        get: (s) => monthlyStats(s).worst,
        format: "percent",
        tone: "bad",
      },
      {
        label: "Positive Months",
        get: (s) => {
          const m = monthlyStats(s);
          return m.total ? m.positive : undefined;
        },
        format: "count",
        tone: "graded",
      },
    ],
  },
  {
    name: "Risk-Adjusted",
    metrics: [
      {
        label: "Sharpe Ratio",
        get: (s) => rs(s)?.sharpe_annualized ?? (s.isAll ? perf(s)?.sharpe : s.row?.sharpe) ?? annualizedSharpe(s.returns),
        tone: "graded",
      },
      {
        label: "Sortino Ratio",
        get: (s) => rs(s)?.sortino_annualized ?? (s.isAll ? perf(s)?.sortino : undefined) ?? annualizedSortino(s.returns),
        tone: "graded",
      },
      {
        label: "Calmar Ratio",
        get: (s) =>
          rs(s)?.calmar ??
          (s.isAll ? perf(s)?.calmar : s.row?.calmar) ??
          calmarRatio(s.isAll ? perf(s)?.annual_return : s.row?.cagr, drawdownOf(s)),
        tone: "graded",
      },
      {
        label: "Volatility (ann.)",
        get: (s) => rs(s)?.volatility_annualized ?? (s.isAll ? perf(s)?.volatility : undefined),
        format: "rate",
      },
    ],
  },
  {
    name: "Drawdown",
    metrics: [
      { label: "Max Drawdown", get: drawdownOf, format: "ratioPct", tone: "bad" },
      {
        // The descent half of an episode, where Longest Recovery below is the climb back out.
        label: "Max DD Duration",
        get: (s) => rs(s)?.max_drawdown_duration_days ?? maxDrawdownDuration(s.drawdown),
        format: "periods",
        tone: "bad",
      },
      {
        // `longest_recovery_days` is deliberately NOT read: it returns an absolute epoch-day
        // rather than a span (see the results-endpoint audit), so the local derivation stands.
        label: "Longest Recovery",
        get: (s) => {
          const recoveries = topDrawdowns(s.drawdown, Infinity)
            .map((e) => e.recovery)
            .filter((r): r is number => r != null);
          return maxOf(recoveries);
        },
        format: "periods",
        tone: "bad",
      },
      {
        label: "VaR (95%)",
        get: (s) => rs(s)?.var_95_pct ?? (s.isAll ? perf(s)?.var : undefined) ?? valueAtRisk(s.returns),
        format: "ratioPct",
        tone: "bad",
      },
      {
        label: "CVaR (95%)",
        get: (s) => rs(s)?.cvar_95_pct ?? (s.isAll ? perf(s)?.cvar : undefined) ?? conditionalValueAtRisk(s.returns),
        format: "ratioPct",
        tone: "bad",
      },
    ],
  },
  {
    name: "Trades",
    metrics: [
      {
        label: "Total Trades",
        get: (s) => rs(s)?.total_trades ?? (s.isAll ? analysis(s)?.total_trades : undefined),
        format: "count",
      },
      {
        label: "Win Rate",
        get: (s) => rs(s)?.win_rate ?? (s.isAll ? perf(s)?.win_rate : undefined),
        format: "rate",
        tone: "graded",
      },
      {
        label: "Profit Factor",
        get: (s) => rs(s)?.profit_factor ?? (s.isAll ? perf(s)?.profit_factor : s.row?.profit_factor),
        tone: "graded",
      },
      // Settlement-currency amounts on the run path, where the XALPHA `analysis` reports them as
      // ratios — the run is the only source a year column has, so the amount is what shows.
      { label: "Avg Win", get: (s) => rs(s)?.avg_win, format: "amount", tone: "good" },
      { label: "Avg Loss", get: (s) => rs(s)?.avg_loss, format: "amount", tone: "bad" },
      // Ticks are an instrument-level concept neither engine surfaces.
      unavailable("Profit/Tick Ratio"),
      {
        label: "Max Consecutive Losses",
        get: (s) => rs(s)?.max_consecutive_losses ?? worstLossStreak(s.returns)?.length,
        format: "count",
        tone: "bad",
      },
    ],
  },
  {
    name: "Execution",
    metrics: [
      { label: "Avg Holding Time", get: (s) => rs(s)?.avg_holding_time_secs, format: "hours" },
      { label: "Trades < 6h", get: (s) => rs(s)?.trades_under_6h_pct, format: "rate" },
      { label: "Overnight Trades", get: (s) => rs(s)?.overnight_trades_pct, format: "rate" },
      { label: "Fill Rate", get: (s) => rs(s)?.fill_rate, format: "rate", tone: "graded" },
      { label: "Slippage (Avg)", get: (s) => rs(s)?.slippage_bps, format: "bps", tone: "bad" },
    ],
  },
  {
    name: "Cost",
    metrics: [
      {
        label: "Total Cost",
        get: (s) => rs(s)?.total_fee ?? (s.isAll ? analysis(s)?.total_fee : undefined),
        format: "amount",
        tone: "bad",
      },
      {
        label: "Fee % of Profit",
        get: (s) => {
          const fee = rs(s)?.total_fee;
          const net = rs(s)?.net_pnl;
          return fee != null && net ? Math.abs(fee / net) : undefined;
        },
        format: "rate",
        tone: "bad",
      },
      {
        label: "Fee per Trade",
        get: (s) => {
          const fee = rs(s)?.total_fee;
          const trades = rs(s)?.total_trades;
          return fee != null && trades ? fee / trades : undefined;
        },
        format: "amount",
        tone: "bad",
      },
      {
        // The share of GROSS profit the fees ate — net plus the fees is what the strategy made
        // before they were taken out, which is the base `cost_bps` can't express here.
        label: "Cost Drag",
        get: (s) => {
          const fee = rs(s)?.total_fee;
          const net = rs(s)?.net_pnl;
          if (fee == null || net == null) return undefined;
          const gross = net + fee;
          return gross ? Math.abs(fee / gross) : undefined;
        },
        format: "rate",
        tone: "bad",
      },
    ],
  },
  {
    name: "Regime",
    metrics: [
      { label: "Peak Hour Concentration", get: (s) => rs(s)?.peak_hour_concentration_pct, format: "rate" },
      // An ATR-regime split of the same run; `/volatility-regime` reports it for the whole run
      // only, never bucketed by year.
      unavailable("Low Vol Sharpe"),
      unavailable("High Vol Sharpe"),
    ],
  },
];

function maxOf(xs: number[]): number | undefined {
  return xs.length ? Math.max(...xs) : undefined;
}

function formatValue(v: number | null | undefined, format: Format = "number"): string {
  if (v == null || !Number.isFinite(v)) return EMPTY;
  switch (format) {
    case "ratioPct":
      return formatPct(v * 100);
    // A share of something, not a change in it — a win rate has no direction to sign, and "+31%"
    // read as an improvement over a baseline that doesn't exist.
    case "rate":
      return formatPct(v * 100, false);
    case "percent":
      return formatPct(v);
    case "count":
      return v.toLocaleString("en-US");
    case "periods":
      // A day and a tenth is the control plane's own precision here (`62.1d`); rounding to whole
      // days hid the difference between a two-day dip and a two-week one on short windows.
      return `${formatAmount(v, 1)}d`;
    case "amount":
      // Settlement-currency figures. Whole units: these run to millions of VND, where a decimal
      // place is noise that costs a column its width.
      return Math.round(v).toLocaleString("en-US");
    case "hours":
      return `${formatAmount(v / 3600, 1)}h`;
    case "bps":
      return `${formatAmount(v, 2)} bp`;
    default:
      return formatAmount(v, 2);
  }
}

/** Compact once a percent no longer fits a 96px year column (`+748,346.70%` → `+748.3K%`). */
function formatPct(n: number, signed = true): string {
  const abs = Math.abs(n);
  const body = abs >= 1000 ? formatCompact(abs) : formatAmount(abs, 2);
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  return `${sign}${body}%`;
}

function toneClass(v: number | null | undefined, tone: StatMetric["tone"]): string {
  if (v == null || !Number.isFinite(v)) return "text-[#9db2ce]";
  switch (tone) {
    case "sign":
      return v >= 0 ? GREEN_TEXT : RED_TEXT;
    case "good":
      return GREEN_TEXT;
    case "bad":
      return RED_TEXT;
    // "graded" marks a figure that is better when larger but has no natural zero — the design
    // paints these amber rather than green/red so they don't read as profit or loss.
    case "graded":
      return YELLOW_TEXT;
    default:
      return NEUTRAL_TEXT;
  }
}

// The metric-name column, pinned so a wide year range stays readable — scrolling to 2025 with
// the labels gone leaves eleven columns of bare numbers. It carries its own opaque background
// because the cells slide underneath it, and `shrink-0` keeps every row's labels on one grid.
const LABEL_COL = "sticky left-0 z-10 w-[172px] shrink-0 px-3";

export function YearlyStatistics({
  years,
  scopeFor,
}: {
  /** Year columns, ascending. */
  years: number[];
  /** Builds the scope for one column; `undefined` year means the All column. */
  scopeFor: (year?: number) => Scope;
}) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hiddenYears, setHiddenYears] = useState<number[]>([]);

  const shownYears = useMemo(
    () => years.filter((y) => !hiddenYears.includes(y)),
    [years, hiddenYears],
  );
  const columns = useMemo(
    () => [
      ...shownYears.map((y) => ({ key: String(y), year: y as number | undefined })),
      { key: "All", year: undefined },
    ],
    [shownYears],
  );
  const scopes = useMemo(() => columns.map((c) => scopeFor(c.year)), [columns, scopeFor]);

  // Every cell up front, keyed by metric label. The `get` functions re-derive monthly returns and
  // drawdown episodes from the raw series, so leaving them in render would redo that work on each
  // keystroke in the filter box — which changes which ROWS show, never their values.
  const values = useMemo(() => {
    const out = new Map<string, (number | null | undefined)[]>();
    for (const g of GROUPS) {
      for (const m of g.metrics) out.set(m.label, scopes.map((s) => m.get(s)));
    }
    return out;
  }, [scopes]);

  const needle = filter.trim().toLowerCase();
  const groups = GROUPS.map((g) => ({
    ...g,
    metrics: needle ? g.metrics.filter((m) => m.label.toLowerCase().includes(needle)) : g.metrics,
  })).filter((g) => g.metrics.length > 0);

  const setAllCollapsed = (value: boolean) =>
    setCollapsed(Object.fromEntries(GROUPS.map((g) => [g.name, value])));

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#1d2939] bg-background">
      <div className="flex flex-col gap-1 border-b border-[#1d2939] bg-[#151a24] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm leading-5 font-medium text-white">Yearly Statistics</span>
          <div className="flex shrink-0 items-center gap-1">
            <HeaderButton label="Expand All" onClick={() => setAllCollapsed(false)}>
              <DoubleAltArrowDown weight="Outline" className="size-5" />
            </HeaderButton>
            <HeaderButton label="Collapse All" onClick={() => setAllCollapsed(true)}>
              <DoubleAltArrowUp weight="Outline" className="size-5" />
            </HeaderButton>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-[240px] items-center gap-2 rounded-[20px] border border-[#1d2939] px-3 py-1.5">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter metric..."
              aria-label="Filter metric"
              className="min-w-0 flex-1 bg-transparent text-xs leading-[18px] text-white outline-none placeholder:text-[#9db2ce]"
            />
            <Magnifer weight="Outline" className="size-4 shrink-0 text-[#9db2ce]" />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {years.map((y) => {
              const on = !hiddenYears.includes(y);
              return (
                <button
                  key={y}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setHiddenYears((prev) => (on ? [...prev, y] : prev.filter((v) => v !== y)))
                  }
                  className={cn(
                    "cursor-pointer rounded-[40px] border px-3 py-1 text-xs leading-[18px] transition-colors",
                    on
                      ? cn("border-[rgba(103,225,193,0.3)] bg-[rgba(103,225,193,0.2)]", GREEN_TEXT)
                      : "border-[#1d2939] text-[#9db2ce]",
                  )}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="min-w-0 overflow-x-auto">
        {/* Each year column is a fixed width so long values (and many years) scroll instead of
            painting on top of the next cell. Figma 15205:58375: equal year columns, label 172. */}
        <div style={{ minWidth: 172 + columns.length * 96 }}>
          {/* Column header. The label column is fixed so every group's rows line up with it. */}
          <div className="flex h-9 items-center border-b border-[#1d2939]">
            <div className={cn(LABEL_COL, "bg-background")}>
              <span className="text-xs leading-[18px] text-[#9db2ce]">Macro</span>
            </div>
            {columns.map((c) => (
              <div key={c.key} className="flex w-24 shrink-0 justify-end overflow-hidden px-3">
                <span className="truncate text-xs leading-[18px] text-white">{c.key}</span>
              </div>
            ))}
          </div>

          {groups.map((g) => {
            const isCollapsed = collapsed[g.name];
            return (
              <div key={g.name}>
                <button
                  type="button"
                  onClick={() => setCollapsed((p) => ({ ...p, [g.name]: !p[g.name] }))}
                  aria-expanded={!isCollapsed}
                  className="flex h-8 w-full cursor-pointer items-center border-b border-[#1d2939] bg-[#1d2939]"
                >
                  {/* Pinned like the metric labels below it, so scrolling out to 2025 doesn't
                      leave you reading a block of numbers with no group name against them. */}
                  <span className="sticky left-0 flex items-center gap-2 bg-[#1d2939] px-4">
                    <AltArrowDown
                      weight="Outline"
                      className={cn("size-3 text-[#9db2ce] transition-transform", isCollapsed && "-rotate-90")}
                    />
                    <span className="text-xs leading-[18px] text-[#9db2ce]">
                      {g.name} ({g.metrics.length})
                    </span>
                  </span>
                </button>
                {!isCollapsed &&
                  g.metrics.map((m) => (
                    <div key={m.label} className="flex h-9 items-center border-b border-[#1d2939]">
                      <div className={cn(LABEL_COL, "bg-background")}>
                        <span className="text-xs leading-[18px] text-[#9db2ce]">{m.label}</span>
                      </div>
                      {columns.map((col, i) => {
                        const v = values.get(m.label)?.[i];
                        const text = formatValue(v, m.format);
                        return (
                          <div key={col.key} className="flex w-24 shrink-0 justify-end overflow-hidden px-3">
                            <span
                              title={text}
                              className={cn(
                                "truncate text-xs leading-[18px] tabular-nums",
                                toneClass(v, m.tone),
                                // The All column is the summary line, so it carries more weight.
                                col.key === "All" && "font-medium",
                              )}
                            >
                              {text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>
            );
          })}

          {groups.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-[#9db2ce]">
              No metric matches “{filter}”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1 rounded-[40px] border border-[#1d2939] bg-[#0a0e14] py-1 pr-2 pl-3 text-xs leading-[18px] text-white transition-colors hover:border-[#3e5569]"
    >
      {label}
      <span className="text-[#9db2ce]">{children}</span>
    </button>
  );
}

/** The year columns the table can show, derived from whatever `/summary-table` returned. */
export function statisticsYears(rows: SummaryTableItem[] | undefined): number[] {
  return [...new Set((rows ?? []).map((r) => Number(r.time)).filter(Number.isFinite))].sort(
    (a, b) => a - b,
  );
}
