"use client";
// OWNED BY: Results "Overview" agent — Figma node 14175:48200.
// 6 metric cards w/ sparklines → Equity Curve panel → Trading history table.
//
// Trading history is `GET /api/runs/{id}/trades` via useTradeHistory. Columns match TradeRow:
// Time · Symbol · Side · Price · Qty · Mid · Outcome. Metric cards + equity curve stay mocked.
import { useState } from "react";
import type { EChartsOption } from "echarts";
import { MaximizeSquareMinimalistic } from "@solar-icons/react";

import { cn } from "@/lib/utils";
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
import type { TradeHistoryRow } from "@/lib/mock/paper-runs";
import { resourceErrorMessage } from "@/lib/api-client";

const GREEN = "#67e1c1";
const RED = "#ff135b";
const GOLD = "#f1c617";
const GRAY = "#9db2ce";
const FAINT = "rgba(157,178,206,0.55)";

// Gradient text tokens pulled from the card value nodes (14175:90136 etc.).
const GREEN_TEXT =
  "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const RED_TEXT =
  "bg-[linear-gradient(165deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";
// Sharpe value = "Primary/Linear orange" (node 14175:90218;14175:90136).
const ORANGE_TEXT =
  "bg-[linear-gradient(165deg,#ffe3d6_0%,#ff9783_100%)] bg-clip-text text-transparent";

// ---- deterministic mock data (no Math.random, stable across renders) ----
function walk(seed: number, points: number, base: number, amp: number): number[] {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < points; i++) {
    v += Math.sin(seed + i * 1.1) * amp + Math.sin(seed * 2.3 + i * 2.4) * amp * 0.4;
    out.push(Number(v.toFixed(2)));
  }
  return out;
}

const NET_PNL_SPARK = walk(0.6, 16, 90, 6).map((v, i) => Math.round(v + i * 3.4));
const SHARPE_SPARK = walk(1.4, 16, 40, 4).map((v, i) => Math.round(v + i * 1.6));
const MAX_DD_SPARK = walk(2.1, 16, 90, 6).map((v, i) => Math.round(v - i * 3.1));
const TURNOVER_SPARK = walk(3.0, 16, 50, 3);
const COST_DRAG_BARS = walk(5.5, 14, 40, 16).map((v) => Math.round(Math.abs(v) + 12));
const MAX_CAPACITY_SPARK = walk(4.2, 16, 45, 4).map((v, i) => Math.round(v + i * 2.2));

// Equity curve: monthly drift regimes (Jan–Jul 2025) + weekly noise → a realistic-looking
// up-and-down curve. Drawdown is derived from Net Equity's running peak, so it's always
// consistent with the equity line (0% at new highs, negative at pullbacks).
const MONTHS = ["Jan 2025", "Feb 2025", "Mar 2025", "Apr 2025", "May 2025", "Jun 2025", "Jul 2025"];
const WEEKS_PER_MONTH = 4;
const MONTH_DRIFT = [2500, -5600, 10000, -2800, 13000, 14500, 14000];

const NET_EQUITY: number[] = [1_000_000];
for (let i = 1; i < MONTHS.length * WEEKS_PER_MONTH; i++) {
  const drift = MONTH_DRIFT[Math.floor(i / WEEKS_PER_MONTH)];
  const noise = Math.sin(i * 1.3) * 2800 + Math.sin(i * 2.7 + 1) * 1600;
  NET_EQUITY.push(Math.round(NET_EQUITY[i - 1] + drift + noise));
}
const GROSS_EQUITY = NET_EQUITY.map((v, i) => Math.round(v + 18000 + Math.sin(i * 0.5) * 4200));
const DRAWDOWN = (() => {
  let peak = NET_EQUITY[0];
  return NET_EQUITY.map((v) => {
    peak = Math.max(peak, v);
    return Number((((v - peak) / peak) * 100).toFixed(2));
  });
})();
const EQUITY_LABELS = NET_EQUITY.map((_, i) => (i % WEEKS_PER_MONTH === 0 ? MONTHS[i / WEEKS_PER_MONTH] : ""));

function formatCompactUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)}K`;
  return `${n}`;
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
  sparkData: number[];
}

const METRICS: Metric[] = [
  {
    label: "Net PnL",
    value: "+142,350",
    unit: "USDT",
    valueClassName: GREEN_TEXT,
    sub: "+25.4%",
    sparkKind: "area",
    sparkColor: GREEN,
    sparkData: NET_PNL_SPARK,
  },
  {
    label: "Sharpe Ratio",
    value: "3.12",
    valueClassName: ORANGE_TEXT,
    sub: "Daily",
    sparkKind: "line",
    sparkColor: GREEN,
    sparkData: SHARPE_SPARK,
  },
  {
    label: "Max Drawdown",
    value: "-4.10%",
    valueClassName: RED_TEXT,
    sub: "-41,230 USDT",
    sparkKind: "line",
    sparkColor: RED,
    sparkData: MAX_DD_SPARK,
  },
  {
    label: "Return / Turnover",
    value: "0.83",
    unit: "bp",
    sub: "per $ traded",
    sparkKind: "line",
    sparkColor: FAINT,
    sparkData: TURNOVER_SPARK,
  },
  {
    label: "Cost Drag",
    value: "31.02%",
    sub: "60,125 USDT",
    sparkKind: "bar",
    sparkColor: GOLD,
    sparkData: COST_DRAG_BARS,
  },
  {
    label: "Max Capacity",
    value: "12.5M",
    unit: "USDT",
    valueClassName: GREEN_TEXT,
    sub: "8.1% Utilized",
    sparkKind: "line",
    sparkColor: GREEN,
    sparkData: MAX_CAPACITY_SPARK,
  },
];

// ---- equity curve stats strip (metrics 14175:90755) ----
// Value colors per node: green gradient (Total/Ann. Return, Profit Days, Fill Rate),
// SOLID red #ff135b (Max Drawdown, node 14175:90783), white (the rest).
const STATS: { label: string; value: string; className?: string }[] = [
  { label: "Total Return", value: "14.24%", className: GREEN_TEXT },
  { label: "Ann. Return", value: "34.18%", className: GREEN_TEXT },
  { label: "Max Drawdown", value: "-12.5%", className: "text-[#ff135b]" },
  { label: "MDD Duration", value: "2d 18h" },
  { label: "Profit Days", value: "72%", className: GREEN_TEXT },
  { label: "Trading Days", value: "151" },
  { label: "Total Trades", value: "1,246,532" },
  { label: "Avg Latency", value: "1.82 ms" },
  { label: "Fill Rate", value: "96.42%", className: GREEN_TEXT },
];

const RANGES = ["All", "1M", "3M", "1W"] as const;

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

function equityChartOption(): EChartsOption {
  return {
    tooltip: { trigger: "axis" },
    legend: {
      bottom: 0,
      data: ["Net Equity", "Gross Equity", "Drawdown"],
      textStyle: { color: GRAY, fontSize: 12 },
      itemWidth: 16,
      itemHeight: 2,
    },
    grid: { left: 8, right: 8, top: 16, bottom: 56, containLabel: true },
    xAxis: { type: "category", data: EQUITY_LABELS, boundaryGap: false },
    yAxis: [
      {
        type: "value",
        min: 918_000,
        max: 1_250_000,
        splitNumber: 4,
        axisLabel: { formatter: (v: number) => formatCompactUsd(v) },
      },
      {
        type: "value",
        min: -8,
        max: 0,
        position: "right",
        splitLine: { show: false },
        axisLabel: { formatter: (v: number) => `${v}%` },
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
        data: DRAWDOWN,
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
      {
        name: "Gross Equity",
        type: "line",
        data: GROSS_EQUITY,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: GRAY, type: "dashed" },
        itemStyle: { color: GRAY },
        z: 2,
      },
      {
        name: "Net Equity",
        type: "line",
        data: NET_EQUITY,
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
  const [range, setRange] = useState<string>("All");
  const { data: trades = [], isLoading, isError, error } = useTradeHistory(runId);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {METRICS.map((m) => (
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
              {m.sparkKind === "area" && <AreaMini data={m.sparkData} />}
              {m.sparkKind === "bar" && <BarMini data={m.sparkData} color={m.sparkColor} />}
              {m.sparkKind === "line" && <LineMini data={m.sparkData} color={m.sparkColor} />}
            </div>
          </div>
        ))}
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[#151a24] px-4 py-3">
          <span className="text-sm font-medium text-white">Equity Curve</span>
          <div className="flex shrink-0 items-center gap-2">
            <Tabs value={range} onValueChange={(v) => v && setRange(v)}>
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
            {STATS.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-1 basis-[72px] flex-col gap-1">
                <span className="whitespace-nowrap text-[10px] text-muted-foreground">{s.label}</span>
                <span className={cn("whitespace-nowrap text-sm", s.className ?? "text-white")}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
          <BaseChart option={equityChartOption()} style={{ height: 300 }} />
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-[#0f0f0f]">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-[#151a24] px-4 py-3">
          <span className="text-sm font-medium text-white">Trading history</span>
          <ExpandButton label="Expand trading history" />
        </div>
        <div className="bg-[#0a0e14]">
          {!runId ? (
            <p className="p-4 text-sm text-muted-foreground">Pick a run to load trades.</p>
          ) : isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
          ) : isError ? (
            <p className="p-4 text-sm text-destructive">{resourceErrorMessage(error, "this run's trades")}</p>
          ) : trades.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No trades yet.</p>
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
