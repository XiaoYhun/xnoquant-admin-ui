"use client";
// OWNED BY: Results "Performance" agent — Figma node 14175:92246.
// PnL summary card → Monthly Return heatmap → PnL bar chart + Daily Return Distribution histogram.
// Self-contained mock data; all interactions (toggle, expand) are local/no-op — page-level
// wiring lands with the shell owner. Fills verified against Figma Dev Mode (see report).
import { useMemo, useState } from "react";
import { MaximizeSquareMinimalistic } from "@solar-icons/react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Gradient text — Figma cells/values use these clipped gradients (angles vary 143–165° per
// node; the canonical project angles below are visually identical).
const GREEN_TEXT =
  "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const RED_TEXT =
  "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

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

const SUMMARY_ROW_1: SummaryMetric[] = [
  { label: "Gross PnL", value: "+142,350", unit: "USDT", delta: "+25.4%", tone: "green" },
  { label: "Net PnL", value: "+142,350", unit: "USDT", delta: "+25.4%", tone: "green" },
  { label: "Total Return", value: "14.24%" },
];

const SUMMARY_ROW_2: SummaryMetric[] = [
  { label: "CAGA", value: "34.24%" },
  { label: "Avg Daily PnL", value: "941.39", unit: "USDT" },
  { label: "Best day", value: "8,350", unit: "USDT", tone: "green" },
  { label: "Worst day", value: "-6,350", unit: "USDT", tone: "red" },
];

function SummaryMetricCell({ metric }: { metric: SummaryMetric }) {
  const { label, value, unit, delta, tone } = metric;
  const valueText = tone === "green" ? GREEN_TEXT : tone === "red" ? RED_TEXT : "text-white";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="flex flex-wrap items-end gap-1">
        <span className={cn("text-base font-semibold leading-5", valueText)}>{value}</span>
        {unit && <span className="text-[10px] leading-[14px] text-muted-foreground">{unit}</span>}
      </span>
      {delta && (
        <span className="text-[10px] leading-[14px] text-muted-foreground">{delta}</span>
      )}
    </div>
  );
}

function SummaryCard() {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-[rgba(29,33,38,0.2)] px-3 py-2">
      <div className="flex flex-col gap-2">
        {/* Top row: 3 metrics on a 4-col grid so they align above the bottom row (no dividers). */}
        <div className="grid grid-cols-2 gap-4 @[520px]:grid-cols-4">
          {SUMMARY_ROW_1.map((m) => (
            <SummaryMetricCell key={m.label} metric={m} />
          ))}
        </div>
        <div className="h-px w-full bg-border" />
        <div className="grid grid-cols-2 gap-4 @[520px]:grid-cols-4">
          {SUMMARY_ROW_2.map((m) => (
            <SummaryMetricCell key={m.label} metric={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared panel chrome
// ---------------------------------------------------------------------------

function PanelCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      {children}
    </section>
  );
}

function ExpandButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={`Expand ${label}`}
      className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-white"
    >
      <MaximizeSquareMinimalistic className="size-4" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Monthly Return heatmap
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface YearlyReturns {
  year: number;
  months: number[]; // 12 monthly return %, Jan..Dec
}

const MONTHLY_RETURNS: YearlyReturns[] = [
  { year: 2023, months: [1.3, -0.8, 2.4, 3.1, 1.7, -1.4, 2.9, 0.6, 1.1, 2.2, 1.9, 2.6] },
  { year: 2024, months: [2.5, 0.5, 1.6, -1.3, 3.9, 1.2, 3.1, 1.8, 3.3, 2.4, 1.4, 2.0] },
  { year: 2025, months: [1.8, 3.3, -0.8, 0.5, -2.0, 3.0, 1.3, -2.0, -1.5, 0.6, 0.9, 1.7] },
];

function formatMonthPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

// Exact Figma fills: gain = rgba(103,225,193,α) (Green/300), loss = rgba(225,103,103,α) (muted
// maroon). α scales with magnitude at the same 10/20/30/60% steps used for both signs.
function heatCellColor(v: number): string {
  const abs = Math.abs(v);
  const alpha = abs < 1 ? 0.1 : abs < 2 ? 0.2 : abs < 3 ? 0.3 : 0.6;
  return v >= 0 ? `rgba(103,225,193,${alpha})` : `rgba(225,103,103,${alpha})`;
}

function MonthlyReturnPanel() {
  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white">Monthly Return</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Loss</span>
            <span className="h-1.5 w-16 rounded-full bg-[linear-gradient(90deg,#ff135b_0%,#67e1c1_100%)]" />
            <span>Gain</span>
          </div>
          <ExpandButton label="Monthly Return" />
        </div>
      </div>

      {/* Full-bleed cells (flex-1, no gaps) that fill each row; rows split by a border.
          Scrolls horizontally inside the panel when narrow rather than overflowing the page. */}
      <div className="min-w-0 overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="flex items-center border-b border-border">
            <span className="flex-1 px-3 py-2 text-xs text-muted-foreground">Year</span>
            {MONTHS.map((m) => (
              <span key={m} className="flex-1 px-3 py-2 text-center text-xs text-muted-foreground">
                {m}
              </span>
            ))}
          </div>
          {MONTHLY_RETURNS.map((row) => (
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
                  style={{ backgroundColor: heatCellColor(v) }}
                  className="flex flex-1 items-center justify-center px-3 py-2.5"
                >
                  <span className={cn("text-xs font-medium", v >= 0 ? GREEN_TEXT : RED_TEXT)}>
                    {formatMonthPct(v)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// PnL bar chart (By Day / By Month)
// ---------------------------------------------------------------------------

const PNL_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

interface PnlPoint {
  label: string;
  value: number;
}

function buildDailyPnl(): PnlPoint[] {
  const end = new Date(2025, 5, 30);
  const points: PnlPoint[] = [];
  const cursor = new Date(2025, 0, 1);
  let i = 0;
  while (cursor <= end) {
    const value = Math.round(
      Math.sin(i * 0.32) * 3400 + Math.sin(i * 0.09) * 2600 + Math.cos(i * 0.6) * 900,
    );
    points.push({
      label: cursor.getDate() === 1 ? `${PNL_MONTH_LABELS[cursor.getMonth()]} 2025` : "",
      value,
    });
    cursor.setDate(cursor.getDate() + 1);
    i += 1;
  }
  return points;
}

const DAILY_PNL: PnlPoint[] = buildDailyPnl();

const MONTHLY_PNL: PnlPoint[] = [
  { label: "Jan 2025", value: 6200 },
  { label: "Feb 2025", value: -3400 },
  { label: "Mar 2025", value: 8100 },
  { label: "Apr 2025", value: -5200 },
  { label: "May 2025", value: 4300 },
  { label: "Jun 2025", value: -1800 },
];

function buildPnlOption(mode: "day" | "month"): EChartsOption {
  const points = mode === "day" ? DAILY_PNL : MONTHLY_PNL;
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: points.map((p) => p.label),
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      min: -10000,
      max: 10000,
      interval: 5000,
      axisLabel: {
        formatter: (value: number) => (value === 0 ? "0" : `${value / 1000}K`),
      },
    },
    series: [
      {
        type: "bar" as const,
        barWidth: mode === "day" ? "70%" : "40%",
        data: points.map((p) => ({
          value: p.value,
          itemStyle: { color: p.value >= 0 ? "#67e1c1" : "#ff135b" },
        })),
      },
    ],
  };
}

function PnlPanel() {
  const [mode, setMode] = useState<"day" | "month">("day");
  const option = useMemo(() => buildPnlOption(mode), [mode]);

  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white">PnL</h3>
        <div className="flex items-center gap-3">
          <Tabs value={mode} onValueChange={(v) => v && setMode(v as "day" | "month")}>
            <TabsList>
              <TabsTrigger value="day">By Day</TabsTrigger>
              <TabsTrigger value="month">By Month</TabsTrigger>
            </TabsList>
          </Tabs>
          <ExpandButton label="PnL" />
        </div>
      </div>
      <BaseChart option={option} />
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// Daily Return Distribution histogram
// ---------------------------------------------------------------------------

// 20 bins from -3% to +3% (0.3% step); label only every ~1% for a readable axis.
const HIST_LABELS = [
  "-3%", "", "",
  "-2%", "", "",
  "-1%", "", "",
  "0%", "", "",
  "1%", "", "",
  "2%", "", "",
  "3%", "",
];
const HIST_VALUES = [4, 6, 10, 16, 24, 34, 46, 60, 75, 88, 97, 100, 94, 82, 68, 54, 40, 28, 18, 10];
const HIST_NEGATIVE_BINS = 10; // bins 0..9 sit left of 0%, colored loss (pink/red)

const DISTRIBUTION_OPTION: EChartsOption = {
  tooltip: { trigger: "axis" },
  grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
  xAxis: {
    type: "category",
    data: HIST_LABELS,
    axisTick: { show: false },
  },
  yAxis: { type: "value", min: 0, max: 100, interval: 25 },
  series: [
    {
      type: "bar" as const,
      barWidth: "90%",
      data: HIST_VALUES.map((v, i) => ({
        value: v,
        itemStyle: { color: i < HIST_NEGATIVE_BINS ? "#ff135b" : "#67e1c1" },
      })),
    },
  ],
};

function DistributionPanel() {
  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white">Daily Return Distribution</h3>
        <ExpandButton label="Daily Return Distribution" />
      </div>
      <BaseChart option={DISTRIBUTION_OPTION} />
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------

export function PerformanceView() {
  return (
    <div className="@container flex min-w-0 flex-col gap-4">
      <SummaryCard />
      <MonthlyReturnPanel />
      <div className="grid min-w-0 grid-cols-1 gap-4 @[560px]:grid-cols-2">
        <PnlPanel />
        <DistributionPanel />
      </div>
    </div>
  );
}
