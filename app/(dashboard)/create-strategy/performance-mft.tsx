"use client";
// Create Strategy "Results" tab (MFT) — "Performance" view. Ported from xno-builder's strategy
// "Performance" tab: 3 stat cards (Transaction Analysis / Performance Metrics / Advanced Metrics),
// no charts. Fed by GET /strategies/{id}/stages/{stage}/performance.
import { cn } from "@/lib/utils";
import {
  useStrategyPerformance,
  type StrategyPerformanceDetail,
} from "@/hooks/api/use-strategy-performance";

type Analysis = NonNullable<StrategyPerformanceDetail["analysis"]>;
type Performance = NonNullable<StrategyPerformanceDetail["performance"]>;

const GREEN_TEXT =
  "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const RED_TEXT = "text-[#ff135b]";
const DEFAULT_TEXT = "text-white";

function fmtCcy(v: number | undefined, market?: string): string {
  if (v == null) return "-";
  const isCrypto = market === "Crypto Spot";
  return new Intl.NumberFormat(isCrypto ? "en-US" : "vi-VN", {
    style: "currency",
    currency: isCrypto ? "USD" : "VND",
    maximumFractionDigits: isCrypto ? 2 : 0,
  }).format(v);
}

function fmtPct(v: number | undefined): string {
  return v == null ? "-" : `${(v * 100).toFixed(2)}%`;
}

function fmtNum(v: number | undefined, d = 2): string {
  return v == null ? "-" : v.toFixed(d);
}

// Tone helpers — pick the value's color class. Fixed tones ignore the value; sign/threshold
// tones inspect it (still returning the neutral default when the value is missing).
const toneDefault = () => DEFAULT_TEXT;
const toneGreen = () => GREEN_TEXT;
const toneRed = () => RED_TEXT;
const toneBySign = (v: number | undefined) => (v == null ? DEFAULT_TEXT : v >= 0 ? GREEN_TEXT : RED_TEXT);
const toneWinRate = (v: number | undefined) => (v == null ? DEFAULT_TEXT : v >= 0.5 ? GREEN_TEXT : RED_TEXT);
const toneProfitFactor = (v: number | undefined) => (v == null ? DEFAULT_TEXT : v >= 1 ? GREEN_TEXT : RED_TEXT);

interface Row {
  label: string;
  text: string;
  colorClass: string;
}

function StatRow({ row }: { row: Row }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{row.label}</span>
      <span className={cn("font-medium", row.colorClass)}>{row.text}</span>
    </div>
  );
}

function StatCard({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="bg-secondary px-4 py-3 text-sm font-semibold text-white">{title}</div>
      <div>
        {rows.map((row) => (
          <StatRow key={row.label} row={row} />
        ))}
      </div>
    </div>
  );
}

function buildTransactionAnalysisRows(a: Analysis, p: Performance, market?: string): Row[] {
  return [
    { label: "Initial Capital", text: fmtCcy(a.start_value, market), colorClass: toneDefault() },
    { label: "Net Equity", text: fmtCcy(a.end_value, market), colorClass: toneDefault() },
    { label: "Total Profit", text: fmtPct(p.cumulative_return), colorClass: toneBySign(p.cumulative_return) },
    { label: "Total Fees", text: fmtPct(a.total_fee), colorClass: toneDefault() },
    { label: "Total Trades", text: a.total_trades == null ? "-" : String(a.total_trades), colorClass: toneDefault() },
    { label: "Largest Win", text: fmtPct(a.best_trade), colorClass: toneGreen() },
    { label: "Largest Loss", text: fmtPct(a.worst_trade), colorClass: toneRed() },
    { label: "Avg Win", text: fmtPct(a.avg_win_trade), colorClass: toneGreen() },
    { label: "Avg Loss", text: fmtPct(a.avg_loss_trade), colorClass: toneRed() },
    { label: "Unrealized PnL", text: fmtCcy(a.open_trade_pnl, market), colorClass: toneBySign(a.open_trade_pnl) },
  ];
}

function buildPerformanceMetricsRows(p: Performance): Row[] {
  return [
    { label: "Cumulative Return", text: fmtPct(p.cumulative_return), colorClass: toneBySign(p.cumulative_return) },
    { label: "CAGR", text: fmtPct(p.annual_return), colorClass: toneBySign(p.annual_return) },
    { label: "Win Rate", text: fmtPct(p.win_rate), colorClass: toneWinRate(p.win_rate) },
    { label: "Profit Factor", text: fmtNum(p.profit_factor, 2), colorClass: toneProfitFactor(p.profit_factor) },
    { label: "Sharpe Ratio", text: fmtNum(p.sharpe), colorClass: toneDefault() },
    { label: "Sortino Ratio", text: fmtNum(p.sortino), colorClass: toneDefault() },
    { label: "Calmar Ratio", text: fmtNum(p.calmar), colorClass: toneDefault() },
    { label: "Payoff Ratio", text: fmtNum(p.win_loss_ratio), colorClass: toneDefault() },
    { label: "Volatility", text: fmtNum(p.volatility), colorClass: toneDefault() },
    { label: "Max Drawdown", text: fmtPct(p.max_drawdown), colorClass: toneRed() },
  ];
}

function buildAdvancedMetricsRows(p: Performance): Row[] {
  return [
    { label: "Recovery Factor", text: fmtNum(p.recovery_factor), colorClass: toneDefault() },
    { label: "Kelly Criterion", text: fmtPct(p.kelly_criterion), colorClass: toneBySign(p.kelly_criterion) },
    { label: "Omega Ratio", text: fmtNum(p.omega), colorClass: toneDefault() },
    { label: "Ulcer Index", text: fmtNum(p.ulcer_index), colorClass: toneDefault() },
    { label: "VaR", text: fmtPct(p.var), colorClass: toneRed() },
    { label: "CVaR", text: fmtPct(p.cvar), colorClass: toneRed() },
  ];
}

export function PerformanceMftView({
  strategyId,
  stage,
  market,
}: {
  strategyId?: string;
  stage: string;
  market?: string;
}) {
  const { data, isLoading } = useStrategyPerformance(strategyId, stage);
  const a = data?.analysis;
  const p = data?.performance;

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading performance…</div>;
  }

  if (!a || !p) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No performance data for this stage.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <StatCard title="Transaction Analysis" rows={buildTransactionAnalysisRows(a, p, market)} />
      <StatCard title="Performance Metrics" rows={buildPerformanceMetricsRows(p)} />
      <StatCard title="Advanced Metrics" rows={buildAdvancedMetricsRows(p)} />
    </div>
  );
}
