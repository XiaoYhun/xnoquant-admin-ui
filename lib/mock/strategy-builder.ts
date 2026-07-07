// Mock data for the Create Strategy (HFT builder) screen — UI-only, no backend.

export const SAMPLE_CODE = `// MACD-ADX Trend Confirmation
// Enters with the MACD/signal cross, gated by ADX trend strength.

let fast = ema(last_price, 12);
let slow = ema(last_price, 26);
let macd = fast - slow;
let signal = ema(macd, 9);
let trend = adx(high, low, last_price, 14);

fn on_bar() {
    if macd > signal && trend > 25.0 {
        enter_long(1.0);
    } else if macd < signal && trend > 25.0 {
        enter_short(1.0);
    } else {
        close_all();
    }
}
`;

export type Metric = { label: string; value: string; positive?: boolean };
export const RESULT_METRICS: Metric[] = [
  { label: "Sharpe", value: "1.56" },
  { label: "Turnover", value: "2.58%" },
  { label: "Fitness", value: "0.88" },
  { label: "Returns", value: "4.85%", positive: true },
  { label: "Drawdown", value: "-12.5%", positive: false },
  { label: "Margin", value: "15.28%" },
];

export type YearRow = { year: string; sharpe: number; cagr: string; maxDd: string; profitFactor: number; calmar: number };
export const YEARLY_ROWS: YearRow[] = [
  { year: "2024", sharpe: 1.82, cagr: "+18.4%", maxDd: "-8.6%", profitFactor: 2.1, calmar: 2.14 },
  { year: "2023", sharpe: 1.45, cagr: "+12.1%", maxDd: "-11.3%", profitFactor: 1.8, calmar: 1.07 },
  { year: "2022", sharpe: 0.92, cagr: "-4.2%", maxDd: "-15.9%", profitFactor: 1.2, calmar: -0.26 },
  { year: "2021", sharpe: 2.05, cagr: "+27.8%", maxDd: "-9.1%", profitFactor: 2.4, calmar: 3.05 },
  { year: "2020", sharpe: 1.67, cagr: "+21.5%", maxDd: "-12.5%", profitFactor: 2.0, calmar: 1.72 },
  { year: "2019", sharpe: 1.31, cagr: "+9.7%", maxDd: "-7.4%", profitFactor: 1.6, calmar: 1.31 },
];

export type CorrRow = { name: string; universe: string; correlation: number; sharpe: number; returns: string };
export const CORRELATION_ROWS: CorrRow[] = [
  { name: "MACD_Strategy_V1", universe: "VN30", correlation: 0.92, sharpe: 1.45, returns: "+12.3%" },
  { name: "Trend_Rider_HFT", universe: "VN30F1M", correlation: 0.61, sharpe: 1.78, returns: "+18.9%" },
  { name: "Momentum_Booster", universe: "Crypto", correlation: 0.34, sharpe: 2.15, returns: "+24.1%" },
  { name: "Reversal_Hunter", universe: "VN100", correlation: 0.12, sharpe: 1.6, returns: "+9.4%" },
  { name: "Volatility_Scalper", universe: "Crypto", correlation: -0.28, sharpe: 2.3, returns: "+31.5%" },
  { name: "Mean_Reversion_A", universe: "VN30", correlation: -0.45, sharpe: 1.34, returns: "+7.8%" },
];

export const FEATURES: { name: string; desc: string }[] = [
  { name: "ema(price, n)", desc: "Exponential moving average" },
  { name: "sma(price, n)", desc: "Simple moving average" },
  { name: "rsi(price, 14)", desc: "Relative strength index" },
  { name: "macd(price)", desc: "Moving average convergence divergence" },
  { name: "adx(high, low, price, 14)", desc: "Average directional index" },
  { name: "atr(14)", desc: "Average true range" },
  { name: "bollinger(price, 20)", desc: "Bollinger bands" },
  { name: "vwap()", desc: "Volume-weighted average price" },
  { name: "stoch(14)", desc: "Stochastic oscillator" },
];

export const SAMPLES: { name: string; category: string; sharpe: number }[] = [
  { name: "MACD-ADX Trend Confirmation", category: "Trend following", sharpe: 1.56 },
  { name: "RSI Mean Reversion", category: "Mean reversion", sharpe: 1.21 },
  { name: "Bollinger Breakout", category: "Breakout", sharpe: 1.44 },
  { name: "VWAP Scalper", category: "Scalping", sharpe: 1.9 },
  { name: "Dual Momentum", category: "Momentum", sharpe: 1.68 },
  { name: "Pairs Arbitrage", category: "Arbitrage", sharpe: 2.05 },
];

// Deterministic PnL / returns series for the Results charts.
export const PNL_SERIES = Array.from({ length: 60 }, (_, i) => {
  let v = 0;
  for (let k = 0; k <= i; k++) v += 0.4 + Math.sin(k * 0.5) * 0.9 + Math.cos(k * 1.3) * 0.6;
  return Number(v.toFixed(2));
});
export const RETURNS_SERIES = Array.from({ length: 60 }, (_, i) =>
  Number((Math.sin(i * 0.9) * 1.4 + Math.sin(i * 0.31) * 0.8).toFixed(2)),
);
