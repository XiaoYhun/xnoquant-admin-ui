"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { AltArrowDown, Maximize, MenuDots, Rocket } from "@solar-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BaseChart } from "@/components/charts/base-chart";
import { cn, formatPercent } from "@/lib/utils";
import { useTradeHistory } from "@/hooks/api/use-paper-runs";
import { useRunSummary, useRunEquity } from "@/hooks/api/use-runs";
import { ApiError, resourceErrorMessage } from "@/lib/api-client";
import { USE_MOCK } from "@/lib/constant";
import { toRunDetail, type RunDetail } from "@/lib/transform/runs";
import type { PaperRunRow, TradeHistoryRow } from "@/lib/mock/paper-runs";
import { PromoteToLiveDialog } from "./promote-to-live-dialog";
import { useAuth } from "@/hooks/use-auth";
import { marketOf } from "@/components/market-tabs";
import { CodeEditor } from "../create-strategy/code-editor";
import { TradeCycles } from "./trade-cycles";
import { useRunOpenPositions } from "@/hooks/api/use-run-live";
import { LiveSnapshotProvider, useLiveSnapshot } from "@/hooks/api/use-run-live-snapshot";

// Paper Trading run detail — a right-side slide-in with Charts / Trades / Configuration / Code
// tabs. Figma nodes 13982:131691 (Charts), 13982:133350 (Trades), 14585:34189 (Configuration).
// Header + slide-in shell mirror strategy-detail-panel.tsx / live-run-detail-panel.tsx.
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";
const GRAD_ORANGE = "bg-[linear-gradient(150deg,#ffe3d6_0%,#ff9783_100%)] bg-clip-text text-transparent";
const GRAD_TAB_BG = "bg-[linear-gradient(163deg,#cff8ea_0%,#67e1c1_100%)]";

// Glassy pill (market / timeframe) — same treatment as the live/strategy panels.
const PILL =
  "inline-flex h-7 shrink-0 items-center rounded-[40px] border border-white/10 bg-[rgba(14,20,42,0.5)] px-3 text-xs font-medium text-white shadow-[inset_0_0_8px_0_rgba(63,216,189,0.15)] backdrop-blur-[2px]";

// The panel is shared by Paper Trading, Live Trading and Backtesting — label it from the run.
const MODE_LABEL: Record<string, string> = { paper: "Paper Trading", live: "Live Trading", backtest: "Backtest" };

const TABS = ["Charts", "Trades", "Trade cycles", "Configuration", "Code"] as const;
type Tab = (typeof TABS)[number];
// Backtests never journal a trace, so they don't get the Trade cycles tab at all.
const tabsFor = (mode?: string): readonly Tab[] => (mode === "backtest" ? TABS.filter((t) => t !== "Trade cycles") : TABS);

// useTradeHistory fetches the first page (this size) in one shot and drops TradePage.total, so a
// full page is our only "there may be more" signal — a partial page means nothing more to load.
const TRADES_PAGE_SIZE = 100;

// ── Charts tab ──────────────────────────────────────────────────────────────
type Tone = "green" | "red" | "orange" | "white";
const TONE: Record<Tone, string> = { green: GRAD_GREEN, red: GRAD_RED, orange: GRAD_ORANGE, white: "text-white" };

function StatCard({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone: Tone }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-[12px] border border-border bg-[rgba(29,33,38,0.2)] p-2">
      <span className="truncate text-xs leading-[18px] text-[#9db2ce]">{label}</span>
      <div className="flex items-end gap-1">
        <span className={cn("text-base leading-5 font-semibold", TONE[tone])}>{value}</span>
        {unit && <span className="text-[10px] leading-[14px] text-[#9db2ce]">{unit}</span>}
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

function PnlChart({ series }: { series: PaperRunRow["pnlChartSeries"] }) {
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
  return <BaseChart option={option} style={{ height: 240 }} />;
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
  const m = detail.metrics;
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <StatCard label="Net PnL" value={`${m.netPnl >= 0 ? "+" : "-"}${Math.abs(m.netPnl).toLocaleString()}`} unit="USDT" tone={m.netPnl >= 0 ? "green" : "red"} />
        <StatCard label="Win rate" value={`${m.winRate.toFixed(2)}%`} tone={m.winRate >= 0 ? "green" : "red"} />
        <StatCard label="Sharpe Ratio" value={detail.sharpe.toFixed(2)} tone="orange" />
        <StatCard label="Max Drawdown" value={formatPercent(detail.maxDrawdownPct)} tone="red" />
        <StatCard label="Trades" value={String(m.trades)} tone="white" />
        <StatCard label="Cost Drag" value={`${m.costDragPct.toFixed(2)}%`} tone="white" />
        <StatCard label="Edge net" value={m.edgeNetBp.toFixed(2)} unit="bp" tone="white" />
      </div>
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
  const { data: trades = [], isLoading, isError, error } = useTradeHistory(run.id);
  return (
    <div className="flex flex-col gap-4 p-4">
      <OpenPositions run={run} />
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-white">Trading history</span>
          <Maximize weight="Outline" className="size-4 text-muted-foreground" />
        </div>
        {/* Columns mirror the API's TradeRow 1:1. The Table primitive already provides an
            overflow-x-auto container, so there is no extra wrapper here. */}
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
        ) : isError ? (
          // A failed fetch is NOT "no trades" — the run's parquet artifacts can be missing or
          // zero-length, which the API surfaces as a 500. Say so instead of implying the run is idle.
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
                  <TradeRowView key={t.id} t={t} />
                ))}
              </TableBody>
            </Table>
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

export function RunDetailPanel({
  open,
  onOpenChange,
  run,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: PaperRunRow | null;
}) {
  const [tab, setTab] = useState<Tab>("Charts");
  const [promoteOpen, setPromoteOpen] = useState(false);
  const router = useRouter();
  const { isAdmin } = useAuth();
  const visibleTabs = tabsFor(run?.mode);
  const activeTab: Tab = visibleTabs.includes(tab) ? tab : "Charts";
  // Summary + equity are fetched here — only when the panel is open for a run — not per-row on the
  // list. Skipped in mock mode (synthetic ids the real endpoints can't resolve; the mock row
  // already carries its metrics).
  const summaryQ = useRunSummary(!USE_MOCK && run ? run.id : undefined);
  const equityQ = useRunEquity(!USE_MOCK && run ? run.id : undefined);
  const detail: RunDetail =
    USE_MOCK && run
      ? {
          returnPct: run.returnPct ?? 0,
          sharpe: run.sharpe ?? 0,
          maxDrawdownPct: run.maxDrawdownPct ?? 0,
          metrics: run.metrics,
          pnlSeries: run.pnlSeries,
          pnlChartSeries: run.pnlChartSeries,
        }
      : toRunDetail(summaryQ.data ?? null, equityQ.data ?? [], run?.startingEquity ?? 0);
  const lazy = !USE_MOCK && !!run;
  // Metrics come from /summary, the equity chart from /equity-curve — track them separately so a
  // slow/flaky equity fetch doesn't hide already-loaded metrics behind "Loading results…".
  const summaryLoading = lazy && summaryQ.isLoading;
  const equityLoading = lazy && equityQ.isLoading;
  const summaryError = lazy ? summaryQ.error : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-y-0 right-0 left-auto flex h-dvh w-[min(960px,92vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-l bg-background p-0 duration-300 sm:max-w-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
      >
        <DialogTitle className="sr-only">{run?.strategyName ?? "Run detail"}</DialogTitle>

        {run && (
          // One `/live/stream` subscription for the whole panel — Open position reads its frames
          // instead of polling `/live`. Scoped to the panel so it closes with it.
          <LiveSnapshotProvider runId={run.id} isLive={run.status === "running"}>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="truncate text-base font-semibold text-white">{run.strategyName}</span>
                <span
                  className={cn(
                    "shrink-0 text-lg font-semibold",
                    summaryLoading ? "text-muted-foreground" : detail.returnPct >= 0 ? GRAD_GREEN : GRAD_RED,
                  )}
                >
                  {summaryLoading ? "—" : formatPercent(detail.returnPct)}
                </span>

                <div className="h-5 w-px shrink-0 bg-[#344054]" />

                <span className="inline-flex h-7 shrink-0 items-center rounded-[40px] border border-white/10 bg-[rgba(103,225,193,0.08)] px-3 text-xs font-medium">
                  <span className={GRAD_GREEN}>{MODE_LABEL[run.mode ?? "paper"]}</span>
                </span>
                {run.symbols.map((sym) => (
                  <span key={sym.symbol} className={cn(PILL, "gap-2")}>
                    <span className="text-white">{sym.symbol}</span>
                    <span className="text-[#9db2ce]">|</span>
                    <span className={GRAD_GREEN}>{sym.market}</span>
                  </span>
                ))}
                <span className={PILL}>{run.timeframe}</span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* Paper runs are promoted into the live basket, not launched from here — the
                    launch step lives on Alpha pool once an admin has approved the strategy. */}
                {run.mode === "paper" && isAdmin && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setPromoteOpen(true)}
                    className="h-[34px] gap-1.5 rounded-full bg-[linear-gradient(168deg,#cff8ea_0%,#67e1c1_100%)] text-[#0d0d0d] hover:opacity-90"
                  >
                    <Rocket weight="Bold" className="size-3.5" />
                    Promote to Live
                  </Button>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="More"
                      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-white"
                    >
                      <MenuDots weight="Bold" className="size-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-40 p-1">
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-sm text-white transition-colors hover:bg-secondary"
                    >
                      Close panel
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

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

            <div className="min-h-0 flex-1 overflow-y-auto">
              {activeTab === "Charts" && (
                <ChartsTab
                  detail={detail}
                  error={summaryError}
                  summaryLoading={summaryLoading}
                  equityLoading={equityLoading}
                />
              )}
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
        )}
      </DialogContent>

      <PromoteToLiveDialog
        run={run}
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        onPromoted={() => {
          const market = run ? marketOf(run) : null;
          setPromoteOpen(false);
          onOpenChange(false);
          router.push(`/live-trading/alpha-pool${market ? `?market=${market}` : ""}`);
        }}
      />
    </Dialog>
  );
}
