import type { StrategyType } from "@/types/domain";

// OWNED BY: Strategy List (Slice 4) agent.
// UI-only denormalized row shape for the Strategy List table — same convention as
// `LiveRunRow` in lib/mock/live-runs.ts (compose cleanly-typed enums with display strings).
// `status` is a strategy-lifecycle concept distinct from the run-lifecycle `RunStatus`
// (Strategy has no `status` field in the HFT spec), so it's a small UI-only union here.
export type StrategyStatus = "published" | "in_sample" | "completed";
export type StrategyGroup = "MFT" | "HFT";

export type StrategyRow = {
  id: string;
  name: string;
  status: StrategyStatus;
  statusUpdatedAt: string;
  market: string;
  universe: string;
  group: StrategyGroup;
  strategyType: StrategyType;
  timeframe: string;
  returnPct: number;
  sharpe: number;
  maxDrawdownPct: number;
  livePerfSeries: number[];
};

export type StrategyAnalytics = {
  portfolioPerformance: { categories: string[]; data: number[] };
  strategyPipeline: { categories: string[]; total: number[]; published: number[] };
  marketAllocation: { name: string; value: number }[];
};

// Deterministic pseudo-random walk (no Math.random) so chart data is stable across
// renders — same idiom as `pnlSeries` in lib/mock/live-runs.ts.
function series(seed: number, drift: number, points = 24): number[] {
  const out: number[] = [];
  let value = 0;
  for (let i = 0; i < points; i++) {
    value += drift + Math.sin(seed + i * 0.7) * Math.abs(drift) * 0.5;
    out.push(Number(value.toFixed(2)));
  }
  return out;
}

const MONTH_DAYS = Array.from({ length: 30 }, (_, i) => `${String(i + 1).padStart(2, "0")}/01/2026`);

function pipelineSeries(seed: number): { total: number[]; published: number[] } {
  const total: number[] = [];
  const published: number[] = [];
  for (let i = 0; i < 30; i++) {
    const t = 20 + Math.round(10 + 8 * Math.sin(seed + i * 0.4));
    const p = Math.max(0, t - (2 + Math.round(4 * Math.abs(Math.cos(seed + i * 0.3)))));
    total.push(t);
    published.push(p);
  }
  return { total, published };
}

export const MOCK_STRATEGIES: StrategyRow[] = [
  { id: "STR-001", name: "Sample Strategy 1", status: "published", statusUpdatedAt: "2025-09-05 13:38:00", market: "Vietnam", universe: "VN30", group: "MFT", strategyType: "taker", timeframe: "5min", returnPct: 134.22, sharpe: 1.82, maxDrawdownPct: -14.22, livePerfSeries: series(1, 1.4) },
  { id: "STR-002", name: "XNO Swing Trading", status: "completed", statusUpdatedAt: "2025-09-05 13:38:00", market: "Vietnam", universe: "VN30", group: "MFT", strategyType: "maker", timeframe: "1h", returnPct: 22.4, sharpe: 1.35, maxDrawdownPct: -8.61, livePerfSeries: series(2, 0.9) },
  { id: "STR-003", name: "Mean Reversion Strategy", status: "in_sample", statusUpdatedAt: "2025-09-05 13:38:00", market: "Vietnam", universe: "VN30", group: "MFT", strategyType: "arbitrage", timeframe: "15min", returnPct: -4.36, sharpe: -0.42, maxDrawdownPct: -11.28, livePerfSeries: series(3, -0.6) },
  { id: "STR-004", name: "Cash Flow Following", status: "completed", statusUpdatedAt: "2025-09-05 13:38:00", market: "Crypto", universe: "BTC/USDT", group: "HFT", strategyType: "maker", timeframe: "1D", returnPct: 18.5, sharpe: 1.11, maxDrawdownPct: -6.47, livePerfSeries: series(4, 0.5) },
  { id: "STR-005", name: "Basic Long/Short", status: "completed", statusUpdatedAt: "2025-09-05 13:38:00", market: "Vietnam", universe: "VN100", group: "MFT", strategyType: "taker", timeframe: "4h", returnPct: 9.91, sharpe: 0.98, maxDrawdownPct: -9.94, livePerfSeries: series(5, 0.5) },
  { id: "STR-006", name: "Ultimate Scalping", status: "published", statusUpdatedAt: "2025-09-05 13:38:00", market: "Crypto", universe: "ETH/USDT", group: "HFT", strategyType: "taker", timeframe: "1m", returnPct: 22.91, sharpe: 2.58, maxDrawdownPct: -2.94, livePerfSeries: series(6, 1.8) },
  { id: "STR-007", name: "Trend following pro", status: "published", statusUpdatedAt: "2025-09-05 13:38:00", market: "Vietnam", universe: "VN30", group: "MFT", strategyType: "taker", timeframe: "1h", returnPct: 14.27, sharpe: 1.94, maxDrawdownPct: -4.71, livePerfSeries: series(7, 1.1) },
  { id: "STR-008", name: "VN30 Calendar Spread Arb", status: "published", statusUpdatedAt: "2025-09-06 09:12:00", market: "Vietnam", universe: "VN30F1M", group: "HFT", strategyType: "arbitrage", timeframe: "5min", returnPct: 16.38, sharpe: 2.02, maxDrawdownPct: -3.51, livePerfSeries: series(8, 1.2) },
  { id: "STR-009", name: "Cross-Exchange Arb Crypto", status: "in_sample", statusUpdatedAt: "2025-09-06 09:12:00", market: "Crypto", universe: "SOL/USDT", group: "HFT", strategyType: "arbitrage", timeframe: "1h", returnPct: -2.67, sharpe: -0.28, maxDrawdownPct: -9.41, livePerfSeries: series(9, -0.4) },
  { id: "STR-010", name: "Volatility Harvest BTC", status: "published", statusUpdatedAt: "2025-09-06 09:12:00", market: "Crypto", universe: "BTC/USDT", group: "HFT", strategyType: "maker", timeframe: "4h", returnPct: 19.73, sharpe: 2.31, maxDrawdownPct: -3.09, livePerfSeries: series(10, 1.5) },
  { id: "STR-011", name: "Order Flow Imbalance ETH", status: "completed", statusUpdatedAt: "2025-09-06 09:12:00", market: "Crypto", universe: "ETH/USDT", group: "HFT", strategyType: "taker", timeframe: "5min", returnPct: 10.92, sharpe: 1.56, maxDrawdownPct: -4.59, livePerfSeries: series(11, 0.85) },
  { id: "STR-012", name: "Grid Trading Bot Crypto", status: "in_sample", statusUpdatedAt: "2025-09-06 09:12:00", market: "Crypto", universe: "SOL/USDT", group: "HFT", strategyType: "maker", timeframe: "1m", returnPct: 7.63, sharpe: 1.29, maxDrawdownPct: -5.88, livePerfSeries: series(12, 0.6) },
  { id: "STR-013", name: "Delta Neutral Hedge", status: "published", statusUpdatedAt: "2025-09-07 08:00:00", market: "Vietnam", universe: "VN30F1M", group: "HFT", strategyType: "arbitrage", timeframe: "1h", returnPct: 13.06, sharpe: 1.78, maxDrawdownPct: -4.15, livePerfSeries: series(13, 1.0) },
  { id: "STR-014", name: "Liquidity Sniper VN30", status: "completed", statusUpdatedAt: "2025-09-07 08:00:00", market: "Vietnam", universe: "VN30", group: "MFT", strategyType: "taker", timeframe: "15min", returnPct: -9.84, sharpe: -1.15, maxDrawdownPct: -15.62, livePerfSeries: series(14, -1.2) },
  { id: "STR-015", name: "Market Maker Lite", status: "in_sample", statusUpdatedAt: "2025-09-07 08:00:00", market: "Crypto", universe: "BTC/USDT", group: "HFT", strategyType: "maker", timeframe: "1m", returnPct: 2.14, sharpe: 0.55, maxDrawdownPct: -6.92, livePerfSeries: series(15, 0.15) },
  { id: "STR-016", name: "Breakout Hunter Altcoins", status: "published", statusUpdatedAt: "2025-09-07 08:00:00", market: "Crypto", universe: "ADA/USDT", group: "MFT", strategyType: "taker", timeframe: "1h", returnPct: 8.29, sharpe: 1.44, maxDrawdownPct: -5.36, livePerfSeries: series(16, 0.7) },
  { id: "STR-017", name: "Statistical Arbitrage Pro", status: "published", statusUpdatedAt: "2025-09-08 10:30:00", market: "Vietnam", universe: "VN100", group: "MFT", strategyType: "arbitrage", timeframe: "5min", returnPct: 20.05, sharpe: 2.14, maxDrawdownPct: -3.85, livePerfSeries: series(17, 1.4) },
  { id: "STR-018", name: "Momentum Breakout VN30", status: "completed", statusUpdatedAt: "2025-09-08 10:30:00", market: "Vietnam", universe: "VN30", group: "MFT", strategyType: "taker", timeframe: "1D", returnPct: 4.51, sharpe: 0.91, maxDrawdownPct: -4.88, livePerfSeries: series(18, 0.35) },
];

// Jagged % curve (~0–4%) for the Portfolio Performance line — matches the Figma chart.
function perfSeries(): number[] {
  const out: number[] = [];
  let value = 0.3;
  for (let i = 0; i < 30; i++) {
    // Gentle waves (smoothed by the chart) on a mild uptrend, ending near ~4%.
    value += Math.sin(i * 0.55) * 0.26 + Math.sin(i * 1.25) * 0.16 + 0.09;
    out.push(Number(Math.max(0, value).toFixed(3)));
  }
  return out;
}

export const STRATEGY_ANALYTICS: StrategyAnalytics = {
  portfolioPerformance: { categories: MONTH_DAYS, data: perfSeries() },
  strategyPipeline: { categories: MONTH_DAYS, ...pipelineSeries(1) },
  marketAllocation: [
    { name: "VN30", value: 30 },
    { name: "VNBank", value: 25 },
    { name: "No-Vin", value: 20 },
    { name: "VNRealEstate", value: 15 },
    { name: "Vin", value: 10 },
  ],
};

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const strategyMocks = {
  async listStrategies(): Promise<StrategyRow[]> {
    await delay();
    // Fresh copy — mirrors lib/mock/index.ts's listVenues comment: React Query needs a
    // new array reference to detect changes if this dataset is ever mutated.
    return [...MOCK_STRATEGIES];
  },
  async getStrategyAnalytics(): Promise<StrategyAnalytics> {
    await delay();
    return STRATEGY_ANALYTICS;
  },
};
