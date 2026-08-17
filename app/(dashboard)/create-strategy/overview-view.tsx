"use client";
// OWNED BY: Results "Overview" agent — Figma node 14175:48200.
// 6 metric cards w/ sparklines → Equity Curve panel → Trading history table.
//
// Data — the same endpoints the hft-platform reference UI drives its results page from:
//   `GET /api/runs/{id}/summary`      → RunSummary, the metric cards + stats strip
//   `GET /api/runs/{id}/equity-curve` → EquityPoint[], the Net line (and drawdown, derived)
//   `GET /api/runs/{id}/cost-curve`   → CostPoint[], cumulative fees → the Gross line
//   `GET /api/runs/{id}/trades`       → TradePage, the trading-history table (via useTradeHistory)
//
// `equity` is *cumulative realized PnL*, not account equity, so this panel plots PnL from 0 —
// there is no account-balance series on the API. Gross = Net + cumulative fees, matching the
// backend's own `edge_gross_bps = (net_pnl + total_fee) / notional` definition.
//
// Metrics with no backend source (Max Capacity, MDD Duration, Avg Latency, Fill Rate) render as
// "—" rather than carrying the old placeholder numbers.
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { MaximizeSquareMinimalistic } from "@solar-icons/react";

import { cn, formatAmount, formatSignedAmount } from "@/lib/utils";
import { BaseChart } from "@/components/charts/base-chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTradeHistory } from "@/hooks/api/use-paper-runs";
import { useRunCostCurve, useRunEquity, useRunSummary } from "@/hooks/api/use-runs";
import {
  mergeLiveSummary,
  mergeLiveTrades,
  preferLiveEquity,
  useLiveSnapshot,
} from "@/hooks/api/use-run-live-snapshot";
import type { CostPoint } from "@/lib/cost-curve";
import {
  annualizedReturn,
  costDragPct,
  curveSpanMs,
  equityDayLabel,
  equityStats,
  toDrawdown,
  toRollingSharpe,
} from "@/lib/transform/results";
import type { TradeHistoryRow } from "@/lib/mock/paper-runs";
import { downloadTradeHistoryCsv } from "@/lib/trade-history-csv";
import { TradeHistoryExportButton } from "@/components/trade-history-export-button";
import type { EquityPoint, RunSummary } from "@/types/domain";
import { resourceErrorMessage } from "@/lib/api-client";
import { MockNote } from "./results-chart-card";

const GREEN = "#67e1c1";
const RED = "#ff135b";
const GOLD = "#f1c617";
const GRAY = "#9db2ce";

// Gradient text tokens pulled from the card value nodes (14175:90136 etc.).
const GREEN_TEXT =
  "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const RED_TEXT =
  "bg-[linear-gradient(165deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";
// Sharpe value = "Primary/Linear orange" (node 14175:90218;14175:90136).
const ORANGE_TEXT =
  "bg-[linear-gradient(165deg,#ffe3d6_0%,#ff9783_100%)] bg-clip-text text-transparent";

const DASH = "—";

const SPARK_POINTS = 16;

function fmtSigned(v: number, digits = 2): string {
  return formatSignedAmount(v, digits);
}

function fmtPct(v: number, digits = 2): string {
  return `${v > 0 ? "+" : ""}${formatAmount(v, digits)}%`;
}

function formatCompactUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)}K`;
  return `${n}`;
}

/** Even-stride downsample so a 10k-point curve still fits a 16-point card sparkline. */
function sample(values: number[], n = SPARK_POINTS): number[] {
  if (values.length <= n) return values;
  const step = (values.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => values[Math.round(i * step)]);
}

// ---- metric cards ----
type SparkKind = "area" | "line" | "bar";
interface Metric {
  label: string;
  value: string;
  unit?: string;
  valueClassName?: string;
  sub: string;
  sparkKind: SparkKind;
  sparkColor: string;
  /** Omitted when the API exposes no series for this metric — the card renders without a chart. */
  sparkData?: number[];
}

function buildMetrics(
  summary: RunSummary | undefined,
  equity: EquityPoint[],
  cost: CostPoint[],
): Metric[] {
  const netPnl = summary?.net_pnl;
  const ddPct = summary?.max_drawdown_pct;
  const mdd = summary?.max_drawdown;
  const costDrag = costDragPct(summary);

  return [
    {
      label: "Net PnL",
      value: netPnl == null ? DASH : fmtSigned(netPnl),
      unit: netPnl == null ? undefined : "USDT",
      valueClassName: netPnl == null ? undefined : netPnl >= 0 ? GREEN_TEXT : RED_TEXT,
      sub: summary?.return_pct == null ? "Cumulative realized" : fmtPct(summary.return_pct * 100),
      sparkKind: "area",
      sparkColor: GREEN,
      sparkData: sample(equity.map((p) => Number(p.equity))),
    },
    {
      label: "Sharpe Ratio",
      value: summary?.sharpe == null ? DASH : formatAmount(summary.sharpe, 2),
      valueClassName: ORANGE_TEXT,
      // Headline is the API's plain `sharpe` (per closing trade), with the annualized figure
      // beneath — the same pairing the HFT control plane's run page shows. Annualizing scales by
      // sqrt(trades per year) off the run's own fill rate, so an HFT run that fills hundreds of
      // times a second annualizes to five or six digits; on its own it reads as a broken number.
      sub: summary?.sharpe_annualized == null ? "Per closing trade" : `Ann. ${formatAmount(summary.sharpe_annualized, 2)}`,
      sparkKind: "line",
      sparkColor: GREEN,
      sparkData: sample(toRollingSharpe(equity).map((p) => p.value)),
    },
    {
      label: "Max Drawdown",
      value:
        ddPct != null
          ? fmtPct(-Math.abs(ddPct) * 100)
          : mdd != null
            ? fmtSigned(-Math.abs(mdd))
            : DASH,
      unit: ddPct == null && mdd != null ? "USDT" : undefined,
      valueClassName: RED_TEXT,
      sub: mdd == null ? DASH : `${fmtSigned(-Math.abs(mdd))} USDT`,
      sparkKind: "line",
      sparkColor: RED,
      sparkData: sample(toDrawdown(equity).map((p) => p.pct)),
    },
    {
      label: "Return / Turnover",
      // REST-only: absent while the summary is coming off the live frame.
      value: summary?.edge_net_bps == null ? DASH : formatAmount(summary.edge_net_bps, 2),
      unit: summary?.edge_net_bps == null ? undefined : "bp",
      sub: "per $ traded",
      sparkKind: "line",
      sparkColor: GRAY,
      // No per-interval edge series on the API — only the run-level bps figure above.
    },
    {
      label: "Cost Drag",
      value: costDrag == null ? DASH : `${formatAmount(costDrag, 2)}%`,
      sub:
        summary?.total_fee == null
          ? DASH
          : `${formatAmount(summary.total_fee)} USDT`,
      sparkKind: "bar",
      sparkColor: GOLD,
      sparkData: sample(cost.map((p) => Number(p.cumulative))),
    },
    {
      // No capacity model on the API (GAP — see docs/plans/api-integration.md).
      label: "Max Capacity",
      value: DASH,
      sub: "No API source",
      sparkKind: "line",
      sparkColor: GREEN,
    },
  ];
}

// ---- equity curve stats strip (metrics 14175:90755) ----
// Value colors per node: green gradient (Total/Ann. Return, Profit Days, Fill Rate),
// SOLID red #ff135b (Max Drawdown, node 14175:90783), white (the rest).
function buildStats(
  summary: RunSummary | undefined,
  equity: EquityPoint[],
): { label: string; value: string; className?: string }[] {
  const stats = equityStats(equity);
  const annReturn = annualizedReturn(summary?.return_pct, curveSpanMs(equity));
  return [
    {
      label: "Total Return",
      value: summary?.return_pct == null ? DASH : fmtPct(summary.return_pct * 100),
      className: GREEN_TEXT,
    },
    { label: "Ann. Return", value: annReturn == null ? DASH : fmtPct(annReturn * 100), className: GREEN_TEXT },
    {
      label: "Max Drawdown",
      value: summary?.max_drawdown_pct == null ? DASH : fmtPct(-Math.abs(summary.max_drawdown_pct) * 100),
      className: "text-[#ff135b]",
    },
    // Derivable from the drawdown series, but not wired — no consumer asked for it yet.
    { label: "MDD Duration", value: DASH },
    {
      label: "Profit Days",
      value: stats ? `${formatAmount(stats.profitDayPct, 0)}%` : DASH,
      className: GREEN_TEXT,
    },
    { label: "Trading Days", value: stats ? String(stats.tradingDays) : DASH },
    {
      label: "Total Trades",
      value: summary?.total_trades == null ? DASH : summary.total_trades.toLocaleString("en-US"),
    },
    // Latency lives on the trace/execution artifacts, not the results endpoints.
    { label: "Avg Latency", value: DASH },
    {
      label: "Fill Rate",
      value: summary?.fill_rate == null ? DASH : `${formatAmount(summary.fill_rate * 100, 1)}%`,
      className: GREEN_TEXT,
    },
  ];
}

const RANGES = ["All", "1M", "3M", "1W"] as const;
type Range = (typeof RANGES)[number];
const RANGE_MS: Record<Exclude<Range, "All">, number> = {
  "1W": 7 * 86_400_000,
  "1M": 30 * 86_400_000,
  "3M": 90 * 86_400_000,
};

/**
 * Trailing window measured from the curve's own last point, not wall-clock — a backtest over 2023
 * data would show nothing under "1W" if the cutoff were `Date.now()`.
 */
function inRange(points: EquityPoint[], range: Range): EquityPoint[] {
  if (range === "All" || points.length === 0) return points;
  const end = Number(points[points.length - 1].ts);
  if (!Number.isFinite(end)) return points;
  const cutoff = end - RANGE_MS[range];
  return points.filter((p) => Number(p.ts) >= cutoff);
}

const nf = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function splitFillTime(iso: string): { date: string; time: string } {
  const [date, rest] = iso.split("T");
  const time = rest?.replace("Z", "").slice(0, 12) ?? "";
  return { date: date ?? iso, time };
}

function TradeHistoryTableRow({ t }: { t: TradeHistoryRow }) {
  const buy = /buy|long/i.test(t.side);
  const { date, time } = splitFillTime(t.time);

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col text-white">
          <span>{date}</span>
          <span>{time}</span>
        </div>
      </TableCell>
      <TableCell className="text-white">{t.symbol}</TableCell>
      <TableCell>
        <span className={cn("font-semibold", buy ? GREEN_TEXT : RED_TEXT)}>{t.side}</span>
      </TableCell>
      <TableCell className="text-right text-white">{nf(t.price)}</TableCell>
      <TableCell className="text-right text-white">{nf(t.qty)}</TableCell>
      <TableCell className="text-right text-white">{nf(t.mid)}</TableCell>
      <TableCell className="text-white">{t.outcome}</TableCell>
    </TableRow>
  );
}

// ---- mini card charts: flat static line/area/bars with NO end-dot. The card sparklines
// in Figma (node 14175:90204 chart) are plain SVG lines/areas — the shared `Sparkline`'s
// pulsing effectScatter dot is wrong here, so these are built directly on BaseChart. ----
// `containLabel: false` is required: the shared BaseChart theme sets `containLabel: true`, which
// merges in and reserves ~28px on the left/bottom for the (hidden) axis labels — squeezing the
// sparkline into a corner of the card. Pin it off so the line fills the whole box.
const MINI_GRID = { left: 2, right: 2, top: 4, bottom: 4, containLabel: false } as const;

function LineMini({ data, color }: { data: number[]; color: string }) {
  const option: EChartsOption = {
    xAxis: { show: false, type: "category", boundaryGap: false },
    yAxis: { show: false, type: "value", min: "dataMin", max: "dataMax" },
    grid: MINI_GRID,
    series: [{ type: "line", data, smooth: false, showSymbol: false, lineStyle: { width: 1.5, color } }],
  };
  return <BaseChart option={option} style={{ height: 42 }} />;
}

function AreaMini({ data }: { data: number[] }) {
  const option: EChartsOption = {
    xAxis: { show: false, type: "category", boundaryGap: false },
    yAxis: { show: false, type: "value", min: "dataMin", max: "dataMax" },
    grid: MINI_GRID,
    series: [
      {
        type: "line",
        data,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1.5, color: GREEN },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(103,225,193,0.35)" },
              { offset: 1, color: "rgba(103,225,193,0)" },
            ],
          },
        },
      },
    ],
  };
  return <BaseChart option={option} style={{ height: 42 }} />;
}

function BarMini({ data, color }: { data: number[]; color: string }) {
  const option: EChartsOption = {
    xAxis: { show: false, type: "category" },
    yAxis: { show: false, type: "value", min: "dataMin", max: "dataMax" },
    grid: MINI_GRID,
    series: [{ type: "bar", data, itemStyle: { color, borderRadius: [1, 1, 0, 0] }, barWidth: "50%" }],
  };
  return <BaseChart option={option} style={{ height: 42 }} />;
}

function ExpandButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-white"
    >
      <MaximizeSquareMinimalistic className="size-5" />
    </button>
  );
}

/**
 * Step-join the cumulative-fee series onto the equity timestamps: for each equity point take the
 * most recent cost point at or before it. The two curves come from the same parquet but are
 * downsampled independently, so they don't share an index.
 */
function grossSeries(equity: EquityPoint[], cost: CostPoint[]): number[] | null {
  if (cost.length === 0) return null;
  const sorted = [...cost].sort((a, b) => Number(a.ts) - Number(b.ts));
  let i = 0;
  let cumulative = 0;
  return equity.map((p) => {
    const ts = Number(p.ts);
    while (i < sorted.length && Number(sorted[i].ts) <= ts) {
      cumulative = Number(sorted[i].cumulative);
      i += 1;
    }
    return Number(p.equity) + cumulative;
  });
}

function equityChartOption(points: EquityPoint[], gross: number[] | null): EChartsOption {
  const labels = points.map((p) => equityDayLabel(Number(p.ts)));
  const net = points.map((p) => Number(p.equity));
  const drawdown = toDrawdown(points).map((p) => p.pct);

  return {
    tooltip: { trigger: "axis" },
    legend: {
      bottom: 0,
      data: gross ? ["Net PnL", "Gross PnL", "Drawdown"] : ["Net PnL", "Drawdown"],
      textStyle: { color: GRAY, fontSize: 12 },
      itemWidth: 16,
      itemHeight: 2,
    },
    grid: { left: 8, right: 8, top: 16, bottom: 56, containLabel: true },
    xAxis: { type: "category", data: labels, boundaryGap: false },
    yAxis: [
      {
        type: "value",
        // Auto-scaled — the curve is cumulative PnL from 0, so its range is run-specific.
        scale: true,
        splitNumber: 4,
        axisLabel: { formatter: (v: number) => formatCompactUsd(v) },
      },
      {
        type: "value",
        max: 0,
        position: "right",
        splitLine: { show: false },
        axisLabel: { formatter: (v: number) => `${formatAmount(v, 0)}%` },
      },
    ],
    series: [
      {
        // Subtle secondary series: thin pink line + faint underwater wash on the RIGHT
        // % axis. `origin: 0` fills only between the 0% line (top) and the drawdown curve,
        // so it never washes over the chart — the equity lines stay the hero.
        name: "Drawdown",
        type: "line",
        yAxisIndex: 1,
        data: drawdown,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, color: RED, opacity: 0.55 },
        itemStyle: { color: RED },
        areaStyle: {
          origin: 0,
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(255,19,91,0.07)" },
              { offset: 1, color: "rgba(255,19,91,0)" },
            ],
          },
        },
        z: 1,
      },
      ...(gross
        ? [
            {
              name: "Gross PnL",
              type: "line" as const,
              data: gross,
              smooth: true,
              showSymbol: false,
              lineStyle: { width: 1.5, color: GRAY, type: "dashed" as const },
              itemStyle: { color: GRAY },
              z: 2,
            },
          ]
        : []),
      {
        name: "Net PnL",
        type: "line",
        data: net,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: GREEN },
        itemStyle: { color: GREEN },
        z: 3,
      },
    ],
  };
}

export function OverviewView({ runId }: { runId?: string }) {
  const [range, setRange] = useState<Range>("All");
  const { data: restTrades = [], isLoading, isError, error } = useTradeHistory(runId);

  const { data: restSummary, isLoading: summaryLoading, isError: summaryError } = useRunSummary(runId);
  const { data: restEquity = [], isLoading: equityLoading, isError: equityError } = useRunEquity(runId);
  // Fees are optional: the spec notes many runs answer `[]` here even when equity has points.
  const { data: cost = [] } = useRunCostCurve(runId);

  // While the run is streaming, the live frame wins over the persisted artifacts — which 500 for
  // the whole life of a running run, so for those the frame is the only source there is.
  const { snapshot } = useLiveSnapshot();
  const summary = useMemo(() => mergeLiveSummary(restSummary, snapshot), [restSummary, snapshot]);
  const equity = useMemo(() => preferLiveEquity(restEquity, snapshot), [restEquity, snapshot]);
  const trades = useMemo(() => mergeLiveTrades(restTrades, snapshot), [restTrades, snapshot]);

  const metrics = useMemo(() => buildMetrics(summary, equity, cost), [summary, equity, cost]);
  const stats = useMemo(() => buildStats(summary, equity), [summary, equity]);

  const windowed = useMemo(() => inRange(equity, range), [equity, range]);
  const gross = useMemo(() => grossSeries(windowed, cost), [windowed, cost]);
  const chartOption = useMemo(() => equityChartOption(windowed, gross), [windowed, gross]);

  // Order matters: a running run's REST curve/summary error out by design, so a live series or a
  // live summary has to win over the REST error rather than be labelled "unavailable" beneath it.
  const curveNote = !runId
    ? "Pick a run"
    : equity.length === 0
      ? summaryLoading || equityLoading
        ? "Loading…"
        : equityError
          ? "Equity unavailable"
          : "No equity points"
      : windowed.length === 0
        ? "No points in range"
        : summaryError && !summary
          ? "Summary unavailable"
          : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex min-w-0 flex-1 basis-[120px] flex-col gap-1 rounded-[12px] border border-border bg-[rgba(29,33,38,0.2)] p-2"
          >
            <span className="truncate text-xs text-muted-foreground">{m.label}</span>
            <div className="flex items-end gap-1">
              <span className={cn("text-base font-semibold whitespace-nowrap", m.valueClassName ?? "text-white")}>
                {m.value}
              </span>
              {m.unit && <span className="text-[10px] text-muted-foreground">{m.unit}</span>}
            </div>
            <span className="truncate text-[10px] text-muted-foreground">{m.sub}</span>
            <div className="h-[42px] w-full overflow-hidden">
              {m.sparkData && m.sparkData.length > 0 && (
                <>
                  {m.sparkKind === "area" && <AreaMini data={m.sparkData} />}
                  {m.sparkKind === "bar" && <BarMini data={m.sparkData} color={m.sparkColor} />}
                  {m.sparkKind === "line" && <LineMini data={m.sparkData} color={m.sparkColor} />}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[#151a24] px-4 py-3">
          <span className="text-sm font-medium text-white">Equity Curve</span>
          <div className="flex shrink-0 items-center gap-2">
            {curveNote && <MockNote>{curveNote}</MockNote>}
            <Tabs value={range} onValueChange={(v) => v && setRange(v as Range)}>
              <TabsList>
                {RANGES.map((r) => (
                  <TabsTrigger key={r} value={r}>
                    {r}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <ExpandButton label="Expand equity curve" />
          </div>
        </div>
        <div className="min-w-0 p-4">
          <div className="flex flex-wrap gap-3 pb-4">
            {stats.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-1 basis-[72px] flex-col gap-1">
                <span className="whitespace-nowrap text-[10px] text-muted-foreground">{s.label}</span>
                <span
                  className={cn(
                    "whitespace-nowrap text-sm",
                    s.value === DASH ? "text-muted-foreground" : (s.className ?? "text-white"),
                  )}
                >
                  {s.value}
                </span>
              </div>
            ))}
          </div>
          <BaseChart option={chartOption} style={{ height: 300 }} />
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-[#0f0f0f]">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-[#151a24] px-4 py-3">
          <span className="text-sm font-medium text-white">Trading history</span>
          <TradeHistoryExportButton
            disabled={!runId || isLoading || trades.length === 0}
            onClick={() => downloadTradeHistoryCsv(`trading-history-${runId}.csv`, trades)}
          />
        </div>
        {/*
          `overflow-anchor:none`: the live stream keeps a newest-first, fixed-size window, so each
          frame pushes whichever row the browser anchored to further down the list. Scroll
          anchoring then chases that row and drags the results panel’s scroll offset to the bottom
          while you are reading. Excluding this subtree from anchor selection leaves the offset put.
        */}
        <div className="bg-[#0a0e14] [overflow-anchor:none]">
          {/*
            Rows first: while the run is live the persisted `/trades` page 500s, and the fills are
            coming off the stream instead — so a REST error only matters when there is nothing
            to show.
          */}
          {!runId ? (
            <p className="p-4 text-sm text-muted-foreground">Pick a run to load trades.</p>
          ) : trades.length === 0 ? (
            isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
            ) : isError ? (
              <p className="p-4 text-sm text-destructive">{resourceErrorMessage(error, "this run's trades")}</p>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">No trades yet.</p>
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Mid</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((t) => (
                  <TradeHistoryTableRow key={t.id} t={t} />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
