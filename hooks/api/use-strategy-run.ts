import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGetData, apiPostData } from "@/lib/api-client";
import { USE_MOCK, XALPHA_API_URL, XALPHA_API_URL_V2 } from "@/lib/constant";
import type { components } from "@/types/api/xalpha";

export type StrategyInfo = components["schemas"]["models.StrategyInfo"];
export type StrategyProgress = components["schemas"]["models.StrategyProgress"];

const RUNNING_STATUSES = ["running", "queued", "evaluating", "waiting"];
export function isRunningStatus(status?: string): boolean {
  return !!status && RUNNING_STATUSES.includes(status);
}

const MOCK_STRATEGY: StrategyInfo = { status: "completed" };
const MOCK_PROGRESS: StrategyProgress = { progress_percentage: 100 };

// GET /xalpha-api/v1/strategies/{id} — polls every 3s while the strategy is running/queued/
// evaluating/waiting, stops once it reaches a terminal status (mirrors xno-builder's
// useStrategyDataById `refreshInterval`, minus the slow 60s tail poll — not needed here since the
// Results panel already re-polls on remount).
export function useStrategyById(id?: string) {
  return useQuery({
    queryKey: ["strategy-run", "strategy", id],
    queryFn: async (): Promise<StrategyInfo> => {
      if (USE_MOCK) return MOCK_STRATEGY;
      return apiGetData<StrategyInfo>(`${XALPHA_API_URL}/strategies/${id}`);
    },
    enabled: !!id,
    refetchInterval: (query) => (isRunningStatus(query.state.data?.status) ? 3000 : false),
  });
}

// GET /xalpha-api/v2/strategies/{id}/progress — only mounted by <RunningSimulateScreen>, which
// itself is only rendered while the strategy is running-ish, so polling naturally stops once the
// parent switches away.
export function useStrategyProgress(id?: string) {
  return useQuery({
    queryKey: ["strategy-run", "progress", id],
    queryFn: async (): Promise<StrategyProgress> => {
      if (USE_MOCK) return MOCK_PROGRESS;
      return apiGetData<StrategyProgress>(`${XALPHA_API_URL_V2}/strategies/${id}/progress`);
    },
    enabled: !!id,
    refetchInterval: 3000,
  });
}

// POST /xalpha-api/v2/strategies/{id}/cancel — invalidates the strategy + progress queries so the
// gating in mft-results-view picks up the CANCELED status.
export function useCancelStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPostData<Record<string, never>>(`${XALPHA_API_URL_V2}/strategies/${id}/cancel`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["strategy-run", "strategy", id] });
      qc.invalidateQueries({ queryKey: ["strategy-run", "progress", id] });
    },
  });
}
