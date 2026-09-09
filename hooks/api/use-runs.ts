import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, retryUnlessForbidden } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import { normalizeCostCurve, type CostPoint } from "@/lib/cost-curve";
import { normalizeTurnover, type TurnoverPoint } from "@/lib/turnover-curve";
import type { EquityPoint, Run, RunPage, RunSummary, SampleScope, VolRegimeSummary } from "@/types/domain";
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
// `size` (default 100, max 200 — the upstream clamps anything larger).
export type RunsQuery = { q?: string; status?: string; page?: number; size?: number };

/**
 * The server-side window assembled by app/hft/api/runs/aggregate/route.ts — the same
 * `RunPage` shape, but up to 1000 runs walked 200 at a time upstream instead of one 200-row
 * page. Temporary, and deleted along with the route once `/api/runs` can filter by `mode`.
 */
const RUNS_AGGREGATE_PATH = "/api/runs/aggregate";

export async function fetchRunsPage(params: RunsQuery = {}, path = "/api/runs"): Promise<RunPage> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.page != null) search.set("page", String(params.page));
  if (params.size != null) search.set("size", String(params.size));
  const qs = search.toString();
  const page = await apiGet<RunPage>(`${HFT_API_URL}${path}${qs ? `?${qs}` : ""}`);
  // Guard the contract: callers map over `runs` immediately, so a malformed payload should
  // render empty rather than take the page down.
  return { runs: Array.isArray(page?.runs) ? page.runs : [], total: page?.total ?? 0, page: page?.page ?? 0, size: page?.size ?? 0 };
}

// GAP-2 (still open): `/api/runs` has no `mode` filter, so the Paper/Live/Backtesting screens
// must split modes client-side and therefore can't page server-side — a server page would mix
// modes and report a `total` covering all three. They paginate locally over this window instead.
//
// `size` is not forwarded: the aggregate route drives upstream paging itself, walking 200-row
// pages up to its own cap. Callers that want one raw upstream page can still pass `page`/`size`
// to `fetchRunsPage` directly.
export async function fetchRuns(params: RunsQuery = {}): Promise<Run[]> {
  const page = await fetchRunsPage(params, RUNS_AGGREGATE_PATH);
  // A page can carry the same run more than once (seen on dev: one id three times). Every list
  // keys its rows on the run id, and React leaves ghost rows behind when keys collide — rows that
  // survive a filter they don't match. Keep the first copy of each id.
  const seen = new Set<string>();
  return page.runs.filter((run) => !seen.has(run.id) && (seen.add(run.id), true));
}

// `?sample=` — which slice of a split backtest the result endpoints compute over (see
// SampleScope in types/domain.ts). Left off entirely when undefined, which lets the API apply its
// own default of `in_sample`; callers that expose the Period pills always send an explicit value,
// including `all`.
function sampleQs(sample: SampleScope | undefined): string {
  return sample ? `?sample=${sample}` : "";
}

export function fetchRunSummary(id: string, sample?: SampleScope): Promise<RunSummary> {
  return apiGet<RunSummary>(`${HFT_API_URL}/api/runs/${id}/summary${sampleQs(sample)}`);
}

export function fetchRunEquity(id: string, sample?: SampleScope): Promise<EquityPoint[]> {
  return apiGet<EquityPoint[]>(`${HFT_API_URL}/api/runs/${id}/equity-curve${sampleQs(sample)}`);
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
export function useRunSummary(id: string | undefined, sample?: SampleScope) {
  return useQuery({
    queryKey: ["run-summary", id, sample],
    queryFn: () => fetchRunSummary(id as string, sample),
    enabled: !!id,
    // The dev summary/equity endpoints 500 intermittently; keep retries (they recover) but with a
    // short fixed backoff so the detail panel's "Loading results…" settles in ~1s rather than the
    // default exponential ~7s. 403/404 still fail fast — see retryUnlessForbidden.
    retry: retryUnlessForbidden,
    retryDelay: 400,
  });
}

export function useRunEquity(id: string | undefined, sample?: SampleScope) {
  return useQuery({
    queryKey: ["run-equity", id, sample],
    queryFn: () => fetchRunEquity(id as string, sample),
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
    refetchInterval: (query) => (isPendingBacktest(query.state.data) ? PENDING_RUN_POLL_MS : false),
  });
}

/** How often a queued backtest's record is re-read while it waits for the engine. */
export const PENDING_RUN_POLL_MS = 5_000;

/**
 * A backtest that the engine hasn't picked up yet. It launches as `pending` with no artifacts
 * behind it, so the record has to be re-asked for — unlike a paper/live run, which publishes its
 * own `/live/stream` updates and needs no poll.
 */
export function isPendingBacktest(run: Run | undefined): boolean {
  return run?.status === "pending" && run.mode === "backtest";
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

export async function fetchRunTurnover(id: string, sample?: SampleScope): Promise<TurnoverPoint[]> {
  const raw = await apiGet<unknown>(`${HFT_API_URL}/api/runs/${id}/turnover-curve${sampleQs(sample)}`);
  return normalizeTurnover(raw);
}

export function useRunTurnover(id: string | undefined, sample?: SampleScope) {
  return useQuery({
    queryKey: ["run-turnover", id, sample],
    queryFn: () => fetchRunTurnover(id as string, sample),
    enabled: !!id,
    retry: retryUnlessForbidden,
    retryDelay: 400,
  });
}

// `GET /api/runs/{id}/cost-curve` — live OpenAPI `CostPoint { ts, fee, cumulative }`. Same parquet
// source as equity/turnover; many runs currently answer `[]` even when equity has points.
export async function fetchRunCostCurve(id: string, sample?: SampleScope): Promise<CostPoint[]> {
  const raw = await apiGet<unknown>(`${HFT_API_URL}/api/runs/${id}/cost-curve${sampleQs(sample)}`);
  return normalizeCostCurve(raw);
}

export function useRunCostCurve(id: string | undefined, sample?: SampleScope) {
  return useQuery({
    queryKey: ["run-cost-curve", id, sample],
    queryFn: () => fetchRunCostCurve(id as string, sample),
    enabled: !!id,
    retry: retryUnlessForbidden,
    retryDelay: 400,
  });
}

// `GET /api/runs/{id}/volatility-regime` — ATR%-bucketed Sharpe for bar-mode single-symbol runs.
// 200 body is `null` when the feature does not apply (tick-mode, multi-symbol, live, no trades).
export function fetchRunVolatilityRegime(id: string, sample?: SampleScope): Promise<VolRegimeSummary | null> {
  return apiGet<VolRegimeSummary | null>(`${HFT_API_URL}/api/runs/${id}/volatility-regime${sampleQs(sample)}`);
}

export function useRunVolatilityRegime(id: string | undefined, sample?: SampleScope) {
  return useQuery({
    queryKey: ["run-volatility-regime", id, sample],
    queryFn: () => fetchRunVolatilityRegime(id as string, sample),
    enabled: !!id,
    retry: retryUnlessForbidden,
    retryDelay: 400,
  });
}
