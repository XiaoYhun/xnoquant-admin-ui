import { useQuery } from "@tanstack/react-query";
import { USE_MOCK } from "@/lib/constant";
import type { Run } from "@/types/domain";
import { fetchRuns } from "./use-runs";

// Runs belonging to one strategy, newest first — backs the Results tab's run-history picker and
// the Strategy List's promotion gates.
//
// `GET /api/runs` has no strategy filter, so this fetches the caller-visible list and narrows it,
// the same shape as use-backtest-runs / use-live-runs. The cache entry is deliberately keyed
// WITHOUT the strategy id and holds that unfiltered list: Strategy List mounts one of these per
// row, and a per-strategy key made each row its own cache entry that re-fetched the whole list —
// twelve identical `?size=200` requests for one screen. One shared entry, and `select` narrows it
// per subscriber.
export function useStrategyRuns(strategyId: string | undefined) {
  return useQuery({
    queryKey: ["strategy-runs"],
    queryFn: async (): Promise<Run[]> => (USE_MOCK ? [] : fetchRuns()),
    enabled: !!strategyId,
    select: (runs) =>
      runs
        .filter((r) => r.strategy_id === strategyId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
  });
}
