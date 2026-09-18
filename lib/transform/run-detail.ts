// Derivations for the three run-result endpoints wired in this pass: `/risk-detail`,
// `/execution-detail` and `/symbol-pnl` (see types/domain.ts for the hand-written response
// shapes). Kept separate from results.ts (equity-curve derivations) and mft-results.ts (XALPHA
// series derivations) since these three read pre-aggregated server payloads rather than deriving
// from a curve.
import type { EChartsOption } from "echarts";
import type { DrawdownEpisode, HistogramBucket, HourlyPnlBucket, RunSummary } from "@/types/domain";
import { formatAmount, formatCompact } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Histogram → bars (slippage_histogram / latency_histogram) — HFT execution-view.tsx and MFT
// execution-mft.tsx draw the identical chart off this, so both the mapping and the option builder
// live here once rather than twice.
// ---------------------------------------------------------------------------

export type HistogramBar = { start: number; end: number; count: number };

export function toHistogramBars(buckets: HistogramBucket[]): HistogramBar[] {
  return [...buckets]
    .filter((b) => Number.isFinite(b.bucket_start) && Number.isFinite(b.bucket_end))
    .sort((a, b) => a.bucket_start - b.bucket_start)
    .map((b) => ({ start: b.bucket_start, end: b.bucket_end, count: b.count }));
}

/** Bar chart: x = bucket lower bound, y = fill count. `unit` labels the axis/tooltip ("bp"/"ms"). */
export function buildHistogramBarOption(bars: HistogramBar[], unit: string, color = "#f1c617"): EChartsOption {
  const digits = unit === "bp" ? 1 : 0;
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number; value: number }[];
        const p = arr[0];
        if (!p) return "";
        const b = bars[p.dataIndex];
        return `${formatAmount(b.start, digits)} to ${formatAmount(b.end, digits)} ${unit}<br/>${p.value} fill${p.value === 1 ? "" : "s"}`;
      },
    },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: bars.map((b) => formatAmount(b.start, digits)),
      axisTick: { show: false },
      axisLabel: { fontSize: 10, hideOverlap: true },
    },
    yAxis: { type: "value", minInterval: 1, axisLabel: { fontSize: 10 } },
    series: [
      {
        type: "bar",
        barWidth: "70%",
        data: bars.map((b) => b.count),
        itemStyle: { color, borderRadius: [2, 2, 0, 0] },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Holding time histogram (`ExecutionDetail.holding_time_histogram`) — Figma 15212:64496. Buckets
// are in seconds; labels are built from their bounds ("<5m", "5-15m", "30m-1h", ">1d") and the
// bar colour marks the band: under 1h gray, 1h–6h green, 6h and longer yellow.
// ---------------------------------------------------------------------------

export type HoldingTimeBar = { label: string; count: number; startSecs: number };

const HOUR = 3600;
const DAY = 86400;

function durationParts(secs: number): [number, string] {
  if (secs >= DAY) return [+(secs / DAY).toFixed(1), "d"];
  if (secs >= HOUR) return [+(secs / HOUR).toFixed(1), "h"];
  if (secs >= 60) return [+(secs / 60).toFixed(1), "m"];
  return [+secs.toFixed(0), "s"];
}

const durationLabel = (secs: number) => durationParts(secs).join("");

/** As Figma writes them: minute ranges share one unit ("5-15m"), others keep both ("1h-2h"). */
function rangeLabel(start: number, end: number) {
  const [a, au] = durationParts(start);
  const [b, bu] = durationParts(end);
  return au === "m" && bu === "m" ? `${a}-${b}m` : `${a}${au}-${b}${bu}`;
}

export function toHoldingTimeBars(buckets: HistogramBucket[]): HoldingTimeBar[] {
  // Only `bucket_start` is relied on (the control plane reads nothing else); a range's end is the
  // next bucket's start.
  const sorted = buckets
    .filter((b) => Number.isFinite(b.bucket_start))
    .sort((a, b) => a.bucket_start - b.bucket_start);
  return sorted.map((b, i) => {
    const next = sorted[i + 1];
    const end = next ? next.bucket_start : b.bucket_end;
    return {
      // The first bucket opens at 0 and the last one also catches the series max, so their honest
      // labels are one-sided.
      label:
        i === 0 && b.bucket_start <= 0 && Number.isFinite(end)
          ? `<${durationLabel(end)}`
          : !next
            ? `>${durationLabel(b.bucket_start)}`
            : rangeLabel(b.bucket_start, end),
      count: b.count,
      startSecs: b.bucket_start,
    };
  });
}

const barGradient = (from: string, to: string) => ({
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

function holdingBandColor(startSecs: number) {
  if (startSecs < HOUR) return barGradient("#f2f7fc", "#ccdff1");
  if (startSecs < 6 * HOUR) return barGradient("#cff8ea", "#67e1c0");
  return barGradient("#fffbd6", "#f1c617");
}

export function buildHoldingTimeOption(bars: HoldingTimeBar[]): EChartsOption {
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const p = (params as { dataIndex: number; value: number }[])[0];
        if (!p) return "";
        return `${bars[p.dataIndex].label}<br/>${p.value} trade${p.value === 1 ? "" : "s"}`;
      },
    },
    grid: { left: 0, right: 0, top: 28, bottom: 0, containLabel: true },
    xAxis: {
      type: "category",
      data: bars.map((b) => b.label),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { fontSize: 12, color: "#9db2ce", margin: 8 },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: "#1d2939" } },
    },
    series: [
      {
        type: "bar",
        name: "Trades",
        barMaxWidth: 32,
        data: bars.map((b) => ({ value: b.count, itemStyle: { color: holdingBandColor(b.startSecs) } })),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: "top", fontSize: 12, color: "#9db2ce", distance: 8 },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Hourly PnL → 24 labelled bars (risk-detail's `hourly_pnl`) — HFT performance-view.tsx (no Regime
// tab) and MFT regime-mft.tsx both draw this "PnL by session hour" chart.
// ---------------------------------------------------------------------------

export type HourlyPnlBar = {
  /** The bucket's own UTC hour, as the API reports it. */
  hour: number;
  /** Minutes past local midnight the band starts at — what the bars are sorted and labelled by. */
  start: number;
  label: string;
  pnl: number;
  pnlSharePct: number | null;
};

const hhmm = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** `420` → "GMT+7", `330` → "GMT+5:30", `0` → "UTC". */
export function gmtLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "UTC";
  const abs = Math.abs(offsetMinutes);
  const mins = abs % 60;
  return `GMT${offsetMinutes < 0 ? "-" : "+"}${Math.floor(abs / 60)}${mins ? `:${String(mins).padStart(2, "0")}` : ""}`;
}

/**
 * Always 24 entries — missing hours (a run with fewer buckets) read as `0`. `offsetMinutes` is the
 * viewer's offset east of UTC (GMT+7 → 420), so the bands read on the local clock; a zone that is
 * not a whole hour off lands them mid-hour (`07:30`) rather than distorting the buckets.
 */
export function toHourlyPnlBars(buckets: HourlyPnlBucket[], offsetMinutes = 0): HourlyPnlBar[] {
  const byHour = new Map(buckets.map((b) => [b.hour, b]));
  return Array.from({ length: 24 }, (_, hour) => {
    const b = byHour.get(hour);
    const start = ((((hour * 60 + offsetMinutes) % 1440) + 1440) % 1440);
    return {
      hour,
      start,
      label: hhmm(start),
      pnl: b?.pnl ?? 0,
      pnlSharePct: b?.pnl_share_pct ?? null,
    };
  }).sort((a, b) => a.start - b.start);
}

/** Green ≥0 / red <0 bars; the tooltip states the hour band in the zone the bars are drawn in. */
export function buildHourlyPnlOption(
  bars: HourlyPnlBar[],
  moneyFmt: (n: number) => string,
  tz = "UTC",
): EChartsOption {
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number; value: number }[];
        const p = arr[0];
        if (!p) return "";
        const b = bars[p.dataIndex];
        const share = b.pnlSharePct == null ? "" : ` (${formatAmount(b.pnlSharePct * 100, 1)}%)`;
        return `${b.label}–${hhmm(b.start + 60)} ${tz}<br/>${moneyFmt(b.pnl)}${share}`;
      },
    },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: bars.map((b) => b.label),
      axisTick: { show: false },
      axisLabel: { fontSize: 10, interval: 1 },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: (v: string | number) => formatCompact(Number(v)) } },
    series: [
      {
        type: "bar",
        barWidth: "70%",
        data: bars.map((b) => ({
          value: b.pnl,
          itemStyle: {
            color: b.pnl >= 0 ? "#67e1c1" : "#ff135b",
            borderRadius: b.pnl >= 0 ? [2, 2, 0, 0] : [0, 0, 2, 2],
          },
        })),
      },
    ],
  };
}

/** The `n` hours with the largest PnL share — Regime's "Top-3 Hours" metric. */
export function topHoursByShare(
  buckets: HourlyPnlBucket[],
  n = 3,
): { hours: number[]; totalSharePct: number | null } {
  const ranked = buckets
    .filter((b) => b.pnl_share_pct != null)
    .sort((a, b) => (b.pnl_share_pct as number) - (a.pnl_share_pct as number) || a.hour - b.hour)
    .slice(0, n);
  if (ranked.length === 0) return { hours: [], totalSharePct: null };
  return {
    hours: ranked.map((b) => b.hour),
    totalSharePct: ranked.reduce((s, b) => s + (b.pnl_share_pct as number), 0),
  };
}

// ---------------------------------------------------------------------------
// Drawdown episodes → table rows (risk-detail's `drawdown_episodes`) — HFT risk-view.tsx's "Top
// drawdowns" table, styled after MFT risk-mft.tsx's "Top 5 drawdown".
// ---------------------------------------------------------------------------

export type DrawdownRow = {
  peakTs: number;
  troughTs: number;
  recoveryTs: number | null;
  /** Always ≤ 0 — the size of the drop, regardless of the sign the API sent. */
  depth: number;
  /** Always ≤ 0 (fraction of starting capital), or `null` when no capital is known. */
  depthPct: number | null;
  lengthDays: number;
  recoveryDays: number | null;
};

/** Normalizes sign (a drop is always shown negative) — same convention `toDrawdown` uses. */
export function toDrawdownRows(episodes: DrawdownEpisode[]): DrawdownRow[] {
  return episodes.map((e) => ({
    peakTs: e.peak_ts,
    troughTs: e.trough_ts,
    recoveryTs: e.recovery_ts,
    depth: -Math.abs(e.depth),
    depthPct: e.depth_pct == null ? null : -Math.abs(e.depth_pct),
    lengthDays: e.length_days,
    recoveryDays: e.recovery_days,
  }));
}

// ---------------------------------------------------------------------------
// Cost Breakdown slices (MFT Cost & Edge donut) — commission/tax/slippage when the run recorded
// the post-split `pnl.parquet` schema, else one Total Fee slice plus slippage, matching how the
// deployed reference draws it (run 01a0a047: Commission 34% / Tax 66% / Slippage 0%).
// ---------------------------------------------------------------------------

export type CostSlice = { key: string; value: number; share: number };

export function costBreakdownSlices(
  summary:
    | Pick<RunSummary, "commission_total" | "tax_total" | "slippage_total" | "total_fee">
    | undefined,
): CostSlice[] {
  if (!summary) return [];
  const { commission_total: commission, tax_total: tax, slippage_total: slippage, total_fee: totalFee } = summary;
  const parts =
    commission != null && tax != null
      ? [
          { key: "Commission", value: Math.abs(commission) },
          { key: "Tax", value: Math.abs(tax) },
          { key: "Slippage", value: Math.abs(slippage ?? 0) },
        ]
      : [
          { key: "Total Fee", value: Math.abs(totalFee ?? 0) },
          { key: "Slippage", value: Math.abs(slippage ?? 0) },
        ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return [];
  return parts.filter((p) => p.value > 0).map((p) => ({ ...p, share: p.value / total }));
}
