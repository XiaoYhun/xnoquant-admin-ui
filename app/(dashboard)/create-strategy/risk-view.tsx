"use client";
// OWNED BY: Results "Risk" agent — Figma node 14180:15399.
// Ratio card (Sharpe/Sortino/Calmar/Omega + Max DD/VaR/CVaR) → Drawdown chart → Rolling Sharpe chart.
//
// Drawdown is derived from `GET /api/runs/{id}/equity-curve` (peak-to-trough on cumulative realized
// PnL). Yesterday/Today/All filters real timestamps (same window as the trading-history Export).
// Rolling Sharpe: while running, appends each `/live/stream` snapshot's sharpe_annualized
// (fallback: sharpe), read off the shared `LiveSnapshotProvider` rather than its own connection.
// Otherwise derived from the equity curve (mean/pop-stddev of PnL deltas, not annualized — same
// as backend `rollingSharpeSeries`).
// Ratio card: Sharpe and Max Drawdown come off the live snapshot while the run is running; the
// remaining ratios (Sortino/Calmar/Omega/MDD-Duration/VaR/CVaR) have no API source and stay mock.
import { useMemo, useState } from "react";
import { MaximizeSquareMinimalistic } from "@solar-icons/react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import {
  preferLiveEquity,
  useLiveSnapshot,
  type LiveSharpeSample,
  type LiveSnapshot,
} from "@/hooks/api/use-run-live-snapshot";
import { useRunEquity } from "@/hooks/api/use-runs";
import { equityDayLabel, toDrawdown, toRollingSharpe, type DrawdownPoint } from "@/lib/transform/results";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatAmount, formatCompact } from "@/lib/utils";
import { MockNote } from "./results-chart-card";

const GRAD_GREEN =
  "bg-[linear-gradient(152deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED =
  "bg-[linear-gradient(161deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

const DRAWDOWN_COLOR = "#ff135b";
const ROLLING_SHARPE_COLOR = "#ff9783";

// ---------------------------------------------------------------------------
// Ratio card
// ---------------------------------------------------------------------------

type RatioTone = "green" | "red" | "white";

interface RatioItem {
  label: string;
  value: string;
  tone: RatioTone;
  suffix?: string;
  /** Which live-snapshot field replaces this item's value while a run is streaming, if any. */
  live?: "sharpe" | "maxDrawdown";
}

// Labels are the design's own spelling (Figma 14180:15399), typos included — don't "fix" them
// here or the card stops matching the mock. The `live` marker, not the label, drives the overlay.
const RATIO_ROW_1: RatioItem[] = [
  { label: "Sharp Ratio", value: "3.12", tone: "green", live: "sharpe" },
  { label: "Sortio Ratio", value: "4.56", tone: "green" },
  { label: "Calmar Ratio", value: "8.34", tone: "green" },
  { label: "Omega Ratio", value: "8.34", tone: "green" },
];

const RATIO_ROW_2: RatioItem[] = [
  { label: "Max Drawdown", value: "-4.10%", tone: "red", live: "maxDrawdown" },
  { label: "Max DD Duration", value: "2d18h", tone: "white" },
  { label: "VaR", value: "-6,530", tone: "red", suffix: "USDT" },
  { label: "CVaR", value: "-9,350", tone: "red", suffix: "USDT" },
];

/**
 * Overlay the two ratios the live snapshot actually publishes onto the mock rows. Sortino/Calmar/
 * Omega/MDD-Duration/VaR/CVaR have no source on the snapshot or in the REST results API, so they
 * keep their placeholder values rather than being blanked.
 */
function withLiveRatios(snapshot: LiveSnapshot | undefined): { row1: RatioItem[]; row2: RatioItem[] } {
  if (!snapshot) return { row1: RATIO_ROW_1, row2: RATIO_ROW_2 };
  const sharpe = snapshot.sharpeAnnualized ?? snapshot.sharpe;
  const mddPct = snapshot.maxDrawdownPct;
  const overlay = (item: RatioItem): RatioItem => {
    if (item.live === "sharpe" && sharpe !== undefined) {
      return { ...item, value: formatAmount(sharpe, 2), tone: sharpe >= 0 ? "green" : "red" };
    }
    // `max_drawdown_pct` is a fraction (0.0032 = 0.32%), matching `RunSummary.max_drawdown_pct`.
    if (item.live === "maxDrawdown" && mddPct !== undefined) {
      return { ...item, value: `${formatAmount(-Math.abs(mddPct) * 100, 2)}%`, tone: "red" };
    }
    return item;
  };
  return { row1: RATIO_ROW_1.map(overlay), row2: RATIO_ROW_2.map(overlay) };
}

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

function RatioCard({ snapshot }: { snapshot?: LiveSnapshot }) {
  const { row1, row2 } = withLiveRatios(snapshot);
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-[rgba(29,33,38,0.2)] px-3 py-2">
      <RatioRow items={row1} />
      <div className="h-px w-full bg-border" />
      <RatioRow items={row2} />
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
// Drawdown chart (area, pink/red gradient, %/$ toggle) — from equity-curve
// ---------------------------------------------------------------------------

type DrawdownUnit = "%" | "$";

/** Time filter shared by the Drawdown chart and the trading-history export. */
const TIME_WINDOWS = ["Yesterday", "Today", "All"] as const;
type TimeWindow = (typeof TIME_WINDOWS)[number];

/** Is this fill / equity point inside the selected window, in the reader's own timezone? */
function inWindowTs(ms: number, window: TimeWindow): boolean {
  if (window === "All") return true;
  if (!Number.isFinite(ms)) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (window === "Today") return ms >= startOfToday;
  return ms >= startOfToday - 86_400_000 && ms < startOfToday;
}

function buildDrawdownOption(points: DrawdownPoint[], unit: DrawdownUnit): EChartsOption {
  const isPercent = unit === "%";
  const data = points.map((p) => (isPercent ? p.pct : p.abs));
  const labels = points.map((p) => equityDayLabel(p.ts));
  const floor = data.length ? Math.min(0, ...data) : -1;
  // Pad ~15% so a flat 0 line isn't glued to the bottom.
  const min = Math.min(floor * 1.15, floor - (isPercent ? 1 : 1));

  return {
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: unknown) =>
        isPercent ? `${formatAmount(Number(v), 2)}%` : formatAmount(Number(v)),
    },
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: labels, boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: {
      type: "value",
      min,
      max: 0,
      axisLabel: {
        // Compact on the axis, exact in the tooltip — a drawdown in the millions needs the room.
        formatter: (value: string | number) =>
          isPercent ? `${value}%` : formatCompact(Number(value)),
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
// Rolling Sharpe — live `/live/stream` samples (sharpe_annualized over time)
// ---------------------------------------------------------------------------

const ROLLING_WINDOW_OPTIONS = ["7D", "14D", "30D", "60D"] as const;
type RollingWindow = (typeof ROLLING_WINDOW_OPTIONS)[number];

const WINDOW_MS: Record<RollingWindow, number> = {
  "7D": 7 * 86_400_000,
  "14D": 14 * 86_400_000,
  "30D": 30 * 86_400_000,
  "60D": 60 * 86_400_000,
};

const pad = (n: number) => String(n).padStart(2, "0");
function clockLabel(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function filterRollingWindow(samples: LiveSharpeSample[], window: RollingWindow): LiveSharpeSample[] {
  const cutoff = Date.now() - WINDOW_MS[window];
  return samples.filter((s) => s.ts >= cutoff);
}

function buildRollingSharpeOption(
  samples: { ts: number; sharpe: number }[],
  labelOf: (ts: number) => string = clockLabel,
): EChartsOption {
  const labels = samples.map((s) => labelOf(s.ts));
  const data = samples.map((s) => s.sharpe);
  const lo = data.length ? Math.min(...data) : -1;
  const hi = data.length ? Math.max(...data) : 3;
  const padY = Math.max(0.25, (hi - lo) * 0.15);

  return {
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => formatAmount(Number(v), 2) },
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: labels, boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: {
      type: "value",
      min: Math.floor((lo - padY) * 10) / 10,
      max: Math.ceil((hi + padY) * 10) / 10,
      axisLabel: {
        formatter: (value: string | number) => (Number(value) === 0 ? "0" : formatAmount(Number(value), 1)),
      },
    },
    series: [
      {
        type: "line",
        data,
        smooth: false,
        // A one-point series (a short run's only rolling window) draws no segment — show its
        // marker so the chart isn't blank when there genuinely is a value.
        showSymbol: data.length === 1,
        symbol: data.length === 1 ? "circle" : "none",
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
}

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

export function RiskView({ runId, isLive }: { runId?: string; isLive?: boolean }) {
  const [drawdownUnit, setDrawdownUnit] = useState<DrawdownUnit>("%");
  const [rollingWindow, setRollingWindow] = useState<string>("30D");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("All");

  // Drawdown series from the run's equity curve (same query paper/live detail uses), or from the
  // live frame's own `equity` while the run is running — `/equity-curve` 500s for its whole life.
  const { data: restEquity = [], isLoading: equityLoading, isError: equityError } = useRunEquity(runId);
  const { snapshot, sharpeSamples: liveSharpe, state: liveState } = useLiveSnapshot();
  const equity = useMemo(() => preferLiveEquity(restEquity, snapshot), [restEquity, snapshot]);
  const drawdownPoints = useMemo(() => {
    const all = toDrawdown(equity);
    return all.filter((p) => inWindowTs(p.ts, timeWindow));
  }, [equity, timeWindow]);
  const drawdownOption = useMemo(
    () => buildDrawdownOption(drawdownPoints, drawdownUnit),
    [drawdownPoints, drawdownUnit],
  );
  // Points win over a REST error: a running run's `/equity-curve` always errors, and the series
  // being drawn came off the live frame instead.
  const drawdownNote = !runId
    ? "Pick a run"
    : drawdownPoints.length > 0
      ? undefined
      : equityLoading
        ? "Loading…"
        : equityError
          ? "Equity unavailable"
          : "No equity points";

  // Live sharpe samples — only while the run is running (Redis stream). Finished/backtest runs
  // fall back to equity-curve rolling Sharpe (backend-aligned, not annualized).
  const equitySharpe = useMemo(() => {
    if (isLive) return [];
    const series = toRollingSharpe(equity);
    if (series.length === 0) return [];
    // Anchor the window to the series' own last point, not wall-clock now: a backtest over
    // historical data — or any run that finished longer ago than the window — would otherwise
    // filter to nothing and draw an empty chart.
    const cutoff = series[series.length - 1].ts - WINDOW_MS[rollingWindow as RollingWindow];
    return series.filter((p) => p.ts >= cutoff).map((p) => ({ ts: p.ts, sharpe: p.value }));
  }, [equity, isLive, rollingWindow]);
  const rollingSamples = useMemo(
    () =>
      isLive
        ? filterRollingWindow(liveSharpe, rollingWindow as RollingWindow)
        : equitySharpe,
    [isLive, liveSharpe, equitySharpe, rollingWindow],
  );
  const rollingOption = useMemo(
    () => buildRollingSharpeOption(rollingSamples, isLive ? clockLabel : equityDayLabel),
    [rollingSamples, isLive],
  );
  const rollingNote = !runId
    ? "Pick a run"
    : isLive
      ? liveState === "connecting"
        ? "Connecting…"
        : liveState === "error"
          ? "Live stream unavailable"
          : rollingSamples.length === 0
            ? liveState === "open"
              ? "Waiting for snapshots…"
              : "No sharpe samples"
            : liveState === "open"
              ? "Live"
              : undefined
      : equityLoading
        ? "Loading…"
        : equityError
          ? "Equity unavailable"
          : rollingSamples.length === 0
            ? "Need more equity points"
            : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <RatioCard snapshot={snapshot} />

      <ChartCard
        title="Drawdown"
        controls={
          <>
            {drawdownNote && <MockNote>{drawdownNote}</MockNote>}
            <Tabs value={timeWindow} onValueChange={(v) => v && setTimeWindow(v as TimeWindow)}>
              <TabsList>
                {TIME_WINDOWS.map((w) => (
                  <TabsTrigger key={w} value={w}>
                    {w}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <UnitToggle value={drawdownUnit} onChange={setDrawdownUnit} />
          </>
        }
      >
        <BaseChart option={drawdownOption} style={{ height: 260 }} />
      </ChartCard>

      <ChartCard
        title="Rolling Sharpe"
        controls={
          <>
            {rollingNote && <MockNote>{rollingNote}</MockNote>}
            <WindowSelect value={rollingWindow} onChange={setRollingWindow} />
          </>
        }
      >
        <BaseChart option={rollingOption} style={{ height: 260 }} />
      </ChartCard>
    </div>
  );
}
