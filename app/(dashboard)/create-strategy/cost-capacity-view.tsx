"use client";
// Create Strategy → Results → Cost & Capacity — Figma node 14180:18285.
// Metric row (Gross PnL / Total Cost / Net PnL / Cost Drag) → "Cost Breakdown (USDT)" donut +
// "Cost Over Time (Cumulative)" stacked area → "Turn over time" + "Capacity Curve".
//
// Data: the metric row and the donut totals are real, derived from `GET /api/runs/{id}/summary`
// (`edge_gross_bps - cost_bps == edge_net_bps`, and gross PnL = `net_pnl + total_fee`). "Turn over
// time" calls `GET /api/runs/{id}/turnover-curve` — live, but it answers `[]` for every run on dev
// today, so it falls back to placeholder bars and says so.
//
// Mocked, because no endpoint exposes them: the five-way cost split (`RunSummary` carries only the
// aggregate `total_fee` and `cost_bps` — no exchange/maker-rebate/funding/slippage breakdown), the
// cumulative cost series, and the capacity curve.
//
// The frame's metric values are placeholders copied from the Execution tab (Gross PnL "96.42%",
// Total Cost "3.21" — the same figures as Fill Rate and Order-to-trade Ratio there), so currency
// fields are formatted as currency here rather than reproduced as percentages.
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { useRunSummary, useRunTurnover } from "@/hooks/api/use-runs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChartCard, MockNote } from "./results-chart-card";

// The five cost components, in the design's order, each with its 135° swatch gradient
// (Figma 14180:39849 and siblings).
const COST_SERIES = [
  { key: "Exchange Fee", from: "#cff8ea", to: "#67e1c0" },
  { key: "Maker Rebate", from: "#e9e8ff", to: "#b7b1ff" },
  { key: "Total Fee", from: "#cfdbf8", to: "#2d84ff" },
  { key: "Funding Fee", from: "#ffe3d6", to: "#ff9783" },
  { key: "Slippage cost", from: "#fffbd6", to: "#f1c617" },
] as const;

const YELLOW = "#f1c617";
const GREEN = "#67e1c1";
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const DASH = "—";

const money = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? DASH : `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

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

// ---------------------------------------------------------------------------
// Metric row (Figma 14180:18287) — one row of four.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mock series — seeded, so server and client renders agree (no Math.random).
// ---------------------------------------------------------------------------

const MONTHS = ["Jan 2025", "Feb 2025", "Mar 2025", "Apr 2025", "May 2025", "Jun 2025", "Jul 2025"];
const CUM_LABELS = Array.from({ length: 56 }, (_, i) => MONTHS[Math.floor((i / 56) * MONTHS.length)]);

// Cumulative cost accrues toward a plateau; each component ramps at its own rate. Negative,
// because the design plots cost as drag on return (0% down to about -8%).
const CUM_SERIES = COST_SERIES.map((s, si) =>
  CUM_LABELS.map((_, i) => {
    const ramp = 1 - Math.exp(-i / 12);
    const wobble = Math.sin(i * 0.5 + si) * 0.06;
    return Number((-(0.5 + si * 0.35) * ramp + wobble).toFixed(3));
  }),
);

const TURNOVER_PLACEHOLDER = Array.from({ length: 40 }, (_, i) => ({
  label: MONTHS[Math.floor((i / 40) * MONTHS.length)],
  value: Math.round(20 + 70 * Math.abs(Math.sin(i * 1.1)) * Math.exp(-i / 26)),
}));

const CAPACITY_LABELS = ["1M", "5M", "10M", "20M", "30M", "40M", "50M", "60M"];
// Sharpe decays as deployed capital grows — flat, then a knee, then a steep fall.
const CAPACITY_SERIES = Array.from({ length: 64 }, (_, i) => {
  const x = i / 63;
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

const pad = (n: number) => String(n).padStart(2, "0");
const dayLabel = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
};

export function CostCapacityView({ runId }: { runId?: string }) {
  const { data: summary } = useRunSummary(runId);
  const { data: turnover = [], isLoading: turnoverLoading } = useRunTurnover(runId);
  const [period, setPeriod] = useState<string>("Daily");
  const [capacityMetric, setCapacityMetric] = useState<string>("Sharpe");

  const totalCost = summary?.total_fee ?? null;
  const netPnl = summary?.net_pnl ?? null;
  const grossPnl = netPnl == null || totalCost == null ? null : netPnl + totalCost;
  const costDrag =
    summary?.cost_bps == null || !summary?.edge_gross_bps
      ? DASH
      : `${((summary.cost_bps / summary.edge_gross_bps) * 100).toFixed(2)}%`;

  // The split is mocked; anchor it to the real total so the donut centre stays truthful.
  const breakdown = useMemo(() => {
    const weights = [0.358, -0.145, 0.358, 0.358, 0.358];
    const base = totalCost ?? 60_125;
    return COST_SERIES.map((s, i) => ({ ...s, value: base * weights[i], share: weights[i] }));
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
          // Magnitudes only — a negative rebate can't occupy negative arc length.
          data: breakdown.map((b) => ({
            name: b.key,
            value: Math.abs(b.value),
            itemStyle: { color: grad(b.from, b.to), borderWidth: 0 },
          })),
        },
      ],
    }),
    [breakdown],
  );

  const cumulativeOption = useMemo<EChartsOption>(
    () => ({
      // No ECharts legend — five labels can't lay out inside a ~180px plot without colliding, and
      // its wrapping isn't controllable. Rendered as HTML beneath the chart instead.
      grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (v: unknown) => `${Number(v).toFixed(2)}%` },
      // hideOverlap rather than a fixed interval: this card is ~340px wide in the side panel,
      // less than half the 793px it was designed at, and a fixed stride collides there.
      xAxis: { type: "category", data: CUM_LABELS, boundaryGap: false, axisLabel: { hideOverlap: true } },
      yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
      series: COST_SERIES.map((s, i) => ({
        name: s.key,
        type: "line" as const,
        stack: "cost",
        data: CUM_SERIES[i],
        smooth: false,
        showSymbol: false,
        symbol: "none",
        lineStyle: { width: 1, color: s.to },
        itemStyle: { color: s.to },
        areaStyle: { color: grad(s.from, s.to), opacity: 0.55 },
      })),
    }),
    [],
  );

  const { turnoverSeries, turnoverIsPlaceholder } = useMemo(() => {
    if (turnover.length > 0) {
      return {
        turnoverSeries: turnover.map((p) => ({ label: dayLabel(Number(p.ts)), value: Number(p.turnover ?? 0) })),
        turnoverIsPlaceholder: false,
      };
    }
    return { turnoverSeries: TURNOVER_PLACEHOLDER, turnoverIsPlaceholder: true };
  }, [turnover]);

  const turnoverOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: turnoverSeries.map((d) => d.label),
        axisTick: { show: false },
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: "value" },
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
        <ChartCard title="Cost Breakdown (USDT)" controls={<MockNote>Split is placeholder</MockNote>}>
          {/* Wraps rather than crushing the legend: the design lays this out at 388px, but in the
              side panel the card can be under 340px, where ring + legend don't fit on one line. */}
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-4">
            <div className="relative size-[148px] shrink-0">
              <BaseChart option={donutOption} style={{ height: 148 }} />
              {/* Centre label sits above the ring rather than inside the canvas, so it stays crisp. */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span className="text-[10px] leading-4 text-muted-foreground">Total Cost</span>
                <span className="text-sm leading-[18px] font-semibold text-white">{money(totalCost ?? 60_125)}</span>
              </div>
            </div>
            <div className="flex min-w-[192px] flex-1 flex-col gap-2.5">
              {breakdown.map((b) => (
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
                      {Math.round(b.value).toLocaleString("en-US")}
                    </span>
                    <span className="text-[10px] leading-[14px] text-muted-foreground">
                      ({(b.share * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Cost Over Time (Cumulative)" controls={<MockNote>Placeholder series</MockNote>}>
          <BaseChart option={cumulativeOption} style={{ height: 212 }} />
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {COST_SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundImage: `linear-gradient(135deg, ${s.from} 0%, ${s.to} 100%)` }}
                />
                <span className="text-[10px] leading-[14px] whitespace-nowrap text-muted-foreground">{s.key}</span>
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Turn over time"
          controls={
            <>
              {turnoverLoading ? (
                <MockNote>Loading…</MockNote>
              ) : turnoverIsPlaceholder ? (
                <MockNote>Placeholder — /turnover-curve returns no points</MockNote>
              ) : null}
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
