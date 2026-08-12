import {
  buildDetail,
  pnlChartSeries,
  returnsChartSeries,
  strategyIdFor,
  symbolIdsFor,
  type PaperRunBase,
  type PaperRunRow,
} from "./paper-runs";

// OWNED BY: Live Trading ("Live trade" screen).
// `useLiveRuns` consumes the same `PaperRunRow` shape as Paper Trading — the two tables share a
// row contract — so these literals are `PaperRunBase` and the detail-tab fields (metrics / config
// / code) come from paper-runs.ts's `buildDetail`. Every row is tagged `mode: "live"`, which is
// what makes the detail panel open its live variant (LiveHeaderBar + LiveChartsTab) and what
// gives the Configuration tab "Live" instead of "Paper".

// Deterministic pseudo-random walk (no Math.random) so sparkline data is stable across
// renders — same idiom as lib/mock/paper-runs.ts.
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

const CRYPTO_LEG = { symbol: "ETHUSD", market: "Crypto" };
const FUT_LEG = { symbol: "VN30F2M", market: "VNFuture" };

// Seeds are offset by 100 from the paper set so the two tables don't render identical curves.
// Statuses skew "running": a live basket is mostly working capital, with a couple of paused and
// one failed/stopped row to exercise every RunStatusPill tone and the "Only Running" filter.
export const MOCK_LIVE_RUNS: PaperRunBase[] = [
  { id: "MFT-5IWb3Ux", strategyName: "Sample Strategy 1", strategyType: "MFT", mode: "live", status: "running", accounts: ["DN-002"], symbols: [{ symbol: "VN30F1M", market: "VNFuture" }], timeframe: "5min", strategyId: strategyIdFor(101), symbolIds: symbolIdsFor(101, 1), executionType: "taker", returnPct: 134.22, sharpe: 1.82, maxDrawdownPct: -14.22, pnlSeries: pnlSeries(101, 1.4), pnlChartSeries: pnlChartSeries(101, 1.4), returnsChartSeries: returnsChartSeries(101) },
  { id: "MFT-D7AxNplR", strategyName: "Momentum Booster", strategyType: "MFT", mode: "live", status: "running", accounts: ["DN-002"], symbols: [{ symbol: "AAPL", market: "NASDAQ" }], timeframe: "5min", strategyId: strategyIdFor(102), symbolIds: symbolIdsFor(102, 1), executionType: "maker", returnPct: 87.45, sharpe: 2.15, maxDrawdownPct: -5.87, pnlSeries: pnlSeries(102, 1.1), pnlChartSeries: pnlChartSeries(102, 1.1), returnsChartSeries: returnsChartSeries(102) },
  // owner_id set to exercise the shared/not-mutable rendering in mock mode (P2.3).
  { id: "HFT-LqJvB9C", owner_id: "user-someone-else", strategyName: "Reversal Hunter", strategyType: "HFT", mode: "live", status: "paused", accounts: ["DN-002"], symbols: [{ symbol: "BTCUSD", market: "Crypto" }], timeframe: "5min", strategyId: strategyIdFor(103), symbolIds: symbolIdsFor(103, 1), executionType: "taker", returnPct: 56.13, sharpe: 1.6, maxDrawdownPct: -7.34, pnlSeries: pnlSeries(103, 0.8), pnlChartSeries: pnlChartSeries(103, 0.8), returnsChartSeries: returnsChartSeries(103) },
  { id: "MFT-2k9GYxS", strategyName: "Breakout Seeker", strategyType: "MFT", mode: "live", status: "paused", accounts: ["DN-001", "DN-002"], symbols: [CRYPTO_LEG, FUT_LEG], timeframe: "5min", strategyId: strategyIdFor(104), symbolIds: symbolIdsFor(104, 2), executionType: "arbitrage", returnPct: 98.77, sharpe: 2.05, maxDrawdownPct: -10.12, pnlSeries: pnlSeries(104, 1.0), pnlChartSeries: pnlChartSeries(104, 1.0), returnsChartSeries: returnsChartSeries(104) },
  { id: "HFT-f9PmYxQ", strategyName: "Trend Rider", strategyType: "HFT", mode: "live", status: "running", accounts: ["DN-002"], symbols: [{ symbol: "TSLA", market: "NASDAQ" }], timeframe: "5min", strategyId: strategyIdFor(105), symbolIds: symbolIdsFor(105, 1), executionType: "taker", returnPct: 45.66, sharpe: 1.75, maxDrawdownPct: -3.88, pnlSeries: pnlSeries(105, 0.9), pnlChartSeries: pnlChartSeries(105, 0.9), returnsChartSeries: returnsChartSeries(105) },
  { id: "HFT-3RxWyQJ", strategyName: "Volatility Scalper", strategyType: "HFT", mode: "live", status: "running", accounts: ["DN-001", "DN-002"], symbols: [CRYPTO_LEG, FUT_LEG], timeframe: "5min", strategyId: strategyIdFor(106), symbolIds: symbolIdsFor(106, 2), executionType: "arbitrage", returnPct: 120.89, sharpe: 2.3, maxDrawdownPct: -12.5, pnlSeries: pnlSeries(106, 1.3), pnlChartSeries: pnlChartSeries(106, 1.3), returnsChartSeries: returnsChartSeries(106) },
  { id: "HFT-Mvd2ZtW", strategyName: "Swing Master", strategyType: "HFT", mode: "live", status: "running", accounts: ["DN-002"], symbols: [{ symbol: "MSFT", market: "NASDAQ" }], timeframe: "5min", strategyId: strategyIdFor(107), symbolIds: symbolIdsFor(107, 1), executionType: "maker", returnPct: 72.34, sharpe: 1.9, maxDrawdownPct: -6.45, pnlSeries: pnlSeries(107, 1.0), pnlChartSeries: pnlChartSeries(107, 1.0), returnsChartSeries: returnsChartSeries(107) },
  { id: "MFT-Y7LwKmZ", strategyName: "Range Bound", strategyType: "MFT", mode: "live", status: "running", accounts: ["DN-001", "DN-002"], symbols: [CRYPTO_LEG, FUT_LEG], timeframe: "5min", strategyId: strategyIdFor(108), symbolIds: symbolIdsFor(108, 2), executionType: "arbitrage", returnPct: 39.21, sharpe: 1.55, maxDrawdownPct: -4.98, pnlSeries: pnlSeries(108, 0.7), pnlChartSeries: pnlChartSeries(108, 0.7), returnsChartSeries: returnsChartSeries(108) },
  { id: "HFT-XBHLm8E", strategyName: "High Frequency", strategyType: "HFT", mode: "live", status: "paused", accounts: ["DN-002"], symbols: [{ symbol: "NQ1!", market: "CME" }], timeframe: "5min", strategyId: strategyIdFor(109), symbolIds: symbolIdsFor(109, 1), executionType: "taker", returnPct: 110.57, sharpe: 2.4, maxDrawdownPct: -11.75, pnlSeries: pnlSeries(109, 1.2), pnlChartSeries: pnlChartSeries(109, 1.2), returnsChartSeries: returnsChartSeries(109) },
  { id: "HFT-QjXyM4N", strategyName: "Dividend Focus", strategyType: "HFT", mode: "live", status: "running", accounts: ["DN-001", "DN-002"], symbols: [CRYPTO_LEG, FUT_LEG], timeframe: "5min", strategyId: strategyIdFor(110), symbolIds: symbolIdsFor(110, 2), executionType: "arbitrage", returnPct: 29.87, sharpe: 1.2, maxDrawdownPct: -2.15, pnlSeries: pnlSeries(110, 0.6), pnlChartSeries: pnlChartSeries(110, 0.6), returnsChartSeries: returnsChartSeries(110) },
  { id: "MFT-Ab3Kd9P", strategyName: "Mean Reversion Alpha", strategyType: "MFT", mode: "live", status: "running", accounts: ["DN-003"], symbols: [{ symbol: "GOOGL", market: "NASDAQ" }], timeframe: "15min", strategyId: strategyIdFor(111), symbolIds: symbolIdsFor(111, 1), executionType: "maker", returnPct: 18.42, sharpe: 1.34, maxDrawdownPct: -5.2, pnlSeries: pnlSeries(111, 0.5), pnlChartSeries: pnlChartSeries(111, 0.5), returnsChartSeries: returnsChartSeries(111) },
  { id: "HFT-Zx8Qw2L", strategyName: "Grid Trading Bot", strategyType: "HFT", mode: "live", status: "running", accounts: ["DN-002"], symbols: [{ symbol: "SOLUSD", market: "Crypto" }], timeframe: "1min", strategyId: strategyIdFor(112), symbolIds: symbolIdsFor(112, 1), executionType: "taker", returnPct: 7.63, sharpe: 1.29, maxDrawdownPct: -5.88, pnlSeries: pnlSeries(112, 0.4), pnlChartSeries: pnlChartSeries(112, 0.4), returnsChartSeries: returnsChartSeries(112) },
  { id: "MFT-Nn5Rt7Y", strategyName: "Statistical Arbitrage", strategyType: "MFT", mode: "live", status: "running", accounts: ["DN-001", "DN-002"], symbols: [{ symbol: "VN30F1M", market: "VNFuture" }, FUT_LEG], timeframe: "1h", strategyId: strategyIdFor(113), symbolIds: symbolIdsFor(113, 2), executionType: "arbitrage", returnPct: 16.38, sharpe: 2.02, maxDrawdownPct: -3.51, pnlSeries: pnlSeries(113, 0.8), pnlChartSeries: pnlChartSeries(113, 0.8), returnsChartSeries: returnsChartSeries(113) },
  { id: "HFT-Pp2Vc6B", strategyName: "Liquidity Sniper", strategyType: "HFT", mode: "live", status: "failed", accounts: ["DN-002"], symbols: [{ symbol: "XRPUSD", market: "Crypto" }], timeframe: "15min", strategyId: strategyIdFor(114), symbolIds: symbolIdsFor(114, 1), executionType: "taker", returnPct: -9.84, sharpe: -1.15, maxDrawdownPct: -15.62, pnlSeries: pnlSeries(114, -1.1), pnlChartSeries: pnlChartSeries(114, -1.1), returnsChartSeries: returnsChartSeries(114) },
  { id: "MFT-Ww9Hg1F", strategyName: "Delta Neutral Hedge", strategyType: "MFT", mode: "live", status: "running", accounts: ["DN-003"], symbols: [{ symbol: "VN30F1M", market: "VNFuture" }], timeframe: "1h", strategyId: strategyIdFor(115), symbolIds: symbolIdsFor(115, 1), executionType: "maker", returnPct: 13.06, sharpe: 1.78, maxDrawdownPct: -4.15, pnlSeries: pnlSeries(115, 0.7), pnlChartSeries: pnlChartSeries(115, 0.7), returnsChartSeries: returnsChartSeries(115) },
  { id: "HFT-Kk4Ss3D", strategyName: "Order Flow Imbalance", strategyType: "HFT", mode: "live", status: "stopped", accounts: ["DN-002"], symbols: [CRYPTO_LEG], timeframe: "5min", strategyId: strategyIdFor(116), symbolIds: symbolIdsFor(116, 1), executionType: "maker", returnPct: -1.18, sharpe: 0.08, maxDrawdownPct: -8.63, pnlSeries: pnlSeries(116, -0.2), pnlChartSeries: pnlChartSeries(116, -0.2), returnsChartSeries: returnsChartSeries(116) },
];

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const liveRunMocks = {
  async listLiveRuns(): Promise<PaperRunRow[]> {
    await delay();
    // Fresh copy — mirrors lib/mock/index.ts's listVenues comment: React Query needs a
    // new array reference to detect changes if this dataset is ever mutated.
    return MOCK_LIVE_RUNS.map((r) => ({ ...r, ...buildDetail(r), owner: "demo-user", startingEquity: 1_000_000 }));
  },
};
