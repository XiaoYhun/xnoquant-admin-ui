"use client";
// OWNED BY: Results "Risk" agent — Figma node 14180:15399.
// Ratio card (Sharpe/Sortino/Calmar/Omega + Max DD/VaR/CVaR) → Drawdown chart → Rolling Sharpe chart.
//
// Drawdown is derived from `GET /api/runs/{id}/equity-curve` (peak-to-trough on cumulative realized
// PnL). Yesterday/Today/All filters real timestamps (same window as the trading-history Export).
// Rolling Sharpe: while running, appends each `/live/stream` snapshot's sharpe_annualized
// (fallback: sharpe). Otherwise derived from the equity curve (mean/pop-stddev of PnL deltas,
// not annualized — same as backend `rollingSharpeSeries`).
// Ratio card is still mock.
import { useMemo, useState } from "react";
import { MaximizeSquareMinimalistic } from "@solar-icons/react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { useRunLiveSharpeStream, type LiveSharpeSample } from "@/hooks/api/use-run-live";
import { useRunEquity } from "@/hooks/api/use-runs";
import { useTradeHistory } from "@/hooks/api/use-paper-runs";
import type { TradeHistoryRow } from "@/lib/mock/paper-runs";
import { equityDayLabel, toDrawdown, toRollingSharpe, type DrawdownPoint } from "@/lib/transform/results";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
        isPercent ? `${Number(v).toFixed(2)}%` : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 }),
    },
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: labels, boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: {
      type: "value",
      min,
      max: 0,
      axisLabel: {
        formatter: (value: string | number) =>
          isPercent ? `${value}%` : `${Number(value).toLocaleString()}`,
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
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => Number(v).toFixed(2) },
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: labels, boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: {
      type: "value",
      min: Math.floor((lo - padY) * 10) / 10,
      max: Math.ceil((hi + padY) * 10) / 10,
      axisLabel: {
        formatter: (value: string | number) => (Number(value) === 0 ? "0" : Number(value).toFixed(1)),
      },
    },
    series: [
      {
        type: "line",
        data,
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

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Trading-history export
// ---------------------------------------------------------------------------

/** Is this fill inside the selected window, in the reader's own timezone? */
function inWindow(iso: string, window: TimeWindow): boolean {
  if (window === "All") return true;
  const t = new Date(iso).getTime();
  return inWindowTs(t, window);
}

const CSV_COLUMNS = ["Time", "Symbol", "Side", "Price", "Qty", "Mid", "Outcome"] as const;

function toCsv(rows: TradeHistoryRow[]): string {
  // Quote only when a field could break the row; doubling embedded quotes per RFC 4180.
  const cell = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) => [r.time, r.symbol, r.side, r.price, r.qty, r.mid, r.outcome].map(cell).join(","));
  return [CSV_COLUMNS.join(","), ...body].join("\n");
}

function downloadCsv(filename: string, csv: string): void {
  // Excel reads a bare UTF-8 CSV as the local codepage; the BOM makes it pick UTF-8.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ExportButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 shrink-0 cursor-pointer rounded-full border border-border bg-background px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Export
    </button>
  );
}

// ---------------------------------------------------------------------------

export function RiskView({ runId, isLive }: { runId?: string; isLive?: boolean }) {
  const [drawdownUnit, setDrawdownUnit] = useState<DrawdownUnit>("%");
  const [rollingWindow, setRollingWindow] = useState<string>("30D");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("All");

  // Drawdown series from the run's equity curve (same query paper/live detail uses).
  const { data: equity = [], isLoading: equityLoading, isError: equityError } = useRunEquity(runId);
  const drawdownPoints = useMemo(() => {
    const all = toDrawdown(equity);
    return all.filter((p) => inWindowTs(p.ts, timeWindow));
  }, [equity, timeWindow]);
  const drawdownOption = useMemo(
    () => buildDrawdownOption(drawdownPoints, drawdownUnit),
    [drawdownPoints, drawdownUnit],
  );
  const drawdownNote = !runId
    ? "Pick a run"
    : equityLoading
      ? "Loading…"
      : equityError
        ? "Equity unavailable"
        : drawdownPoints.length === 0
          ? "No equity points"
          : undefined;

  // Live sharpe samples — only while the run is running (Redis stream). Finished/backtest runs
  // fall back to equity-curve rolling Sharpe (backend-aligned, not annualized).
  const { samples: liveSharpe, state: liveState } = useRunLiveSharpeStream(runId, !!isLive);
  const equitySharpe = useMemo(() => {
    if (isLive) return [];
    return toRollingSharpe(equity)
      .filter((p) => {
        const cutoff = Date.now() - WINDOW_MS[rollingWindow as RollingWindow];
        return p.ts >= cutoff;
      })
      .map((p) => ({ ts: p.ts, sharpe: p.value }));
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

  // The trading history lives on another tab; this view only exports it, so it rides the same
  // cached ["trade-history", runId] query rather than fetching its own copy.
  const { data: trades = [], isLoading: tradesLoading } = useTradeHistory(runId);
  const exportable = trades.filter((t) => inWindow(t.time, timeWindow));

  const handleExport = () => {
    if (exportable.length === 0) return;
    downloadCsv(`trading-history-${runId}-${timeWindow.toLowerCase()}.csv`, toCsv(exportable));
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <RatioCard />

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
            <ExportButton disabled={!runId || tradesLoading || exportable.length === 0} onClick={handleExport} />
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
