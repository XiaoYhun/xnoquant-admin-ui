import type { EquityPoint, Run, RunSummary, TradeRow } from "@/types/domain";
import type { LiveRunRow } from "@/lib/mock/live-runs";
import type { PaperRunRow, TradeHistoryRow } from "@/lib/mock/paper-runs";

// Run (+ RunSummary, EquityPoint[]) → LiveRunRow / PaperRunRow, and TradeRow → TradeHistoryRow.
// See docs/plans/api-integration.md §4.C/§4.D for the source mapping this file implements, and
// the GAP-3/4/5 notes below for fields HFT doesn't provide directly.

type RunManifest = Run["manifest"];
type ManifestAccount = RunManifest["account"];
type ManifestSymbol = RunManifest["symbols"][number];

// GAP-3: RunSummary.{net_pnl,max_drawdown} are absolute PnL units, not the %/ratio the tables
// show. We derive a % using the manifest's starting balances (paper: launch-time balances;
// live: exchange snapshot, currently empty per the schema doc — falls back to 0% when absent).
function startingEquity(manifest: RunManifest): number {
  const accounts = [manifest.account, ...(manifest.extra_accounts ?? [])];
  return accounts.reduce((sum, acc) => {
    const balances = acc.balances ?? {};
    return sum + Object.values(balances).reduce((s, v) => s + v, 0);
  }, 0);
}

function pctReturn(summary: RunSummary | null, manifest: RunManifest): number {
  if (!summary) return 0;
  const equity = startingEquity(manifest);
  return equity ? Number(((summary.net_pnl / equity) * 100).toFixed(2)) : 0;
}

function pctMaxDrawdown(summary: RunSummary | null, manifest: RunManifest): number {
  if (!summary) return 0;
  const equity = startingEquity(manifest);
  return equity ? Number((-(Math.abs(summary.max_drawdown) / equity) * 100).toFixed(2)) : 0;
}

// `MarketDataKind.interval` is an exchange label ("1m", "5m", "15m", "1h", ...) — map to the
// UI's "5min"/"15min"/"1h" style; tick data has no interval and reads as "tick".
function timeframeLabel(dataKind: RunManifest["data_kind"]): string {
  if (!dataKind) return "—";
  if (dataKind.kind === "tick") return "tick";
  const m = dataKind.interval.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!m) return dataKind.interval;
  const [, n, unit] = m;
  return `${n}${unit === "m" ? "min" : unit}`;
}

// Manifest doc: Tick data → the HFT (L2) engine, Bar data → the MFT (OHLC) engine.
function strategyGroup(dataKind: RunManifest["data_kind"]): "MFT" | "HFT" {
  return dataKind?.kind === "tick" ? "HFT" : "MFT";
}

// GAP-4: HFT symbols carry `instrument_class`/`venue_id`, not a "VNFuture"/"NASDAQ"/"Crypto"
// market label. Approximate from the venue backing the symbol's account leg (matched by
// venue_id): binance_* → Crypto; dnse/tcbs futures → VNFuture, else Vietnam. Lossy — unmapped
// combinations fall back to "—".
function marketForSymbol(sym: ManifestSymbol, manifest: RunManifest): string {
  const accounts: ManifestAccount[] = [manifest.account, ...(manifest.extra_accounts ?? [])];
  const venueType = accounts.find((a) => a.venue_id === sym.venue_id)?.venue_type;
  if (venueType === "binance_spot" || venueType === "binance_futures") return "Crypto";
  if (venueType === "dnse" || venueType === "tcbs") {
    return sym.instrument_class === "linear_future" || sym.instrument_class === "coin_margined_future"
      ? "VNFuture"
      : "Vietnam";
  }
  return "—";
}

function accountNames(manifest: RunManifest): string[] {
  return [manifest.account, ...(manifest.extra_accounts ?? [])].map((a) => a.name);
}

function symbolRows(manifest: RunManifest): { symbol: string; market: string }[] {
  return manifest.symbols.map((s) => ({ symbol: s.symbol, market: marketForSymbol(s, manifest) }));
}

// Detail-view "Configuration" tab — pre-format the manifest into display strings. Fields HFT
// doesn't surface (queue capacities, processing costs) fall back to the platform defaults the
// design shows.
function toRunConfig(manifest: RunManifest): PaperRunRow["config"] {
  const exec = manifest.execution;
  const dk = manifest.data_kind;
  const acc = manifest.account;
  const latency = exec?.latency;
  return {
    mode: manifest.mode.charAt(0).toUpperCase() + manifest.mode.slice(1),
    data: !dk ? "—" : dk.kind === "tick" ? "Tick" : `Bar (${dk.interval})`,
    sourceHash: manifest.strategy.source_hash ?? "—",
    accountName: acc.name,
    accountMeta: `${acc.venue_name ?? acc.venue_type} · ${acc.account_type}`,
    accountRisk: "risk: No limits",
    symbolsLabel: `${manifest.symbols.length} — ${manifest.symbols.map((s) => s.symbol).join(", ")}`,
    maxSliceSize: (exec?.max_slice_size ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    twapInterval: `${exec?.twap_interval_ms ?? 0} ms`,
    chaseThreshold: `${exec?.chase_threshold_ticks ?? 0} ticks`,
    entryOrderTtl: "0 ms",
    takeProfit: `${exec?.take_profit_points ?? 0} pts`,
    stopLoss: `${exec?.stop_loss_points ?? 0} pts`,
    cancelRatio: `${((exec?.cancel_ratio ?? 0) * 100).toFixed(1)}%`,
    simulatedLatency: typeof latency === "string" || typeof latency === "number" ? String(latency) : "None",
    tradeProcessingCost: "0 ns",
    l2ProcessingCost: "0 ns",
    l2QueueCapacity: "64",
    tradeQueueCapacity: "64",
    features: manifest.strategy.features ?? [],
  };
}

function toRunMetrics(summary: RunSummary | null, manifest: RunManifest): PaperRunRow["metrics"] {
  const equity = startingEquity(manifest);
  return {
    netPnl: summary?.net_pnl ?? 0,
    winRate: summary ? Number((summary.win_rate * 100).toFixed(2)) : 0,
    trades: summary?.total_trades ?? 0,
    costDragPct: summary && equity ? Number(((summary.total_fee / equity) * 100).toFixed(2)) : 0,
    edgeNetBp: 0,
  };
}

export function toLiveRunRow(run: Run, summary: RunSummary | null, equity: EquityPoint[]): LiveRunRow {
  const { manifest } = run;
  return {
    id: run.id,
    strategyName: manifest.strategy.name,
    alphaStatus: "Live Trading", // GAP-4: no API field — constant per plan §4.C
    accounts: accountNames(manifest),
    symbols: symbolRows(manifest),
    timeframe: timeframeLabel(manifest.data_kind),
    status: run.status,
    pnlSeries: equity.map((p) => p.equity),
    returnPct: pctReturn(summary, manifest),
    sharpe: summary?.sharpe ?? 0,
    maxDrawdownPct: pctMaxDrawdown(summary, manifest),
  };
}

// GAP-3 (returns-series): HFT has no per-point returns series — derive from equity deltas
// (Δequity / starting equity per point). Falls back to raw Δequity (unscaled) when there's no
// starting balance on record.
function deriveReturnsSeries(points: EquityPoint[], startEquity: number): { date: string; value: number }[] {
  const base = startEquity || 1;
  let prev = 0;
  return points.map((p) => {
    const value = Number(((p.equity - prev) / base).toFixed(4));
    prev = p.equity;
    return { date: new Date(p.ts).toISOString(), value };
  });
}

export function toPaperRunRow(run: Run, summary: RunSummary | null, equity: EquityPoint[]): PaperRunRow {
  const { manifest } = run;
  return {
    id: run.id,
    strategyName: manifest.strategy.name,
    strategyType: strategyGroup(manifest.data_kind),
    status: run.status,
    accounts: accountNames(manifest),
    symbols: symbolRows(manifest),
    timeframe: timeframeLabel(manifest.data_kind),
    strategyId: run.strategy_id ?? manifest.strategy.id,
    symbolIds: manifest.symbols.map((s) => s.id),
    executionType: manifest.strategy.strategy_type,
    pnlSeries: equity.map((p) => p.equity),
    returnPct: pctReturn(summary, manifest),
    sharpe: summary?.sharpe ?? 0,
    maxDrawdownPct: pctMaxDrawdown(summary, manifest),
    pnlChartSeries: equity.map((p) => ({ date: new Date(p.ts).toISOString(), value: p.equity })),
    returnsChartSeries: deriveReturnsSeries(equity, startingEquity(manifest)),
    metrics: toRunMetrics(summary, manifest),
    config: toRunConfig(manifest),
    code: manifest.strategy.code,
  };
}

function mapAction(side: string): "Buy" | "Sell" {
  const s = side.toLowerCase();
  return s.includes("sell") || s.includes("ask") ? "Sell" : "Buy";
}

// GAP-5: TradeRow has no explicit maker/taker flag. Best-effort: sniff the (untyped) `outcome`
// string for "maker"/"taker"; default to "Taker" (the common case) when it's ambiguous.
function mapRole(outcome: string): "Maker" | "Taker" {
  const o = outcome.toLowerCase();
  if (o.includes("maker")) return "Maker";
  if (o.includes("taker")) return "Taker";
  return "Taker";
}

export function toTradeHistoryRow(t: TradeRow): TradeHistoryRow {
  return {
    id: `${t.order_id}-${t.fill_ts}`,
    time: new Date(t.fill_ts).toISOString(),
    action: mapAction(t.side),
    role: mapRole(t.outcome),
    price: t.fill_price,
    size: t.fill_qty,
    // GAP-5: no per-fill fee on TradeRow (only the run-level aggregate SymbolPnlSummary.total_fee)
    fee: 0,
    latencyMs: Math.max(0, t.fill_ts - t.submitted_ts),
    // GAP-5: no per-fill running equity (only the downsampled equity-curve)
    equity: 0,
  };
}
