import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import type { EquityPoint, Run, RunSummary } from "@/types/domain";

// Shared HFT `runs` fetchers used to compose useLiveRuns/usePaperRuns rows (Run + RunSummary +
// EquityPoint[] → LiveRunRow/PaperRunRow via lib/transform/runs.ts — see
// docs/plans/api-integration.md §4.C). Raw HFT payloads — no envelope, use apiGet/apiPost.

export function fetchRuns(): Promise<Run[]> {
  return apiGet<Run[]>(`${HFT_API_URL}/api/runs`);
}

export function fetchRunSummary(id: string): Promise<RunSummary> {
  return apiGet<RunSummary>(`${HFT_API_URL}/api/runs/${id}/summary`);
}

export function fetchRunEquity(id: string): Promise<EquityPoint[]> {
  return apiGet<EquityPoint[]>(`${HFT_API_URL}/api/runs/${id}/equity-curve`);
}

// Exposed for future row-level/lazy loading. The current live/paper tables consume
// fully-composed rows from useLiveRuns/usePaperRuns instead (their UI contract is frozen —
// see hooks/api/use-live-runs.ts), so nothing calls these yet.
export function useRunSummary(id: string | undefined) {
  return useQuery({
    queryKey: ["run-summary", id],
    queryFn: () => fetchRunSummary(id as string),
    enabled: !!id,
  });
}

export function useRunEquity(id: string | undefined) {
  return useQuery({
    queryKey: ["run-equity", id],
    queryFn: () => fetchRunEquity(id as string),
    enabled: !!id,
  });
}

// GAP-7: HFT has POST /api/runs/{id}/stop but no start/resume endpoint — "Start Bot" stays a
// no-op (live-runs-table.tsx already has no onClick for it). "Stop Bot" in the same table also
// has no onClick yet (UI file — out of this phase's scope); this mutation is ready for that
// wiring to call.
export function useStopRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (USE_MOCK) return; // no mock run store to mutate, and no UI wires this yet — inert fallback
      await apiPost<Run>(`${HFT_API_URL}/api/runs/${id}/stop`, undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["live-runs"] });
      qc.invalidateQueries({ queryKey: ["paper-runs"] });
    },
  });
}
