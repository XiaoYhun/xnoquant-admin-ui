"use client";
// MFT Results → "Overview" (Figma 15204:30669). Six sparkline KPI cards, the equity curve with its
// nine-metric strip, and the yearly summary table.
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { MaximizeSquareMinimalistic } from "@solar-icons/react";

import { BaseChart } from "@/components/charts/base-chart";
import { ChartState, chartStatus } from "@/components/charts/chart-state";
import { Sparkline } from "@/components/charts/sparkline";
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
  type PeriodSelection,
  type Point,
} from "@/lib/transform/mft-results";
import { useStrategyChart, useSummaryTable } from "@/hooks/api/use-strategy-results";
import { useStrategyPerformance } from "@/hooks/api/use-strategy-performance";
import {
  ChartCard,
  EMPTY,
  GREEN_TEXT,
  PillTabs,
  RED_TEXT,
  count,
  num,
  pctFromRatio,
  toneBySign,
} from "./results-chrome";

// Trailing windows on the equity chart (Figma 15204:30778). "All" keeps whatever the Period row
// already selected; the rest cut a tail off the end of that.
const RANGES = [
  { value: "All", label: "All", days: 0 },
  { value: "1M", label: "1M", days: 30 },
  { value: "3M", label: "3M", days: 90 },
  { value: "1W", label: "1W", days: 7 },
] as const;
type Range = (typeof RANGES)[number]["value"];

const DAY = 86_400;

function trailing(points: Point[], range: Range): Point[] {
  const days = RANGES.find((r) => r.value === range)?.days ?? 0;
  if (!days || !points.length) return points;
  const cutoff = points[points.length - 1].t - days * DAY;
  return points.filter((p) => p.t >= cutoff);
}

function dateLabel(t: number): string {
  return new Date(t * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

// ---- KPI cards (Figma 15204:30766) -----------------------------------------------------------

interface KpiCard {
  label: string;
  value: string;
  /** Unit shown small and baseline-aligned after the value. */
  unit?: string;
  /** Second line under the value. */
  note?: string;
  tone?: string;
  spark?: number[];
}

function KpiCards({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="flex min-w-0 flex-col rounded-xl border border-[#1d2939] bg-[rgba(29,33,38,0.2)] p-2"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-xs leading-[18px] text-[#9db2ce]">{c.label}</span>
            <div className="flex items-end gap-1">
              <span className={cn("text-base leading-5 font-semibold", c.tone ?? "text-white")}>
                {c.value}
              </span>
              {c.unit && (
                <span className="text-[10px] leading-[14px] text-[#9db2ce]">{c.unit}</span>
              )}
            </div>
            <span className="text-[10px] leading-[14px] text-[#9db2ce]">{c.note ?? " "}</span>
          </div>
          {/* The card keeps the sparkline's height even with no series, so a row of six cards
              stays flush whether or not each metric happens to have a curve behind it. */}
          <div className="h-[42px] w-full">
            {c.spark && c.spark.length > 1 && <Sparkline data={c.spark} />}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- equity curve ----------------------------------------------------------------------------

function equityOption(equity: Point[], drawdown: Point[]): EChartsOption {
  const labels = equity.map((p) => dateLabel(p.t));
  // Drawdown is fetched as its own series, so it is aligned onto the equity axis by timestamp
  // rather than assumed to be sample-for-sample identical.
  const ddByTime = new Map(drawdown.map((p) => [p.t, p.v]));
  const ddAligned = equity.map((p) => ddByTime.get(p.t) ?? null);
  const hasDrawdown = ddAligned.some((v) => v != null);

  return {
    tooltip: { trigger: "axis" },
    legend: { show: false },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: "#9db2ce",
        interval: Math.max(0, Math.ceil(labels.length / 7) - 1),
      },
    },
    yAxis: [
      { type: "value", scale: true, axisLabel: { fontSize: 10 } },
      {
        type: "value",
        max: 0,
        splitLine: { show: false },
        axisLabel: { fontSize: 10, formatter: (v: number) => `${formatAmount(v, 0)}%` },
      },
    ],
    series: [
      {
        type: "line",
        name: "Net Equity",
        data: equity.map((p) => p.v),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: "#67e1c1" },
        itemStyle: { color: "#67e1c1" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(103,225,193,0.35)" },
              { offset: 1, color: "rgba(103,225,193,0)" },
            ],
          },
        },
      },
      ...(hasDrawdown
        ? [
            {
              type: "line" as const,
              name: "Drawdown",
              yAxisIndex: 1,
              data: ddAligned,
              smooth: true,
              showSymbol: false,
              connectNulls: true,
              lineStyle: { width: 1.5, color: "#ff135b" },
              itemStyle: { color: "#ff135b" },
              areaStyle: {
                color: {
                  type: "linear" as const,
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: "rgba(255,19,91,0)" },
                    { offset: 1, color: "rgba(255,19,91,0.35)" },
                  ],
                },
              },
            },
          ]
        : []),
    ],
  };
}

function StripMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-1 basis-[74px] flex-col gap-1">
      <span className="truncate text-[10px] leading-[14px] text-[#9db2ce]">{label}</span>
      <span className={cn("text-sm leading-5 whitespace-nowrap", tone ?? "text-white")}>{value}</span>
    </div>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {dashed ? (
        <span className="h-0 w-[15px] border-t border-dashed" style={{ borderColor: color }} />
      ) : (
        <span className="h-1 w-[15px] rounded-full" style={{ backgroundColor: color }} />
      )}
      <span className="text-[10px] leading-[14px] text-[#9db2ce]">{label}</span>
    </div>
  );
}

// ---- yearly summary (Figma 15205:55638) ------------------------------------------------------

function YearlySummary({
  rows,
}: {
  rows: { time?: string; sharpe?: number; cagr?: number; max_drawdown?: number; profit_factor?: number; calmar?: number }[];
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#1d2939] bg-background">
      <div className="border-b border-[#1d2939] bg-[#151a24] px-4 py-2">
        <span className="text-sm leading-5 font-medium text-white">Yearly Summary</span>
      </div>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="h-10">Year</TableHead>
            <TableHead className="h-10">Sharpe</TableHead>
            <TableHead className="h-10">CAGR</TableHead>
            <TableHead className="h-10">Max drawdown</TableHead>
            <TableHead className="h-10">Profit factor</TableHead>
            <TableHead className="h-10">Calmar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.time}>
              <TableCell className="py-2 text-xs text-white">{r.time ?? EMPTY}</TableCell>
              <TableCell className="py-2 text-xs text-white">{num(r.sharpe)}</TableCell>
              <TableCell className={cn("py-2 text-xs", toneBySign(r.cagr))}>
                {pctFromRatio(r.cagr)}
              </TableCell>
              <TableCell className={cn("py-2 text-xs", RED_TEXT)}>
                {pctFromRatio(r.max_drawdown)}
              </TableCell>
              <TableCell className="py-2 text-xs text-white">{num(r.profit_factor)}</TableCell>
              <TableCell className="py-2 text-xs text-white">{num(r.calmar)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function OverviewMft({
  strategyId,
  stage,
  period,
}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
}) {
  const [range, setRange] = useState<Range>("All");

  const { data: perf } = useStrategyPerformance(strategyId, stage);
  const { data: summaryRows } = useSummaryTable(strategyId, stage);
  const pnls = useStrategyChart(strategyId, "pnls");
  const dd = useStrategyChart(strategyId, "drawdown");
  const sharpe = useStrategyChart(strategyId, "sharpe");
  const returns = useStrategyChart(strategyId, "returns");

  // Stage slice first (the charts endpoint returns every stage at once), then the Period row,
  // then the chart's own trailing range.
  const equity = useMemo(
    () => trailing(filterByPeriod(sliceStage(toPoints(pnls.data), pnls.data, stage), period), range),
    [pnls.data, stage, period, range],
  );
  const drawdown = useMemo(
    () => trailing(filterByPeriod(sliceStage(toPoints(dd.data), dd.data, stage), period), range),
    [dd.data, stage, period, range],
  );
  const sharpePts = useMemo(
    () => filterByPeriod(sliceStage(toPoints(sharpe.data), sharpe.data, stage), period),
    [sharpe.data, stage, period],
  );
  const returnPts = useMemo(
    () => filterByPeriod(sliceStage(toPoints(returns.data), returns.data, stage), period),
    [returns.data, stage, period],
  );

  const a = perf?.analysis;
  const p = perf?.performance;

  // Both are honest derivations of the daily return series rather than API fields: a day is a
  // "profit day" when its return is positive, and the series has one sample per trading day.
  const profitDays = returnPts.length
    ? returnPts.filter((x) => x.v > 0).length / returnPts.length
    : undefined;
  const tradingDays = returnPts.length || undefined;

  const netPnl = a?.end_value != null && a?.start_value != null ? a.end_value - a.start_value : undefined;

  const cards: KpiCard[] = [
    {
      label: "Net PnL",
      value: netPnl == null ? EMPTY : `${netPnl > 0 ? "+" : ""}${formatAmount(netPnl, 0)}`,
      note: pctFromRatio(p?.cumulative_return),
      tone: toneBySign(netPnl),
      spark: equity.map((x) => x.v),
    },
    {
      label: "Sharpe Ratio",
      value: num(p?.sharpe),
      spark: sharpePts.map((x) => x.v),
    },
    {
      label: "Max Drawdown",
      value: pctFromRatio(p?.max_drawdown),
      tone: RED_TEXT,
      spark: drawdown.map((x) => x.v),
    },
    // Turnover is not reported by the MFT engine, so return-per-unit-of-turnover has no source.
    { label: "Return / Turnover", value: EMPTY },
    {
      // Fees are reported as a positive magnitude; shown here as the drag they are.
      label: "Cost Drag",
      value: a?.total_fee == null ? EMPTY : pctFromRatio(-Math.abs(a.total_fee)),
      tone: a?.total_fee == null ? undefined : RED_TEXT,
    },
    // Capacity analysis is an HFT-only artifact; nothing in /performance approximates it.
    { label: "Max Capacity", value: EMPTY },
  ];

  const equityStatus = chartStatus({
    loading: pnls.isLoading,
    error: pnls.isError,
    empty: !equity.length,
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <KpiCards cards={cards} />

      <ChartCard
        title="Equity Curve"
        right={
          <>
            <PillTabs options={RANGES} value={range} onChange={setRange} size="sm" />
            <button
              type="button"
              aria-label="Expand Equity Curve chart"
              className="inline-flex cursor-pointer items-center justify-center text-[#9db2ce] transition-colors hover:text-white"
            >
              <MaximizeSquareMinimalistic className="size-5" />
            </button>
          </>
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-wrap gap-4">
            <StripMetric
              label="Total Return"
              value={pctFromRatio(p?.cumulative_return)}
              tone={toneBySign(p?.cumulative_return)}
            />
            <StripMetric
              label="Ann. Return"
              value={pctFromRatio(p?.annual_return)}
              tone={toneBySign(p?.annual_return)}
            />
            <StripMetric label="Max Drawdown" value={pctFromRatio(p?.max_drawdown)} tone={RED_TEXT} />
            {/* Drawdown DURATION needs the peak-to-recovery span the engine never returns. */}
            <StripMetric label="MDD Duration" value={EMPTY} />
            <StripMetric
              label="Profit Days"
              value={profitDays == null ? EMPTY : `${formatAmount(profitDays * 100, 0)}%`}
              tone={profitDays == null ? undefined : GREEN_TEXT}
            />
            <StripMetric label="Trading Days" value={count(tradingDays)} />
            <StripMetric label="Total Trades" value={count(a?.total_trades)} />
            <StripMetric label="Avg Latency" value={EMPTY} />
            <StripMetric label="Fill Rate" value={EMPTY} />
          </div>

          <ChartState status={equityStatus} detail="No equity points for this stage and period.">
            <BaseChart option={equityOption(equity, drawdown)} style={{ height: 240 }} />
          </ChartState>

          <div className="flex items-center justify-center gap-6">
            <LegendDot color="#67e1c1" label="Net Equity" />
            {/* Gross equity needs per-period fees; MFT reports one aggregate fee for the run. */}
            <LegendDot color="#9db2ce" label="Gross Equity" dashed />
            <LegendDot color="#ff135b" label="Drawdown" />
          </div>
        </div>
      </ChartCard>

      {summaryRows && summaryRows.length > 0 && <YearlySummary rows={summaryRows} />}
    </div>
  );
}
