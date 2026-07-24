import type { RunStatus, StrategyType } from "@/types/domain";
import { SAMPLE_CODE } from "@/lib/mock/strategy-builder";

// Detail-view "Charts" tab stat cards (the ones not already on the row: sharpe / returnPct /
// maxDrawdownPct cover the rest).
export type RunMetrics = {
  netPnl: number; // absolute PnL
  winRate: number; // percent
  trades: number; // fill count
  costDragPct: number; // percent
  edgeNetBp: number; // basis points
};

export type FeatureDef = { name: string; expression: string };

// Detail-view "Configuration" tab — a read-only snapshot of the run manifest, pre-formatted for
// display (units baked in) so the panel stays pure presentation.
export type RunConfig = {
  mode: string;
  data: string;
  sourceHash: string;
  accountName: string;
  accountMeta: string;
  accountRisk: string;
  symbolsLabel: string;
  maxSliceSize: string;
  twapInterval: string;
  chaseThreshold: string;
  entryOrderTtl: string;
  cancelRatio: string;
  simulatedLatency: string;
  tradeProcessingCost: string;
  l2ProcessingCost: string;
  l2QueueCapacity: string;
  tradeQueueCapacity: string;
  features: FeatureDef[];
};

// OWNED BY: Paper Trading (Slice 5).
// UI-only denormalized row shape — mirrors `LiveRunRow`: accounts/symbols are arrays
// because the design binds some runs to two accounts / instruments (the taller rows).
export type PaperRunRow = {
  id: string;
  strategyName: string;
  strategyType: "MFT" | "HFT";
  status: RunStatus;
  accounts: string[];
  symbols: { symbol: string; market: string }[];
  timeframe: string;
  strategyId: string | null;
  symbolIds: string[];
  executionType: StrategyType;
  // Run.owner_username — the owner's display name; null when the roster hasn't been populated.
  owner: string | null;
  // Manifest-derived starting equity — kept so the detail panel can compute % metrics from the
  // lazily-fetched summary. See lib/transform/runs.ts.
  startingEquity: number;
  pnlSeries: number[];
  // Summary/equity-derived — null/empty until the run's detail panel is opened (then fetched).
  returnPct: number | null;
  sharpe: number | null;
  maxDrawdownPct: number | null;
  // Detail-view "Charts" tab data — denormalized so selecting a run needs no extra fetch.
  pnlChartSeries: { date: string; value: number }[];
  returnsChartSeries: { date: string; value: number }[];
  // Detail-view tabs: metrics (Charts stat cards), config (Configuration), code (Code).
  metrics: RunMetrics;
  config: RunConfig;
  code: string;
};

// The 16 mock literals below carry only the list-row fields; the detail-tab fields
// (metrics/config/code) are synthesized in listPaperRuns so the literals stay compact.
type PaperRunBase = Omit<PaperRunRow, "metrics" | "config" | "code" | "startingEquity" | "owner">;

// UI-only row for the detail view's "Trade history" table.
export type TradeHistoryRow = {
  id: string;
  time: string;
  action: "Buy" | "Sell";
  role: "Maker" | "Taker";
  price: number;
  size: number;
  fee: number;
  latencyMs: number;
  equity: number;
};

// Deterministic pseudo-random walk (no Math.random) with visible intra-series volatility
// so the mini PnL chart reads as a real equity curve — same idiom as lib/mock/live-runs.ts.
function pnlSeries(seed: number, drift: number): number[] {
  const points: number[] = [];
  let value = 0;
  for (let i = 0; i < 44; i++) {
    // High-frequency multi-octave noise → a genuinely choppy price/equity series
    // (not a smooth curve). Drift is deliberately weak so the noise dominates the shape.
    const noise =
      Math.sin(seed * 1.7 + i * 1.3) * 5 +
      Math.sin(seed * 0.9 + i * 2.9) * 4 +
      Math.cos(seed * 2.3 + i * 0.7) * 3.5 +
      Math.sin(seed * 3.7 + i * 5.1) * 2.4;
    value += drift * 0.5 + noise;
    points.push(Number(value.toFixed(2)));
  }
  return points;
}

function dateAt(offsetDays: number): string {
  const d = new Date(Date.UTC(2026, 4, 1));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Larger-magnitude cumulative walk for the detail view's PnL area chart.
function pnlChartSeries(seed: number, drift: number, points = 40): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  let value = 0;
  for (let i = 0; i < points; i++) {
    value += drift * 850 + Math.sin(seed + i * 0.5) * Math.abs(drift) * 900;
    out.push({ date: dateAt(i * 2), value: Number(value.toFixed(2)) });
  }
  return out;
}

// Noisy oscillation (no cumulative drift) for the detail view's Returns line chart.
function returnsChartSeries(seed: number, points = 80): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  for (let i = 0; i < points; i++) {
    const value = Math.sin(seed * 1.7 + i * 0.9) * 0.09 + Math.sin(seed * 0.6 + i * 0.33) * 0.05;
    out.push({ date: dateAt(i), value: Number(value.toFixed(4)) });
  }
  return out;
}

const CRYPTO_LEG = { symbol: "ETHUSD", market: "Crypto" };
const FUT_LEG = { symbol: "VN30F2M", market: "VNFuture" };

function strategyIdFor(n: number): string {
  return `a1b2c3d4-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function symbolIdsFor(n: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `b1b2c3d4-1111-4111-8111-${String(n * 10 + i).padStart(12, "0")}`);
}

export const MOCK_PAPER_RUNS: PaperRunBase[] = [
  { id: "MFT-5lWb3Ux", strategyName: "Sample Strategy 1", strategyType: "MFT", status: "running", accounts: ["DN-002"], symbols: [{ symbol: "VN30F1M", market: "VNFuture" }], timeframe: "5min", strategyId: strategyIdFor(1), symbolIds: symbolIdsFor(1, 1), executionType: "taker", returnPct: 134.22, sharpe: 1.82, maxDrawdownPct: -14.22, pnlSeries: pnlSeries(1, 1.6), pnlChartSeries: pnlChartSeries(1, 1.6), returnsChartSeries: returnsChartSeries(1) },
  { id: "MFT-D7AxNplR", strategyName: "Momentum Booster", strategyType: "MFT", status: "running", accounts: ["DN-002"], symbols: [{ symbol: "AAPL", market: "NASDAQ" }], timeframe: "5min", strategyId: strategyIdFor(2), symbolIds: symbolIdsFor(2, 1), executionType: "maker", returnPct: 87.45, sharpe: 2.15, maxDrawdownPct: -5.87, pnlSeries: pnlSeries(2, 1.1), pnlChartSeries: pnlChartSeries(2, 1.1), returnsChartSeries: returnsChartSeries(2) },
  { id: "HFT-LqJvB9C", strategyName: "Reversal Hunter", strategyType: "HFT", status: "paused", accounts: ["DN-002"], symbols: [{ symbol: "BTCUSD", market: "Crypto" }], timeframe: "5min", strategyId: strategyIdFor(3), symbolIds: symbolIdsFor(3, 1), executionType: "taker", returnPct: 56.13, sharpe: 1.6, maxDrawdownPct: -7.34, pnlSeries: pnlSeries(3, 0.8), pnlChartSeries: pnlChartSeries(3, 0.8), returnsChartSeries: returnsChartSeries(3) },
  { id: "MFT-2k9GYxS", strategyName: "Breakout Seeker", strategyType: "MFT", status: "paused", accounts: ["DN-001", "DN-002"], symbols: [CRYPTO_LEG, FUT_LEG], timeframe: "5min", strategyId: strategyIdFor(4), symbolIds: symbolIdsFor(4, 2), executionType: "arbitrage", returnPct: 98.77, sharpe: 2.05, maxDrawdownPct: -10.12, pnlSeries: pnlSeries(4, 1.0), pnlChartSeries: pnlChartSeries(4, 1.0), returnsChartSeries: returnsChartSeries(4) },
  { id: "HFT-f9PmYxQ", strategyName: "Trend Rider", strategyType: "HFT", status: "running", accounts: ["DN-002"], symbols: [{ symbol: "TSLA", market: "NASDAQ" }], timeframe: "5min", strategyId: strategyIdFor(5), symbolIds: symbolIdsFor(5, 1), executionType: "taker", returnPct: 45.66, sharpe: 1.75, maxDrawdownPct: -3.88, pnlSeries: pnlSeries(5, 0.9), pnlChartSeries: pnlChartSeries(5, 0.9), returnsChartSeries: returnsChartSeries(5) },
  { id: "HFT-3RxWyQJ", strategyName: "Volatility Scalper", strategyType: "HFT", status: "running", accounts: ["DN-001", "DN-002"], symbols: [CRYPTO_LEG, FUT_LEG], timeframe: "5min", strategyId: strategyIdFor(6), symbolIds: symbolIdsFor(6, 2), executionType: "arbitrage", returnPct: 120.89, sharpe: 2.3, maxDrawdownPct: -12.5, pnlSeries: pnlSeries(6, 1.3), pnlChartSeries: pnlChartSeries(6, 1.3), returnsChartSeries: returnsChartSeries(6) },
  { id: "HFT-Mvd2ZtW", strategyName: "Swing Master", strategyType: "HFT", status: "running", accounts: ["DN-002"], symbols: [{ symbol: "MSFT", market: "NASDAQ" }], timeframe: "5min", strategyId: strategyIdFor(7), symbolIds: symbolIdsFor(7, 1), executionType: "maker", returnPct: 72.34, sharpe: 1.9, maxDrawdownPct: -6.45, pnlSeries: pnlSeries(7, 1.0), pnlChartSeries: pnlChartSeries(7, 1.0), returnsChartSeries: returnsChartSeries(7) },
  { id: "MFT-Y7LwKmZ", strategyName: "Range Bound", strategyType: "MFT", status: "running", accounts: ["DN-001", "DN-002"], symbols: [CRYPTO_LEG, FUT_LEG], timeframe: "5min", strategyId: strategyIdFor(8), symbolIds: symbolIdsFor(8, 2), executionType: "arbitrage", returnPct: 39.21, sharpe: 1.55, maxDrawdownPct: -4.98, pnlSeries: pnlSeries(8, 0.7), pnlChartSeries: pnlChartSeries(8, 0.7), returnsChartSeries: returnsChartSeries(8) },
  { id: "HFT-XBHLm8E", strategyName: "High Frequency", strategyType: "HFT", status: "paused", accounts: ["DN-002"], symbols: [{ symbol: "NQ1!", market: "CME" }], timeframe: "5min", strategyId: strategyIdFor(9), symbolIds: symbolIdsFor(9, 1), executionType: "taker", returnPct: 110.57, sharpe: 2.4, maxDrawdownPct: -11.75, pnlSeries: pnlSeries(9, 1.2), pnlChartSeries: pnlChartSeries(9, 1.2), returnsChartSeries: returnsChartSeries(9) },
  { id: "HFT-QjXyM4N", strategyName: "Dividend Focus", strategyType: "HFT", status: "running", accounts: ["DN-001", "DN-002"], symbols: [CRYPTO_LEG, FUT_LEG], timeframe: "5min", strategyId: strategyIdFor(10), symbolIds: symbolIdsFor(10, 2), executionType: "arbitrage", returnPct: 29.87, sharpe: 1.2, maxDrawdownPct: -2.15, pnlSeries: pnlSeries(10, 0.6), pnlChartSeries: pnlChartSeries(10, 0.6), returnsChartSeries: returnsChartSeries(10) },
  { id: "MFT-Ab3Kd9P", strategyName: "Mean Reversion Alpha", strategyType: "MFT", status: "running", accounts: ["DN-003"], symbols: [{ symbol: "GOOGL", market: "NASDAQ" }], timeframe: "15min", strategyId: strategyIdFor(11), symbolIds: symbolIdsFor(11, 1), executionType: "maker", returnPct: 18.42, sharpe: 1.34, maxDrawdownPct: -5.2, pnlSeries: pnlSeries(11, 0.5), pnlChartSeries: pnlChartSeries(11, 0.5), returnsChartSeries: returnsChartSeries(11) },
  { id: "MFT-Nn5Rt7Y", strategyName: "Statistical Arbitrage", strategyType: "MFT", status: "running", accounts: ["DN-001", "DN-002"], symbols: [{ symbol: "VN30F1M", market: "VNFuture" }, { symbol: "VN30F2M", market: "VNFuture" }], timeframe: "1h", strategyId: strategyIdFor(12), symbolIds: symbolIdsFor(12, 2), executionType: "arbitrage", returnPct: 16.38, sharpe: 2.02, maxDrawdownPct: -3.51, pnlSeries: pnlSeries(12, 0.8), pnlChartSeries: pnlChartSeries(12, 0.8), returnsChartSeries: returnsChartSeries(12) },
  { id: "HFT-Pp2Vc6B", strategyName: "Liquidity Sniper", strategyType: "HFT", status: "failed", accounts: ["DN-002"], symbols: [{ symbol: "XRPUSD", market: "Crypto" }], timeframe: "15min", strategyId: strategyIdFor(13), symbolIds: symbolIdsFor(13, 1), executionType: "taker", returnPct: -9.84, sharpe: -1.15, maxDrawdownPct: -15.62, pnlSeries: pnlSeries(13, -1.1), pnlChartSeries: pnlChartSeries(13, -1.1), returnsChartSeries: returnsChartSeries(13) },
  { id: "MFT-Ww9Hg1F", strategyName: "Delta Neutral Hedge", strategyType: "MFT", status: "running", accounts: ["DN-003"], symbols: [{ symbol: "VN30F1M", market: "VNFuture" }], timeframe: "1h", strategyId: strategyIdFor(14), symbolIds: symbolIdsFor(14, 1), executionType: "maker", returnPct: 13.06, sharpe: 1.78, maxDrawdownPct: -4.15, pnlSeries: pnlSeries(14, 0.7), pnlChartSeries: pnlChartSeries(14, 0.7), returnsChartSeries: returnsChartSeries(14) },
  { id: "HFT-Zx8Qw2L", strategyName: "Grid Trading Bot", strategyType: "HFT", status: "running", accounts: ["DN-002"], symbols: [{ symbol: "SOLUSD", market: "Crypto" }], timeframe: "1min", strategyId: strategyIdFor(15), symbolIds: symbolIdsFor(15, 1), executionType: "taker", returnPct: 7.63, sharpe: 1.29, maxDrawdownPct: -5.88, pnlSeries: pnlSeries(15, 0.4), pnlChartSeries: pnlChartSeries(15, 0.4), returnsChartSeries: returnsChartSeries(15) },
  { id: "HFT-Kk4Ss3D", strategyName: "Order Flow Imbalance", strategyType: "HFT", status: "stopped", accounts: ["DN-002"], symbols: [{ symbol: "ADAUSD", market: "Crypto" }], timeframe: "5min", strategyId: strategyIdFor(16), symbolIds: symbolIdsFor(16, 1), executionType: "maker", returnPct: -1.18, sharpe: 0.08, maxDrawdownPct: -8.63, pnlSeries: pnlSeries(16, -0.2), pnlChartSeries: pnlChartSeries(16, -0.2), returnsChartSeries: returnsChartSeries(16) },
];

function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return h || 7;
}

// Deterministic per-run trade history — derived from the run id's seed on demand, since
// only the selected run's "Trades" tab ever needs it.
function buildTradeHistory(runId: string, count = 24): TradeHistoryRow[] {
  const seed = seedFromId(runId);
  const basePrice = 1300 + (seed % 50);
  let equity = 1_000_000_000 + seed * 137_000;
  const rows: TradeHistoryRow[] = [];
  for (let i = 0; i < count; i++) {
    const isBuy = Math.sin(seed + i * 0.9) >= 0;
    const price = Number((basePrice + Math.sin(seed + i * 0.4) * 15).toFixed(2));
    const size = Number((5 + Math.abs(Math.sin(seed + i * 1.3)) * 20).toFixed(2));
    const fee = Number((size * price * 0.0005).toFixed(2));
    const latencyMs = 5 + Math.round(Math.abs(Math.sin(seed + i * 0.6)) * 20);
    equity += (isBuy ? 1 : -1) * size * price * 0.1;
    const ts = Date.UTC(2026, 5, 11, 9, 20, 0) + i * 5 * 60_000 + Math.round(Math.abs(Math.sin(seed + i)) * 900);
    rows.push({
      id: `${runId}-T${i}`,
      time: new Date(ts).toISOString(),
      action: isBuy ? "Buy" : "Sell",
      role: i % 3 === 0 ? "Maker" : "Taker",
      price,
      size,
      fee,
      latencyMs,
      equity: Number(equity.toFixed(2)),
    });
  }
  return rows;
}

// Sample feature set for the Configuration tab (matches the Figma "6 variables" example).
const SAMPLE_FEATURES: FeatureDef[] = [
  { name: "Close", expression: "Close" },
  { name: "sma200", expression: "sma(close, 200)" },
  { name: "vwap_tp", expression: "vwap(high, low, close, volume)" },
  { name: "signal", expression: "zscore(close - vwap_tp, 30)" },
  { name: "atr14", expression: "atr(high, low, close, 14)" },
  { name: "atr_base", expression: "sma(atr(high, low, close, 14), 100)" },
];

// Synthesize the detail-tab payload from a list row's seed — keeps the 16 literals compact
// while giving each selected run stable, design-shaped metrics / config / code.
function buildDetail(r: PaperRunBase): Pick<PaperRunRow, "metrics" | "config" | "code"> {
  const seed = seedFromId(r.id);
  const isTick = r.timeframe === "tick";
  return {
    metrics: {
      netPnl: 100_000 + (seed % 90) * 1000,
      winRate: Number((45 + (seed % 20)).toFixed(2)),
      trades: 80 + (seed % 120),
      costDragPct: Number((15 + (seed % 20)).toFixed(2)),
      edgeNetBp: Number((0.4 + (seed % 12) / 10).toFixed(2)),
    },
    config: {
      mode: "Paper",
      data: isTick ? "Tick" : `Bar (${r.timeframe.replace("min", "m")})`,
      sourceHash: seed.toString(16).padStart(12, "0"),
      accountName: r.accounts[0] ?? "—",
      accountMeta: "DNSE · spot",
      accountRisk: "risk: No limits · fee: maker 0.018% / taker 0.045%",
      symbolsLabel: `${r.symbols.length} — ${r.symbols.map((s) => s.symbol).join(", ")}`,
      maxSliceSize: "1,000.00",
      twapInterval: "1000 ms",
      chaseThreshold: "100 ticks",
      entryOrderTtl: "0 ms",
      cancelRatio: "0.0%",
      simulatedLatency: "None",
      tradeProcessingCost: "0 ns",
      l2ProcessingCost: "0 ns",
      l2QueueCapacity: "64",
      tradeQueueCapacity: "64",
      features: SAMPLE_FEATURES,
    },
    code: SAMPLE_CODE,
  };
}

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const paperRunMocks = {
  async listPaperRuns(): Promise<PaperRunRow[]> {
    await delay();
    // Fresh copy — mirrors lib/mock/index.ts's listVenues comment: React Query needs a
    // new array reference to detect changes if this dataset is ever mutated.
    return MOCK_PAPER_RUNS.map((r) => ({ ...r, ...buildDetail(r), owner: "demo-user", startingEquity: 1_000_000 }));
  },
  async getTradeHistory(id: string): Promise<TradeHistoryRow[]> {
    await delay();
    return buildTradeHistory(id);
  },
};
