"use client";
import { useState } from "react";
import type { EChartsOption } from "echarts";
import { AltArrowDown, Maximize, MenuDots } from "@solar-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BaseChart } from "@/components/charts/base-chart";
import { cn, formatPercent } from "@/lib/utils";
import { useTradeHistory } from "@/hooks/api/use-paper-runs";
import { useRunSummary, useRunEquity } from "@/hooks/api/use-runs";
import { ApiError } from "@/lib/api-client";
import { USE_MOCK } from "@/lib/constant";
import { toRunDetail, type RunDetail } from "@/lib/transform/runs";
import type { PaperRunRow, TradeHistoryRow } from "@/lib/mock/paper-runs";
import { StartLiveTradingDialog } from "./start-live-trading-dialog";
import { CodeEditor } from "../create-strategy/code-editor";

// Paper Trading run detail — a right-side slide-in with Charts / Trades / Configuration / Code
// tabs. Figma nodes 13982:131691 (Charts), 13982:133350 (Trades), 14585:34189 (Configuration).
// Header + slide-in shell mirror strategy-detail-panel.tsx / live-run-detail-panel.tsx.
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";
const GRAD_ORANGE = "bg-[linear-gradient(150deg,#ffe3d6_0%,#ff9783_100%)] bg-clip-text text-transparent";
const GRAD_TAB_BG = "bg-[linear-gradient(163deg,#cff8ea_0%,#67e1c1_100%)]";

// Glassy pill (market / timeframe) — same treatment as the live/strategy panels.
const PILL =
  "inline-flex h-7 shrink-0 items-center rounded-[40px] border border-white/25 bg-[rgba(14,20,42,0.5)] px-3 text-xs font-medium text-white shadow-[inset_0_0_8px_0_rgba(63,216,189,0.15)] backdrop-blur-[2px]";

const TABS = ["Charts", "Trades", "Configuration", "Code"] as const;
type Tab = (typeof TABS)[number];

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

function ChartsTab({ detail, error, loading }: { detail: RunDetail; error: unknown; loading: boolean }) {
  if (error) {
    return (
      <div className="p-4 text-sm text-[#9db2ce]">
        {error instanceof ApiError && error.status === 404
          ? "No results — this run produced no artifacts (it never traded)."
          : `Failed to load results: ${error instanceof Error ? error.message : ""}`}
      </div>
    );
  }
  if (loading) {
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
        {detail.pnlChartSeries.length === 0 ? (
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
  const buy = t.action === "Buy";
  const sign = buy ? "+" : "-";
  const [date, rest] = t.time.split("T");
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
      <TableCell className="text-muted-foreground">{t.latencyMs}ms</TableCell>
      <TableCell className={cn("font-medium", buy ? GRAD_GREEN : GRAD_RED)}>{t.action}</TableCell>
      <TableCell className="text-right text-white">{num(t.price)}</TableCell>
      <TableCell className={cn("text-right", buy ? GRAD_GREEN : GRAD_RED)}>
        {sign}
        {t.size.toFixed(2)}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {sign} {Math.abs(Math.round(t.fee)).toLocaleString()}
      </TableCell>
      <TableCell>
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-medium text-white">
          {t.role[0]}
        </span>
      </TableCell>
      <TableCell className="text-right text-white">{num(t.equity)}</TableCell>
    </TableRow>
  );
}

function TradesTab({ runId }: { runId: string }) {
  const { data: trades = [], isLoading } = useTradeHistory(runId);
  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-white">Trading history</span>
          <Maximize weight="Outline" className="size-4 text-muted-foreground" />
        </div>
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
        ) : trades.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead className="text-right">Equity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((t) => (
                  <TradeRowView key={t.id} t={t} />
                ))}
              </TableBody>
            </Table>
          </div>
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
  const detailLoading = lazy && (summaryQ.isLoading || equityQ.isLoading);
  const summaryError = lazy ? summaryQ.error : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-y-0 right-0 left-auto flex h-dvh w-[min(960px,92vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-l bg-background p-0 duration-300 sm:max-w-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
      >
        <DialogTitle className="sr-only">{run?.strategyName ?? "Run detail"}</DialogTitle>

        {run && (
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="truncate text-base font-semibold text-white">{run.strategyName}</span>
                <span
                  className={cn(
                    "shrink-0 text-lg font-semibold",
                    detailLoading ? "text-muted-foreground" : detail.returnPct >= 0 ? GRAD_GREEN : GRAD_RED,
                  )}
                >
                  {detailLoading ? "—" : formatPercent(detail.returnPct)}
                </span>

                <div className="h-5 w-px shrink-0 bg-[#344054]" />

                <span className="inline-flex h-7 shrink-0 items-center rounded-[40px] border border-white/10 bg-[rgba(103,225,193,0.08)] px-3 text-xs font-medium">
                  <span className={GRAD_GREEN}>Paper Trading</span>
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
                <StartLiveTradingDialog run={run} />
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
              {TABS.map((t) => {
                const on = tab === t;
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
              {tab === "Charts" && <ChartsTab detail={detail} error={summaryError} loading={detailLoading} />}
              {tab === "Trades" && <TradesTab runId={run.id} />}
              {tab === "Configuration" && <ConfigTab run={run} />}
              {tab === "Code" && <CodeView code={run.code} />}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
