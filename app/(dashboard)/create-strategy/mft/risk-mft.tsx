"use client";
// MFT Results → "Risk" (Figma 15212:59857). Risk panel, the underwater curve, rolling Sharpe,
// the consecutive-loss-streak histogram and the top-5 drawdown table.
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { ChartState, chartStatus } from "@/components/charts/chart-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatAmount } from "@/lib/utils";
import {
  filterByPeriod,
  sliceStage,
  toPoints,
  topDrawdowns,
  worstLossStreak,
  type PeriodSelection,
  type Point,
} from "@/lib/transform/mft-results";
import { useMftResultsSource } from "@/hooks/api/use-mft-results-source";
import { useRunRiskDetail } from "@/hooks/api/use-runs";
import type { LossStreakBucket, SampleScope } from "@/types/domain";
import {
  ChartCard,
  DropdownPill,
  EMPTY,
  MetricPanel,
  RED_TEXT,
  count,
  durationDays,
  pctFromPercent,
  pctFromRatio,
  type Metric,
} from "./results-chrome";

const RED = "#ff135b";
// The control plane's bar green, so the two apps' streak charts read as the same chart.
const GREEN = "#10b981";

// Rolling window for the Sharpe chart (Figma 15227:70313). The MFT `sharpe` series is already a
// running figure from the engine, so the window smooths what it returns rather than recomputing
// Sharpe from returns — which is why "Raw" is offered as the unsmoothed truth.
const WINDOWS = [
  { value: 0, label: "Raw" },
  { value: 7, label: "7D" },
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
] as const;

function rollingMean(points: Point[], size: number): Point[] {
  if (size < 2) return points;
  return points.map((p, i) => {
    const from = Math.max(0, i - size + 1);
    const slice = points.slice(from, i + 1);
    return { t: p.t, v: slice.reduce((sum, q) => sum + q.v, 0) / slice.length };
  });
}

const DAY = 86_400;

/**
 * Axis labels sized to the window. The design labels these charts by month ("Jan 2026, Feb 2026"),
 * which is right for a multi-year backtest but collapses to five identical "Jul 2026" ticks on a
 * short stage — so anything under ~four months falls back to day precision.
 */
function labelFormatter(points: Point[]): (t: number) => string {
  const span = points.length > 1 ? points[points.length - 1].t - points[0].t : 0;
  const byDay = span < 120 * DAY;
  return (t) =>
    new Date(t * 1000).toLocaleDateString("en-GB", {
      day: byDay ? "2-digit" : undefined,
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
}

function dayLabel(t: number): string {
  return new Date(t * 1000).toLocaleDateString("en-CA", { timeZone: "UTC" });
}

function areaOption(points: Point[], color: string, opts?: { max?: number }): EChartsOption {
  const label = labelFormatter(points);
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: points.map((p) => label(p.t)),
      boundaryGap: false,
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: "#9db2ce",
        interval: Math.max(0, Math.ceil(points.length / 7) - 1),
      },
    },
    yAxis: {
      type: "value",
      scale: opts?.max == null,
      max: opts?.max,
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        type: "line",
        data: points.map((p) => p.v),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            // Underwater curves hang below zero, so the fill is densest at the bottom.
            colorStops:
              opts?.max === 0
                ? [
                    { offset: 0, color: `${color}00` },
                    { offset: 1, color: `${color}80` },
                  ]
                : [
                    { offset: 0, color: `${color}80` },
                    { offset: 1, color: `${color}00` },
                  ],
          },
        },
      },
    ],
  };
}

// Consecutive Loss Streaks — `/risk-detail`'s own histogram (streak length → how many times it
// happened), drawn like the control plane's: green bars rounded at the top, no label over each
// bar, and only every few lengths labelled so a 24-bucket run stays readable.
function streakOption(bars: LossStreakBucket[]): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: bars.map((b) => String(b.streak_len)),
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: "#9db2ce",
        interval: Math.max(0, Math.ceil(bars.length / 10) - 1),
      },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      // Two gridlines only, the peak and zero, as the control plane chart draws them: a full
      // ladder of ticks competes with the bars for attention.
      splitNumber: 1,
      axisLabel: { fontSize: 10, color: "#9db2ce" },
      splitLine: { lineStyle: { color: "#1d2939" } },
    },
    series: [
      {
        type: "bar",
        name: "Streaks",
        data: bars.map((b) => b.count),
        barMaxWidth: 40,
        itemStyle: { color: GREEN, borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

export function RiskMft({
  strategyId,
  stage,
  period,
  runId,
  sample,
}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
  runId?: string;
  sample?: SampleScope;
}) {
  const [sharpeWindow, setSharpeWindow] = useState<number>(30);

  // `period` scopes `perf`/`summary` to the selected year — the top risk panel is a headline
  // figure like Overview's KPI cards, not the Top-5-drawdown table (built from the already
  // period-filtered `drawdownPts` below either way).
  const src = useMftResultsSource({ strategyId, stage, runId, period, sample });
  const perf = src.perf;
  const summary = src.summary;
  const dd = src.drawdown;
  const sharpe = src.sharpe;
  const returns = src.returns;

  const drawdownPts = useMemo(
    () => filterByPeriod(sliceStage(toPoints(dd.data), dd.data, stage), period),
    [dd.data, stage, period],
  );
  const sharpePts = useMemo(
    () => filterByPeriod(sliceStage(toPoints(sharpe.data), sharpe.data, stage), period),
    [sharpe.data, stage, period],
  );
  const returnPts = useMemo(
    () => filterByPeriod(sliceStage(toPoints(returns.data), returns.data, stage), period),
    [returns.data, stage, period],
  );

  const smoothed = useMemo(() => rollingMean(sharpePts, sharpeWindow), [sharpePts, sharpeWindow]);
  // The engine's own histogram, the same source the control plane's chart draws.
  const riskQ = useRunRiskDetail(runId, sample);
  const streaks = useMemo(() => riskQ.data?.loss_streak_histogram ?? [], [riskQ.data]);
  const worst = useMemo(() => worstLossStreak(returnPts), [returnPts]);
  const episodes = useMemo(() => topDrawdowns(drawdownPts), [drawdownPts]);

  // F-073: `RunSummary.longest_recovery_days` used to report an absolute epoch-day instead of a
  // span whenever the series opened already in a drawdown (its implicit starting peak's
  // timestamp stayed at the Unix epoch) — fixed upstream (hft-platform commit f4569f2, "the
  // implicit starting peak... is 'reached' at the series' first timestamp, not at the Unix
  // epoch"). Read directly now; the local derivation is only a fallback for `null` (no RunSummary
  // for this window, or no completed recovery — see the neighbouring `max_drawdown_duration_days`
  // doc, which covers the still-open-drawdown case this field deliberately excludes).
  const longestRecovery = useMemo(() => {
    if (summary?.longest_recovery_days != null) return summary.longest_recovery_days;
    const recoveries = topDrawdowns(drawdownPts, Infinity)
      .map((e) => e.recovery)
      .filter((r): r is number => r != null);
    return recoveries.length ? Math.max(...recoveries) : undefined;
  }, [drawdownPts, summary]);

  const p = perf?.performance;

  const rows: Metric[][] = [
    [
      { label: "Max Drawdown", value: pctFromRatio(p?.max_drawdown), tone: RED_TEXT },
      // Reported directly for an HFT bar-run; the XALPHA feed has no calendar-time equivalent,
      // since its drawdown series is per-period.
      { label: "Max DD Duration", value: durationDays(summary?.max_drawdown_duration_days) },
      { label: "VaR", value: pctFromRatio(p?.var), tone: p?.var == null ? undefined : RED_TEXT },
      { label: "CVaR", value: pctFromRatio(p?.cvar), tone: p?.cvar == null ? undefined : RED_TEXT },
    ],
    [
      {
        label: "Max Consecutive Losses",
        // The engine's own count for the run; the streak derived from the returns series is the
        // fallback, and it is empty whenever that series is (a run with no `return_pct` to scale
        // by — see runToMftCharts), which is why this read "—" against a populated summary.
        value: count(summary?.max_consecutive_losses ?? worst?.length),
        // The summary has no percentage to pair with its own count (only the losing/winning DAY
        // streaks carry one), and the local streak's total describes a different, shorter run of
        // trades — so the sub-line belongs to the derived value only.
        sub:
          summary?.max_consecutive_losses == null && worst
            ? `${pctFromPercent(worst.total)} total`
            : undefined,
      },
      // Calendar trading days, straight off the summary. The XALPHA feed only counts PERIODS,
      // which coincide with days only for a daily series — left unfilled there rather than guessed.
      {
        label: "Max Consecutive Days",
        value: summary?.max_consecutive_losing_days == null ? EMPTY : count(summary.max_consecutive_losing_days),
        sub:
          summary?.max_consecutive_losing_days_pct == null
            ? undefined
            : `${pctFromRatio(summary.max_consecutive_losing_days_pct)} total`,
      },
      {
        label: "Longest Recovery",
        value: longestRecovery == null ? EMPTY : `${formatAmount(longestRecovery, 1)}d`,
      },
      { label: "Kelly Criterion", value: pctFromRatio(p?.kelly_criterion) },
    ],
  ];

  const ddStatus = chartStatus({
    loading: dd.isLoading,
    error: dd.isError,
    empty: !drawdownPts.length,
  });
  const sharpeStatus = chartStatus({
    loading: sharpe.isLoading,
    error: sharpe.isError,
    empty: !smoothed.length,
  });
  const streakStatus = chartStatus({
    idle: !runId,
    loading: riskQ.isLoading,
    error: riskQ.isError,
    empty: !streaks.length,
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricPanel rows={rows} />

      <ChartCard title="Underwater">
        <ChartState status={ddStatus} detail="No drawdown series for this stage and period.">
          <BaseChart option={areaOption(drawdownPts, RED, { max: 0 })} style={{ height: 240 }} />
        </ChartState>
      </ChartCard>

      <ChartCard
        title="Rolling Sharpe"
        right={
          <DropdownPill
            label={WINDOWS.find((w) => w.value === sharpeWindow)?.label ?? "Raw"}
            onClick={() =>
              setSharpeWindow((prev) => {
                const i = WINDOWS.findIndex((w) => w.value === prev);
                return WINDOWS[(i + 1) % WINDOWS.length].value;
              })
            }
          />
        }
      >
        <ChartState status={sharpeStatus} detail="No Sharpe series for this stage and period.">
          <BaseChart option={areaOption(smoothed, "#c98b7a")} style={{ height: 240 }} />
        </ChartState>
      </ChartCard>

      <ChartCard title="Consecutive Loss Streaks">
        <ChartState status={streakStatus} detail="This run never had a losing streak.">
          <BaseChart option={streakOption(streaks)} style={{ height: 240 }} />
        </ChartState>
      </ChartCard>

      <div className="min-w-0 overflow-hidden rounded-xl border border-[#1d2939] bg-background">
        <div className="border-b border-[#1d2939] bg-[#151a24] px-4 py-2">
          <span className="text-sm leading-5 font-medium text-white">Top 5 drawdown</span>
        </div>
        {episodes.length ? (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="h-10">Start</TableHead>
                <TableHead className="h-10">Trough</TableHead>
                <TableHead className="h-10 text-right">Depth</TableHead>
                <TableHead className="h-10 text-right">Length</TableHead>
                <TableHead className="h-10 text-right">Recovery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {episodes.map((e) => (
                <TableRow key={`${e.start}-${e.trough}`}>
                  <TableCell className="py-2 text-xs text-white">{dayLabel(e.start)}</TableCell>
                  <TableCell className="py-2 text-xs text-white">{dayLabel(e.trough)}</TableCell>
                  <TableCell className={cn("py-2 text-right text-xs", RED_TEXT)}>
                    {`${formatAmount(e.depth, 2)}%`}
                  </TableCell>
                  <TableCell className="py-2 text-right text-xs text-white">{`${e.length}d`}</TableCell>
                  <TableCell className="py-2 text-right text-xs text-white">
                    {e.recovery == null ? EMPTY : `${e.recovery}d`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-4 py-8 text-center text-xs text-[#9db2ce]">
            This stage never went underwater.
          </div>
        )}
      </div>
    </div>
  );
}
