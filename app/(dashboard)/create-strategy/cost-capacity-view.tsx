"use client";
// Create Strategy → Results → Cost & Capacity — Figma node 14180:18285.
// Metric row (Gross PnL / Total Cost / Net PnL / Cost Drag) → "Cost Breakdown (USDT)" donut +
// "Cost Over Time (Cumulative)" → "Turn over time" + "Capacity Curve".
//
// Real:
// - Metrics from `GET /api/runs/{id}/summary`.
// - Cost Breakdown + Cost Over Time from `GET /api/runs/{id}/cost-curve`
//   (`CostPoint { ts, fee, cumulative }`). The API exposes aggregate fees only — no
//   exchange/maker/funding/slippage split — so the donut is a single "Total Fee" slice and the
//   over-time chart is one cumulative series (not the Figma five-way stack).
// - Turn over time from `/turnover-curve`.
//
// Still mocked: Capacity Curve.
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { useRunCostCurve, useRunCurrency, useRunSummary, useRunTurnover } from "@/hooks/api/use-runs";
import { mergeLiveSummary, useLiveSnapshot } from "@/hooks/api/use-run-live-snapshot";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { lastCumulative, toCostSeries } from "@/lib/cost-curve";
import { aggregateTurnover, type TurnoverPeriod } from "@/lib/turnover-curve";
import { costDragPct } from "@/lib/transform/results";
import { cn, formatAmount, formatCompact } from "@/lib/utils";
import { currencySymbol } from "@/lib/transform/runs";
import { ChartCard, MockNote } from "./results-chart-card";

// Figma 14180:39849 "Total Fee" swatch — the only component the cost-curve can populate.
const FEE_FROM = "#cfdbf8";
const FEE_TO = "#2d84ff";

const YELLOW = "#f1c617";
const GREEN = "#67e1c1";
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const DASH = "—";

// Money is denominated in the RUN's settlement currency, not a hardcoded "$" — a crypto run
// accounts in USDT and a DNSE one in VND. Both are suffixed, as everywhere else in Results.
const moneyIn = (currency: string) => (n: number | null | undefined) =>
  n == null || !Number.isFinite(n)
    ? DASH
    : `${n < 0 ? "-" : ""}${formatAmount(Math.abs(n))} ${currencySymbol(currency)}`;

/** Chart axis ticks only — a `111,000,000.00` label does not fit; tooltips use `money`. */
const axisMoneyIn = (currency: string) => (n: number) => `${formatCompact(n)} ${currencySymbol(currency)}`;

/** ECharts linear gradient matching a swatch, top-left → bottom-right. */
const grad = (from: string, to: string) => ({
  type: "linear" as const,
  x: 0,
  y: 0,
  x2: 1,
  y2: 1,
  colorStops: [
    { offset: 0, color: from },
    { offset: 1, color: to },
  ],
});

function MetricCell({ label, value, tone }: { label: string; value: string; tone?: "green" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-xs leading-[18px] text-muted-foreground">{label}</span>
      <span className={cn("truncate text-base leading-5 font-semibold", tone === "green" ? GRAD_GREEN : "text-white")}>
        {value}
      </span>
    </div>
  );
}

const CAPACITY_LABELS = ["1M", "5M", "10M", "20M", "30M", "40M", "50M", "60M"];
// Sharpe decays as deployed capital grows — flat, then a knee, then a steep fall.
const CAPACITY_SERIES = Array.from({ length: 64 }, (_, i) => {
  const x = i / 63;
  // Numeric rounding for the mock series, not a label — grouping here would yield NaN.
  return Number((3.5 - 2.9 * x ** 3 + Math.sin(i * 0.9) * 0.09).toFixed(3));
});

const PERIOD_OPTIONS = ["Daily", "Weekly", "Monthly"] as const;
const CAPACITY_METRICS = ["Sharpe", "Return", "Net PnL"] as const;

function PillSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="h-8 rounded-full border-border bg-background px-3 text-xs font-medium text-white"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CostCapacityView({ runId }: { runId?: string }) {
  const currency = useRunCurrency(runId);
  const money = useMemo(() => moneyIn(currency), [currency]);
  const axisMoney = useMemo(() => axisMoneyIn(currency), [currency]);
  const { data: restSummary } = useRunSummary(runId);
  // While the run is streaming, the live frame wins over the persisted `/summary` snapshot.
  const { snapshot } = useLiveSnapshot();
  const summary = useMemo(() => mergeLiveSummary(restSummary, snapshot), [restSummary, snapshot]);
  const {
    data: costCurve = [],
    isLoading: costLoading,
    isError: costError,
  } = useRunCostCurve(runId);
  const {
    data: turnover = [],
    isLoading: turnoverLoading,
    isError: turnoverError,
  } = useRunTurnover(runId);
  const [period, setPeriod] = useState<string>("Daily");
  const [capacityMetric, setCapacityMetric] = useState<string>("Sharpe");

  const curveTotal = lastCumulative(costCurve);
  // Prefer the curve's closing cumulative when present; summary.total_fee is the same aggregate.
  const totalCost = curveTotal ?? summary?.total_fee ?? null;
  const netPnl = summary?.net_pnl ?? null;
  const grossPnl = netPnl == null || totalCost == null ? null : netPnl + totalCost;
  // Dashes rather than printing a five-digit percentage when there is no gross edge to erode —
  // see costDragPct. `cost_bps` in the Cost Over Time card is the figure that still holds.
  const drag = costDragPct(summary);
  const costDrag = drag == null ? DASH : `${formatAmount(drag, 2)}%`;

  const breakdown = useMemo(() => {
    if (totalCost == null || !Number.isFinite(totalCost) || totalCost === 0) return [];
    return [{ key: "Total Fee", from: FEE_FROM, to: FEE_TO, value: totalCost, share: 1 }];
  }, [totalCost]);

  const donutOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "item", valueFormatter: (v: unknown) => money(Number(v)) },
      series: [
        {
          type: "pie",
          radius: ["62%", "92%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data: breakdown.map((b) => ({
            name: b.key,
            value: Math.abs(b.value),
            itemStyle: { color: grad(b.from, b.to), borderWidth: 0 },
          })),
        },
      ],
    }),
    [breakdown, money],
  );

  const costSeries = useMemo(() => toCostSeries(costCurve), [costCurve]);

  const cumulativeOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: unknown) => money(Number(v)),
      },
      xAxis: {
        type: "category",
        data: costSeries.map((p) => p.label),
        boundaryGap: false,
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: "value", axisLabel: { formatter: (v: string | number) => axisMoney(Number(v)) } },
      series: [
        {
          name: "Total Fee",
          type: "line" as const,
          data: costSeries.map((p) => p.cumulative),
          smooth: false,
          showSymbol: false,
          symbol: "none",
          lineStyle: { width: 1.5, color: FEE_TO },
          itemStyle: { color: FEE_TO },
          areaStyle: { color: grad(FEE_FROM, FEE_TO), opacity: 0.55 },
        },
      ],
    }),
    [costSeries, money, axisMoney],
  );

  const costNote = !runId
    ? "Pick a run"
    : costLoading
      ? "Loading…"
      : costError
        ? "Cost curve unavailable"
        : costSeries.length === 0
          ? "No cost points"
          : undefined;

  const turnoverSeries = useMemo(
    () => aggregateTurnover(turnover, period as TurnoverPeriod),
    [turnover, period],
  );

  const turnoverOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (v: unknown) => formatAmount(Number(v)) },
      xAxis: {
        type: "category",
        data: turnoverSeries.map((d) => d.label),
        axisTick: { show: false },
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: "value", axisLabel: { formatter: (v: string | number) => formatCompact(Number(v)) } },
      series: [
        {
          type: "bar",
          data: turnoverSeries.map((d) => d.value),
          barMaxWidth: 12,
          itemStyle: { color: grad("#fffbd6", YELLOW), borderRadius: [2, 2, 0, 0] },
        },
      ],
    }),
    [turnoverSeries],
  );

  const turnoverNote = !runId
    ? "Pick a run"
    : turnoverLoading
      ? "Loading…"
      : turnoverError
        ? "Turnover unavailable"
        : turnoverSeries.length === 0
          ? "No turnover points"
          : undefined;

  const capacityOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: CAPACITY_SERIES.map((_, i) => CAPACITY_LABELS[Math.floor((i / CAPACITY_SERIES.length) * CAPACITY_LABELS.length)]),
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: "value", min: 0, max: 4, interval: 1 },
      series: [
        {
          type: "line",
          data: CAPACITY_SERIES,
          smooth: false,
          showSymbol: false,
          symbol: "none",
          lineStyle: { width: 1.5, color: GREEN },
          itemStyle: { color: GREEN },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(103,225,193,0.45)" },
                { offset: 1, color: "rgba(103,225,193,0)" },
              ],
            },
          },
        },
      ],
    }),
    [],
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid min-w-0 grid-cols-2 gap-4 rounded-xl border border-border bg-[rgba(29,33,38,0.2)] px-3 py-3 sm:grid-cols-4">
        <MetricCell label="Gross PnL" value={money(grossPnl)} tone="green" />
        <MetricCell label="Total Cost" value={money(totalCost)} />
        <MetricCell label="Net PnL" value={money(netPnl)} />
        <MetricCell label="Cost Drag" value={costDrag} />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard title={`Cost Breakdown (${currency})`} controls={costNote ? <MockNote>{costNote}</MockNote> : undefined}>
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-4">
            <div className="relative size-[148px] shrink-0">
              <BaseChart option={donutOption} style={{ height: 148 }} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span className="text-[10px] leading-4 text-muted-foreground">Total Cost</span>
                <span className="text-sm leading-[18px] font-semibold text-white">{money(totalCost)}</span>
              </div>
            </div>
            <div className="flex min-w-[192px] flex-1 flex-col gap-2.5">
              {breakdown.length === 0 ? (
                <span className="text-[10px] leading-[14px] text-muted-foreground">
                  Aggregate fees only — no component split on /cost-curve.
                </span>
              ) : (
                breakdown.map((b) => (
                  <div key={b.key} className="flex min-w-0 items-center gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-1">
                      <span
                        className="size-3 shrink-0 rounded"
                        style={{ backgroundImage: `linear-gradient(135deg, ${b.from} 0%, ${b.to} 100%)` }}
                      />
                      <span className="truncate text-[10px] leading-[14px] text-muted-foreground">{b.key}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="text-xs leading-[18px] font-semibold text-white">
                        {formatAmount(b.value)}
                      </span>
                      <span className="text-[10px] leading-[14px] text-muted-foreground">
                        ({formatAmount(b.share * 100, 1)}%)
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Cost Over Time (Cumulative)"
          controls={costNote ? <MockNote>{costNote}</MockNote> : undefined}
        >
          <BaseChart option={cumulativeOption} style={{ height: 212 }} />
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundImage: `linear-gradient(135deg, ${FEE_FROM} 0%, ${FEE_TO} 100%)` }}
              />
              <span className="text-[10px] leading-[14px] whitespace-nowrap text-muted-foreground">Total Fee</span>
            </span>
          </div>
        </ChartCard>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Turn over time"
          controls={
            <>
              {turnoverNote && <MockNote>{turnoverNote}</MockNote>}
              <PillSelect value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
            </>
          }
        >
          <BaseChart option={turnoverOption} style={{ height: 244 }} />
        </ChartCard>

        <ChartCard
          title="Capacity Curve"
          controls={
            <>
              <MockNote>Placeholder series</MockNote>
              <PillSelect value={capacityMetric} onChange={setCapacityMetric} options={CAPACITY_METRICS} />
            </>
          }
        >
          <BaseChart option={capacityOption} style={{ height: 244 }} />
        </ChartCard>
      </div>
    </div>
  );
}
