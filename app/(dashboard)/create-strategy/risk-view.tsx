"use client";
// OWNED BY: Results "Risk" agent — Figma node 14180:15399.
// Ratio card (Sharpe/Sortino/Calmar/Omega + Max DD/VaR/CVaR) → Drawdown chart → Rolling Sharpe chart.
// Self-contained mock data; all interactions (unit toggle, window select, expand) are local/no-op —
// page-level wiring lands with the shell owner.
import { useState } from "react";
import { MaximizeSquareMinimalistic } from "@solar-icons/react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const GRAD_GREEN =
  "bg-[linear-gradient(152deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED =
  "bg-[linear-gradient(161deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

const DRAWDOWN_COLOR = "#ff135b";
const ROLLING_SHARPE_COLOR = "#ff9783";
const NOTIONAL = 100_000; // mock account equity used to convert Drawdown % -> $

// ---------------------------------------------------------------------------
// Ratio card
// ---------------------------------------------------------------------------

type RatioTone = "green" | "red" | "white";

interface RatioItem {
  label: string;
  value: string;
  tone: RatioTone;
  suffix?: string;
}

const RATIO_ROW_1: RatioItem[] = [
  { label: "Sharp Ratio", value: "3.12", tone: "green" },
  { label: "Sortio Ratio", value: "4.56", tone: "green" },
  { label: "Calmar Ratio", value: "8.34", tone: "green" },
  { label: "Omega Ratio", value: "8.34", tone: "green" },
];

const RATIO_ROW_2: RatioItem[] = [
  { label: "Max Drawdown", value: "-4.10%", tone: "red" },
  { label: "Max DD Duration", value: "2d18h", tone: "white" },
  { label: "VaR", value: "-6,530", tone: "red", suffix: "USDT" },
  { label: "CVaR", value: "-9,350", tone: "red", suffix: "USDT" },
];

const RATIO_TONE_CLASS: Record<RatioTone, string> = {
  green: GRAD_GREEN,
  red: GRAD_RED,
  white: "text-white",
};

function RatioRow({ items }: { items: RatioItem[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-xs text-muted-foreground">{item.label}</span>
          <span className="flex flex-wrap items-end gap-1">
            <span className={cn("text-base leading-5 font-semibold", RATIO_TONE_CLASS[item.tone])}>
              {item.value}
            </span>
            {item.suffix && <span className="text-[10px] text-muted-foreground">{item.suffix}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function RatioCard() {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-[rgba(29,33,38,0.2)] px-3 py-2">
      <RatioRow items={RATIO_ROW_1} />
      <div className="h-px w-full bg-border" />
      <RatioRow items={RATIO_ROW_2} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared chart panel chrome
// ---------------------------------------------------------------------------

function ExpandButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={`Expand ${label} chart`}
      className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-white"
    >
      <MaximizeSquareMinimalistic weight="Outline" className="size-5" />
    </button>
  );
}

function ChartCard({
  title,
  controls,
  children,
}: {
  title: string;
  controls: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3">
        <span className="text-sm font-medium text-white">{title}</span>
        <div className="flex shrink-0 items-center gap-3">
          {controls}
          <ExpandButton label={title} />
        </div>
      </div>
      <div className="min-w-0 p-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock time series — deterministic so the chart is stable across renders/SSR.
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
const POINTS_PER_MONTH = 4;

function buildCategories(): string[] {
  const labels: string[] = [];
  for (const month of MONTHS) {
    for (let i = 0; i < POINTS_PER_MONTH; i++) {
      labels.push(i === 0 ? `${month} 2025` : "");
    }
  }
  return labels;
}

// Deterministic PRNG (mulberry32) — no Math.random(), so SSR/CSR output matches.
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDrawdownSeries(length: number): number[] {
  const random = mulberry32(7);
  const values: number[] = [];
  let value = 0;
  for (let i = 0; i < length; i++) {
    const drift = i < length * 0.6 ? -0.35 : 0.15;
    value = Math.min(0, Math.max(-8, value + drift + (random() - 0.5) * 1.1));
    values.push(Number(value.toFixed(2)));
  }
  return values;
}

function buildRollingSharpeSeries(length: number): number[] {
  const random = mulberry32(23);
  const values: number[] = [];
  let value = 2;
  for (let i = 0; i < length; i++) {
    value = Math.min(3, Math.max(-1, value + (random() - 0.5) * 0.9));
    values.push(Number(value.toFixed(2)));
  }
  return values;
}

const CATEGORIES = buildCategories();
const DRAWDOWN_PERCENT = buildDrawdownSeries(CATEGORIES.length);
const DRAWDOWN_DOLLAR = DRAWDOWN_PERCENT.map((p) => Math.round((p / 100) * NOTIONAL));
const ROLLING_SHARPE = buildRollingSharpeSeries(CATEGORIES.length);

// ---------------------------------------------------------------------------
// Drawdown chart (area, pink/red gradient, %/$ toggle)
// ---------------------------------------------------------------------------

type DrawdownUnit = "%" | "$";

function buildDrawdownOption(unit: DrawdownUnit): EChartsOption {
  const isPercent = unit === "%";
  const data = isPercent ? DRAWDOWN_PERCENT : DRAWDOWN_DOLLAR;

  return {
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: CATEGORIES, boundaryGap: false },
    yAxis: {
      type: "value",
      min: isPercent ? -8 : (-8 / 100) * NOTIONAL,
      max: 0,
      interval: isPercent ? 2 : (2 / 100) * NOTIONAL,
      axisLabel: {
        formatter: (value: string | number) => (isPercent ? `${value}%` : `${Number(value).toLocaleString()}`),
      },
    },
    series: [
      {
        type: "line",
        data,
        smooth: false,
        showSymbol: false,
        symbol: "none",
        lineStyle: { width: 1.5, color: DRAWDOWN_COLOR },
        itemStyle: { color: DRAWDOWN_COLOR },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(255,19,91,0.45)" },
              { offset: 1, color: "rgba(255,19,91,0)" },
            ],
          },
        },
      },
    ],
  };
}

function UnitToggle({ value, onChange }: { value: DrawdownUnit; onChange: (value: DrawdownUnit) => void }) {
  return (
    <Tabs value={value} onValueChange={(v) => v && onChange(v as DrawdownUnit)}>
      <TabsList>
        <TabsTrigger value="%">%</TabsTrigger>
        <TabsTrigger value="$">$</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Rolling Sharpe chart (area, brown/orange gradient, dashed ref lines at 0 / 1.0)
// ---------------------------------------------------------------------------

const ROLLING_WINDOW_OPTIONS = ["7D", "14D", "30D", "60D"] as const;

const ROLLING_SHARPE_OPTION: EChartsOption = {
  tooltip: { trigger: "axis" },
  grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
  xAxis: { type: "category", data: CATEGORIES, boundaryGap: false },
  yAxis: {
    type: "value",
    min: -1,
    max: 3,
    interval: 1,
    axisLabel: {
      formatter: (value: string | number) => (Number(value) === 0 ? "0" : Number(value).toFixed(1)),
    },
  },
  series: [
    {
      type: "line",
      data: ROLLING_SHARPE,
      smooth: false,
      showSymbol: false,
      symbol: "none",
      lineStyle: { width: 1.5, color: ROLLING_SHARPE_COLOR },
      itemStyle: { color: ROLLING_SHARPE_COLOR },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(255,151,131,0.4)" },
            { offset: 1, color: "rgba(255,151,131,0)" },
          ],
        },
      },
      markLine: {
        symbol: "none",
        silent: true,
        label: { show: false },
        data: [
          { yAxis: 0, lineStyle: { type: "dashed", color: "#9db2ce", width: 1 } },
          { yAxis: 1, lineStyle: { type: "dashed", color: "#ff6a8f", width: 1 } },
        ],
      },
    },
  ],
};

function WindowSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="h-8 rounded-full border-border bg-background px-3 text-xs font-medium text-white"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {ROLLING_WINDOW_OPTIONS.map((w) => (
          <SelectItem key={w} value={w}>
            {w}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------

export function RiskView() {
  const [drawdownUnit, setDrawdownUnit] = useState<DrawdownUnit>("%");
  const [rollingWindow, setRollingWindow] = useState<string>("30D");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <RatioCard />

      <ChartCard title="Drawdown" controls={<UnitToggle value={drawdownUnit} onChange={setDrawdownUnit} />}>
        <BaseChart option={buildDrawdownOption(drawdownUnit)} style={{ height: 260 }} />
      </ChartCard>

      <ChartCard
        title="Rolling Sharpe"
        controls={<WindowSelect value={rollingWindow} onChange={setRollingWindow} />}
      >
        <BaseChart option={ROLLING_SHARPE_OPTION} style={{ height: 260 }} />
      </ChartCard>
    </div>
  );
}
