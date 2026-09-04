import { useQuery } from "@tanstack/react-query";
import { apiGetData } from "@/lib/api-client";
import { USE_MOCK, XALPHA_API_URL } from "@/lib/constant";
import type { components } from "@/types/api/xalpha";

// Create Strategy "Performance" tab (MFT) — XALPHA envelope, unwrap `.data` via apiGetData.
// Ported from xno-builder's strategy "Performance" tab (Transaction Analysis / Performance
// Metrics / Advanced Metrics stat cards).
export type StrategyPerformanceDetail = components["schemas"]["models.StrategyPerformanceDetail"];

// This endpoint now feeds the metric panel on five of the six MFT Results screens, so the mock
// carries a full payload rather than `{}` — an empty object left every one of those panels reading
// "—" and made mock mode useless for checking them. Ratios, matching the real API's units.
const MOCK_PERFORMANCE: StrategyPerformanceDetail = {
  analysis: {
    start_value: 1_000_000_000,
    end_value: 1_184_000_000,
    total_return: 0.184,
    total_fee: 0.0212,
    total_trades: 1_246,
    total_closed_trades: 1_231,
    total_open_trades: 15,
    best_trade: 0.0642,
    worst_trade: -0.0389,
    avg_win_trade: 0.0121,
    avg_loss_trade: -0.0084,
    avg_win_trade_duration: 4.2,
    avg_loss_trade_duration: 2.8,
    open_trade_pnl: 3_400_000,
    benchmark_return: 0.092,
  },
  performance: {
    cumulative_return: 0.184,
    annual_return: 0.1341,
    avg_return: 0.0006,
    volatility: 0.1608,
    sharpe: 1.82,
    sortino: 2.41,
    calmar: 1.55,
    max_drawdown: -0.0864,
    win_rate: 0.541,
    profit_factor: 1.74,
    win_loss_ratio: 1.44,
    recovery_factor: 2.13,
    kelly_criterion: 0.0991,
    omega: 1.32,
    ulcer_index: 0.041,
    var: -0.0182,
    cvar: -0.0271,
    tail_ratio: 1.08,
    gain_to_pain_ratio: 0.87,
  },
};

export function useStrategyPerformance(strategyId?: string, stage?: string) {
  return useQuery({
    queryKey: ["strategy-results", "performance", strategyId, stage],
    queryFn: async (): Promise<StrategyPerformanceDetail> => {
      if (USE_MOCK) return MOCK_PERFORMANCE;
      return apiGetData<StrategyPerformanceDetail>(
        `${XALPHA_API_URL}/strategies/${strategyId}/stages/${stage}/performance`,
      );
    },
    // `USE_MOCK ||` matches the sibling hooks in use-strategy-results: an un-simulated strategy has
    // no id, and without this the mock payload above could never be reached.
    enabled: USE_MOCK || (!!strategyId && !!stage),
  });
}
