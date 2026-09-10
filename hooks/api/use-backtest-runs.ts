import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiPost } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { Run } from "@/types/domain";
import { PENDING_RUN_POLL_MS, fetchRunRowPage, type RunRowPage, type RunsQuery } from "./use-runs";

// Backtesting is `GET /api/runs?mode=backtest` — one server page, already narrowed, sorted and
// counted upstream. Rows share the paper row contract (toPaperRunRow), so the Strategy List and
// the paper detail panel read them unchanged. Per-run summary + equity stay deferred to the
// detail panel.
//
// `query` is the page's whole filter state; every field of it is served by the API. Paging is the
// caller's to drive: it passes `page` (0-indexed) and `size`, and measures the pager against the
// returned `total`.
export function useBacktestRuns(query: RunsQuery = {}) {
  return useQuery({
    queryKey: ["backtest-runs", query],
    queryFn: () =>
      USE_MOCK ? Promise.resolve<RunRowPage>({ rows: [], total: 0 }) : fetchRunRowPage({ ...query, mode: "backtest" }),
    placeholderData: (prev) => prev, // keep rows on screen while a new page or search resolves
    // A queued backtest is the only row on this screen that changes without the user doing
    // anything, so the list re-reads itself every 5s while one is on the loaded page — and only
    // then. Same cadence as the run record's own poll (see useRun).
    refetchInterval: (q) =>
      q.state.data?.rows.some((row) => row.status === "pending") ? PENDING_RUN_POLL_MS : false,
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
