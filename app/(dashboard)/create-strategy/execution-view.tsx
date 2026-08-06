"use client";
// Create Strategy → Results → Execution — Figma node 14180:16730.
// Metric card (Fill Rate / Order to trade Ratio / Cancel Rate + Avg Latency / Slippage Avg / Std /
// Market Impact) → "Fill Rate over time" → "Slippage Distribution" + "Latency Distribution".
//
// Replaces the former Latency view (14819:25500). Its per-stage AVG/LAST/MAX cards are not in this
// design — latency now surfaces as the "Avg Latency" metric plus the distribution chart.
//
// Self-contained mock data, and it has to be: every figure here comes from per-fill telemetry, and
// the only source for that is `GET /api/runs/{id}/trace/stream`, which emits solely while a run is
// running — a finished run has no history to replay. `RunSummary` carries no fill-rate, slippage or
// latency field either. Swap in a hook once the backend exposes per-fill history.
//
// Two axes deliberately depart from the Figma frame, where these charts were duplicated from other
// panels and kept their source data: "Fill Rate over time" is plotted as a percentage (the frame
// shows a -1.0–3.0 Sharpe axis under a fill-rate title) and "Latency Distribution" is bucketed in
// milliseconds (the frame reuses the slippage chart's -3%–3% axis). Layout and styling follow the
// design.
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChartCard, MockNote } from "./results-chart-card";

// Stroke/Linear yellow — the colour every chart on this tab is drawn in.
const YELLOW = "#f1c617";
const YELLOW_LIGHT = "#fffbd6";
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";

// ---------------------------------------------------------------------------
// Metric card (Figma 14180:16732) — two rows of four, divider between.
// ---------------------------------------------------------------------------

type Metric = { label: string; value: string; tone?: "green" };

const ROW_TOP: Metric[] = [
  { label: "Fill Rate", value: "96.42%", tone: "green" },
  { label: "Order to trade Ratio", value: "3.21" },
  { label: "Cancel Rate", value: "68.74%" },
];

const ROW_BOTTOM: Metric[] = [
  { label: "Avg Latency", value: "1.82 ms" },
  { label: "Slippage (Avg)", value: "-0.38 bp" },
  { label: "Slippage (Std)", value: "0.72 bp" },
  { label: "Market Impact", value: "-0.64 bp" },
];

function MetricCell({ metric }: { metric: Metric }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-xs leading-[18px] text-muted-foreground">{metric.label}</span>
      <span
        className={cn(
          "truncate text-base leading-5 font-semibold",
          metric.tone === "green" ? GRAD_GREEN : "text-white",
        )}
      >
        {metric.value}
      </span>
    </div>
  );
}

function MetricCard() {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-[rgba(29,33,38,0.2)] px-3 py-2">
      {/* Three metrics on a 4-col grid so they align above the bottom row, as the design has them. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {ROW_TOP.map((m) => (
          <MetricCell key={m.label} metric={m} />
        ))}
      </div>
      <div className="h-px w-full bg-border" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {ROW_BOTTOM.map((m) => (
          <MetricCell key={m.label} metric={m} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock series — seeded, so server and client renders agree (no Math.random).
// ---------------------------------------------------------------------------

const MONTHS = ["Jan 2025", "Feb 2025", "Mar 2025", "Apr 2025", "May 2025", "Jun 2025", "Jul 2025", "Aug 2025"];

const FILL_RATE_SERIES = Array.from({ length: 64 }, (_, i) =>
  Number((96 + Math.sin(i * 0.7) * 1.9 + Math.cos(i * 0.23) * 1.1).toFixed(2)),
);
const FILL_RATE_LABELS = FILL_RATE_SERIES.map((_, i) => MONTHS[Math.floor((i / 64) * MONTHS.length)]);

const SLIPPAGE_BUCKETS = Array.from({ length: 25 }, (_, i) => `${(-3 + i * 0.25).toFixed(2)}%`);
/** Bell-shaped bucket counts, peaked at `centre`. */
const SLIPPAGE_COUNTS = Array.from({ length: 25 }, (_, i) =>
  Math.round(100 * Math.exp(-((i - 12) ** 2) / (2 * 4.2 ** 2))),
);

const LATENCY_BUCKETS = Array.from({ length: 25 }, (_, i) => `${(0.4 + i * 0.2).toFixed(1)}ms`);
// Latency is right-skewed — a tight mode plus a long tail, not a symmetric bell.
const LATENCY_COUNTS = LATENCY_BUCKETS.map((_, i) =>
  Math.round(100 * Math.exp(-((i - 4) ** 2) / 18) + 34 * Math.exp(-((i - 13) ** 2) / 26)),
);

const BAR_FILL = {
  type: "linear" as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: YELLOW_LIGHT },
    { offset: 1, color: YELLOW },
  ],
};

function distributionOption(labels: string[], counts: number[]): EChartsOption {
  return {
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: "axis" },
    // hideOverlap rather than a fixed stride: these cards sit at roughly half the 793px width the
    // design assumes, where a fixed interval collides.
    xAxis: { type: "category", data: labels, axisTick: { show: false }, axisLabel: { hideOverlap: true } },
    yAxis: { type: "value" },
    series: [
      { type: "bar", data: counts, barMaxWidth: 14, itemStyle: { color: BAR_FILL, borderRadius: [2, 2, 0, 0] } },
    ],
  };
}

const FILL_RATE_OPTION: EChartsOption = {
  grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
  tooltip: { trigger: "axis", valueFormatter: (v: unknown) => `${Number(v).toFixed(2)}%` },
  xAxis: { type: "category", data: FILL_RATE_LABELS, boundaryGap: false, axisLabel: { hideOverlap: true } },
  yAxis: { type: "value", min: 90, max: 100, axisLabel: { formatter: "{value}%" } },
  series: [
    {
      type: "line",
      data: FILL_RATE_SERIES,
      smooth: false,
      showSymbol: false,
      symbol: "none",
      lineStyle: { width: 1.5, color: YELLOW },
      itemStyle: { color: YELLOW },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(241,198,23,0.45)" },
            { offset: 1, color: "rgba(241,198,23,0)" },
          ],
        },
      },
    },
  ],
};

const PERIOD_OPTIONS = ["Daily", "Weekly", "Monthly"] as const;
const SCOPE_OPTIONS = ["All", "Maker", "Taker"] as const;

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

export function ExecutionView() {
  const [period, setPeriod] = useState<string>("Daily");
  const [slippageScope, setSlippageScope] = useState<string>("All");
  const [latencyScope, setLatencyScope] = useState<string>("All");

  // The selects are presentational until per-fill history exists — one series backs every option.
  const slippage = useMemo(() => distributionOption(SLIPPAGE_BUCKETS, SLIPPAGE_COUNTS), []);
  const latency = useMemo(() => distributionOption(LATENCY_BUCKETS, LATENCY_COUNTS), []);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricCard />

      <ChartCard
        title="Fill Rate over time"
        controls={
          <>
            <MockNote>Placeholder — needs per-fill history</MockNote>
            <PillSelect value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
          </>
        }
      >
        <BaseChart option={FILL_RATE_OPTION} style={{ height: 260 }} />
      </ChartCard>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Slippage Distribution"
          controls={<PillSelect value={slippageScope} onChange={setSlippageScope} options={SCOPE_OPTIONS} />}
        >
          <BaseChart option={slippage} style={{ height: 260 }} />
        </ChartCard>
        <ChartCard
          title="Latency Distribution"
          controls={<PillSelect value={latencyScope} onChange={setLatencyScope} options={SCOPE_OPTIONS} />}
        >
          <BaseChart option={latency} style={{ height: 260 }} />
        </ChartCard>
      </div>
    </div>
  );
}
