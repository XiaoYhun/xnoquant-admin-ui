// Mock data for the Create Strategy (HFT builder) screen — UI-only, no backend.

export const SAMPLE_CODE = `from src.algo import StockAlgorithm


class MyAlgorithm(StockAlgorithm):
    def __setup_data__(self):
        """Setup additional data fields if needed."""

    def __generate_signals__(self):
        # Indicators
        rsi = self.feat.rsi()
        adx = self.feat.adx()

        # The logical AND operator can be used directly by using \`&\` or \`self.And()\`
        buy_signal = (self.op.current(rsi) > self.op.previous(rsi)) & \\
            (self.op.current(adx) < self.op.previous(adx))

        # You can also use \`self.And()\` for logical AND
        sell_signal = self.op.And(self.op.current(rsi) < self.op.previous(rsi),
            self.op.current(adx) > self.op.previous(adx))

        # Set the buy and sell signals
        self.buy(buy_signal, 1)
        self.sell(sell_signal, 1)
`;

export const SAMPLE_CODE_2 = `from src.algo import StockAlgorithm


class CryptoScalping(StockAlgorithm):
    def __generate_signals__(self):
        rsi = self.feat.rsi(window=14)
        upper, lower = self.feat.bollinger(window=20)

        self.buy((self.op.current(rsi) < 30) & (self.op.current(self.close) < lower), 0.5)
        self.sell((self.op.current(rsi) > 70) & (self.op.current(self.close) > upper), 0.5)
`;

// The open-editor tabs (would come from an API in production).
// `strategy_ids` (from XALPHA `StrategyEditorInfo`) resolves which strategy's Results tab to show.
// `type` distinguishes MFT (XALPHA editors) from HFT (HFT strategies) tabs.
export type EditorTab = { id: string; name: string; code: string; strategy_ids?: string[]; type: "mft" | "hft" };
export const INITIAL_EDITORS: EditorTab[] = [
  { id: "ed-1", name: "Test bot AI", code: SAMPLE_CODE, type: "mft" },
  { id: "ed-2", name: "Crypto Scalping", code: SAMPLE_CODE_2, type: "mft" },
];

export const OPERATORS: { name: string; desc: string }[] = [
  { name: "if / else", desc: "Conditional branch" },
  { name: "&& · ||", desc: "Logical and / or" },
  { name: "> · < · >= · <=", desc: "Comparison operators" },
  { name: "+ · - · * · /", desc: "Arithmetic operators" },
  { name: "crossover(a, b)", desc: "a crosses above b" },
  { name: "crossunder(a, b)", desc: "a crosses below b" },
  { name: "abs(x)", desc: "Absolute value" },
  { name: "min(a, b) · max(a, b)", desc: "Minimum / maximum" },
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
