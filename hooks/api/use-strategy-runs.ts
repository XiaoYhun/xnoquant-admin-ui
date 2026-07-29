import { useQuery } from "@tanstack/react-query";
import { USE_MOCK } from "@/lib/constant";
import type { Run } from "@/types/domain";
import { fetchRuns } from "./use-runs";

// Runs belonging to one strategy, newest first — backs the Results tab's run-history picker.
// `GET /api/runs` has no strategy filter, so this fetches the caller-visible list and narrows it,
// the same shape as use-backtest-runs / use-live-runs.
export function useStrategyRuns(strategyId: string | undefined) {
  return useQuery({
    queryKey: ["strategy-runs", strategyId],
    queryFn: async (): Promise<Run[]> => {
      if (USE_MOCK) return [];
      const runs = await fetchRuns();
      return runs
        .filter((r) => r.strategy_id === strategyId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
    enabled: !!strategyId,
  });
}
