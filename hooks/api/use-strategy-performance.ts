import { useQuery } from "@tanstack/react-query";
import { apiGetData } from "@/lib/api-client";
import { USE_MOCK, XALPHA_API_URL } from "@/lib/constant";
import type { components } from "@/types/api/xalpha";

// Create Strategy "Performance" tab (MFT) — XALPHA envelope, unwrap `.data` via apiGetData.
// Ported from xno-builder's strategy "Performance" tab (Transaction Analysis / Performance
// Metrics / Advanced Metrics stat cards).
export type StrategyPerformanceDetail = components["schemas"]["models.StrategyPerformanceDetail"];

export function useStrategyPerformance(strategyId?: string, stage?: string) {
  return useQuery({
    queryKey: ["strategy-results", "performance", strategyId, stage],
    queryFn: async (): Promise<StrategyPerformanceDetail> => {
      if (USE_MOCK) return {} as StrategyPerformanceDetail;
      return apiGetData<StrategyPerformanceDetail>(
        `${XALPHA_API_URL}/strategies/${strategyId}/stages/${stage}/performance`,
      );
    },
    enabled: !!strategyId && !!stage,
  });
}
