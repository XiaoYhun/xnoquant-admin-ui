import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiPost } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { Run } from "@/types/domain";
import type { PaperRunRow } from "@/lib/mock/paper-runs";
import { fetchRuns, type RunsQuery } from "./use-runs";
import { toPaperRunRow } from "@/lib/transform/runs";

// GAP-2: `GET /api/runs` has no `mode` filter — fetch a page, keep `mode==="backtest"`. Same shape
// as the paper list (toPaperRunRow), so the Strategy List reuses the paper-trading row contract.
// Per-run summary + equity stay deferred to the detail panel.
async function fetchBacktestRunRows(query: RunsQuery): Promise<PaperRunRow[]> {
  return (await fetchRuns(query)).filter((r) => r.mode === "backtest").map(toPaperRunRow);
}

// `query` goes to the server (`q` = strategy-name search, `status` = exact match). Paging stays
// client-side — see the GAP-2 note in use-runs.ts.
export function useBacktestRuns(query: RunsQuery = {}) {
  return useQuery({
    queryKey: ["backtest-runs", query.q ?? "", query.status ?? ""],
    queryFn: () => (USE_MOCK ? Promise.resolve<PaperRunRow[]>([]) : fetchBacktestRunRows(query)),
    placeholderData: (prev) => prev, // keep rows on screen while a new search resolves
  });
}

/**
 * `POST /api/runs/{id}/stop`. Owner-or-admin only — lab visibility doesn't grant stop access, so a
 * lab-mate's run 404s. 422 when the run isn't in a stoppable state.
 */
export function useStopRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Run>(`${HFT_API_URL}/api/runs/${id}/stop`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backtest-runs"] }),
  });
}

/**
 * `DELETE /api/runs/{id}`. Owner-or-admin only (lab visibility doesn't grant delete). The API
 * rejects paper and live runs with 422 — only backtest runs are deletable.
 */
export function useDeleteRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`${HFT_API_URL}/api/runs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backtest-runs"] }),
  });
}
