"use client";
// OWNED BY: Results "Performance" agent — Figma node 14175:92246.
// PnL summary card → Monthly Return heatmap → PnL bar chart + Daily Return Distribution histogram.
//
// Data: `GET /api/runs/{id}/summary` (RunSummary) + `GET /api/runs/{id}/equity-curve`
// (EquityPoint[]) — the same two endpoints the hft-platform reference UI uses for its results
// page. The curve is *cumulative realized PnL*, so every per-day/per-month figure here is
// derived from it in `lib/transform/results.ts` rather than fetched.
//
// Percent framing needs starting capital, which the API only publishes indirectly as
// `return_pct = net_pnl / capital`; when that's null (always for live runs, per the spec) the
// heatmap and histogram fall back to absolute PnL and say so in the panel header.
import { useMemo, useState } from "react";
import { MaximizeSquareMinimalistic } from "@solar-icons/react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRunCurrency, useRunEquity, useRunSummary } from "@/hooks/api/use-runs";
import { mergeLiveSummary, preferLiveEquity, useLiveSnapshot } from "@/hooks/api/use-run-live-snapshot";
import {
  annualizedReturn,
  curveSpanMs,
  equityStats,
  startingCapital,
  padDailyPnl,
  toDailyPnlPoints,
  toMonthlyPnl,
  toReturnHistogram,
  type MonthPnl,
} from "@/lib/transform/results";
import { cn, formatAmount, formatSignedAmount } from "@/lib/utils";
import { MockNote } from "./results-chart-card";

// Gradient text — Figma cells/values use these clipped gradients (angles vary 143–165° per
// node; the canonical project angles below are visually identical).
const GREEN_TEXT =
  "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const RED_TEXT =
  "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

const DASH = "—";

function fmtSigned(v: number, digits = 2): string {
  return formatSignedAmount(v, digits);
}

function fmtPct(v: number, digits = 2): string {
  return `${v > 0 ? "+" : ""}${formatAmount(v, digits)}%`;
}

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

function toneOf(v: number): MetricTone {
  return v >= 0 ? "green" : "red";
}

function SummaryMetricCell({ metric }: { metric: SummaryMetric }) {
  const { label, value, unit, delta, tone } = metric;
  const valueText = tone === "green" ? GREEN_TEXT : tone === "red" ? RED_TEXT : "text-white";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="flex flex-wrap items-end gap-1">
        <span className={cn("text-[14px] font-semibold leading-5", valueText)}>{value}</span>
        {unit && <span className="text-[10px] leading-[14px] text-muted-foreground">{unit}</span>}
      </span>
      {delta && (
        <span className="text-[10px] leading-[14px] text-muted-foreground">{delta}</span>
      )}
    </div>
  );
}

const EMPTY_ROW_1: SummaryMetric[] = [
  { label: "Gross PnL", value: DASH },
  { label: "Net PnL", value: DASH },
  { label: "Total Return", value: DASH },
];
const EMPTY_ROW_2: SummaryMetric[] = [
  { label: "CAGR", value: DASH },
  { label: "Avg Daily PnL", value: DASH },
  { label: "Best day", value: DASH },
  { label: "Worst day", value: DASH },
];

function SummaryCard({ rows }: { rows: [SummaryMetric[], SummaryMetric[]] }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-[rgba(29,33,38,0.2)] px-3 py-2">
      <div className="flex flex-col gap-2">
        {/* Top row: 3 metrics on a 4-col grid so they align above the bottom row (no dividers). */}
        <div className="grid grid-cols-2 gap-4 @[520px]:grid-cols-4">
          {rows[0].map((m) => (
            <SummaryMetricCell key={m.label} metric={m} />
          ))}
        </div>
        <div className="h-px w-full bg-border" />
        <div className="grid grid-cols-2 gap-4 @[520px]:grid-cols-4">
          {rows[1].map((m) => (
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

/** A month with no equity points reads as a blank cell, not a 0% one. */
type MonthCell = number | null;
interface YearlyReturns {
  year: number;
  months: MonthCell[]; // 12 entries, Jan..Dec
}

/** Pivot the flat monthly series into one row per year, gaps left null. */
function toYearlyRows(months: MonthPnl[], scale: number): YearlyReturns[] {
  const byYear = new Map<number, YearlyReturns>();
  for (const m of months) {
    let row = byYear.get(m.year);
    if (!row) {
      row = { year: m.year, months: Array<MonthCell>(12).fill(null) };
      byYear.set(m.year, row);
    }
    row.months[m.month] = m.value * scale;
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

// Exact Figma fills: gain = rgba(103,225,193,α) (Green/300), loss = rgba(225,103,103,α) (muted
// maroon). α scales with magnitude at the same 10/20/30/60% steps used for both signs. `step` is
// what one alpha band is worth: 1 (percentage point) in % mode, a third of the largest month in
// absolute mode, so the ramp still spreads across the data either way.
function heatCellColor(v: number, step: number): string {
  const abs = Math.abs(v) / (step || 1);
  const alpha = abs < 1 ? 0.1 : abs < 2 ? 0.2 : abs < 3 ? 0.3 : 0.6;
  return v >= 0 ? `rgba(103,225,193,${alpha})` : `rgba(225,103,103,${alpha})`;
}

function MonthlyReturnPanel({
  rows,
  step,
  isPct,
  note,
}: {
  rows: YearlyReturns[];
  step: number;
  isPct: boolean;
  note?: string;
}) {
  // Heatmap cells are ~48px wide; two decimals do not fit.
  const fmt = (v: number) => (isPct ? fmtPct(v, 1) : fmtSigned(v, 0));
  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white">Monthly Return</h3>
        <div className="flex items-center gap-3">
          {note && <MockNote>{note}</MockNote>}
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
          {rows.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No monthly returns for this run.
            </div>
          ) : (
            rows.map((row) => (
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
                    style={v === null ? undefined : { backgroundColor: heatCellColor(v, step) }}
                    className="flex flex-1 items-center justify-center px-3 py-2.5"
                  >
                    <span
                      className={cn(
                        "text-xs font-medium",
                        v === null ? "text-muted-foreground" : v >= 0 ? GREEN_TEXT : RED_TEXT,
                      )}
                    >
                      {v === null ? DASH : fmt(v)}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// PnL bar chart (By Day / By Month)
// ---------------------------------------------------------------------------

interface PnlPoint {
  label: string;
  value: number;
}

function buildPnlOption(points: PnlPoint[], mode: "day" | "month"): EChartsOption {
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
      // Auto-scaled: real runs span anything from a few hundred to millions.
      axisLabel: {
        formatter: (value: number) =>
          Math.abs(value) >= 1000 ? `${value / 1000}K` : `${value}`,
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

function PnlPanel({ daily, monthly, note }: { daily: PnlPoint[]; monthly: PnlPoint[]; note?: string }) {
  const [mode, setMode] = useState<"day" | "month">("day");
  const points = mode === "day" ? daily : monthly;
  const option = useMemo(() => buildPnlOption(points, mode), [points, mode]);

  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white">PnL</h3>
        <div className="flex items-center gap-3">
          {note && <MockNote>{note}</MockNote>}
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

function buildDistributionOption(
  bins: { center: number; count: number }[],
  isPct: boolean,
): EChartsOption {
  // Bins are symmetric around 0, so the first half is exactly the loss side.
  const negative = bins.length / 2;
  // Bar labels stay integral — a "1,000,000.00" caption over a narrow bar is unreadable.
  const label = (v: number) => (isPct ? `${formatAmount(v, 1)}%` : fmtSigned(v, 0));
  return {
    tooltip: {
      trigger: "axis",
      // The category axis only labels every 3rd bin; the tooltip should still name the bin.
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number; value: number }[];
        const p = arr[0];
        if (!p) return "";
        return `${label(bins[p.dataIndex].center)}<br/>${p.value} day${p.value === 1 ? "" : "s"}`;
      },
    },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      // Label every 3rd bin so a 20-bin axis stays readable (matches the Figma cadence).
      data: bins.map((b, i) => (i % 3 === 0 ? label(b.center) : "")),
      axisTick: { show: false },
    },
    yAxis: { type: "value", minInterval: 1 },
    series: [
      {
        type: "bar" as const,
        barWidth: "90%",
        data: bins.map((b, i) => ({
          value: b.count,
          itemStyle: { color: i < negative ? "#ff135b" : "#67e1c1" },
        })),
      },
    ],
  };
}

function DistributionPanel({
  bins,
  isPct,
  note,
}: {
  bins: { center: number; count: number }[];
  isPct: boolean;
  note?: string;
}) {
  const option = useMemo(() => buildDistributionOption(bins, isPct), [bins, isPct]);
  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white">Daily Return Distribution</h3>
        <div className="flex items-center gap-3">
          {note && <MockNote>{note}</MockNote>}
          <ExpandButton label="Daily Return Distribution" />
        </div>
      </div>
      <BaseChart option={option} />
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------

export function PerformanceView({ runId }: { runId?: string }) {
  const {
    data: restSummary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useRunSummary(runId);
  const {
    data: restEquity = [],
    isLoading: equityLoading,
    isError: equityError,
  } = useRunEquity(runId);

  // While the run is streaming, the live frame wins over the persisted artifacts — which error out
  // for the whole life of a running run, leaving the frame as the only source.
  const { snapshot } = useLiveSnapshot();
  const summary = useMemo(() => mergeLiveSummary(restSummary, snapshot), [restSummary, snapshot]);
  const equity = useMemo(() => preferLiveEquity(restEquity, snapshot), [restEquity, snapshot]);

  // Starting capital turns every absolute PnL figure into a percentage. Null → absolute mode.
  const capital = useMemo(() => startingCapital(summary), [summary]);
  const isPct = capital !== null;
  const scale = capital === null ? 1 : 100 / capital; // PnL → % of starting capital

  const currency = useRunCurrency(runId);
  const stats = useMemo(() => equityStats(equity), [equity]);
  // Padded to a week so a single-day HFT run reads as a bar in context, not one lone column.
  const daily = useMemo(() => padDailyPnl(toDailyPnlPoints(equity)), [equity]);
  const monthly = useMemo(() => toMonthlyPnl(equity), [equity]);

  const monthlyRows = useMemo(() => toYearlyRows(monthly, scale), [monthly, scale]);
  // One alpha band = 1 percentage point in % mode; in absolute mode spread the same 3 bands
  // across the largest month so the heatmap still ramps instead of saturating.
  const heatStep = useMemo(() => {
    if (isPct) return 1;
    const maxAbs = Math.max(0, ...monthly.map((m) => Math.abs(m.value)));
    return maxAbs / 3 || 1;
  }, [isPct, monthly]);

  const monthlyPoints = useMemo(
    () => monthly.map((m) => ({ label: `${MONTHS[m.month]} ${m.year}`, value: m.value })),
    [monthly],
  );
  const histogram = useMemo(
    () => toReturnHistogram(toDailyPnlPoints(equity).map((d) => d.value * scale)),
    [equity, scale],
  );

  const summaryRows = useMemo<[SummaryMetric[], SummaryMetric[]]>(() => {
    if (!summary) return [EMPTY_ROW_1, EMPTY_ROW_2];
    const grossPnl = summary.net_pnl + summary.total_fee;

    // CAGR from the run's own calendar span; needs both a return % and enough elapsed time.
    const cagrPct = annualizedReturn(summary.return_pct, curveSpanMs(equity));
    const cagr = cagrPct === null ? DASH : fmtPct(cagrPct * 100);

    return [
      [
        {
          label: "Gross PnL",
          value: fmtSigned(grossPnl),
          unit: currency,
          delta: `Fees ${fmtSigned(-summary.total_fee)}`,
          tone: toneOf(grossPnl),
        },
        {
          label: "Net PnL",
          value: fmtSigned(summary.net_pnl),
          unit: currency,
          delta: summary.return_pct == null ? undefined : fmtPct(summary.return_pct * 100),
          tone: toneOf(summary.net_pnl),
        },
        {
          label: "Total Return",
          value: summary.return_pct == null ? DASH : fmtPct(summary.return_pct * 100),
          tone: summary.return_pct == null ? undefined : toneOf(summary.return_pct),
        },
      ],
      [
        { label: "CAGR", value: cagr },
        {
          label: "Avg Daily PnL",
          value: stats ? fmtSigned(stats.avgDailyPnl, 2) : DASH,
          unit: stats ? currency : undefined,
        },
        {
          label: "Best day",
          value: stats ? fmtSigned(stats.bestDay) : DASH,
          unit: stats ? currency : undefined,
          tone: stats ? "green" : undefined,
        },
        {
          label: "Worst day",
          value: stats ? fmtSigned(stats.worstDay) : DASH,
          unit: stats ? currency : undefined,
          tone: stats ? "red" : undefined,
        },
      ],
    ];
  }, [summary, stats, equity, currency]);

  // One note drives every panel: which of "no run / loading / failed / empty" applies, plus the
  // absolute-instead-of-% caveat once data is actually on screen.
  const loading = summaryLoading || equityLoading;
  const note = !runId
    ? "Pick a run"
    : loading
      ? "Loading…"
      : summaryError && equityError
        ? "Results unavailable"
        : equityError
          ? "Equity unavailable"
          : equity.length === 0
            ? "No equity points"
            : isPct
              ? undefined
              : "Absolute PnL — no starting capital";

  return (
    <div className="@container flex min-w-0 flex-col gap-4">
      <SummaryCard rows={summaryRows} />
      <MonthlyReturnPanel rows={monthlyRows} step={heatStep} isPct={isPct} note={note} />
      <div className="grid min-w-0 grid-cols-1 gap-4 @[560px]:grid-cols-2">
        <PnlPanel daily={daily} monthly={monthlyPoints} note={note} />
        <DistributionPanel bins={histogram} isPct={isPct} note={note} />
      </div>
    </div>
  );
}
