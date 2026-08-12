"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { format, isValid, parseISO } from "date-fns";
import { AltArrowDown, Maximize, MenuDots, Pause, Plain, Rocket } from "@solar-icons/react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BaseChart } from "@/components/charts/base-chart";
import { ReorderDotsVerticalIcon } from "@/components/icons/reorder-dots-vertical";
import { CloseIcon } from "@/components/icons/close";
import { cn } from "@/lib/utils";
import { canMutate } from "@/lib/rbac";
import { useTradeHistory } from "@/hooks/api/use-paper-runs";
import { useRunSummary, useRunEquity, useStopRun } from "@/hooks/api/use-runs";
import { ApiError, resourceErrorMessage } from "@/lib/api-client";
import { USE_MOCK } from "@/lib/constant";
import { toRunDetail, type RunDetail } from "@/lib/transform/runs";
import { toDailyPnl, toWeekdayPnl, type DayPoint } from "@/lib/transform/results";
import type { PaperRunRow, TradeHistoryRow } from "@/lib/mock/paper-runs";
import type { EquityPoint, RunSummary } from "@/types/domain";
import { RUN_STATUS_META } from "@/components/run-status-pill";
import { downloadTradeHistoryCsv } from "@/lib/trade-history-csv";
import { TradeHistoryExportButton } from "@/components/trade-history-export-button";
import { PromoteToLiveDialog } from "./promote-to-live-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useConsoleLog } from "@/store/console-log-store";
import { marketOf } from "@/components/market-tabs";
import { CodeEditor } from "../create-strategy/code-editor";
import { TradeCycles } from "./trade-cycles";
import { useRunOpenPositions } from "@/hooks/api/use-run-live";
import {
  LiveSnapshotProvider,
  mergeLiveSummary,
  mergeLiveTrades,
  preferLiveEquity,
  useLiveSnapshot,
} from "@/hooks/api/use-run-live-snapshot";

// Paper Trading run detail — a right-side slide-in with Charts / Trades / Configuration / Code
// tabs. Figma nodes 13982:131691 (Charts), 13982:133350 (Trades), 14585:34189 (Configuration).
// Header + slide-in shell mirror strategy-detail-panel.tsx / live-run-detail-panel.tsx.
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";
const GRAD_TAB_BG = "bg-[linear-gradient(163deg,#cff8ea_0%,#67e1c1_100%)]";

const TABS = ["Charts", "Trades", "Trade cycles", "Configuration", "Code"] as const;
type Tab = (typeof TABS)[number];
// Backtests never journal a trace, so they don't get the Trade cycles tab at all.
const tabsFor = (mode?: string): readonly Tab[] => (mode === "backtest" ? TABS.filter((t) => t !== "Trade cycles") : TABS);

// useTradeHistory fetches the first page (this size) in one shot and drops TradePage.total, so a
// full page is our only "there may be more" signal — a partial page means nothing more to load.
const TRADES_PAGE_SIZE = 100;

// ── Charts tab ──────────────────────────────────────────────────────────────
// KPI grid cell — label/value/extra layout shell shared by both Charts tabs' KPI blocks; every
// visual variation (size, tone, unit) is supplied by the caller.
function KpiCell({
  label,
  size,
  value,
  valueClassName,
  extra,
  extraClassName,
  title,
}: {
  label: string;
  size: "sm" | "base";
  value: string;
  valueClassName: string;
  extra?: string;
  extraClassName?: string;
  title?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs leading-[18px] text-[#9db2ce]">{label}</span>
      <div className="flex min-w-0 items-end gap-1" title={title}>
        <span
          className={cn(
            size === "sm" ? "text-sm" : "text-base",
            "min-w-0 truncate leading-5 font-semibold",
            valueClassName,
          )}
        >
          {value}
        </span>
        {extra && <span className={cn("shrink-0", extraClassName)}>{extra}</span>}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-white">{title}</span>
        <Maximize weight="Outline" className="size-4 text-muted-foreground" />
      </div>
      <div className="px-2 pb-2">{children}</div>
    </div>
  );
}

function PnlChart({ series, height = 240 }: { series: PaperRunRow["pnlChartSeries"]; height?: number }) {
  const option: EChartsOption = {
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: series.map((p) => p.date), boundaryGap: false },
    yAxis: { type: "value" },
    visualMap: {
      show: false,
      dimension: 1,
      seriesIndex: 0,
      pieces: [
        { lte: 0, color: "#ff135b" },
        { gt: 0, color: "#67e1c1" },
      ],
    },
    series: [
      {
        type: "line",
        data: series.map((p) => p.value),
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 1.5 },
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
  return <BaseChart option={option} style={{ height }} />;
}

// Two rows of 4 KPIs in one bordered block — Figma 14876:145548. Profit Factor and the win-rate
// wins|losses breakdown have no source in RunSummary (no profit-factor field; total_trades counts
// fills, not closing trades), so those render "—" with an explanatory title — same convention as
// LiveKpiGrid below.
function ResultsKpiGrid({ detail }: { detail: RunDetail }) {
  const m = detail.metrics;
  const netPnlTone = m.netPnl < 0 ? GRAD_RED : GRAD_GREEN;
  const amount = (n: number) => `${Math.abs(n).toLocaleString()} ₫`;

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[#1d2939] bg-[rgba(29,33,38,0.2)] px-3 py-2">
      <div className="grid w-full grid-cols-4 gap-4">
        <KpiCell
          label="Net PnL"
          size="sm"
          value={`${m.netPnl >= 0 ? "+" : "-"}${amount(m.netPnl)}`}
          valueClassName={netPnlTone}
          extra={`(${detail.returnPct >= 0 ? "+" : ""}${detail.returnPct.toFixed(1)}%)`}
          extraClassName={cn("text-xs font-medium", netPnlTone)}
        />
        <KpiCell label="Trades" size="base" value={m.trades.toLocaleString()} valueClassName="text-white" />
        <KpiCell
          label="Win rate"
          size="sm"
          value={`${m.winRate.toFixed(2)}%`}
          valueClassName="text-white"
          extra="—"
          extraClassName="text-xs text-[#9db2ce]"
          title="Wins|losses counts aren't available — total_trades counts fills, not closing trades."
        />
        <KpiCell
          label="Profit Factor"
          size="base"
          value="—"
          valueClassName="text-muted-foreground"
          title="Not available — RunSummary has no profit-factor field."
        />
      </div>
      <div className="h-px w-full bg-[#1d2939]" />
      <div className="grid w-full grid-cols-4 gap-4">
        <KpiCell
          label="Max Drawdown"
          size="sm"
          value={`-${amount(detail.maxDrawdown)}`}
          valueClassName={GRAD_RED}
          extra={`(-${Math.abs(detail.maxDrawdownPct).toFixed(1)}%)`}
          extraClassName={cn("text-xs font-medium", GRAD_RED)}
        />
        <KpiCell label="Sharpe Ratio" size="base" value={detail.sharpe.toFixed(2)} valueClassName="text-white" />
        <KpiCell label="Cost Drag" size="base" value={`${m.costDragPct.toFixed(2)}%`} valueClassName="text-white" />
        <KpiCell
          label="Edge net"
          size="base"
          value={m.edgeNetBp.toFixed(2)}
          valueClassName="text-white"
          extra="bp"
          extraClassName="text-[10px] leading-[14px] text-[#9db2ce]"
        />
      </div>
    </div>
  );
}

function ChartsTab({
  detail,
  error,
  summaryLoading,
  equityLoading,
}: {
  detail: RunDetail;
  error: unknown;
  summaryLoading: boolean;
  equityLoading: boolean;
}) {
  if (error) {
    return (
      <div className="p-4 text-sm text-[#9db2ce]">
        {error instanceof ApiError && error.status === 404
          ? "No results — this run produced no artifacts (it never traded)."
          : `Failed to load results: ${error instanceof Error ? error.message : ""}`}
      </div>
    );
  }
  if (summaryLoading) {
    return <div className="p-4 text-sm text-[#9db2ce]">Loading results…</div>;
  }
  return (
    <div className="flex flex-col gap-3 p-4">
      <ResultsKpiGrid detail={detail} />
      <ChartCard title="Equity curve">
        {equityLoading ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : detail.pnlChartSeries.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            No equity data.
          </div>
        ) : (
          <PnlChart series={detail.pnlChartSeries} />
        )}
      </ChartCard>
    </div>
  );
}

// ── Charts tab (live variant, Figma 14890:143542) ──────────────────────────
// Two rows of 4 KPIs off RunSummary. Profit Factor and the win-rate wins|losses breakdown have no
// API source (no profit-factor field; total_trades counts fills, not closing trades) — those two
// render "—" with an explanatory title, same convention as the live-trade page's KpiCard.
function LiveKpiGrid({ summary }: { summary: RunSummary | undefined }) {
  const netPnl = summary?.net_pnl;
  const netPnlTone = netPnl != null && netPnl < 0 ? GRAD_RED : GRAD_GREEN;
  const returnPct = summary?.return_pct;
  const mdd = summary?.max_drawdown;
  const mddPct = summary?.max_drawdown_pct;
  const winRate = summary?.win_rate;
  const sharpe = summary?.sharpe_annualized ?? summary?.sharpe;
  const costBps = summary?.cost_bps;
  const edgeNet = summary?.edge_net_bps;
  const trades = summary?.total_trades;

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[#1d2939] bg-[rgba(29,33,38,0.2)] px-3 py-2">
      <div className="grid w-full grid-cols-4 gap-4">
        <KpiCell
          label="Net PnL"
          size="sm"
          value={netPnl == null ? "—" : `${netPnl >= 0 ? "+" : "-"}${Math.abs(netPnl).toLocaleString()}`}
          valueClassName={netPnl == null ? "text-muted-foreground" : netPnlTone}
          extra={returnPct == null ? undefined : `(${returnPct >= 0 ? "+" : ""}${(returnPct * 100).toFixed(1)}%)`}
          extraClassName={cn("text-xs font-medium", netPnlTone)}
        />
        <KpiCell
          label="Trades"
          size="base"
          value={trades == null ? "—" : trades.toLocaleString()}
          valueClassName="text-white"
        />
        <KpiCell
          label="Win rate"
          size="sm"
          value={winRate == null ? "—" : `${(winRate * 100).toFixed(2)}%`}
          valueClassName="text-white"
          extra="—"
          extraClassName="text-xs text-[#9db2ce]"
          title="Wins|losses counts aren't available — total_trades counts fills, not closing trades."
        />
        <KpiCell
          label="Profit Factor"
          size="base"
          value="—"
          valueClassName="text-muted-foreground"
          title="Not available — RunSummary has no profit-factor field."
        />
      </div>
      <div className="h-px w-full bg-[#1d2939]" />
      <div className="grid w-full grid-cols-4 gap-4">
        <KpiCell
          label="Max Drawdown"
          size="sm"
          value={mdd == null ? "—" : `-${Math.abs(mdd).toLocaleString()}`}
          valueClassName={mdd == null ? "text-muted-foreground" : GRAD_RED}
          extra={mddPct == null ? undefined : `(-${Math.abs(mddPct * 100).toFixed(1)}%)`}
          extraClassName={cn("text-xs font-medium", GRAD_RED)}
        />
        <KpiCell
          label="Sharpe Ratio"
          size="base"
          value={sharpe == null ? "—" : sharpe.toFixed(2)}
          valueClassName="text-white"
        />
        <KpiCell
          label="Cost Drag"
          size="base"
          value={costBps == null ? "—" : costBps.toFixed(2)}
          valueClassName="text-white"
        />
        <KpiCell
          label="Edge net"
          size="base"
          value={edgeNet == null ? "—" : edgeNet.toFixed(2)}
          valueClassName="text-white"
          extra={edgeNet == null ? undefined : "bp"}
          extraClassName="text-[10px] text-[#9db2ce]"
        />
      </div>
    </div>
  );
}

// Bar option for the two half-width PnL charts (3c). The Figma frame clips both charts' bodies —
// only the card chrome and a "10K"-style y-axis tick are visible — so there's no spec for the bars
// themselves; this mirrors create-strategy/performance-view.tsx's day/month PnL bar rendering
// (same green/red-by-sign coloring), kept local since that file exports no chart component to
// import directly.
function dailyBarOption(points: DayPoint[]): EChartsOption {
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: points.map((p) => p.label), axisTick: { show: false } },
    yAxis: {
      type: "value",
      axisLabel: { formatter: (v: number) => (Math.abs(v) >= 1000 ? `${v / 1000}K` : `${v}`) },
    },
    series: [
      {
        type: "bar",
        barWidth: "60%",
        data: points.map((p) => ({ value: p.value, itemStyle: { color: p.value >= 0 ? "#67e1c1" : "#ff135b" } })),
      },
    ],
  };
}

function LiveChartsTab({
  summary,
  equity,
  summaryLoading,
  equityLoading,
  error,
}: {
  summary: RunSummary | undefined;
  equity: EquityPoint[];
  summaryLoading: boolean;
  equityLoading: boolean;
  error: unknown;
}) {
  // The REST /summary and /equity-curve 500 for the whole life of a running run (parquet sidecar
  // still being written) — the live/stream frame is the only source until the run stops, so the
  // KPIs and every chart below read the merged values, not the raw REST props.
  const { snapshot } = useLiveSnapshot();
  const liveSummary = mergeLiveSummary(summary, snapshot);
  const liveEquity = preferLiveEquity(equity, snapshot);

  if (error && !liveSummary) {
    return (
      <div className="p-4 text-sm text-[#9db2ce]">
        {error instanceof ApiError && error.status === 404
          ? "No results — this run produced no artifacts (it never traded)."
          : `Failed to load results: ${error instanceof Error ? error.message : ""}`}
      </div>
    );
  }
  if (summaryLoading && !liveSummary) {
    return <div className="p-4 text-sm text-[#9db2ce]">Loading results…</div>;
  }

  // No settlement-currency field reaches PaperRunRow yet (see toRunConfig in
  // lib/transform/runs.ts) — fall back to this file's existing currency convention (StatCard's
  // "USDT" unit above) rather than plumb one through for two chart titles.
  const ccy = "USDT";
  const noEquity = liveEquity.length === 0;
  const dailyPoints = toDailyPnl(liveEquity);
  const weeklyPoints = toWeekdayPnl(liveEquity);

  return (
    <div className="flex flex-col gap-3 p-4">
      <LiveKpiGrid summary={liveSummary} />

      <ChartCard title="EQUITY">
        {equityLoading && noEquity ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : noEquity ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No equity data.
          </div>
        ) : (
          <PnlChart
            series={liveEquity.map((p) => ({ date: new Date(p.ts).toISOString(), value: p.equity }))}
            height={260}
          />
        )}
      </ChartCard>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard title={`Net Daily PNL (${ccy})`}>
          {noEquity ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
              No daily PnL.
            </div>
          ) : (
            <BaseChart option={dailyBarOption(dailyPoints)} />
          )}
        </ChartCard>
        <ChartCard title={`Weekly performance (${ccy})`}>
          {noEquity ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
              No weekly PnL.
            </div>
          ) : (
            <BaseChart option={dailyBarOption(weeklyPoints)} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// ── Trades tab ──────────────────────────────────────────────────────────────
function TradeRowView({ t }: { t: TradeHistoryRow }) {
  const buy = /buy|long/i.test(t.side);
  const [date, rest] = t.time.split("T");
  // Keep milliseconds — fills within the same second are common at this cadence.
  const time = rest?.replace("Z", "").slice(0, 12) ?? "";
  const num = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <TableRow>
      <TableCell>
        <div className="leading-tight">
          <div className="text-white">{date}</div>
          <div className="text-muted-foreground">{time}</div>
        </div>
      </TableCell>
      <TableCell className="text-white">{t.symbol}</TableCell>
      <TableCell className={cn("font-medium", buy ? GRAD_GREEN : GRAD_RED)}>{t.side}</TableCell>
      <TableCell className="text-right text-white">{num(t.price)}</TableCell>
      <TableCell className="text-right text-white">{num(t.qty)}</TableCell>
      <TableCell className="text-right text-white">{num(t.mid)}</TableCell>
      <TableCell className="text-white">{t.outcome}</TableCell>
    </TableRow>
  );
}

// Open position — the run's live snapshot `positions`. While the run is running these arrive on
// the shared `/live/stream` subscription (every published update, no polling); a run that isn't
// streaming falls back to the one-shot `GET /api/runs/{id}/live`. Sits above Trading history
// because it's the "right now" state, whereas the history below is what already happened.
function OpenPositions({ run }: { run: PaperRunRow }) {
  const isLive = run.status === "running";
  // Always rendered so the section is visibly present; /live 404s harmlessly for runs that never
  // published a snapshot (backtests, finished runs) and the empty state says so.
  const { snapshot, state } = useLiveSnapshot();
  const { data: polled = [], isLoading: pollLoading } = useRunOpenPositions(run.id, !isLive);
  const positions = isLive ? (snapshot?.positions ?? []) : polled;
  const isLoading = isLive ? state === "connecting" : pollLoading;

  const num = (n?: number, dp = 2) =>
    n === undefined ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-white">Open position</span>
        <Maximize weight="Outline" className="size-4 text-muted-foreground" />
      </div>
      {isLoading ? (
        <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
      ) : positions.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No open position.</p>
      ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Side</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Avg Price</TableHead>
            <TableHead className="text-right">Mark</TableHead>
            <TableHead className="text-right">Unrealized PnL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((pos, i) => {
            const buy = !!pos.side && /buy|long/i.test(pos.side);
            const up = (pos.unrealizedPnl ?? 0) >= 0;
            // symbol_id indexes the run manifest's ordered symbol list.
            const symbol = pos.symbolId !== undefined ? run.symbols[pos.symbolId]?.symbol : undefined;
            return (
              <TableRow key={i}>
                <TableCell className="text-white">{symbol ?? `#${pos.symbolId ?? "?"}`}</TableCell>
                <TableCell className={cn("font-medium", buy ? GRAD_GREEN : GRAD_RED)}>{pos.side ?? "—"}</TableCell>
                <TableCell className="text-right text-white">{num(pos.qty)}</TableCell>
                <TableCell className="text-right text-white">{num(pos.avgPrice)}</TableCell>
                <TableCell className="text-right text-white">{num(pos.markPrice)}</TableCell>
                <TableCell className={cn("text-right", up ? GRAD_GREEN : GRAD_RED)}>{num(pos.unrealizedPnl)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      )}
    </div>
  );
}

function TradesTab({ run }: { run: PaperRunRow }) {
  const { data: restTrades = [], isLoading, isError, error } = useTradeHistory(run.id);
  // The REST /trades endpoint 500s for the whole life of a running run (parquet artifact still
  // being written), but the live stream keeps delivering fills — merge so the table isn't hidden
  // behind that REST error while a healthy stream has data.
  const { snapshot } = useLiveSnapshot();
  const trades = useMemo(() => mergeLiveTrades(restTrades, snapshot), [restTrades, snapshot]);
  const hasTrades = trades.length > 0;
  return (
    <div className="flex flex-col gap-4 p-4">
      <OpenPositions run={run} />
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-white">Trading history</span>
          <TradeHistoryExportButton
            disabled={isLoading || trades.length === 0}
            onClick={() => downloadTradeHistoryCsv(`trading-history-${run.id}.csv`, trades)}
          />
        </div>
        {/* Columns mirror the API's TradeRow 1:1. The Table primitive already provides an
            overflow-x-auto container, so there is no extra wrapper here. */}
        {hasTrades ? (
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
                  <TradeRowView key={t.id} t={t} />
                ))}
              </TableBody>
            </Table>
        ) : isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
        ) : isError ? (
          // A failed fetch is NOT "no trades" — the run's parquet artifacts can be missing or
          // zero-length, which the API surfaces as a 500. Say so instead of implying the run is idle.
          <p className="p-4 text-sm text-destructive">{resourceErrorMessage(error, "this run's trades")}</p>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No trades yet.</p>
        )}
        {trades.length >= TRADES_PAGE_SIZE && (
          <div className="flex justify-center py-3">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-white"
            >
              <AltArrowDown weight="Outline" className="size-3.5" />
              View more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Configuration tab ───────────────────────────────────────────────────────
function ConfigField({ label, value, sub, note }: { label: string; value: string; sub?: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-[#9db2ce]">{label}</span>
      <span className="text-sm font-medium text-white">
        {value}
        {sub && <span className="ml-1 font-normal text-[#9db2ce]">{sub}</span>}
      </span>
      {note && <span className="text-xs text-[#9db2ce]">{note}</span>}
    </div>
  );
}

function ConfigTab({ run }: { run: PaperRunRow }) {
  const c = run.config;
  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="grid grid-cols-4 gap-x-6 gap-y-5">
        <ConfigField label="Mode" value={c.mode} />
        <ConfigField label="Data" value={c.data} />
        <ConfigField label="Strategy" value={run.strategyName} />
        <ConfigField label="Source hash" value={c.sourceHash} />
        <ConfigField label="Account" value={c.accountName} sub={`(${c.accountMeta})`} note={c.accountRisk} />
        <ConfigField label="Symbols" value={c.symbolsLabel} />
        <ConfigField label="Max slice size" value={c.maxSliceSize} />
        <ConfigField label="TWAP interval" value={c.twapInterval} />
        <ConfigField label="Chase threshold" value={c.chaseThreshold} />
        <ConfigField label="Entry order TTL" value={c.entryOrderTtl} />
        <ConfigField label="Cancel ratio" value={c.cancelRatio} />
        <ConfigField label="Simulated latency" value={c.simulatedLatency} />
        <ConfigField label="Trade processing cost" value={c.tradeProcessingCost} />
        <ConfigField label="L2 processing cost" value={c.l2ProcessingCost} />
        <ConfigField label="L2 queue capacity" value={c.l2QueueCapacity} />
        <ConfigField label="Trade queue capacity" value={c.tradeQueueCapacity} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <span className="text-sm font-semibold text-white">Features</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {c.features.length} variables
          </span>
        </div>
        <div className="flex flex-col gap-1.5 px-4 py-4 font-mono text-xs">
          {c.features.map((f) => (
            <div key={f.name} className="flex items-baseline gap-3">
              <span className="w-24 shrink-0 text-white">{f.name}</span>
              <span className="shrink-0 text-muted-foreground">=</span>
              <span className="text-primary">{f.expression}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Code tab ────────────────────────────────────────────────────────────────
// Reuse the strategy builder's Monaco editor (read-only) so the syntax colors match the Create
// page exactly. Paper/live runs all come from the HFT platform, whose strategies are Rhai
// (Rust-like) — including the bar-data "MFT engine" ones — so always highlight as Rust.
function CodeView({ code }: { code: string }) {
  return (
    <div className="flex h-full flex-col">
      <CodeEditor code={code} language="rust" readOnly />
    </div>
  );
}

// ── Header + tab bar (live variant, Figma 14890:144366 / 14782:66119) ──────
// Paper/backtest share ResultsHeaderBar below; only run.mode === "live" reaches these.

// Status pill — tone follows the run's STATUS, not the header variant (Figma 14890:144366's
// "Running" dot treatment vs. the plain tinted pill RUN_STATUS_META already defines).
function HeaderStatusPill({ status }: { status: PaperRunRow["status"] }) {
  const label = RUN_STATUS_META[status]?.label ?? status;
  if (status === "running") {
    return (
      <span className="inline-flex shrink-0 items-center gap-2 rounded-[20px] bg-[rgba(103,225,193,0.1)] px-2 py-1 text-xs leading-[18px]">
        <span className="size-2 shrink-0 rounded-full bg-[linear-gradient(135deg,#cff8ea_0%,#67e1c0_100%)] ring-2 ring-[#67e1c1]/30" />
        <span className="bg-[linear-gradient(172deg,#cff8ea_0%,#67e1c0_100%)] bg-clip-text text-transparent">
          {label}
        </span>
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex h-[26px] shrink-0 items-center rounded-[40px] bg-[rgba(103,133,225,0.1)] px-2 py-1 text-xs leading-[18px] text-[#90c1ff]">
        {label}
      </span>
    );
  }
  const meta = RUN_STATUS_META[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-2 rounded-[20px] px-2 py-1 text-xs leading-[18px]"
      style={{ backgroundColor: meta?.bg }}
    >
      <span className={meta?.text}>{label}</span>
    </span>
  );
}

// Stop-live confirm — same useStopRun mutation and confirm-dialog copy as live-runs-table.tsx's
// "Stop Bot" action, just triggered from the detail panel's header instead of the list row.
function StopLiveDialog({
  run,
  open,
  onOpenChange,
}: {
  run: PaperRunRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const stopRun = useStopRun();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) stopRun.reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stop bot</DialogTitle>
          <DialogDescription>
            Are you sure you want to stop &ldquo;{run.strategyName}&rdquo; ({run.id})? This will halt live trading
            for this run.
          </DialogDescription>
        </DialogHeader>
        {stopRun.isError && (
          <p className="text-xs text-destructive">{resourceErrorMessage(stopRun.error, "this run")}</p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={stopRun.isPending}
            onClick={() => stopRun.mutate(run.id, { onSuccess: () => onOpenChange(false) })}
          >
            {stopRun.isPending ? "Stopping…" : "Stop Bot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LiveHeaderBar({ run, padRight = false }: { run: PaperRunRow; padRight?: boolean }) {
  const { userId, isAdmin } = useAuth();
  const [confirmStop, setConfirmStop] = useState(false);
  // Only stoppable (running) and only for someone who may mutate this run — same gate
  // live-runs-table.tsx uses for its own "Stop Bot" control.
  const canStop = run.status === "running" && canMutate(run, { userId, isAdmin });

  const symbolSegment = run.symbols[0]
    ? `${run.symbols[0].symbol}${run.symbols.length > 1 ? ` +${run.symbols.length - 1}` : ""}`
    : null;
  // `backtestRange` is always null for a live run, so the meta row is just symbol • timeframe.
  const metaSegments = [symbolSegment, run.timeframe].filter((s): s is string => !!s);

  return (
    <>
      {/* `padRight` keeps the in-table panel's pinned X clear of the Stop-live button. */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-2",
          padRight && "pr-12",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="bg-[linear-gradient(172deg,#cff8ea_0%,#67e1c0_100%)] bg-clip-text text-xs leading-[18px] text-transparent">
            LIVE TRADE RESULTS
          </span>
          <div className="flex items-center gap-3">
            <span className="min-w-0 truncate text-base font-medium leading-5 text-white">{run.strategyName}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="size-2 rounded-full bg-[linear-gradient(135deg,#cff8ea_0%,#67e1c0_100%)] ring-2 ring-[#67e1c1]/30" />
              <span className="bg-[linear-gradient(145deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-sm font-medium leading-5 text-transparent">
                {run.strategyType}
              </span>
            </div>
            <HeaderStatusPill status={run.status} />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {canStop && (
            <button
              type="button"
              onClick={() => setConfirmStop(true)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-[32px] border border-[#1d2939] bg-[#1d2939] pl-3 pr-4 py-2 text-xs font-medium leading-[18px] text-white transition-opacity hover:opacity-90"
            >
              <Pause weight="Bold" className="size-[18px]" />
              Stop live
            </button>
          )}
          <div className="flex items-center gap-2 text-xs leading-[18px] text-white">
            {metaSegments.map((seg, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="size-1 shrink-0 rounded-full bg-[#9db2ce]" />}
                <span>{seg}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <StopLiveDialog run={run} open={confirmStop} onOpenChange={setConfirmStop} />
    </>
  );
}

// Header — paper / backtest variant (Figma 14948:27384 shell). Same layout as LiveHeaderBar:
// grey eyebrow, strategy name + type + status, right-side action + symbol/timeframe meta.
// Paper: "PAPER TRADING RESULTS" + Promote to Live (admin). Backtest: "BACKTEST RESULTS" +
// Start Paper Trading (not wired — no paper-trade launch API yet) + optional date range.
function ResultsHeaderBar({
  run,
  onClose,
  onPromote,
  canPromote,
}: {
  run: PaperRunRow;
  onClose: () => void;
  onPromote?: () => void;
  canPromote?: boolean;
}) {
  const addLog = useConsoleLog((s) => s.addLog);
  const isBacktest = run.mode === "backtest";

  const symbolSegment = run.symbols[0]
    ? `${run.symbols[0].symbol}${run.symbols.length > 1 ? ` +${run.symbols.length - 1}` : ""}`
    : null;
  const dateRangeSegment = (() => {
    if (!isBacktest || !run.backtestRange) return null;
    const start = parseISO(run.backtestRange.startDate);
    const end = parseISO(run.backtestRange.endDate);
    if (!isValid(start) || !isValid(end)) return null;
    return `${format(start, "MMM d, yyyy")} → ${format(end, "MMM d, yyyy")}`;
  })();
  const metaSegments = [symbolSegment, run.timeframe, dateRangeSegment].filter((s): s is string => !!s);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-surface py-2.5 pr-4 pl-8">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs leading-[18px] text-[#9db2ce]">
          {isBacktest ? "BACKTEST RESULTS" : "PAPER TRADING RESULTS"}
        </span>
        <div className="flex items-center gap-3">
          <span className="min-w-0 truncate text-base font-medium leading-5 text-white">{run.strategyName}</span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="size-2 rounded-full bg-[linear-gradient(135deg,#cff8ea_0%,#67e1c0_100%)] ring-2 ring-[#67e1c1]/30" />
            <span className="bg-[linear-gradient(145deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-sm font-medium leading-5 text-transparent">
              {run.strategyType}
            </span>
          </div>
          <HeaderStatusPill status={run.status} />
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {isBacktest ? (
          <button
            type="button"
            onClick={() => addLog("info", `Start paper trading — not wired yet ("${run.strategyName}")`)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[40px] border border-[#1d2939] bg-[#0a0e14] px-3 py-2 text-xs leading-[18px] text-white transition-opacity hover:opacity-90"
          >
            <Plain weight="Outline" className="size-4" />
            Start Paper Trading
          </button>
        ) : canPromote ? (
          <Button
            type="button"
            size="sm"
            onClick={onPromote}
            className="h-[34px] shrink-0 gap-1.5 rounded-full bg-[linear-gradient(168deg,#cff8ea_0%,#67e1c1_100%)] text-[#0d0d0d] hover:opacity-90"
          >
            <Rocket weight="Bold" className="size-3.5" />
            Promote to Live
          </Button>
        ) : null}
        <div className="flex items-center gap-2 text-xs leading-[18px] text-white">
          {metaSegments.map((seg, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="size-1 shrink-0 rounded-full bg-[#9db2ce]" />}
              <span>{seg}</span>
            </span>
          ))}
        </div>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="More"
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-white"
          >
            <MenuDots weight="Bold" className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-40 p-1">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-sm text-white transition-colors hover:bg-secondary"
          >
            Close panel
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Tab bar — live variant: bordered tabs with a filled active state (no underline), and the panel's
// close affordance moved here as the trailing grip icon — the live header's right edge holds only
// the Stop-live button + meta row, nothing else, so this is the only close affordance for live.
function LiveTabBar({
  tabs,
  active,
  onChange,
  onClose,
  showMenu = true,
}: {
  tabs: readonly Tab[];
  active: Tab;
  onChange: (tab: Tab) => void;
  onClose: () => void;
  showMenu?: boolean;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-[#1d2939] bg-surface pr-4">
      {tabs.map((t) => {
        const on = t === active;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              "flex h-full cursor-pointer items-center border-t border-r border-[#1d2939] px-8 py-1 text-sm font-medium leading-5 transition-colors",
              on ? "bg-[#151a24]" : "text-[#9db2ce]",
            )}
          >
            <span
              className={cn(
                on && "bg-[linear-gradient(165deg,#cff8ea_0%,#67e1c0_100%)] bg-clip-text text-transparent",
              )}
            >
              {t}
            </span>
          </button>
        );
      })}
      {/* In-table presentation supplies its own absolutely-positioned X, so the ⋮ menu — whose
          only entry is "Close panel" — would be redundant there. */}
      {showMenu && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="More"
              className="ml-auto inline-flex cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-white"
            >
              <ReorderDotsVerticalIcon className="size-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-40 p-1">
            <button
              type="button"
              onClick={onClose}
              className="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-sm text-white transition-colors hover:bg-secondary"
            >
              Close panel
            </button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// Header + tab bar + tab content for one run. Shared by both presentations: the viewport
// slide-in (RunDetailPanel — Paper Trading / Backtesting) and the in-table panel
// (RunDetailInline — Live trade). Mounting is the caller's job: unmounting this tears down the
// `/live/stream` subscription, which is what closing the panel should do.
function RunDetailBody({
  run,
  onClose,
  inline = false,
}: {
  run: PaperRunRow;
  onClose: () => void;
  /** In-table presentation: the caller pins its own X, so drop the tab bar's ⋮ close menu. */
  inline?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Charts");
  const [promoteOpen, setPromoteOpen] = useState(false);
  const router = useRouter();
  const { isAdmin } = useAuth();
  const visibleTabs = tabsFor(run.mode);
  const activeTab: Tab = visibleTabs.includes(tab) ? tab : "Charts";
  // Summary + equity are fetched here — only when the panel is open for a run — not per-row on the
  // list. Skipped in mock mode (synthetic ids the real endpoints can't resolve; the mock row
  // already carries its metrics).
  const summaryQ = useRunSummary(!USE_MOCK ? run.id : undefined);
  const equityQ = useRunEquity(!USE_MOCK ? run.id : undefined);
  const detail: RunDetail =
    USE_MOCK
      ? {
          returnPct: run.returnPct ?? 0,
          sharpe: run.sharpe ?? 0,
          // PaperRunRow carries only the percentage, so back the absolute figure out of it.
          maxDrawdown: ((run.maxDrawdownPct ?? 0) / 100) * run.startingEquity,
          maxDrawdownPct: run.maxDrawdownPct ?? 0,
          metrics: run.metrics,
          pnlSeries: run.pnlSeries,
          pnlChartSeries: run.pnlChartSeries,
        }
      : toRunDetail(summaryQ.data ?? null, equityQ.data ?? [], run.startingEquity);
  const lazy = !USE_MOCK;
  // Metrics come from /summary, the equity chart from /equity-curve — track them separately so a
  // slow/flaky equity fetch doesn't hide already-loaded metrics behind "Loading results…".
  const summaryLoading = lazy && summaryQ.isLoading;
  const equityLoading = lazy && equityQ.isLoading;
  const summaryError = lazy ? summaryQ.error : null;

  return (
    <>
      {/* One `/live/stream` subscription for the whole panel — Open position reads its frames
          instead of polling `/live`. Scoped here so it closes when the panel unmounts. */}
      <LiveSnapshotProvider runId={run.id} isLive={run.status === "running"}>
        {run.mode === "live" ? (
          <LiveHeaderBar run={run} padRight={inline} />
        ) : (
          <ResultsHeaderBar
            run={run}
            onClose={onClose}
            canPromote={run.mode === "paper" && isAdmin}
            onPromote={() => setPromoteOpen(true)}
          />
        )}

        {run.mode === "live" ? (
          <LiveTabBar tabs={visibleTabs} active={activeTab} onChange={setTab} onClose={onClose} showMenu={!inline} />
        ) : (
              <div className="flex h-14 shrink-0 items-stretch border-b border-border bg-surface">
                {visibleTabs.map((t) => {
                  const on = activeTab === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={cn(
                        "relative flex cursor-pointer items-center justify-center px-6 text-sm whitespace-nowrap transition-colors",
                        on ? "font-semibold" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className={cn(on && `${GRAD_TAB_BG} bg-clip-text text-transparent`)}>{t}</span>
                      {on && <span className={cn("absolute inset-x-0 bottom-0 h-0.5 rounded-full", GRAD_TAB_BG)} />}
                    </button>
                  );
                })}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "Charts" &&
            (run.mode === "live" ? (
              <LiveChartsTab
                summary={summaryQ.data}
                equity={equityQ.data ?? []}
                summaryLoading={summaryLoading}
                equityLoading={equityLoading}
                error={summaryError}
              />
            ) : (
              <ChartsTab
                detail={detail}
                error={summaryError}
                summaryLoading={summaryLoading}
                equityLoading={equityLoading}
              />
            ))}
          {activeTab === "Trades" && <TradesTab run={run} />}
          {activeTab === "Trade cycles" && (
            <div className="p-4">
              <TradeCycles runId={run.id} isLive={run.status === "running"} symbols={run.symbols} />
            </div>
          )}
          {activeTab === "Configuration" && <ConfigTab run={run} />}
          {activeTab === "Code" && <CodeView code={run.code} />}
        </div>
      </LiveSnapshotProvider>

      <PromoteToLiveDialog
        run={run}
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        onPromoted={() => {
          const market = marketOf(run);
          setPromoteOpen(false);
          onClose();
          router.push(`/live-trading/alpha-pool${market ? `?market=${market}` : ""}`);
        }}
      />
    </>
  );
}

// Viewport slide-in — Paper Trading and Backtesting. Unchanged presentation.
export function RunDetailPanel({
  open,
  onOpenChange,
  run,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: PaperRunRow | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-y-0 top-0 right-0 left-auto flex h-dvh w-[min(960px,92vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-l bg-background p-0 shadow-none duration-300 sm:max-w-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right ![--tw-enter-scale:1] ![--tw-exit-scale:1]"
      >
        <DialogTitle className="sr-only">{run?.strategyName ?? "Run detail"}</DialogTitle>
        {run && <RunDetailBody run={run} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

// In-table presentation — Live trade renders this in place of the runs table rather than over
// the whole viewport, so the orderbook rail beside it stays visible. The X is pinned to the
// panel's top-right corner, outside the header/tab-bar flow, and replaces the slide-in's ⋮ menu
// (whose only entry was "Close panel").
export function RunDetailInline({ run, onClose }: { run: PaperRunRow; onClose: () => void }) {
  return (
    // No overflow-hidden here: the close button straddles the top-right corner and must not clip.
    <div className="relative flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute -top-4 -right-4 z-30 inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-[#1d2939] bg-background text-[#9db2ce] transition-colors hover:border-white/25 hover:text-white"
      >
        <CloseIcon className="size-5" />
      </button>
      {/* Clipper: bounds the slide-in to the panel box (the wrapper above can't, since it has to
          let the close button overhang) and keeps the content inside the section's rounded edge. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
        <div className="flex min-h-0 flex-1 flex-col animate-in fade-in-0 slide-in-from-right duration-300">
          <RunDetailBody run={run} onClose={onClose} inline />
        </div>
      </div>
    </div>
  );
}
