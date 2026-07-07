import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { apiGet } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { StrategyRow, StrategyAnalytics } from "@/lib/mock/strategies";

export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: () => (USE_MOCK ? mockApi.listStrategies() : apiGet<StrategyRow[]>(`${HFT_API_URL}/api/strategies`)),
  });
}

export function useStrategyAnalytics() {
  return useQuery({
    queryKey: ["strategies", "analytics"],
    queryFn: () =>
      USE_MOCK ? mockApi.getStrategyAnalytics() : apiGet<StrategyAnalytics>(`${HFT_API_URL}/api/strategies/analytics`),
  });
}
