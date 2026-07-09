import { useQuery } from "@tanstack/react-query";
import { apiGetData } from "@/lib/api-client";
import { USE_MOCK, XALPHA_API_URL } from "@/lib/constant";
import type { components } from "@/types/api/xalpha";

// Create Strategy "Analysis" tab (MFT) — XALPHA envelope, unwrap `.data` via apiGetData.
// Ported from xno-builder's strategy "Analysis" tab (IS Testing Status + Event Analytics).
export type StrategyEvaluationData = components["schemas"]["models.StrategyEvaluationData"];
export type EvaluationRecord = components["schemas"]["models.EvaluationRecord"];
export type StrategyEventScore = components["schemas"]["models.StrategyEventScore"];
export type StrategyEventCorrelationItem = components["schemas"]["models.StrategyEventCorrelationItem"];
export type StrategyEventComparisonResult = components["schemas"]["models.StrategyEventComparisonResult"];
export type ComparisonTimeSeriesResult = components["schemas"]["models.ComparisonTimeSeriesResult"];

// GET /xalpha-api/v1/strategies/{id}/stages/simulate/evaluations — stage hardcoded to `simulate`
// (Testing Status card always evaluates the simulate stage regardless of the Results tab's
// selected stage).
export function useStrategyEvaluations(strategyId?: string) {
  return useQuery({
    queryKey: ["strategy-analysis", "evaluations", strategyId],
    queryFn: async (): Promise<StrategyEvaluationData> => {
      if (USE_MOCK) return {} as StrategyEvaluationData;
      return apiGetData<StrategyEvaluationData>(
        `${XALPHA_API_URL}/strategies/${strategyId}/stages/simulate/evaluations`,
      );
    },
    enabled: !!strategyId,
  });
}

export function useStrategyCorrelation(strategyId?: string, eventId?: string, enabled = true) {
  return useQuery({
    queryKey: ["strategy-analysis", "correlation", strategyId, eventId],
    queryFn: async (): Promise<StrategyEventScore> => {
      if (USE_MOCK) return {} as StrategyEventScore;
      return apiGetData<StrategyEventScore>(
        `${XALPHA_API_URL}/strategies/${strategyId}/events/${eventId}/correlation`,
      );
    },
    enabled: !!strategyId && !!eventId && enabled,
  });
}

export function useStrategyComparison(strategyId?: string, eventId?: string) {
  return useQuery({
    queryKey: ["strategy-analysis", "comparison", strategyId, eventId],
    queryFn: async (): Promise<StrategyEventComparisonResult> => {
      if (USE_MOCK) return {} as StrategyEventComparisonResult;
      return apiGetData<StrategyEventComparisonResult>(
        `${XALPHA_API_URL}/strategies/${strategyId}/events/${eventId}/comparison`,
      );
    },
    enabled: !!strategyId && !!eventId,
  });
}
