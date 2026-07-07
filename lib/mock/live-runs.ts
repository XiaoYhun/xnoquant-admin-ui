import type { RunStatus } from "@/types/domain";

// UI-only denormalized row shape for the Live Trading table — composes the cleanly-typed
// `status: RunStatus` with display-only fields, same convention as the UI-only `Portfolio`
// type in types/domain.ts. Accounts and symbols are arrays because the design shows rows
// bound to one OR two accounts / instruments (the taller rows).
export type LiveRunRow = {
  id: string;
  strategyName: string;
  alphaStatus: string;
  accounts: string[];
  symbols: { symbol: string; market: string }[];
  timeframe: string;
  status: RunStatus;
  pnlSeries: number[];
  returnPct: number;
  sharpe: number;
  maxDrawdownPct: number;
};

// Deterministic pseudo-random walk (no Math.random) so sparkline data is stable across
// renders. `drift` sets the overall up/down trend; the sin/cos terms add visible
// intra-series volatility so the mini PnL chart reads as a real equity curve, not a flat line.
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

export const MOCK_LIVE_RUNS: LiveRunRow[] = [
  { id: "MFT-5IWb3Ux", strategyName: "Sample Strategy 1", alphaStatus: "Live Trading", accounts: ["DN-002"], symbols: [{ symbol: "VN30F1M", market: "VNFuture" }], timeframe: "5min", status: "running", returnPct: 134.22, sharpe: 1.82, maxDrawdownPct: -14.22, pnlSeries: pnlSeries(1, 1.4) },
  { id: "MFT-D7AxNplR", strategyName: "Momentum Booster", alphaStatus: "Live Trading", accounts: ["DN-002"], symbols: [{ symbol: "AAPL", market: "NASDAQ" }], timeframe: "5min", status: "running", returnPct: 87.45, sharpe: 2.15, maxDrawdownPct: -5.87, pnlSeries: pnlSeries(2, 1.1) },
  { id: "HFT-LqJvB9C", strategyName: "Reversal Hunter", alphaStatus: "Live Trading", accounts: ["DN-002"], symbols: [{ symbol: "BTCUSD", market: "Crypto" }], timeframe: "5min", status: "paused", returnPct: 56.13, sharpe: 1.6, maxDrawdownPct: -7.34, pnlSeries: pnlSeries(3, 0.8) },
  { id: "MFT-2k9GYxS", strategyName: "Breakout Seeker", alphaStatus: "Live Trading", accounts: ["DN-001", "DN-002"], symbols: [{ symbol: "ETHUSD", market: "Crypto" }, { symbol: "VN30F2M", market: "VNFuture" }], timeframe: "5min", status: "paused", returnPct: 98.77, sharpe: 2.05, maxDrawdownPct: -10.12, pnlSeries: pnlSeries(4, 1.0) },
  { id: "HFT-f9PmYxQ", strategyName: "Trend Rider", alphaStatus: "Live Trading", accounts: ["DN-002"], symbols: [{ symbol: "TSLA", market: "NASDAQ" }], timeframe: "5min", status: "running", returnPct: 45.66, sharpe: 1.75, maxDrawdownPct: -3.88, pnlSeries: pnlSeries(5, 0.9) },
  { id: "HFT-3RxWyQJ", strategyName: "Volatility Scalper", alphaStatus: "Live Trading", accounts: ["DN-001", "DN-002"], symbols: [{ symbol: "ETHUSD", market: "Crypto" }, { symbol: "VN30F2M", market: "VNFuture" }], timeframe: "5min", status: "running", returnPct: 120.89, sharpe: 2.3, maxDrawdownPct: -12.5, pnlSeries: pnlSeries(6, 1.3) },
  { id: "HFT-Mvd2ZtW", strategyName: "Swing Master", alphaStatus: "Live Trading", accounts: ["DN-002"], symbols: [{ symbol: "MSFT", market: "NASDAQ" }], timeframe: "5min", status: "running", returnPct: 72.34, sharpe: 1.9, maxDrawdownPct: -6.45, pnlSeries: pnlSeries(7, 1.0) },
  { id: "MFT-Y7LwKmZ", strategyName: "Range Bound", alphaStatus: "Live Trading", accounts: ["DN-001", "DN-002"], symbols: [{ symbol: "ETHUSD", market: "Crypto" }, { symbol: "VN30F2M", market: "VNFuture" }], timeframe: "5min", status: "running", returnPct: 39.21, sharpe: 1.55, maxDrawdownPct: -4.98, pnlSeries: pnlSeries(8, 0.7) },
  { id: "HFT-XBHLm8E", strategyName: "High Frequency", alphaStatus: "Live Trading", accounts: ["DN-002"], symbols: [{ symbol: "NQ1!", market: "CME" }], timeframe: "5min", status: "paused", returnPct: 110.57, sharpe: 2.4, maxDrawdownPct: -11.75, pnlSeries: pnlSeries(9, 1.2) },
  { id: "HFT-QjXyM4N", strategyName: "Dividend Focus", alphaStatus: "Live Trading", accounts: ["DN-001", "DN-002"], symbols: [{ symbol: "ETHUSD", market: "Crypto" }, { symbol: "VN30F2M", market: "VNFuture" }], timeframe: "5min", status: "running", returnPct: 29.87, sharpe: 1.2, maxDrawdownPct: -2.15, pnlSeries: pnlSeries(10, 0.6) },
  { id: "MFT-Ab3Kd9P", strategyName: "Mean Reversion Alpha", alphaStatus: "Live Trading", accounts: ["DN-003"], symbols: [{ symbol: "GOOGL", market: "NASDAQ" }], timeframe: "15min", status: "running", returnPct: 18.42, sharpe: 1.34, maxDrawdownPct: -5.2, pnlSeries: pnlSeries(11, 0.5) },
  { id: "HFT-Zx8Qw2L", strategyName: "Grid Trading Bot", alphaStatus: "Live Trading", accounts: ["DN-002"], symbols: [{ symbol: "SOLUSD", market: "Crypto" }], timeframe: "1min", status: "running", returnPct: 7.63, sharpe: 1.29, maxDrawdownPct: -5.88, pnlSeries: pnlSeries(12, 0.4) },
  { id: "MFT-Nn5Rt7Y", strategyName: "Statistical Arb", alphaStatus: "Live Trading", accounts: ["DN-001", "DN-002"], symbols: [{ symbol: "VN30F1M", market: "VNFuture" }, { symbol: "VN30F2M", market: "VNFuture" }], timeframe: "1h", status: "running", returnPct: 16.38, sharpe: 2.02, maxDrawdownPct: -3.51, pnlSeries: pnlSeries(13, 0.8) },
  { id: "HFT-Pp2Vc6B", strategyName: "Liquidity Sniper", alphaStatus: "Live Trading", accounts: ["DN-002"], symbols: [{ symbol: "XRPUSD", market: "Crypto" }], timeframe: "15min", status: "failed", returnPct: -9.84, sharpe: -1.15, maxDrawdownPct: -15.62, pnlSeries: pnlSeries(14, -1.1) },
  { id: "MFT-Ww9Hg1F", strategyName: "Delta Neutral Hedge", alphaStatus: "Live Trading", accounts: ["DN-003"], symbols: [{ symbol: "VN30F1M", market: "VNFuture" }], timeframe: "1h", status: "running", returnPct: 13.06, sharpe: 1.78, maxDrawdownPct: -4.15, pnlSeries: pnlSeries(15, 0.7) },
  { id: "HFT-Kk4Ss3D", strategyName: "Order Flow Imbalance", alphaStatus: "Live Trading", accounts: ["DN-002"], symbols: [{ symbol: "ETHUSD", market: "Crypto" }], timeframe: "5min", status: "stopped", returnPct: -1.18, sharpe: 0.08, maxDrawdownPct: -8.63, pnlSeries: pnlSeries(16, -0.2) },
];

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const liveRunMocks = {
  async listLiveRuns(): Promise<LiveRunRow[]> {
    await delay();
    // Fresh copy — mirrors lib/mock/index.ts's listVenues comment: React Query needs a
    // new array reference to detect changes if this dataset is ever mutated.
    return [...MOCK_LIVE_RUNS];
  },
};
