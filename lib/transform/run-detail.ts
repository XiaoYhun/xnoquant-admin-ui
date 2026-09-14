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
// Hourly PnL → 24 labelled bars (risk-detail's `hourly_pnl`) — HFT performance-view.tsx (no Regime
// tab) and MFT regime-mft.tsx both draw this "PnL by session hour" chart.
// ---------------------------------------------------------------------------

export type HourlyPnlBar = { hour: number; label: string; pnl: number; pnlSharePct: number | null };

/** Always 24 entries, hour-ascending — missing hours (a run with fewer buckets) read as `0`. */
export function toHourlyPnlBars(buckets: HourlyPnlBucket[]): HourlyPnlBar[] {
  const byHour = new Map(buckets.map((b) => [b.hour, b]));
  return Array.from({ length: 24 }, (_, hour) => {
    const b = byHour.get(hour);
    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      pnl: b?.pnl ?? 0,
      pnlSharePct: b?.pnl_share_pct ?? null,
    };
  });
}

/** Green ≥0 / red <0 bars; the tooltip states the hour band in UTC. */
export function buildHourlyPnlOption(bars: HourlyPnlBar[], moneyFmt: (n: number) => string): EChartsOption {
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number; value: number }[];
        const p = arr[0];
        if (!p) return "";
        const b = bars[p.dataIndex];
        const next = String((b.hour + 1) % 24).padStart(2, "0");
        const share = b.pnlSharePct == null ? "" : ` (${formatAmount(b.pnlSharePct * 100, 1)}%)`;
        return `${b.label}–${next}:00 UTC<br/>${moneyFmt(b.pnl)}${share}`;
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
