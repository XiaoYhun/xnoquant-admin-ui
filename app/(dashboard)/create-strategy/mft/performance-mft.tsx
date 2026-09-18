"use client";
// MFT Results → "Performance" (Figma 15205:56946). Ratio panel, the Yearly Statistics grid, the
// monthly-return heatmap, net daily PnL bars and the daily-return histogram.
import { useCallback, useMemo } from "react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { ChartState, chartStatus } from "@/components/charts/chart-state";
import { formatAmount } from "@/lib/utils";
import { startingCapital, toReturnHistogram } from "@/lib/transform/results";
import {
  filterByPeriod,
  monthlyReturns,
  monthsOf,
  quartersOf,
  sliceStage,
  toPeriodChanges,
  toPoints,
  yearOf,
  type PeriodSelection,
} from "@/lib/transform/mft-results";
import { useMftResultsSource } from "@/hooks/api/use-mft-results-source";
import { useRunCurrency, useRunPeriodicSummary, useRunVolatilityRegime } from "@/hooks/api/use-runs";
import {
  ChartCard,
  MetricPanel,
  YELLOW_TEXT,
  money,
  num,
  pctFromPercent,
  pctFromRatio,
  toneBySign,
  type Metric,
} from "./results-chrome";
import { monthlyReturnPct } from "@/lib/transform/pnl-buckets";
import { YearlyStatistics, statisticsYears, type Scope, type StatColumn } from "./yearly-statistics";
import type { Granularity } from "../mft-results-view";
import type { PeriodGranularity, PeriodSummary, RunSummary, SampleScope } from "@/types/domain";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DAY_SECONDS = 86_400;

/** A `/periodic-summary` label, shortened for a 96px column — "2024-03" → "Mar", "2024 Q3" → "Q3". */
function bucketLabel(label: string): string {
  const month = /^\d{4}-(\d{2})$/.exec(label);
  if (month) return MONTHS[Number(month[1]) - 1] ?? label;
  return label.replace(/^\d{4}\s+/, "");
}

/** The calendar months (1-12) an inclusive `YYYY-MM-DD` range touches. */
function monthsBetween(start: string, end: string): number[] {
  const first = Number(start.slice(5, 7));
  const last = Number(end.slice(5, 7));
  const out: number[] = [];
  for (let m = first; m <= last; m++) out.push(m);
  return out;
}

const GREEN = "#67e1c1";
const RED = "#ff135b";

function dateLabel(t: number): string {
  return new Date(t * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });
}

// ---- monthly return heatmap (Figma 15205:57102) ----------------------------------------------

/** Cell tint: hue by sign, opacity by magnitude relative to the grid's largest absolute month. */
function cellStyle(v: number | undefined, peak: number): React.CSSProperties {
  if (v == null || peak <= 0) return {};
  const weight = Math.min(1, Math.abs(v) / peak);
  // Floor the alpha so a small but real month still reads as coloured rather than blank.
  const alpha = 0.12 + weight * 0.5;
  return { backgroundColor: `${v >= 0 ? "rgba(103,225,193," : "rgba(255,19,91,"}${alpha})` };
}

function MonthlyReturns({ rows }: { rows: ReturnType<typeof monthlyReturns> }) {
  const peak = Math.max(
    0,
    ...rows.flatMap((r) => r.months.filter((m): m is number => m != null).map(Math.abs)),
  );

  return (
    <ChartCard
      title="Monthly Return"
      right={
        <div className="flex items-center gap-2">
          <span className="text-[10px] leading-[14px] text-[#9db2ce]">Less</span>
          <span className="h-2 w-16 rounded-full bg-[linear-gradient(90deg,rgba(255,19,91,0.6)_0%,rgba(29,41,57,1)_50%,rgba(103,225,193,0.6)_100%)]" />
          <span className="text-[10px] leading-[14px] text-[#9db2ce]">More</span>
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs leading-[18px] font-medium text-white">
                Year
              </th>
              {MONTHS.map((m) => (
                <th
                  key={m}
                  className="px-1 py-2 text-center text-xs leading-[18px] font-medium text-white"
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year}>
                <td className="px-3 py-1 text-xs leading-[18px] text-white">{r.year}</td>
                {r.months.map((v, i) => (
                  <td key={i} className="p-0.5">
                    <div
                      className="flex h-7 items-center justify-center rounded text-[10px] leading-[14px] text-white"
                      style={cellStyle(v, peak)}
                      title={v == null ? undefined : `${MONTHS[i]} ${r.year}: ${pctFromPercent(v)}`}
                    >
                      {v == null ? "" : formatAmount(v, 1)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ---- charts ----------------------------------------------------------------------------------

function dailyPnlOption(points: { t: number; v: number }[]): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: points.map((p) => dateLabel(p.t)),
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: "#9db2ce",
        interval: Math.max(0, Math.ceil(points.length / 8) - 1),
      },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 10 } },
    series: [
      {
        type: "bar",
        name: "Net PnL",
        data: points.map((p) => ({ value: p.v, itemStyle: { color: p.v >= 0 ? GREEN : RED } })),
        barMaxWidth: 12,
      },
    ],
  };
}

function distributionOption(bins: ReturnType<typeof toReturnHistogram>): EChartsOption {
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number; value: number }[];
        const b = bins[arr[0]?.dataIndex ?? 0];
        if (!b) return "";
        return `${formatAmount(b.lower, 2)}% – ${formatAmount(b.lower + (bins[1]?.lower - bins[0]?.lower || 0), 2)}%<br/>${arr[0].value} days`;
      },
    },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: bins.map((b) => `${formatAmount(b.center, 1)}%`),
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: "#9db2ce",
        interval: Math.max(0, Math.ceil(bins.length / 10) - 1),
      },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 10 } },
    series: [
      {
        type: "bar",
        name: "Days",
        data: bins.map((b) => ({
          value: b.count,
          itemStyle: { color: b.center < 0 ? RED : GREEN },
        })),
        barCategoryGap: "10%",
      },
    ],
  };
}

// ---- view ------------------------------------------------------------------------------------

export function PerformanceMft({
  strategyId,
  stage,
  period,
  runId,
  sample,
  granularity,
}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
  runId?: string;
  sample?: SampleScope;
  /** The Period row's Mo/Qtr/Ytd toggle — what one statistics column covers. */
  granularity: Granularity;
}) {
  // `period` is deliberately NOT passed here: via `scopeFor(undefined)` below this feeds the
  // Yearly Statistics grid's "All" column, which has to stay the true whole-run rollup no matter
  // what the Period row has selected, the same way its year columns don't filter to one year either.
  const src = useMftResultsSource({ strategyId, stage, runId, sample });
  // F-078: the ratio panel IS a headline figure like Overview's KPI cards, so it follows the Period
  // row — which is why it reads this scoped call rather than `src`. `period` is not a query key
  // (see use-mft-results-source.ts): both calls share the same three queries, and this one only
  // re-selects the matching `/periodic-summary` bucket. A month has no bucket, so a month-scoped
  // selection falls back to the whole run (summaryForPeriod) rather than inventing a figure.
  const scopedSrc = useMftResultsSource({ strategyId, stage, runId, period, sample });
  // Whole-run only (see Scope.volRegime in yearly-statistics.tsx) — the All column's two regime
  // Sharpes. Rides the same query the Regime tab uses, so opening both costs one request.
  const volRegime = useRunVolatilityRegime(runId, sample).data ?? undefined;
  // Settlement currency for the money labels below (and the Yearly Statistics ones).
  const currency = useRunCurrency(runId);
  // The ratio panel's own figures (period-scoped); the All column reads `src.perf` via scopeFor.
  const perf = scopedSrc.perf;
  const summaryRows = src.summaryRows;
  // `/periodic-summary` buckets by label ("2018", or "2018 Q3" on a sub-year backtest); the year
  // is what the grid's columns are keyed on, so index by the label's leading year.
  const periodByYear = useMemo(() => {
    const m = new Map<number, RunSummary>();
    for (const p of src.periods ?? []) {
      const y = Number(p.label.slice(0, 4));
      if (Number.isFinite(y) && p.summary) m.set(y, p.summary);
    }
    return m;
  }, [src.periods]);
  const returns = src.returns;
  const pnls = src.pnls;
  const dd = src.drawdown;

  // Stage slice first (the charts endpoint returns every stage at once), then the Period row.
  const returnPts = useMemo(
    () => filterByPeriod(sliceStage(toPoints(returns.data), returns.data, stage), period),
    [returns.data, stage, period],
  );
  const dailyPnl = useMemo(
    () => toPeriodChanges(filterByPeriod(sliceStage(toPoints(pnls.data), pnls.data, stage), period)),
    [pnls.data, stage, period],
  );

  const monthly = useMemo(() => monthlyReturns(returnPts), [returnPts]);
  const bins = useMemo(() => toReturnHistogram(returnPts.map((p) => p.v)), [returnPts]);

  // Stage-wide series (NOT period-filtered) back the year columns — each column narrows to its own
  // year, so pre-filtering to the selected period would empty every other column.
  const stageReturns = useMemo(
    () => sliceStage(toPoints(returns.data), returns.data, stage),
    [returns.data, stage],
  );
  const stageDrawdown = useMemo(
    () => sliceStage(toPoints(dd.data), dd.data, stage),
    [dd.data, stage],
  );
  // F-057: the source Best/Worst month and Positive Months read (see Scope.monthlyRows in
  // yearly-statistics.tsx). Bucketed once over the stage-wide equity curve — each year column then
  // takes its own rows — because a curve sliced to one year before diffing credits that year's
  // first month with everything earned before it. `undefined` on the XALPHA (non-run) path, which
  // has no RunSummary to derive a capital base from.
  const monthlyRows = useMemo(() => {
    const capitalBase = startingCapital(src.summary);
    return capitalBase ? monthlyReturnPct(sliceStage(toPoints(pnls.data), pnls.data, stage), capitalBase) : undefined;
  }, [pnls.data, stage, src.summary]);

  // The year columns come from whichever source has them. `/periodic-summary` is the richer one
  // and covers years the equity curve alone never reaches (2016-17 here, before the first fill).
  const years = useMemo(
    () =>
      periodByYear.size
        ? [...periodByYear.keys()].sort((a, b) => a - b)
        : statisticsYears(summaryRows),
    [periodByYear, summaryRows],
  );

  // Mo/Qtr break the SELECTED year down. `/periodic-summary` computes a full RunSummary per
  // bucket — the same endpoint the year columns already read, asked for a smaller bucket — so a
  // month column is the engine's own figure for that month, not a re-derivation. Omitting
  // `granularity` (Ytd) leaves the shared query and its auto-selected buckets exactly as they were.
  const apiGranularity: PeriodGranularity | undefined =
    granularity === "Mo" ? "monthly" : granularity === "Qtr" ? "quarterly" : undefined;
  // Both breakdowns are fetched as soon as the tab opens, so flipping Mo/Qtr swaps the columns
  // without waiting on a round trip. They are the same endpoint the year columns already read and
  // the engine caches them, so the cost is two requests the tab was going to make on the first
  // switch anyway.
  const monthlyQ = useRunPeriodicSummary(runId, sample, "monthly");
  const quarterlyQ = useRunPeriodicSummary(runId, sample, "quarterly");
  const bucketQ = apiGranularity === "monthly" ? monthlyQ : quarterlyQ;
  const subYearBuckets = useMemo(() => {
    if (!apiGranularity || period.year == null) return undefined;
    const prefix = String(period.year);
    const found = (bucketQ.data ?? []).filter((b) => b.label.startsWith(prefix));
    return found.length ? found : undefined;
  }, [apiGranularity, period.year, bucketQ.data]);

  // A switch that beat its prefetch. The columns the year is ABOUT to break into are already known
  // from the series (the same months/quarters the Period row's own pills offer), so the grid can
  // hold its final shape while the buckets land instead of flashing the year columns. Only ever
  // while a year IS selected — Mo/Qtr with the Period row on "All" has no year to break down, and
  // the grid stays the yearly one it already was.
  const breakingDown = !!apiGranularity && period.year != null && !subYearBuckets;
  const loading = breakingDown && bucketQ.isLoading;
  const pendingColumns: StatColumn[] | undefined = useMemo(() => {
    if (!loading || period.year == null) return undefined;
    const year = period.year;
    const found =
      apiGranularity === "monthly"
        ? monthsOf(stageReturns, year).map((m) => ({ key: `pending-${m}`, label: MONTHS[m - 1] }))
        : quartersOf(stageReturns, year).map((q) => ({ key: `pending-${q}`, label: `Q${q}` }));
    return found.length ? found : undefined;
  }, [loading, apiGranularity, period.year, stageReturns]);

  const columns: StatColumn[] = useMemo(
    () =>
      subYearBuckets?.map((b) => ({ key: b.label, label: bucketLabel(b.label) })) ??
      pendingColumns ??
      years.map((y) => ({ key: String(y), label: String(y) })),
    [subYearBuckets, pendingColumns, years],
  );
  const title =
    subYearBuckets || pendingColumns
      ? apiGranularity === "monthly"
        ? "Monthly Statistics"
        : "Quarterly Statistics"
      : "Yearly Statistics";

  const scopeForBucket = useCallback(
    (bucket: PeriodSummary): Scope => {
      // The bucket's own inclusive date range, which is what narrows the series — a label like
      // "2024 Q3" would otherwise have to be parsed back into months.
      const from = Date.parse(`${bucket.start_date}T00:00:00Z`) / 1000;
      const to = Date.parse(`${bucket.end_date}T00:00:00Z`) / 1000 + DAY_SECONDS;
      const inWindow = (t: number) => t >= from && t < to;
      const months = monthsBetween(bucket.start_date, bucket.end_date);
      return {
        isAll: false,
        // `oversized` marks a placeholder of zeroes, not a computed window (see run-as-mft).
        runSummary: bucket.summary?.oversized ? undefined : bucket.summary,
        returns: stageReturns.filter((p) => inWindow(p.t)),
        drawdown: stageDrawdown.filter((p) => inWindow(p.t)),
        // Best/Worst month over a single month is that month itself — the rows are kept whole and
        // the months outside the bucket blanked, so the "x/y" denominator counts only its own.
        monthlyRows: monthlyRows
          ?.filter((r) => r.year === Number(bucket.label.slice(0, 4)))
          .map((r) => ({ ...r, months: r.months.map((v, i) => (months.includes(i + 1) ? v : undefined)) })),
      };
    },
    [stageReturns, stageDrawdown, monthlyRows],
  );

  const scopeForYear = useCallback(
    (year?: number): Scope =>
      year == null
        ? {
            isAll: true,
            // Whole-run, unlike the ratio panel above — the All column never narrows to the period.
            perf: src.perf,
            // The whole-run summary answers the All column with the same fields the year columns
            // read, so the summary line isn't a different calculation from the ones above it.
            runSummary: src.summary,
            returns: stageReturns,
            drawdown: stageDrawdown,
            monthlyRows,
            volRegime,
          }
        : {
            isAll: false,
            row: summaryRows?.find((r) => Number(r.time) === year),
            runSummary: periodByYear.get(year),
            returns: stageReturns.filter((p) => yearOf(p.t) === year),
            drawdown: stageDrawdown.filter((p) => yearOf(p.t) === year),
            monthlyRows: monthlyRows?.filter((r) => r.year === year),
          },
    [src.perf, src.summary, summaryRows, periodByYear, stageReturns, stageDrawdown, monthlyRows, volRegime],
  );

  // One column key in, one scope out: a month/quarter column names its bucket, a year column its
  // year, and `undefined` is the All column either way.
  const scopeFor = useCallback(
    (key?: string): Scope => {
      const bucket = key == null ? undefined : subYearBuckets?.find((b) => b.label === key);
      if (bucket) return scopeForBucket(bucket);
      return scopeForYear(key == null ? undefined : Number(key));
    },
    [subYearBuckets, scopeForBucket, scopeForYear],
  );

  const p = perf?.performance;
  const a = perf?.analysis;
  // F-074: on the run path (an HFT/MFT run) the summary is set and Avg Win/Avg Loss are
  // settlement-currency amounts (`RunSummary.avg_win`/`avg_loss`); the XALPHA strategy/stage path
  // has no RunSummary but already reports these as ratios on `analysis` — kept as-is there.
  // Period-scoped, like the rest of the panel these two rows belong to.
  const runSummary = scopedSrc.summary;

  const rows: Metric[][] = [
    [
      { label: "Sharpe Ratio", value: num(p?.sharpe), tone: YELLOW_TEXT },
      { label: "Sortino Ratio", value: num(p?.sortino), tone: YELLOW_TEXT },
      { label: "Calmar Ratio", value: num(p?.calmar), tone: YELLOW_TEXT },
      { label: "Volatility (ann.)", value: pctFromRatio(p?.volatility) },
    ],
    [
      {
        // Money on the run path, a ratio on the XALPHA one — the unit is only true for the former.
        label: runSummary ? `Avg Win (${currency})` : "Avg Win",
        value: runSummary ? money(runSummary.avg_win) : pctFromRatio(a?.avg_win_trade),
        tone: toneBySign(runSummary ? runSummary.avg_win : a?.avg_win_trade),
      },
      {
        label: runSummary ? `Avg Loss (${currency})` : "Avg Loss",
        value: runSummary ? money(runSummary.avg_loss) : pctFromRatio(a?.avg_loss_trade),
        tone: toneBySign(runSummary ? runSummary.avg_loss : a?.avg_loss_trade),
      },
      { label: "Payoff Ratio", value: num(p?.win_loss_ratio), tone: YELLOW_TEXT },
      { label: "Recovery Factor", value: num(p?.recovery_factor), tone: YELLOW_TEXT },
    ],
  ];

  const pnlStatus = chartStatus({
    loading: pnls.isLoading,
    error: pnls.isError,
    empty: !dailyPnl.length,
  });
  const distStatus = chartStatus({
    loading: returns.isLoading,
    error: returns.isError,
    empty: !bins.length,
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricPanel rows={rows} />

      {years.length > 0 ? (
        <YearlyStatistics
          title={title}
          columns={columns}
          scopeFor={scopeFor}
          currency={currency}
          loading={loading && !!pendingColumns}
        />
      ) : (
        <div className="rounded-xl border border-[#1d2939] bg-background px-4 py-8 text-center text-xs text-[#9db2ce]">
          No yearly breakdown for this stage.
        </div>
      )}

      {monthly.length > 0 ? (
        <MonthlyReturns rows={monthly} />
      ) : (
        <ChartCard title="Monthly Return">
          <ChartState status="empty" detail="No return series for this stage and period." />
        </ChartCard>
      )}

      <ChartCard title="Net Daily PnL">
        <ChartState status={pnlStatus} detail="No PnL series for this stage and period.">
          <BaseChart option={dailyPnlOption(dailyPnl)} style={{ height: 240 }} />
        </ChartState>
      </ChartCard>

      <ChartCard title="Daily Return Distribution">
        <ChartState status={distStatus} detail="No return series for this stage and period.">
          <BaseChart option={distributionOption(bins)} style={{ height: 240 }} />
        </ChartState>
      </ChartCard>
    </div>
  );
}
