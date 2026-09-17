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
// Ratio card: every figure reads `GET /api/runs/{id}/summary` — Sharpe/Sortino/Calmar,
// Max Drawdown, Max DD Duration, VaR and CVaR. While a run is RUNNING that endpoint 409s (its
// parquet sidecars are mid-write), so Sharpe and Max Drawdown fall back to the `/live/stream`
// frame, which publishes those two and nothing else; the rest read "—" until the run stops.
// Omega is the one ratio the API does not compute at all.
import { useMemo, useState } from "react";
import { MaximizeSquareMinimalistic } from "@solar-icons/react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { ChartState, chartStatus, type ChartStatus } from "@/components/charts/chart-state";
import {
  mergeLiveSummary,
  preferLiveEquity,
  useLiveSnapshot,
  type LiveSharpeSample,
} from "@/hooks/api/use-run-live-snapshot";
import { realSummary, useRunCurrency, useRunEquity, useRunRiskDetail, useRunSummary } from "@/hooks/api/use-runs";
import type { RunSummary, SampleScope } from "@/types/domain";
import { equityDayLabel, toDrawdown, toRollingSharpe, type DrawdownPoint } from "@/lib/transform/results";
import { toDrawdownRows } from "@/lib/transform/run-detail";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, currencyDigits, formatAmount, formatCompact, formatDurationDays } from "@/lib/utils";
import { currencySymbol } from "@/lib/transform/runs";
import { MockNote } from "./results-chart-card";

const YELLOW = "#f1c617";

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
  /** Why there is no number. Set only where the API has no such field; shown on hover. */
  unavailable?: string;
}

const DASH = "—";

/** Signed ratio, green above zero and red below — the card's convention for Sharpe-likes. */
function ratio(value: number | null | undefined): { value: string; tone: RatioTone } {
  if (value == null || !Number.isFinite(value)) return { value: DASH, tone: "white" };
  return { value: formatAmount(value, 2), tone: value >= 0 ? "green" : "red" };
}

/** A fraction (0.0032) as the negative percentage the drawdown row prints ("-0.32%"). */
function drawdownPct(fraction: number | null | undefined): string {
  if (fraction == null || !Number.isFinite(fraction)) return DASH;
  return `${formatAmount(-Math.abs(fraction) * 100, 2)}%`;
}

/** `2.75` → `2d18h`, or a dash when the run reports no drawdown duration. */
function durationDays(days: number | null | undefined): string {
  return formatDurationDays(days) ?? DASH;
}

/** Money in the run's own settlement currency, matching every other figure in Results. */
function money(value: number | null | undefined, currency: string): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return formatAmount(value, currencyDigits(currency));
}

/**
 * The eight ratios, off the summary (merged with the live frame for the two fields it carries).
 *
 * Everything here is a read — no value is invented. A run with no summary yet renders eight
 * dashes, which is the honest answer while the artifacts are still being written.
 */
function ratioRows(summary: RunSummary | undefined, currency: string): { row1: RatioItem[]; row2: RatioItem[] } {
  const sharpe = ratio(summary?.sharpe_annualized ?? summary?.sharpe);
  const sortino = ratio(summary?.sortino_annualized ?? summary?.sortino);
  const calmar = ratio(summary?.calmar);
  const maxDd = drawdownPct(summary?.max_drawdown_pct);
  return {
    row1: [
      { label: "Sharpe Ratio", ...sharpe },
      { label: "Sortino Ratio", ...sortino },
      { label: "Calmar Ratio", ...calmar },
      {
        label: "Omega Ratio",
        value: DASH,
        tone: "white",
        unavailable: "Omega is not computed by the results API.",
      },
    ],
    row2: [
      { label: "Max Drawdown", value: maxDd, tone: maxDd === DASH ? "white" : "red" },
      { label: "Max DD Duration", value: durationDays(summary?.max_drawdown_duration_days), tone: "white" },
      { label: "VaR", value: money(summary?.var_95, currency), tone: "red", suffix: currencySymbol(currency) },
      { label: "CVaR", value: money(summary?.cvar_95, currency), tone: "red", suffix: currencySymbol(currency) },
    ],
  };
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
            <span
              title={item.unavailable}
              className={cn(
                "text-base leading-5 font-semibold",
                item.unavailable ? "text-muted-foreground" : RATIO_TONE_CLASS[item.tone],
              )}
            >
              {item.value}
            </span>
            {item.suffix && <span className="text-[10px] text-muted-foreground">{item.suffix}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function RatioCard({ summary, currency }: { summary?: RunSummary; currency: string }) {
  const { row1, row2 } = ratioRows(summary, currency);
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

// NOTE: a near-copy of ./results-chart-card ChartCard (this one always shows the expand button and
// drops the className hook). Left as-is rather than consolidated — out of scope here.
function ChartCard({
  title,
  controls,
  children,
  status,
  detail,
  bodyHeight,
}: {
  title: string;
  controls: React.ReactNode;
  children: React.ReactNode;
  status?: ChartStatus;
  detail?: string;
  bodyHeight?: number;
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
      <div className="min-w-0 p-4">
        <ChartState status={status} detail={detail} height={bodyHeight}>
          {children}
        </ChartState>
      </div>
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
  // Pad ~15% so a flat 0 line isn't glued to the bottom, then take the whole unit below that: the
  // padded value is what ECharts labels the axis end with, and -136.1716022970557% is not a tick.
  const min = Math.floor(Math.min(floor * 1.15, floor - 1));

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
        // Percentages are rounded here too: the axis end carries the padding above, which is not
        // a round number on its own.
        formatter: (value: string | number) =>
          isPercent ? `${formatAmount(Number(value), 2)}%` : formatCompact(Number(value)),
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

// ---------------------------------------------------------------------------
// Consecutive loss streaks + Top drawdowns — `/risk-detail`. Styled after MFT risk-mft.tsx's
// "Consecutive loss streaks" chart and "Top 5 drawdown" table so the two engines read as one
// family; not shared code since that file derives its bars/episodes locally off a different
// (percent-return) series and this pass leaves it untouched.
// ---------------------------------------------------------------------------

function lossStreakOption(bars: { streak_len: number; count: number }[]): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: bars.map((b) => String(b.streak_len)),
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: "#9db2ce" },
    },
    yAxis: { type: "value", minInterval: 1, axisLabel: { fontSize: 10 } },
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

/** Epoch ms → the equity chart's own `DD/MM/YY` label plus a `HH:MM` time-of-day. */
function tsLabel(ms: number): string {
  const d = new Date(ms);
  return `${equityDayLabel(ms)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RiskView({
  runId,
  isLive,
  sample,
}: {
  runId?: string;
  isLive?: boolean;
  sample?: SampleScope;
}) {
  // Money, not percent — the control plane's Risk tab plots "equity - running peak" in PnL units
  // (`drawdownSeries` in web/src/features/runs/metric-series.ts, drawn with LineChart's compact
  // formatter); its percentage form lives only on the Equity Curve overlay. The "$" unit here is
  // that same series (`DrawdownPoint.abs`). The "%" unit divides by the running peak of cumulative
  // PnL, which on a curve seeded at 0 compresses a real drawdown toward zero — why this chart read
  // about -1% against a -4.80% `max_drawdown_pct` headline.
  const [drawdownUnit, setDrawdownUnit] = useState<DrawdownUnit>("$");
  const [rollingWindow, setRollingWindow] = useState<string>("30D");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("All");

  // Drawdown series from the run's equity curve (same query paper/live detail uses), or from the
  // live frame's own `equity` while the run is running — `/equity-curve` 500s for its whole life.
  const { data: restEquity = [], isLoading: equityLoading, isError: equityError } = useRunEquity(
    isLive ? undefined : runId,
    sample,
  );
  const { snapshot, sharpeSamples: liveSharpe, state: liveState } = useLiveSnapshot();
  // The ratio card's source. `/summary` 409s for the whole life of a running run, so it is not
  // even asked for there; `mergeLiveSummary` then supplies the two fields the frame does carry
  // (Sharpe, Max Drawdown) and the rest of the card reads "—" until the run stops.
  const { data: restSummary } = useRunSummary(isLive ? undefined : runId, sample);
  const summary = useMemo(
    () => mergeLiveSummary(realSummary(restSummary), snapshot),
    [restSummary, snapshot],
  );
  const currency = useRunCurrency(runId);
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
  const hasDrawdown = drawdownPoints.length > 0;
  const drawdownStatus = chartStatus({
    idle: !runId,
    loading: !hasDrawdown && equityLoading,
    error: !hasDrawdown && equityError,
    empty: !hasDrawdown,
  });
  const drawdownDetail = equityError
    ? "The equity curve for this run could not be loaded."
    : "No equity points fall inside this window.";

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
  const hasRolling = rollingSamples.length > 0;
  const rollingStatus = chartStatus({
    idle: !runId,
    loading: !hasRolling && (isLive ? liveState === "connecting" : equityLoading),
    error: !hasRolling && (isLive ? liveState === "error" : equityError),
    empty: !hasRolling,
  });
  const rollingDetail = isLive
    ? liveState === "error"
      ? "The live stream for this run could not be reached."
      : liveState === "open"
        ? "Waiting for the first snapshots to arrive."
        : "No Sharpe samples have arrived yet."
    : equityError
      ? "The equity curve for this run could not be loaded."
      : "Not enough equity points to compute a rolling Sharpe.";
  // Only meaningful once the chart is actually drawing.
  const rollingNote = hasRolling && isLive && liveState === "open" ? "Live" : undefined;

  // Loss streaks + drawdown episodes — `/risk-detail` 409s for the whole life of a running run,
  // same as every other persisted artifact here.
  const { data: riskDetail, isLoading: riskLoading, isError: riskError } = useRunRiskDetail(
    isLive ? undefined : runId,
    sample,
  );
  const streakBars = useMemo(() => riskDetail?.loss_streak_histogram ?? [], [riskDetail]);
  const streakOption = useMemo(() => lossStreakOption(streakBars), [streakBars]);
  const streakStatus = chartStatus({
    idle: !runId,
    loading: riskLoading,
    error: riskError,
    empty: streakBars.length === 0,
  });
  const drawdownRows = useMemo(() => toDrawdownRows(riskDetail?.drawdown_episodes ?? []), [riskDetail]);
  const streakDetail = riskError
    ? "Risk detail for this run could not be loaded."
    : "This run never had a losing streak.";
  const drawdownRowsDetail = riskError
    ? "Risk detail for this run could not be loaded."
    : "This run never went underwater.";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <RatioCard summary={summary} currency={currency} />

      <ChartCard
        title="Drawdown"
        status={drawdownStatus}
        detail={drawdownDetail}
        bodyHeight={260}
        controls={
          <>
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
        status={rollingStatus}
        detail={rollingDetail}
        bodyHeight={260}
        controls={
          <>
            {rollingNote && <MockNote>{rollingNote}</MockNote>}
            <WindowSelect value={rollingWindow} onChange={setRollingWindow} />
          </>
        }
      >
        <BaseChart option={rollingOption} style={{ height: 260 }} />
      </ChartCard>

      <ChartCard
        title="Consecutive loss streaks"
        controls={undefined}
        status={streakStatus}
        detail={streakDetail}
        bodyHeight={240}
      >
        <BaseChart option={streakOption} style={{ height: 240 }} />
      </ChartCard>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background">
        <div className="border-b border-border bg-surface px-4 py-3">
          <span className="text-sm font-medium text-white">Top drawdowns</span>
        </div>
        {drawdownRows.length ? (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Peak</TableHead>
                <TableHead>Trough</TableHead>
                <TableHead className="text-right">Depth</TableHead>
                <TableHead className="text-right">Length</TableHead>
                <TableHead className="text-right">Recovery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drawdownRows.map((row) => (
                <TableRow key={`${row.peakTs}-${row.troughTs}`}>
                  <TableCell className="text-xs text-white">{tsLabel(row.peakTs)}</TableCell>
                  <TableCell className="text-xs text-white">{tsLabel(row.troughTs)}</TableCell>
                  <TableCell className={cn("text-right text-xs", GRAD_RED)}>
                    {money(row.depth, currency)}
                    {row.depthPct != null && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({formatAmount(row.depthPct * 100, 2)}%)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-white">
                    {formatDurationDays(row.lengthDays) ?? DASH}
                  </TableCell>
                  <TableCell className="text-right text-xs text-white">
                    {row.recoveryDays == null ? DASH : formatDurationDays(row.recoveryDays)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">{drawdownRowsDetail}</div>
        )}
      </div>
    </div>
  );
}
