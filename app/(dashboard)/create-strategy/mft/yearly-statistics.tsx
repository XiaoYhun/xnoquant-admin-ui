"use client";
// MFT Results → Performance → "Yearly Statistics" (Figma 15205:58375). Metrics down the side,
// years across the top, grouped into collapsible sections with a metric filter and year toggles.
//
// Two different sources feed the grid, which is why a metric declares one `get` taking a scope
// rather than two lookups. A YEAR column can only be answered by `/summary-table` (five metrics)
// or by re-deriving from the series filtered to that year; the ALL column additionally has the
// whole of `/performance`. Anything neither can answer renders as "—" — the MFT engine reports no
// microstructure (holding time, fills, slippage, ticks) and no volatility-regime split at all.
import { useMemo, useState } from "react";
import { DoubleAltArrowDown, DoubleAltArrowUp, Magnifer, AltArrowDown } from "@solar-icons/react";

import { cn, formatAmount } from "@/lib/utils";
import {
  compound,
  monthlyReturns,
  topDrawdowns,
  worstLossStreak,
  type Point,
} from "@/lib/transform/mft-results";
import type { SummaryTableItem } from "@/hooks/api/use-strategy-results";
import type { StrategyPerformanceDetail } from "@/hooks/api/use-strategy-performance";
import { EMPTY, GREEN_TEXT, NEUTRAL_TEXT, RED_TEXT, YELLOW_TEXT } from "./results-chrome";

/** Everything a metric may consult for one column. */
export interface Scope {
  /** The "All" column, which alone may read `/performance`. */
  isAll: boolean;
  /** That year's `/summary-table` row (year columns only). */
  row?: SummaryTableItem;
  perf?: StrategyPerformanceDetail;
  /** Per-period `returns`, already narrowed to this column's year. */
  returns: Point[];
  /** `drawdown` series, already narrowed to this column's year. */
  drawdown: Point[];
}

type Format = "ratioPct" | "percent" | "number" | "count" | "periods";

interface StatMetric {
  label: string;
  get: (s: Scope) => number | undefined;
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

/** Metrics the MFT engine has no source for, in any column. */
const unavailable = (label: string): StatMetric => ({ label, get: () => undefined });

/** Monthly returns for this column's window, compounded per calendar month. */
function months(s: Scope): number[] {
  return monthlyReturns(s.returns)
    .flatMap((r) => r.months)
    .filter((m): m is number => m != null);
}

const GROUPS: StatGroup[] = [
  {
    name: "Returns",
    metrics: [
      {
        label: "Net Return",
        // Per-year the engine reports CAGR, not a cumulative figure, so a year column compounds
        // its own daily returns instead of borrowing the annualised number.
        get: (s) => (s.isAll ? perf(s)?.cumulative_return : ratioOf(compoundAll(s.returns))),
        format: "ratioPct",
        tone: "sign",
      },
      {
        label: "Gross Return",
        // Net plus the costs that were taken out of it. Only the run-level fee total exists, so
        // this is answerable for the All column alone.
        get: (s) => {
          const net = perf(s)?.cumulative_return;
          const fee = analysis(s)?.total_fee;
          return s.isAll && net != null && fee != null ? net + fee : undefined;
        },
        format: "ratioPct",
        tone: "sign",
      },
      {
        label: "CAGR",
        get: (s) => (s.isAll ? perf(s)?.annual_return : s.row?.cagr),
        format: "ratioPct",
        tone: "sign",
      },
      {
        label: "Best month",
        get: (s) => maxOf(months(s)),
        format: "percent",
        tone: "good",
      },
      {
        label: "Worst month",
        get: (s) => minOf(months(s)),
        format: "percent",
        tone: "bad",
      },
      {
        label: "Positive Months",
        get: (s) => {
          const m = months(s);
          return m.length ? m.filter((v) => v > 0).length : undefined;
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
        get: (s) => (s.isAll ? perf(s)?.sharpe : s.row?.sharpe),
        tone: "graded",
      },
      { label: "Sortino Ratio", get: (s) => (s.isAll ? perf(s)?.sortino : undefined), tone: "graded" },
      {
        label: "Calmar Ratio",
        get: (s) => (s.isAll ? perf(s)?.calmar : s.row?.calmar),
        tone: "graded",
      },
      {
        label: "Volatility (ann.)",
        get: (s) => (s.isAll ? perf(s)?.volatility : undefined),
      },
    ],
  },
  {
    name: "Drawdown",
    metrics: [
      {
        label: "Max Drawdown",
        get: (s) => (s.isAll ? perf(s)?.max_drawdown : s.row?.max_drawdown),
        format: "ratioPct",
        tone: "bad",
      },
      // Peak-to-trough duration would need the drawdown series' episode boundaries expressed in
      // calendar time; the series is per-period, so only the recovery leg below is well defined.
      unavailable("Max DD Duration"),
      {
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
        get: (s) => (s.isAll ? perf(s)?.var : undefined),
        format: "ratioPct",
        tone: "bad",
      },
      {
        label: "CVaR (95%)",
        get: (s) => (s.isAll ? perf(s)?.cvar : undefined),
        format: "ratioPct",
        tone: "bad",
      },
    ],
  },
  {
    name: "Trades",
    metrics: [
      { label: "Total Trades", get: (s) => (s.isAll ? analysis(s)?.total_trades : undefined), format: "count" },
      {
        label: "Win Rate",
        get: (s) => (s.isAll ? perf(s)?.win_rate : undefined),
        format: "ratioPct",
        tone: "graded",
      },
      {
        label: "Profit Factor",
        get: (s) => (s.isAll ? perf(s)?.profit_factor : s.row?.profit_factor),
        tone: "graded",
      },
      {
        label: "Avg Win",
        get: (s) => (s.isAll ? analysis(s)?.avg_win_trade : undefined),
        format: "ratioPct",
        tone: "good",
      },
      {
        label: "Avg Loss",
        get: (s) => (s.isAll ? analysis(s)?.avg_loss_trade : undefined),
        format: "ratioPct",
        tone: "bad",
      },
      // Ticks are an instrument-level concept the MFT bar engine never surfaces.
      unavailable("Profit/Tick Ratio"),
      {
        label: "Max Consecutive Losses",
        get: (s) => worstLossStreak(s.returns)?.length,
        format: "count",
        tone: "bad",
      },
    ],
  },
  {
    // Fills, holding time and slippage all require per-trade execution records. `/performance`
    // reports trade COUNTS and average trade RETURNS, never their timing or their fill quality.
    name: "Execution",
    metrics: [
      unavailable("Avg Holding Time"),
      unavailable("Trades < 6h"),
      unavailable("Overnight Trades"),
      unavailable("Fill Rate"),
      unavailable("Slippage (Avg)"),
    ],
  },
  {
    name: "Cost",
    metrics: [
      {
        label: "Total Cost",
        get: (s) => (s.isAll ? analysis(s)?.total_fee : undefined),
        format: "ratioPct",
        tone: "bad",
      },
      {
        label: "Fee % of Profit",
        get: (s) => {
          const fee = analysis(s)?.total_fee;
          const net = perf(s)?.cumulative_return;
          return s.isAll && fee != null && net ? Math.abs(fee / net) : undefined;
        },
        format: "ratioPct",
        tone: "bad",
      },
      {
        label: "Fee per Trade",
        get: (s) => {
          const fee = analysis(s)?.total_fee;
          const trades = analysis(s)?.total_trades;
          return s.isAll && fee != null && trades ? fee / trades : undefined;
        },
        format: "ratioPct",
        tone: "bad",
      },
      {
        label: "Cost Drag",
        get: (s) => (s.isAll ? analysis(s)?.total_fee : undefined),
        format: "ratioPct",
        tone: "bad",
      },
    ],
  },
  {
    // Intraday session buckets and ATR regimes need bar-level market data alongside the results;
    // the results API returns neither.
    name: "Regime",
    metrics: [
      unavailable("Peak Hour Concentration"),
      unavailable("Low Vol Sharpe"),
      unavailable("High Vol Sharpe"),
    ],
  },
];

function compoundAll(points: Point[]): number | undefined {
  return points.length ? compound(points.map((p) => p.v)) : undefined;
}
/** Percent → ratio, so a derived figure can share the `ratioPct` formatter. */
function ratioOf(percent: number | undefined): number | undefined {
  return percent == null ? undefined : percent / 100;
}
function maxOf(xs: number[]): number | undefined {
  return xs.length ? Math.max(...xs) : undefined;
}
function minOf(xs: number[]): number | undefined {
  return xs.length ? Math.min(...xs) : undefined;
}

function formatValue(v: number | undefined, format: Format = "number"): string {
  if (v == null || !Number.isFinite(v)) return EMPTY;
  switch (format) {
    case "ratioPct":
      return `${v > 0 ? "+" : ""}${formatAmount(v * 100, 2)}%`;
    case "percent":
      return `${v > 0 ? "+" : ""}${formatAmount(v, 2)}%`;
    case "count":
      return v.toLocaleString("en-US");
    case "periods":
      return `${Math.round(v)}d`;
    default:
      return formatAmount(v, 2);
  }
}

function toneClass(v: number | undefined, tone: StatMetric["tone"]): string {
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
    const out = new Map<string, (number | undefined)[]>();
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
        <div className="min-w-[560px]">
          {/* Column header. The label column is fixed so every group's rows line up with it. */}
          <div className="flex h-9 items-center border-b border-[#1d2939]">
            <div className="w-[172px] shrink-0 px-3">
              <span className="text-xs leading-[18px] text-[#9db2ce]">Macro</span>
            </div>
            {columns.map((c) => (
              <div key={c.key} className="flex min-w-0 flex-1 justify-end px-3">
                <span className="text-xs leading-[18px] text-white">{c.key}</span>
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
                  className="flex h-8 w-full cursor-pointer items-center border-b border-[#1d2939] bg-[#1d2939] px-4"
                >
                  <span className="flex items-center gap-2">
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
                      <div className="w-[172px] shrink-0 px-3">
                        <span className="text-xs leading-[18px] text-[#9db2ce]">{m.label}</span>
                      </div>
                      {columns.map((col, i) => {
                        const v = values.get(m.label)?.[i];
                        return (
                          <div key={col.key} className="flex min-w-0 flex-1 justify-end px-3">
                            <span
                              className={cn(
                                "text-xs leading-[18px] whitespace-nowrap",
                                toneClass(v, m.tone),
                                // The All column is the summary line, so it carries more weight.
                                col.key === "All" && "font-medium",
                              )}
                            >
                              {formatValue(v, m.format)}
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
