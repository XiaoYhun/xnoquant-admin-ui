import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, retryUnlessForbidden } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import { normalizeCostCurve, type CostPoint } from "@/lib/cost-curve";
import { normalizeTurnover, type TurnoverPoint } from "@/lib/turnover-curve";
import type { EquityPoint, Run, RunPage, RunSummary } from "@/types/domain";
import type { components } from "@/types/api/hft";

export type { TurnoverPoint, CostPoint };

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

export type ExecutionSettings = components["schemas"]["ExecutionSettings"];
// `imbalance_depth` is in the deployed spec (nullable integer ≥ 0: top order-book levels
// aggregated per side for the `imbalance_n` feature, engine default 10) but not in the checked-in
// generated types, which predate it. Declared here so the launch form can send it; drop this line
// once `npm run gen:types` has been re-run against the current spec.
export type LaunchRequest = Omit<components["schemas"]["LaunchRequest"], "execution"> & {
  execution?: ExecutionSettings | null;
  otp_passcode?: string;
  backtest_range?: BacktestDateRange;
  imbalance_depth?: number | null;
};

// Shared HFT `runs` fetchers used to compose useLiveRuns/usePaperRuns rows (Run + RunSummary +
// EquityPoint[] → LiveRunRow/PaperRunRow via lib/transform/runs.ts — see
// docs/plans/api-integration.md §4.C). Raw HFT payloads — no envelope, use apiGet/apiPost.

// `GET /api/runs` is paged: it returns `RunPage { runs, total, page, size }`, and supports
// `q` (case-insensitive strategy-NAME search), `status` (exact), `page` (0-indexed) and
// `size` (default 100, max 200).
export const RUNS_MAX_PAGE_SIZE = 200;

export type RunsQuery = { q?: string; status?: string; page?: number; size?: number };

export async function fetchRunsPage(params: RunsQuery = {}): Promise<RunPage> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.page != null) search.set("page", String(params.page));
  if (params.size != null) search.set("size", String(params.size));
  const qs = search.toString();
  const page = await apiGet<RunPage>(`${HFT_API_URL}/api/runs${qs ? `?${qs}` : ""}`);
  // Guard the contract: callers map over `runs` immediately, so a malformed payload should
  // render empty rather than take the page down.
  return { runs: Array.isArray(page?.runs) ? page.runs : [], total: page?.total ?? 0, page: page?.page ?? 0, size: page?.size ?? 0 };
}

// GAP-2 (still open): `/api/runs` has no `mode` filter, so the Paper/Live screens must split
// modes client-side and therefore can't page server-side — a server page would mix modes and
// report a `total` for both. They request the largest page instead and paginate locally.
export async function fetchRuns(params: RunsQuery = {}): Promise<Run[]> {
  const page = await fetchRunsPage({ size: RUNS_MAX_PAGE_SIZE, ...params });
  return page.runs;
}

export function fetchRunSummary(id: string): Promise<RunSummary> {
  return apiGet<RunSummary>(`${HFT_API_URL}/api/runs/${id}/summary`);
}

export function fetchRunEquity(id: string): Promise<EquityPoint[]> {
  return apiGet<EquityPoint[]>(`${HFT_API_URL}/api/runs/${id}/equity-curve`);
}

// All runs, unfiltered — the Alpha pool joins each live-basket member to the run named by its
// `based_on_run_id` (a paper *or* backtest run), so it can't use the mode-filtered hooks.
export function useRuns() {
  return useQuery({
    queryKey: ["runs"],
    queryFn: () => (USE_MOCK ? Promise.resolve<Run[]>([]) : fetchRuns()),
  });
}

// Exposed for future row-level/lazy loading. The current live/paper tables consume
// fully-composed rows from useLiveRuns/usePaperRuns instead (their UI contract is frozen —
// see hooks/api/use-live-runs.ts), so nothing calls these yet.
export function useRunSummary(id: string | undefined) {
  return useQuery({
    queryKey: ["run-summary", id],
    queryFn: () => fetchRunSummary(id as string),
    enabled: !!id,
    // The dev summary/equity endpoints 500 intermittently; keep retries (they recover) but with a
    // short fixed backoff so the detail panel's "Loading results…" settles in ~1s rather than the
    // default exponential ~7s. 403/404 still fail fast — see retryUnlessForbidden.
    retry: retryUnlessForbidden,
    retryDelay: 400,
  });
}

export function useRunEquity(id: string | undefined) {
  return useQuery({
    queryKey: ["run-equity", id],
    queryFn: () => fetchRunEquity(id as string),
    enabled: !!id,
    retry: retryUnlessForbidden,
    retryDelay: 400,
  });
}

/**
 * One run record (status + manifest). Unlike the result endpoints this answers 200 for a *running*
 * run, so it's the only place a live view can learn the run's symbol names — live/stream frames
 * carry the dense `symbol_id` and never the ticker.
 */
export function useRun(id: string | undefined) {
  return useQuery({
    queryKey: ["run", id],
    queryFn: () => apiGet<Run>(`${HFT_API_URL}/api/runs/${id}`),
    enabled: !!id && !USE_MOCK,
    retry: retryUnlessForbidden,
  });
}

/** `symbol_id` → ticker, off a run's manifest. Empty until the run record resolves. */
export function symbolNamesOf(run: Run | undefined): Record<number, string> {
  const out: Record<number, string> = {};
  for (const s of run?.manifest?.symbols ?? []) {
    if (typeof s.symbol_id === "number" && s.symbol) out[s.symbol_id] = s.symbol;
  }
  return out;
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
          owner_id: "",
          account_id: req.account_id,
          strategy_id: req.strategy_id,
          mode: req.mode,
          status: "running",
          created_at: now,
          updated_at: now,
          started_at: now,
          stopped_at: null,
          error: null,
          in_session_blackout: false,
          needs_otp: false,
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

// `GET /api/runs/{id}/turnover-curve` is undocumented: it is absent from the OpenAPI spec, so
// `gen:types` can't emit a type for it, but it is live on the API. Verified against dev — it
// returns 200 with a JSON array and reads the same `pnl-*.parquet` the equity curve does (a run
// with a zero-byte parquet fails both with an identical error). Response shape is normalized
// defensively in `lib/turnover-curve.ts` because the contract isn't in OpenAPI.

export async function fetchRunTurnover(id: string): Promise<TurnoverPoint[]> {
  const raw = await apiGet<unknown>(`${HFT_API_URL}/api/runs/${id}/turnover-curve`);
  return normalizeTurnover(raw);
}

export function useRunTurnover(id: string | undefined) {
  return useQuery({
    queryKey: ["run-turnover", id],
    queryFn: () => fetchRunTurnover(id as string),
    enabled: !!id,
    retry: retryUnlessForbidden,
    retryDelay: 400,
  });
}

// `GET /api/runs/{id}/cost-curve` — live OpenAPI `CostPoint { ts, fee, cumulative }`. Same parquet
// source as equity/turnover; many runs currently answer `[]` even when equity has points.
export async function fetchRunCostCurve(id: string): Promise<CostPoint[]> {
  const raw = await apiGet<unknown>(`${HFT_API_URL}/api/runs/${id}/cost-curve`);
  return normalizeCostCurve(raw);
}

export function useRunCostCurve(id: string | undefined) {
  return useQuery({
    queryKey: ["run-cost-curve", id],
    queryFn: () => fetchRunCostCurve(id as string),
    enabled: !!id,
    retry: retryUnlessForbidden,
    retryDelay: 400,
  });
}
