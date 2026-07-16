import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import type { EquityPoint, Run, RunSummary } from "@/types/domain";
import type { components } from "@/types/api/hft";

// Request body for `POST /api/runs` (simulate-modal's launch form).
// `otp_passcode` (DNSE live runs — see `POST /api/accounts/{id}/dnse/send-otp`) isn't in the
// generated schema yet — extended locally until the OpenAPI spec catches up.
//
// `backtest_range` likewise: the deployed spec declares the field but `$ref`s a
// `BacktestDateRange` schema it never defines (utoipa doesn't register the component), so
// `gen:types` can't emit it. Shape mirrors the server's `BacktestDateRange` — two `NaiveDate`s,
// which serde reads as "YYYY-MM-DD". Required for a bar-mode backtest and ignored otherwise;
// the server rejects start > end and any end in the future.
export type BacktestDateRange = { start_date: string; end_date: string };
export type LaunchRequest = components["schemas"]["LaunchRequest"] & {
  otp_passcode?: string;
  backtest_range?: BacktestDateRange;
};

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

// GAP-7: HFT has POST /api/runs/{id}/stop but no start/resume endpoint — "Start Bot" in
// live-runs-table.tsx stays disabled. "Stop Bot" calls this mutation via a confirm dialog.
export function useStopRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (USE_MOCK) return; // no mock run store to mutate — inert fallback so the confirm dialog still resolves
      await apiPost<Run>(`${HFT_API_URL}/api/runs/${id}/stop`, undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["live-runs"] });
      qc.invalidateQueries({ queryKey: ["paper-runs"] });
    },
  });
}

// simulate-modal's launch form — binds a strategy to an account + symbols and starts a
// paper/live run. No mock run store exists yet, so the mock branch resolves a minimally-shaped
// stub `Run` (mirrors useCreateHftStrategy's mock stub) instead of persisting anything.
export function useLaunchRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: LaunchRequest): Promise<Run> => {
      if (USE_MOCK) {
        const now = new Date().toISOString();
        return {
          id: crypto.randomUUID(),
          account_id: req.account_id,
          strategy_id: req.strategy_id,
          mode: req.mode,
          status: "running",
          created_at: now,
          updated_at: now,
          started_at: now,
          stopped_at: null,
          error: null,
          manifest: {
            account: {
              id: req.account_id,
              name: "",
              venue_id: "",
              venue_name: "",
              venue_type: "binance_spot",
              account_type: "spot",
            },
            strategy: { id: req.strategy_id, name: "", code: "", strategy_type: "taker" },
            symbols: [],
            mode: req.mode,
          },
        };
      }
      return apiPost<Run>(`${HFT_API_URL}/api/runs`, req);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["live-runs"] });
      qc.invalidateQueries({ queryKey: ["paper-runs"] });
    },
  });
}
