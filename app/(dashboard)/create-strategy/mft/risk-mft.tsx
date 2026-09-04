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
  lossStreaks,
  sliceStage,
  toPoints,
  topDrawdowns,
  worstLossStreak,
  type PeriodSelection,
  type Point,
} from "@/lib/transform/mft-results";
import { useStrategyChart } from "@/hooks/api/use-strategy-results";
import { useStrategyPerformance } from "@/hooks/api/use-strategy-performance";
import {
  ChartCard,
  DropdownPill,
  EMPTY,
  MetricPanel,
  RED_TEXT,
  count,
  pctFromPercent,
  pctFromRatio,
  type Metric,
} from "./results-chrome";

const RED = "#ff135b";
const YELLOW = "#f1c617";

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

function streakOption(bars: ReturnType<typeof lossStreaks>): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: bars.map((b) => String(b.length)),
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: "#9db2ce" },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 10 } },
    series: [
      {
        type: "bar",
        name: "Streaks",
        data: bars.map((b) => b.count),
        barMaxWidth: 40,
        itemStyle: { color: YELLOW, borderRadius: [2, 2, 0, 0] },
        label: { show: true, position: "top", color: "#9db2ce", fontSize: 10 },
      },
    ],
  };
}

export function RiskMft({
  strategyId,
  stage,
  period,
}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
}) {
  const [sharpeWindow, setSharpeWindow] = useState<number>(30);

  const { data: perf } = useStrategyPerformance(strategyId, stage);
  const dd = useStrategyChart(strategyId, "drawdown");
  const sharpe = useStrategyChart(strategyId, "sharpe");
  const returns = useStrategyChart(strategyId, "returns");

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
  const streaks = useMemo(() => lossStreaks(returnPts), [returnPts]);
  const worst = useMemo(() => worstLossStreak(returnPts), [returnPts]);
  const episodes = useMemo(() => topDrawdowns(drawdownPts), [drawdownPts]);

  const longestRecovery = useMemo(() => {
    const recoveries = topDrawdowns(drawdownPts, Infinity)
      .map((e) => e.recovery)
      .filter((r): r is number => r != null);
    return recoveries.length ? Math.max(...recoveries) : undefined;
  }, [drawdownPts]);

  const p = perf?.performance;

  const rows: Metric[][] = [
    [
      { label: "Max Drawdown", value: pctFromRatio(p?.max_drawdown), tone: RED_TEXT },
      // Needs peak→trough in calendar time; the drawdown series is per-period only.
      { label: "Max DD Duration", value: EMPTY },
      { label: "VaR", value: pctFromRatio(p?.var), tone: p?.var == null ? undefined : RED_TEXT },
      { label: "CVaR", value: pctFromRatio(p?.cvar), tone: p?.cvar == null ? undefined : RED_TEXT },
    ],
    [
      {
        label: "Max Consecutive Losses",
        value: count(worst?.length),
        sub: worst ? `${pctFromPercent(worst.total)} total` : undefined,
      },
      // "Days" and "periods" only coincide when the series is daily, which the engine does not
      // state, so the day-count variant is left unfilled rather than guessed.
      { label: "Max Consecutive Days", value: EMPTY },
      {
        label: "Longest Recovery",
        value: longestRecovery == null ? EMPTY : `${longestRecovery}d`,
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
    loading: returns.isLoading,
    error: returns.isError,
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

      <ChartCard title="Consecutive loss streaks">
        <ChartState status={streakStatus} detail="No losing periods in this stage and period.">
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
