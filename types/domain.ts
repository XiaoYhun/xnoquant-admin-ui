import type { components as HftComponents } from "./api/hft";

/**
 * App-facing domain aliases re-exported from the generated HFT OpenAPI types.
 * `types/api/hft.ts` is the source of truth; keep names here 1:1 with the
 * corresponding `components["schemas"]` entry when a clean schema exists.
 */

// HFT spec has a clean `Venue` schema ({ id, name, venue_type, created_at, updated_at }) — re-export directly.
export type Venue = HftComponents["schemas"]["Venue"];

// HFT spec has a clean `Account` schema — re-export directly.
export type Account = HftComponents["schemas"]["Account"];

// NOTE: The HFT spec has no distinct "Portfolio" schema (Account / Run /
// RunSummary are the closest concepts). Not re-exporting a Portfolio alias
// here — add one once phase-3 wiring clarifies which schema maps to the
// UI's "portfolio" concept.
// TODO(phase3): reconcile with real API — this is a UI-only shape until the
// backend exposes a proper portfolio resource.
export type Portfolio = {
  id: string;
  name: string;
  status: "running" | "stopped";
  total_allocation: number;
  sources: { account_id: string; account_name: string; amount: number }[];
};

// --- Slices 3–5 (Live Trading, Strategy List, Paper Trading) ---
// Clean HFT schemas re-exported 1:1, same convention as Venue/Account above
// (source of truth: types/api/hft.ts). `Instrument` aliases the HFT `Symbol`
// schema to avoid shadowing the global `Symbol` type.
export type Run = HftComponents["schemas"]["Run"];
export type RunPage = HftComponents["schemas"]["RunPage"];
export type RunSummary = HftComponents["schemas"]["RunSummary"];
export type VolRegimeSummary = HftComponents["schemas"]["VolRegimeSummary"];

/**
 * One bucket of `GET /api/runs/:id/periodic-summary` — a calendar year (or quarter, for a backtest
 * spanning under a year) with the same `RunSummary` the whole-run endpoint returns, computed over
 * that window alone.
 *
 * Hand-written because the generated `HftComponents["schemas"]["PeriodSummary"]` is
 * `Record<string, never>`: the OpenAPI document names the type but declares none of its fields.
 * Shape confirmed against the dev endpoint for run 01a08f45 (labels "2016".."2025", each carrying
 * a full 44-field summary).
 */
export type PeriodSummary = {
  /** The bucket's name, as the API formats it for display — "2018", or "2018 Q3". */
  label: string;
  /** Inclusive ISO dates (`YYYY-MM-DD`) bounding the bucket. */
  start_date: string;
  end_date: string;
  summary: RunSummary;
};
export type VolRegimeBucket = HftComponents["schemas"]["VolRegimeBucket"];
export type RunStatus = HftComponents["schemas"]["RunStatus"];
export type RunMode = HftComponents["schemas"]["RunMode"];

/**
 * `?sample=` on the eight run-result endpoints — which slice of a split backtest to compute over.
 * Hand-written because the HFT spec `$ref`s `SampleScope` from all eight parameters but never
 * defines the schema, so `gen:types` emits it as an empty `Record<string, never>` (see
 * types/api/hft.ts). The values mirror the backend enum's `rename_all = "snake_case"` wire form.
 *
 * The API default is `in_sample`, NOT the full range — omitting the param on a split run silently
 * narrows the result, so an "All" selection has to send `all` explicitly. Runs with no split
 * (`RunManifest.oos_start_date === null` — paper/live, and backtests launched before the split
 * existed) ignore it and always compute over the full series, and non-admin callers are forced to
 * `in_sample` server-side regardless of what the client sends.
 */
export type SampleScope = "all" | "in_sample" | "out_of_sample";
export type Strategy = HftComponents["schemas"]["Strategy"];
export type StrategyType = HftComponents["schemas"]["StrategyType"];
export type Instrument = HftComponents["schemas"]["Symbol"];
export type InstrumentClass = HftComponents["schemas"]["InstrumentClass"];
export type SymbolPnlSummary = HftComponents["schemas"]["SymbolPnlSummary"];

/**
 * `GET /api/runs/:id/risk-detail` and `GET /api/runs/:id/execution-detail` — one-shot bundles of
 * the Risk/Execution tabs' distribution views, computed together off a single parquet read.
 *
 * Hand-written, same reason as `PeriodSummary` above: the deployed OpenAPI document *lists* both
 * paths but never defines their response schemas, so `gen:types` stubs them as `unknown` /
 * `Record<string, never>`. Shapes confirmed against `crates/api/src/domain/result.rs` on
 * `origin/develop` (`DrawdownEpisode`, `LossStreakBucket`, `HourlyPnlBucket`, `RiskDetail`,
 * `HistogramBucket`, `FillRatePoint`, `ExecutionDetail`) rather than a live endpoint.
 */
export type DrawdownEpisode = {
  /** Epoch ms of the peak that preceded this drawdown. */
  peak_ts: number;
  /** Epoch ms of the episode's deepest point. */
  trough_ts: number;
  /** Epoch ms the curve climbed back to/above the peak; `null` if still open at run end. */
  recovery_ts: number | null;
  /** Peak-to-trough drop, in PnL units. */
  depth: number;
  /** `depth` as a fraction of starting capital; `null` when no starting capital is known. */
  depth_pct: number | null;
  /** `trough_ts - peak_ts`, in days. */
  length_days: number;
  /** `recovery_ts - trough_ts`, in days; `null` when the episode never recovered. */
  recovery_days: number | null;
};
/** One bucket of a consecutive-losing-round-trip streak-length histogram, ascending by `streak_len`. */
export type LossStreakBucket = { streak_len: number; count: number };
/** Net PnL for one UTC hour-of-day (`0..23`), collapsed across every calendar day sharing it. */
export type HourlyPnlBucket = {
  hour: number;
  pnl: number;
  /** `pnl` as a fraction of `net_pnl` summed over every hour; `null` when that total is `0`. */
  pnl_share_pct: number | null;
};
export type RiskDetail = {
  /** Worst first, max 10. */
  drawdown_episodes: DrawdownEpisode[];
  loss_streak_histogram: LossStreakBucket[];
  /** Always 24 entries, one per UTC hour, `hour`-ascending. */
  hourly_pnl: HourlyPnlBucket[];
};
/** One bucket of a fixed-width per-fill histogram (slippage or latency), ascending by `bucket_start`. */
export type HistogramBucket = {
  /** Inclusive lower bound, in the metric's own unit. */
  bucket_start: number;
  /** Exclusive upper bound, except on the last bucket (which also captures the series max). */
  bucket_end: number;
  count: number;
};
/** One UTC calendar day's qty-weighted fill rate. */
export type FillRatePoint = { ts: number; fill_rate: number };
export type ExecutionDetail = {
  fill_rate_daily: FillRatePoint[];
  /** Per-fill signed slippage vs mid, in bps. Negative = adverse. */
  slippage_histogram: HistogramBucket[];
  /** Per-fill latency (`fill_ts - submitted_ts`), in ms. */
  latency_histogram: HistogramBucket[];
  /** Closed round-trips by holding time (`close_ts - open_ts`), in seconds. Not in the published
   *  OpenAPI spec yet — the control plane reads it off this payload, so treat it as optional. */
  holding_time_histogram?: HistogramBucket[];
  /** Fraction of submitted orders ever canceled, in `[0, 1]`. */
  cancel_rate: number;
  /** Orders submitted per fill executed. */
  order_to_trade_ratio: number;
  avg_latency_ms: number;
  /** Signed; negative = adverse (a buy above mid, or a sell below mid). */
  slippage_avg_bps: number;
  /** Sample stddev (ddof=1) of the same per-fill slippage distribution. */
  slippage_std_bps: number;
  /** Negative = adverse. */
  market_impact_bps: number;
};

// --- Risk management (Figma 14975:41599 / 14975:44103) ---
// Two scopes with different severities: an account can only go Yellow (warn, no action), the
// portfolio only Red (stops + flattens every running strategy and halts new launches).
export type RiskLevel = HftComponents["schemas"]["RiskLevel"];
export type RiskStatusResponse = HftComponents["schemas"]["RiskStatusResponse"];
export type AccountRiskStatus = HftComponents["schemas"]["AccountRiskStatus"];
export type RiskThresholdsResponse = HftComponents["schemas"]["RiskThresholdsResponse"];
export type AccountRiskThreshold = HftComponents["schemas"]["AccountRiskThreshold"];
export type PortfolioRiskThreshold = HftComponents["schemas"]["PortfolioRiskThreshold"];
export type RiskAuditEntry = HftComponents["schemas"]["RiskAuditEntry"];
export type ResetRiskRequest = HftComponents["schemas"]["ResetRiskRequest"];
export type TradeRow = HftComponents["schemas"]["TradeRow"];
export type TradePage = HftComponents["schemas"]["TradePage"];
export type EquityPoint = HftComponents["schemas"]["EquityPoint"];

// --- Promotions (the "Alpha pool" screen) ---
// A strategy's approval for a stage, pinned to the strategy version an admin reviewed. Replaces
// the old single global live-basket: promotion is now per stage ("paper" | "live") and the API
// enforces the sequence backtest -> paper -> live.
export type StrategyPromotion = HftComponents["schemas"]["StrategyPromotion"];
export type PromotionStage = HftComponents["schemas"]["PromotionStage"];
export type PromoteRequest = HftComponents["schemas"]["PromoteRequest"];
