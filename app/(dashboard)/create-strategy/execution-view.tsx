"use client";
// Create Strategy → Results → Execution — Figma node 14180:16730.
// Metric card (Fill Rate / Order to trade Ratio / Cancel Rate + Avg Latency / Slippage Avg / Std /
// Market Impact) → "Fill Rate over time" → "Slippage Distribution" + "Latency Distribution".
//
// Fill Rate / Order-to-trade / Cancel Rate and the "Fill Rate over time" series are derived from
// the run's trade-cycle console log: `GET /api/runs/{id}/trace/history` (terminal) plus
// `/trace/stream` (SSE while the run is live). Backtests never journal a trace — those stay empty.
// Latency / slippage / market impact have no fields on the trace events, so they stay mocked.
//
// Two axes deliberately depart from the Figma frame, where these charts were duplicated from other
// panels and kept their source data: "Fill Rate over time" is plotted as a percentage (the frame
// shows a -1.0–3.0 Sharpe axis under a fill-rate title) and "Latency Distribution" is bucketed in
// milliseconds (the frame reuses the slippage chart's -3%–3% axis). Layout and styling follow the
// design.
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { chartStatus } from "@/components/charts/chart-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRunTraceHistory, useRunTraceStream } from "@/hooks/api/use-run-trace";
import {
  deriveFillRateSeries,
  deriveTraceExecutionMetrics,
  type TracePeriod,
} from "@/lib/trace-execution-metrics";
import { cn, formatAmount } from "@/lib/utils";
import { ChartCard, MockNote } from "./results-chart-card";

// Stroke/Linear yellow — the colour every chart on this tab is drawn in.
const YELLOW = "#f1c617";
const YELLOW_LIGHT = "#fffbd6";
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const DASH = "—";

// ---------------------------------------------------------------------------
// Metric card (Figma 14180:16732) — two rows of four, divider between.
// ---------------------------------------------------------------------------

type Metric = { label: string; value: string; tone?: "green" };

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

function MetricCard({ top, bottom }: { top: Metric[]; bottom: Metric[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-[rgba(29,33,38,0.2)] px-3 py-2">
      {/* Three metrics on a 4-col grid so they align above the bottom row, as the design has them. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {top.map((m) => (
          <MetricCell key={m.label} metric={m} />
        ))}
      </div>
      <div className="h-px w-full bg-border" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {bottom.map((m) => (
          <MetricCell key={m.label} metric={m} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distributions still mocked — trace events carry neither slippage nor latency.
// ---------------------------------------------------------------------------

const SLIPPAGE_BUCKETS = Array.from({ length: 25 }, (_, i) => `${formatAmount(-3 + i * 0.25, 2)}%`);
/** Bell-shaped bucket counts, peaked at `centre`. */
const SLIPPAGE_COUNTS = Array.from({ length: 25 }, (_, i) =>
  Math.round(100 * Math.exp(-((i - 12) ** 2) / (2 * 4.2 ** 2))),
);

const LATENCY_BUCKETS = Array.from({ length: 25 }, (_, i) => `${formatAmount(0.4 + i * 0.2, 1)}ms`);
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

function fillRateOption(labels: string[], values: number[]): EChartsOption {
  const lo = values.length ? Math.min(...values) : 90;
  const hi = values.length ? Math.max(...values) : 100;
  const pad = Math.max(1, (hi - lo) * 0.15);
  return {
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => `${formatAmount(Number(v), 2)}%` },
    xAxis: { type: "category", data: labels, boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: {
      type: "value",
      min: Math.max(0, Math.floor(lo - pad)),
      max: Math.min(100, Math.ceil(hi + pad)),
      axisLabel: { formatter: "{value}%" },
    },
    series: [
      {
        type: "line",
        data: values,
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
}

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

const pct = (n: number | null) => (n == null ? DASH : `${formatAmount(n, 2)}%`);
const ratio = (n: number | null) => (n == null ? DASH : formatAmount(n, 2));

export function ExecutionView({ runId, isLive }: { runId?: string; isLive?: boolean }) {
  const [period, setPeriod] = useState<string>("Daily");
  const [slippageScope, setSlippageScope] = useState<string>("All");
  const [latencyScope, setLatencyScope] = useState<string>("All");

  const { data, isLoading, isError, error } = useRunTraceHistory(runId);
  const { events: streamed, state: streamState } = useRunTraceStream(runId, !!isLive);
  const history = data?.events;
  const events = useMemo(() => [...(history ?? []), ...streamed], [history, streamed]);

  const metrics = useMemo(() => deriveTraceExecutionMetrics(events), [events]);
  const fillSeries = useMemo(
    () => deriveFillRateSeries(events, period as TracePeriod),
    [events, period],
  );
  const fillOption = useMemo(
    () => fillRateOption(
      fillSeries.map((p) => p.label),
      fillSeries.map((p) => p.value),
    ),
    [fillSeries],
  );

  const topRow: Metric[] = [
    { label: "Fill Rate", value: pct(metrics.fillRatePct), tone: "green" },
    { label: "Order to trade Ratio", value: ratio(metrics.orderToTrade) },
    { label: "Cancel Rate", value: pct(metrics.cancelRatePct) },
  ];
  // Still mocked — no latency / slippage on TraceEvent.
  const bottomRow: Metric[] = [
    { label: "Avg Latency", value: "1.82 ms" },
    { label: "Slippage (Avg)", value: "-0.38 bp" },
    { label: "Slippage (Std)", value: "0.72 bp" },
    { label: "Market Impact", value: "-0.64 bp" },
  ];

  const slippage = useMemo(() => distributionOption(SLIPPAGE_BUCKETS, SLIPPAGE_COUNTS), []);
  const latency = useMemo(() => distributionOption(LATENCY_BUCKETS, LATENCY_COUNTS), []);

  const fillStatus = chartStatus({
    idle: !runId,
    loading: isLoading,
    error: isError,
    empty: fillSeries.length === 0,
  });
  // Say WHY — a bare "unavailable" reads like the endpoint is down even when the real answer is
  // a transient 503 or a run that never journaled.
  const fillDetail = isError
    ? error instanceof Error && error.message
      ? error.message
      : "The trace for this run could not be loaded."
    : streamState === "open"
      ? "Waiting for the first orders to arrive."
      : "This run’s trace holds no order events.";
  // Qualifies a chart that IS drawing, so it stays a header caption rather than a state.
  const fillNote =
    fillStatus !== "ready"
      ? undefined
      : data?.truncated
        ? "Partial — journal cut short"
        : streamState === "open"
          ? "Live"
          : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricCard top={topRow} bottom={bottomRow} />

      <ChartCard
        title="Fill Rate over time"
        controls={
          <>
            {fillNote && <MockNote>{fillNote}</MockNote>}
            <PillSelect value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
          </>
        }
        status={fillStatus}
        detail={fillDetail}
        bodyHeight={260}
      >
        <BaseChart option={fillOption} style={{ height: 260 }} />
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
