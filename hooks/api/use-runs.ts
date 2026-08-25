import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, retryUnlessForbidden } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import { normalizeCostCurve, type CostPoint } from "@/lib/cost-curve";
import { normalizeTurnover, type TurnoverPoint } from "@/lib/turnover-curve";
import type { EquityPoint, Run, RunPage, RunSummary } from "@/types/domain";
import { settlementCurrencyOf } from "@/lib/transform/runs";
import type { components } from "@/types/api/hft";

export type { TurnoverPoint, CostPoint };

// Request body for `POST /api/runs` (simulate-modal's launch form). `otp_passcode`,
// `backtest_range` and `imbalance_depth` used to be declared by hand here because the checked-in
// schema predated them; the regenerated spec carries all three, so this is a plain re-export now.
export type BacktestDateRange = components["schemas"]["BacktestDateRange"];
export type ExecutionSettings = components["schemas"]["ExecutionSettings"];
export type LaunchRequest = components["schemas"]["LaunchRequest"];

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

// All runs, unfiltered — the Alpha pool joins each promotion to the run named by its
// `based_on_run_id` (a paper *or* backtest run), so it can't use the mode-filtered hooks.
export function useRuns() {
  return useQuery({
    queryKey: ["runs"],
    queryFn: () => (USE_MOCK ? Promise.resolve<Run[]>([]) : fetchRuns()),
  });
}

/**
 * Currently-running runs. The Risk screen's Strategy column has no field on the risk API, so it
 * is derived from these by joining `manifest.account.id` — which also means it only describes
 * what is running *now*, not what was running when a past audit event fired.
 */
export function useRunningRuns() {
  return useQuery({
    queryKey: ["runs", "running"],
    queryFn: () => fetchRuns({ status: "running" }),
    enabled: !USE_MOCK,
  });
}

/** `account_id` → the names of the strategies it is currently running, in first-seen order. */
export function strategiesByAccount(runs: Run[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const run of runs) {
    const name = run.manifest?.strategy?.name;
    if (!name) continue;
    // Arbitrage binds a second account as leg 2; both are running this strategy.
    for (const account of [run.manifest.account, ...(run.manifest.extra_accounts ?? [])]) {
      if (!account?.id) continue;
      const seen = out.get(account.id) ?? [];
      if (!seen.includes(name)) out.set(account.id, [...seen, name]);
    }
  }
  return out;
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

/**
 * The currency a run accounts in, for the Results views — they receive only a `runId`, so the
 * manifest has to be fetched. Rides the shared ["run", id] query, so the six views (and anything
 * else already reading that key) cost one request between them.
 *
 * Defaults to USDT until the record resolves: the crypto venues are the common case, and a
 * momentary "USDT" that settles to "VND" reads better than a bare number with no unit.
 */
export function useRunCurrency(runId: string | undefined): string {
  const { data } = useRun(runId);
  return data?.manifest ? settlementCurrencyOf(data.manifest) : "USDT";
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

// `GET /api/strategies/{id}/last-run-config` — the manifest of the caller's OWN most recent run of
// this strategy, or `null` if they have never run it. It exists so the simulate dialog can reopen
// on the configuration the user last launched instead of blank defaults. The server scopes it to
// [caller, strategy] regardless of RBAC scope: this is a personal convenience, so a lab-mate's run
// of the same strategy never leaks through it even under Lab/All scope.
export type RunManifest = components["schemas"]["RunManifest"];

export function useLastRunConfig(strategyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["last-run-config", strategyId],
    queryFn: () => apiGet<RunManifest | null>(`${HFT_API_URL}/api/strategies/${strategyId}/last-run-config`),
    enabled: enabled && !!strategyId && !USE_MOCK,
    retry: retryUnlessForbidden,
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
    onSuccess: (run) => {
      // `POST /api/runs` answers with the created Run, so the Results tab's run-history picker can
      // show it before any refetch lands — the list is derived from `GET /api/runs`, which is
      // eventually consistent and would otherwise leave the picker a beat behind the launch.
      // Seeded only when the query already exists: writing into a key nothing has fetched would
      // plant a one-row list that later reads mistake for the whole history.
      // One shared, unfiltered entry (see useStrategyRuns) — each subscriber narrows it itself,
      // so the new run only has to be prepended once.
      qc.setQueryData<Run[]>(["strategy-runs"], (prev) =>
        prev ? [run, ...prev.filter((r) => r.id !== run.id)] : prev,
      );
      // The detail views read this key directly (useRun), so the panel opens populated.
      qc.setQueryData<Run>(["run", run.id], run);

      // `["runs"]` also covers useRunningRuns' ["runs","running"] by prefix.
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["live-runs"] });
      qc.invalidateQueries({ queryKey: ["paper-runs"] });
      qc.invalidateQueries({ queryKey: ["strategy-runs"] });
      // This run is now the strategy's "last run", so the next mount of the simulate dialog
      // prefills from it rather than from the run it replaced.
      qc.invalidateQueries({ queryKey: ["last-run-config", run.strategy_id] });
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
