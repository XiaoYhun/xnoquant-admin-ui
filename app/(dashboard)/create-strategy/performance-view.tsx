"use client";
// OWNED BY: Results "Performance" agent — Figma node 14175:92246.
// PnL summary card → Monthly Return heatmap → PnL bar chart + Daily Return Distribution histogram.
//
// Data: `GET /api/runs/{id}/summary` (RunSummary) + `GET /api/runs/{id}/equity-curve`
// (EquityPoint[]) — the same two endpoints the hft-platform reference UI uses for its results
// page. The curve is *cumulative realized PnL*, so every per-day/per-month figure here is
// derived from it in `lib/transform/results.ts` rather than fetched.
//
// Percent framing needs starting capital, which the API only publishes indirectly as
// `return_pct = net_pnl / capital`; when that's null (always for live runs, per the spec) the
// heatmap and histogram fall back to absolute PnL and say so in the panel header.
import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { useRunCurrency, useRunEquity, useRunSummary } from "@/hooks/api/use-runs";
import { mergeLiveSummary, preferLiveEquity, useLiveSnapshot } from "@/hooks/api/use-run-live-snapshot";
import {
  annualizedReturn,
  curveSpanMs,
  equityStats,
  startingCapital,
  padDailyPnl,
  toDailyPnlPoints,
  toMonthlyPnl,
  toReturnHistogram,
  niceStep,
  type HistogramBin,
  toWeekdayPnl,
  type DayPoint,
  type MonthPnl,
} from "@/lib/transform/results";
import { cn, formatAmount, formatSignedAmount } from "@/lib/utils";
import { ChartCard, MockNote } from "./results-chart-card";

// Gradient text — Figma cells/values use these clipped gradients (angles vary 143–165° per
// node; the canonical project angles below are visually identical).
const GREEN_TEXT =
  "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const RED_TEXT =
  "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

const DASH = "—";

/** Width of the Net Daily PNL window, in calendar days. */
const NET_DAILY_PNL_DAYS = 30;

function fmtSigned(v: number, digits = 2): string {
  return formatSignedAmount(v, digits);
}

function fmtPct(v: number, digits = 2): string {
  return `${v > 0 ? "+" : ""}${formatAmount(v, digits)}%`;
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

type MetricTone = "green" | "red";

interface SummaryMetric {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  tone?: MetricTone;
}

function toneOf(v: number): MetricTone {
  return v >= 0 ? "green" : "red";
}

function SummaryMetricCell({ metric }: { metric: SummaryMetric }) {
  const { label, value, unit, delta, tone } = metric;
  const valueText = tone === "green" ? GREEN_TEXT : tone === "red" ? RED_TEXT : "text-white";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="flex flex-wrap items-end gap-1">
        <span className={cn("text-[14px] font-semibold leading-5", valueText)}>{value}</span>
        {unit && <span className="text-[10px] leading-[14px] text-muted-foreground">{unit}</span>}
      </span>
      {delta && (
        <span className="text-[10px] leading-[14px] text-muted-foreground">{delta}</span>
      )}
    </div>
  );
}

const EMPTY_ROW_1: SummaryMetric[] = [
  { label: "Gross PnL", value: DASH },
  { label: "Net PnL", value: DASH },
  { label: "Total Return", value: DASH },
];
const EMPTY_ROW_2: SummaryMetric[] = [
  { label: "CAGR", value: DASH },
  { label: "Avg Daily PnL", value: DASH },
  { label: "Best day", value: DASH },
  { label: "Worst day", value: DASH },
];

function SummaryCard({ rows }: { rows: [SummaryMetric[], SummaryMetric[]] }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-[rgba(29,33,38,0.2)] px-3 py-2">
      <div className="flex flex-col gap-2">
        {/* Top row: 3 metrics on a 4-col grid so they align above the bottom row (no dividers). */}
        <div className="grid grid-cols-2 gap-4 @[520px]:grid-cols-4">
          {rows[0].map((m) => (
            <SummaryMetricCell key={m.label} metric={m} />
          ))}
        </div>
        <div className="h-px w-full bg-border" />
        <div className="grid grid-cols-2 gap-4 @[520px]:grid-cols-4">
          {rows[1].map((m) => (
            <SummaryMetricCell key={m.label} metric={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bar + axis vocabulary (Figma 15039:41614)
// ---------------------------------------------------------------------------

// Every bar in this tab fades away from its baseline: fully saturated where it meets the zero
// line, washing out toward the tip. Exact stops read off the exported bar SVGs — gains
// #02795F→#05E6B5, losses #FF135B→#FFCCE2. Gradient coordinates are relative to each bar's own
// bounding box, where y=0 is its top edge, so a bar growing UP needs the opposite stop order to
// one hanging DOWN.
const grad = (from: string, to: string) => ({
  type: "linear" as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: from },
    { offset: 1, color: to },
  ],
});
/** Gain, growing up: dark at the tip, bright at the zero line. */
const BAR_GAIN = grad("#02795f", "#05e6b5");
/** Loss, hanging down from zero: hot at the zero line, pale at the tip. */
const BAR_LOSS_DOWN = grad("#ff135b", "#ffcce2");
/** Loss, growing up (the histogram's counts): pale at the tip, hot at the baseline. */
const BAR_LOSS_UP = grad("#ffcce2", "#ff135b");

/** Only the outer tip is rounded; the end sitting on the axis stays square. */
const RADIUS_UP: [number, number, number, number] = [3, 3, 0, 0];
const RADIUS_DOWN: [number, number, number, number] = [0, 0, 3, 3];

/** 12,000 → "10K" style ticks; the design's axes are always compact. */
function compactTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value / 1_000_000}M`;
  if (abs >= 1000) return `${value / 1000}K`;
  return `${value}`;
}

/**
 * A round bound that covers the data, so the axis can be mirrored around zero the way the design
 * draws it (10K / 5K / 0 / -5K / -10K) instead of ECharts' asymmetric auto-scale, which puts the
 * zero line at a different height in every panel.
 */
export function niceSymmetricMax(values: number[]): number | undefined {
  const peak = Math.max(0, ...values.map(Math.abs));
  if (peak === 0) return undefined; // all-flat: let ECharts pick, there's nothing to mirror
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  for (const f of [1, 1.5, 2, 2.5, 5]) {
    if (peak <= f * magnitude) return f * magnitude;
  }
  return 10 * magnitude;
}

/** Horizontal rules only, no axis spine — the design draws no vertical gridlines or ticks. */
const CATEGORY_AXIS = {
  type: "category" as const,
  axisTick: { show: false },
  axisLine: { lineStyle: { color: "#1d2939" } },
} as const;

// ---------------------------------------------------------------------------
// Monthly Return heatmap
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A month with no equity points reads as a blank cell, not a 0% one. */
type MonthCell = number | null;
interface YearlyReturns {
  year: number;
  months: MonthCell[]; // 12 entries, Jan..Dec
  /** Sum of the year's populated months; null for a year with no data at all. */
  ytd: MonthCell;
}

/** Pivot the flat monthly series into one row per year, gaps left null. */
function toYearlyRows(months: MonthPnl[], scale: number): YearlyReturns[] {
  const byYear = new Map<number, YearlyReturns>();
  for (const m of months) {
    let row = byYear.get(m.year);
    if (!row) {
      row = { year: m.year, months: Array<MonthCell>(12).fill(null), ytd: null };
      byYear.set(m.year, row);
    }
    row.months[m.month] = m.value * scale;
  }
  for (const row of byYear.values()) {
    const seen = row.months.filter((v): v is number => v !== null);
    row.ytd = seen.length === 0 ? null : seen.reduce((a, b) => a + b, 0);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

// Exact Figma fills: gain = rgba(103,225,193,α) (Green/300), loss = rgba(225,103,103,α) (muted
// maroon). α scales with magnitude at the same 10/20/30/60% steps used for both signs. `step` is
// what one alpha band is worth: 1 (percentage point) in % mode, a third of the largest month in
// absolute mode, so the ramp still spreads across the data either way.
function heatCellColor(v: number, step: number): string {
  const abs = Math.abs(v) / (step || 1);
  const alpha = abs < 1 ? 0.1 : abs < 2 ? 0.2 : abs < 3 ? 0.3 : 0.6;
  return v >= 0 ? `rgba(103,225,193,${alpha})` : `rgba(225,103,103,${alpha})`;
}

function MonthlyReturnPanel({
  rows,
  step,
  isPct,
  note,
}: {
  rows: YearlyReturns[];
  step: number;
  isPct: boolean;
  note?: string;
}) {
  // Heatmap cells are ~48px wide; two decimals do not fit.
  const fmt = (v: number) => (isPct ? fmtPct(v, 1) : fmtSigned(v, 0));
  return (
    <ChartCard
      title="Monthly Return"
      controls={
        <>
          {note && <MockNote>{note}</MockNote>}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Loss</span>
            <span className="h-1.5 w-16 rounded-full bg-[linear-gradient(90deg,#ff135b_0%,#67e1c1_100%)]" />
            <span>Gain</span>
          </div>
        </>
      }
    >

      {/* Full-bleed cells (flex-1, no gaps) that fill each row; rows split by a border.
          Scrolls horizontally inside the panel when narrow rather than overflowing the page. */}
      <div className="min-w-0 overflow-x-auto">
        <div className="min-w-[740px]">
          <div className="flex items-center border-b border-border">
            <span className="flex-1 px-3 py-2 text-xs text-muted-foreground">Year</span>
            {MONTHS.map((m) => (
              <span key={m} className="flex-1 px-3 py-2 text-center text-xs text-muted-foreground">
                {m}
              </span>
            ))}
            <span className="flex-1 px-3 py-2 text-center text-xs text-muted-foreground">YTD</span>
          </div>
          {rows.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No monthly returns for this run.
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.year}
                className="flex items-stretch border-b border-border last:border-b-0"
              >
                <span className="flex flex-1 items-center px-3 py-2.5 text-sm text-white">
                  {row.year}
                </span>
                {row.months.map((v, i) => (
                  <div
                    key={i}
                    style={v === null ? undefined : { backgroundColor: heatCellColor(v, step) }}
                    className="flex flex-1 items-center justify-center px-3 py-2.5"
                  >
                    <span
                      className={cn(
                        "text-xs font-medium",
                        v === null ? "text-muted-foreground" : v >= 0 ? GREEN_TEXT : RED_TEXT,
                      )}
                    >
                      {v === null ? DASH : fmt(v)}
                    </span>
                  </div>
                ))}
                {/* YTD closes the row: the year's realised total, summing only months that
                    actually have equity points so a part-year reads as its own progress. */}
                <div className="flex flex-1 items-center justify-center px-3 py-2.5">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      row.ytd === null ? "text-muted-foreground" : row.ytd >= 0 ? GREEN_TEXT : RED_TEXT,
                    )}
                  >
                    {row.ytd === null ? DASH : fmt(row.ytd)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Net Daily PNL + Weekly performance (Figma 15039:42982 / 15039:43339)
// ---------------------------------------------------------------------------

/**
 * Signed PnL bars on a zero-mirrored axis — shared by the by-date and by-weekday panels, which
 * differ only in bar width and how many categories they carry.
 */
export function buildSignedPnlOption(points: DayPoint[], barWidth: number | string): EChartsOption {
  const bound = niceSymmetricMax(points.map((p) => p.value));
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: { ...CATEGORY_AXIS, data: points.map((p) => p.label) },
    yAxis: {
      type: "value",
      ...(bound === undefined ? {} : { min: -bound, max: bound, interval: bound / 2 }),
      axisLabel: { formatter: compactTick },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar" as const,
        barWidth,
        data: points.map((p) => ({
          value: p.value,
          itemStyle:
            p.value >= 0
              ? { color: BAR_GAIN, borderRadius: RADIUS_UP }
              : { color: BAR_LOSS_DOWN, borderRadius: RADIUS_DOWN },
        })),
      },
    ],
  };
}

function NetDailyPnlPanel({
  points,
  currency,
  note,
}: {
  points: DayPoint[];
  currency: string;
  note?: string;
}) {
  const option = useMemo(() => buildSignedPnlOption(points, "42%"), [points]);
  return (
    <ChartCard
      title={`Net Daily PNL (${currency})`}
      controls={note ? <MockNote>{note}</MockNote> : undefined}
      expandable={false}
    >
      <BaseChart option={option} />
    </ChartCard>
  );
}

function WeeklyPerformancePanel({
  points,
  currency,
  note,
}: {
  points: DayPoint[];
  currency: string;
  note?: string;
}) {
  // Wider bars: seven categories at most, and the design draws them as 20px slabs.
  const option = useMemo(() => buildSignedPnlOption(points, 20), [points]);
  return (
    <ChartCard
      title={`Weekly performance (${currency})`}
      controls={note ? <MockNote>{note}</MockNote> : undefined}
      expandable={false}
    >
      <BaseChart option={option} />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Daily Return Distribution histogram
// ---------------------------------------------------------------------------

export function buildDistributionOption(bins: HistogramBin[], isPct: boolean): EChartsOption {
  // Bins are symmetric around 0, so the first half is exactly the loss side.
  const negative = bins.length / 2;
  const width = bins.length > 1 ? bins[1].lower - bins[0].lower : 0;
  // Tick only at ROUND multiples of the band width — the design labels whole percents, not
  // wherever every third bar happens to land. ~7 ticks reads well at this card size.
  const major = niceStep(width * Math.max(1, Math.round(bins.length / 7)));
  // Decimals are whatever it takes to tell ADJACENT values apart, and the axis only ever prints
  // multiples of `major` — so it needs far fewer than a band does. Deriving both from the band
  // width instead made axis labels long enough that ECharts dropped every one as overlapping,
  // leaving the chart with no scale at all.
  const dpFor = (step: number) => (step > 0 ? Math.min(6, Math.max(0, Math.ceil(-Math.log10(step)))) : 1);
  const axisDp = dpFor(major);
  const bandDp = dpFor(width);
  const label = (v: number, dp: number) => (isPct ? `${formatAmount(v, dp)}%` : fmtSigned(v, 0));
  const isTick = (b: HistogramBin) => Math.abs(b.lower / major - Math.round(b.lower / major)) < 1e-6;
  return {
    tooltip: {
      trigger: "axis",
      // Name the BAND, not its mid-point: a bar means "days that returned between these two",
      // which is the whole idea of the chart.
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number; value: number }[];
        const p = arr[0];
        if (!p) return "";
        const b = bins[p.dataIndex];
        const band =
          width > 0 ? `${label(b.lower, bandDp)} to ${label(b.lower + width, bandDp)}` : label(b.center, bandDp);
        return `${band}<br/>${p.value} day${p.value === 1 ? "" : "s"}`;
      },
    },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      ...CATEGORY_AXIS,
      data: bins.map((b) => (isTick(b) ? label(b.lower, axisDp) : "")),
      // `interval: 0` because the tick positions are OURS: every other category is deliberately
      // blank, and ECharts' auto-stride counts blanks as labels — it would pick a stride, land it
      // on empty strings, and draw an axis with no scale at all. Blank entries cost no width, so
      // forcing every category through leaves exactly the ticks chosen above.
      axisLabel: { interval: 0 },
    },
    yAxis: { type: "value", minInterval: 1, axisLine: { show: false } },
    series: [
      {
        type: "bar" as const,
        barWidth: "62%",
        data: bins.map((b, i) => ({
          value: b.count,
          // Counts always grow upward, so the loss side needs the up-facing stop order.
          itemStyle: { color: i < negative ? BAR_LOSS_UP : BAR_GAIN, borderRadius: RADIUS_UP },
        })),
      },
    ],
  };
}

function DistributionPanel({
  bins,
  isPct,
  note,
}: {
  bins: HistogramBin[];
  isPct: boolean;
  note?: string;
}) {
  const option = useMemo(() => buildDistributionOption(bins, isPct), [bins, isPct]);
  return (
    <ChartCard
      title="Daily Return Distribution"
      controls={note ? <MockNote>{note}</MockNote> : undefined}
    >
      <BaseChart option={option} />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------

export function PerformanceView({ runId }: { runId?: string }) {
  const {
    data: restSummary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useRunSummary(runId);
  const {
    data: restEquity = [],
    isLoading: equityLoading,
    isError: equityError,
  } = useRunEquity(runId);

  // While the run is streaming, the live frame wins over the persisted artifacts — which error out
  // for the whole life of a running run, leaving the frame as the only source.
  const { snapshot } = useLiveSnapshot();
  const summary = useMemo(() => mergeLiveSummary(restSummary, snapshot), [restSummary, snapshot]);
  const equity = useMemo(() => preferLiveEquity(restEquity, snapshot), [restEquity, snapshot]);

  // Starting capital turns every absolute PnL figure into a percentage. Null → absolute mode.
  const capital = useMemo(() => startingCapital(summary), [summary]);
  const isPct = capital !== null;
  const scale = capital === null ? 1 : 100 / capital; // PnL → % of starting capital

  const currency = useRunCurrency(runId);
  const stats = useMemo(() => equityStats(equity), [equity]);
  // A rolling 30-day window: padded up to 30 days so a single-day HFT run reads as a bar in
  // context rather than one lone column, and cut to the most recent 30 so a long backtest doesn't
  // squeeze months of bars into the panel.
  const daily = useMemo(
    () => padDailyPnl(toDailyPnlPoints(equity), NET_DAILY_PNL_DAYS).slice(-NET_DAILY_PNL_DAYS),
    [equity],
  );
  const monthly = useMemo(() => toMonthlyPnl(equity), [equity]);
  // Weekdays the run never traded are dropped rather than drawn as empty columns: a VN30 run then
  // reads Mon..Fri like the design, while a crypto run keeps all seven.
  const weekly = useMemo(() => {
    const traded = new Set(toDailyPnlPoints(equity).map((d) => (new Date(d.ts).getDay() + 6) % 7));
    return toWeekdayPnl(equity).filter((_, i) => traded.has(i));
  }, [equity]);

  const monthlyRows = useMemo(() => toYearlyRows(monthly, scale), [monthly, scale]);
  // One alpha band = 1 percentage point in % mode; in absolute mode spread the same 3 bands
  // across the largest month so the heatmap still ramps instead of saturating.
  const heatStep = useMemo(() => {
    if (isPct) return 1;
    const maxAbs = Math.max(0, ...monthly.map((m) => Math.abs(m.value)));
    return maxAbs / 3 || 1;
  }, [isPct, monthly]);

  const histogram = useMemo(
    () => toReturnHistogram(toDailyPnlPoints(equity).map((d) => d.value * scale)),
    [equity, scale],
  );

  const summaryRows = useMemo<[SummaryMetric[], SummaryMetric[]]>(() => {
    if (!summary) return [EMPTY_ROW_1, EMPTY_ROW_2];
    const grossPnl = summary.net_pnl + summary.total_fee;

    // CAGR from the run's own calendar span; needs both a return % and enough elapsed time.
    const cagrPct = annualizedReturn(summary.return_pct, curveSpanMs(equity));
    const cagr = cagrPct === null ? DASH : fmtPct(cagrPct * 100);

    return [
      [
        {
          label: "Gross PnL",
          value: fmtSigned(grossPnl),
          unit: currency,
          delta: `Fees ${fmtSigned(-summary.total_fee)}`,
          tone: toneOf(grossPnl),
        },
        {
          label: "Net PnL",
          value: fmtSigned(summary.net_pnl),
          unit: currency,
          delta: summary.return_pct == null ? undefined : fmtPct(summary.return_pct * 100),
          tone: toneOf(summary.net_pnl),
        },
        {
          label: "Total Return",
          value: summary.return_pct == null ? DASH : fmtPct(summary.return_pct * 100),
          tone: summary.return_pct == null ? undefined : toneOf(summary.return_pct),
        },
      ],
      [
        { label: "CAGR", value: cagr },
        {
          label: "Avg Daily PnL",
          value: stats ? fmtSigned(stats.avgDailyPnl, 2) : DASH,
          unit: stats ? currency : undefined,
        },
        {
          label: "Best day",
          value: stats ? fmtSigned(stats.bestDay) : DASH,
          unit: stats ? currency : undefined,
          tone: stats ? "green" : undefined,
        },
        {
          label: "Worst day",
          value: stats ? fmtSigned(stats.worstDay) : DASH,
          unit: stats ? currency : undefined,
          tone: stats ? "red" : undefined,
        },
      ],
    ];
  }, [summary, stats, equity, currency]);

  // One note drives every panel: which of "no run / loading / failed / empty" applies, plus the
  // absolute-instead-of-% caveat once data is actually on screen.
  const loading = summaryLoading || equityLoading;
  const note = !runId
    ? "Pick a run"
    : loading
      ? "Loading…"
      : summaryError && equityError
        ? "Results unavailable"
        : equityError
          ? "Equity unavailable"
          : equity.length === 0
            ? "No equity points"
            : isPct
              ? undefined
              : "Absolute PnL — no starting capital";

  return (
    <div className="@container flex min-w-0 flex-col gap-4">
      <SummaryCard rows={summaryRows} />
      <MonthlyReturnPanel rows={monthlyRows} step={heatStep} isPct={isPct} note={note} />
      <div className="grid min-w-0 grid-cols-1 gap-4 @[560px]:grid-cols-2">
        <NetDailyPnlPanel points={daily} currency={currency} note={note} />
        <WeeklyPerformancePanel points={weekly} currency={currency} note={note} />
      </div>
      <DistributionPanel bins={histogram} isPct={isPct} note={note} />
    </div>
  );
}
