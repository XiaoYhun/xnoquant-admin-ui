// Derivations from the equity curve. The HFT API exposes only two curve endpoints
// (`/equity-curve`, `/turnover-curve`), so daily PnL, weekday PnL, drawdown and rolling Sharpe
// have to be computed from the equity series rather than fetched.
//
// Aligns with backend helpers: drawdown = equity − running peak (peak seeded at 0);
// rolling Sharpe = mean / population-stddev of equity deltas (not annualized), adaptive window.
//
// Wired: Risk Drawdown (`toDrawdown`); Risk Rolling Sharpe uses live/stream while running and
// `toRollingSharpe` from equity otherwise. Performance uses `toDailyPnl` / `toMonthlyPnl` /
// `toReturnHistogram` / `equityStats`; Overview's stats strip uses `equityStats`.
// `toWeekdayPnl` still has no side-panel home.
import type { EquityPoint, RunSummary } from "@/types/domain";

export type DayPoint = { label: string; value: number };
/** A day's net PnL with its timestamp retained (for month/weekday regrouping). */
export type DatedPnl = { ts: number; value: number };
export type MonthPnl = { year: number; /** 0-indexed, Jan = 0 */ month: number; value: number };
export type HistogramBin = { /** Bin mid-point, in the same unit as the input values. */ center: number; count: number };
export type LinePoint = { ts: number; value: number };
export type DrawdownPoint = {
  ts: number;
  /** Peak-to-trough as a negative % of the running peak (0 while peak ≤ 0). */
  pct: number;
  /** Absolute drop from the running peak (`equity - peak`, ≤ 0). */
  abs: number;
};

const DAY_MS = 86_400_000;
// Chart x-axis labels render as DD/MM/YY, matching Figma 14876:145754.
export const equityDayLabel = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
};

function pointEquity(p: EquityPoint): { ts: number; equity: number } | null {
  const ts = Number(p.ts);
  const equity = Number(p.equity ?? p.pnl ?? 0);
  if (!Number.isFinite(ts) || !Number.isFinite(equity)) return null;
  return { ts, equity };
}

/** Last equity reading of each calendar day, oldest first. */
function dailyCloses(points: EquityPoint[]): { ts: number; equity: number }[] {
  const byDay = new Map<number, { ts: number; equity: number }>();
  for (const p of points) {
    const row = pointEquity(p);
    if (!row) continue;
    const day = Math.floor(row.ts / DAY_MS);
    const seen = byDay.get(day);
    if (!seen || row.ts >= seen.ts) byDay.set(day, row);
  }
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

/**
 * Net PnL per calendar day — Figma "Net Daily PNL (VND)" (14876:145688). The equity curve is
 * cumulative, so a day's PnL is its close minus the previous day's close.
 */
export function toDailyPnl(points: EquityPoint[]): DayPoint[] {
  return toDailyPnlPoints(points).map((d) => ({ label: equityDayLabel(d.ts), value: d.value }));
}

/**
 * `toDailyPnl` keeping each day's timestamp — the input for monthly/histogram regrouping.
 *
 * The first day's prior close is seeded at `0`, not dropped: equity here IS cumulative realized
 * PnL, so the day before the run started did close at 0 — the same reasoning `toDrawdown` uses to
 * seed its peak. Dropping it meant an intraday run (the norm for HFT) produced no daily series at
 * all, blanking Performance's monthly / by-day / distribution charts and Overview's Profit Days
 * and Trading Days even though the run had real PnL.
 */
export function toDailyPnlPoints(points: EquityPoint[]): DatedPnl[] {
  let prevClose = 0;
  return dailyCloses(points).map((c) => {
    const value = c.equity - prevClose;
    prevClose = c.equity;
    return { ts: c.ts, value };
  });
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thur", "Fri", "Sat", "Sun"] as const;

/**
 * Daily PnL summed by weekday — Figma "Weekly performance (VND)" (14876:146047). Ordered
 * Mon→Sun to match the design's x-axis, not JS's Sunday-first `getDay()`.
 */
export function toWeekdayPnl(points: EquityPoint[]): DayPoint[] {
  const totals = new Array(7).fill(0) as number[];
  // Built from the daily series so the two agree on how day one is counted.
  for (const d of toDailyPnlPoints(points)) {
    const jsDay = new Date(d.ts).getDay(); // 0 = Sunday
    totals[(jsDay + 6) % 7] += d.value;
  }
  return WEEKDAYS.map((label, i) => ({ label, value: totals[i] }));
}

/**
 * Peak-to-trough drawdown along the equity (cumulative realized PnL) curve.
 * Peak is seeded at `0` so an underwater start (equity < 0) reads as drawdown immediately —
 * same as backend `drawdownSeries`.
 */
export function toDrawdown(points: EquityPoint[]): DrawdownPoint[] {
  let peak = 0;
  const out: DrawdownPoint[] = [];
  for (const p of points) {
    const row = pointEquity(p);
    if (!row) continue;
    peak = Math.max(peak, row.equity);
    const abs = row.equity - peak;
    const pct = peak > 0 ? (abs / peak) * 100 : 0;
    out.push({ ts: row.ts, pct, abs });
  }
  return out;
}

/** Successive equity deltas — input to rolling Sharpe (backend `equityDeltas`). */
function equityDeltas(points: EquityPoint[]): { ts: number; delta: number }[] {
  const rows: { ts: number; equity: number }[] = [];
  for (const p of points) {
    const row = pointEquity(p);
    if (row) rows.push(row);
  }
  const out: { ts: number; delta: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    out.push({ ts: rows[i].ts, delta: rows[i].equity - rows[i - 1].equity });
  }
  return out;
}

/**
 * Rolling Sharpe (mean / population-stddev of realized PnL deltas, not annualized — same
 * definition as `sharpe()` in crates/api/src/result.rs) over a trailing window of retained
 * equity-curve points. The window adapts to the run's length so short runs still produce a
 * handful of points; `0` window-stddev (a flat window) reads as `0`, same as the backend.
 */
export function toRollingSharpe(points: EquityPoint[], window?: number): LinePoint[] {
  const deltas = equityDeltas(points);
  const w = window ?? Math.max(3, Math.min(20, Math.floor(deltas.length / 3)));
  if (deltas.length < w) return [];

  const out: LinePoint[] = [];
  for (let i = w - 1; i < deltas.length; i++) {
    const windowVals = deltas.slice(i - w + 1, i + 1).map((d) => d.delta);
    const mean = windowVals.reduce((s, v) => s + v, 0) / w;
    const variance = windowVals.reduce((s, v) => s + (v - mean) ** 2, 0) / w;
    const std = Math.sqrt(variance);
    out.push({ ts: deltas[i].ts, value: std === 0 ? 0 : mean / std });
  }
  return out;
}

/**
 * Net PnL per calendar month, oldest first — the Performance tab's Monthly Return heatmap and
 * its "By Month" PnL bars. Summing the daily PnLs (rather than differencing month closes) keeps
 * months with missing days consistent with the daily series they're aggregated from.
 */
export function toMonthlyPnl(points: EquityPoint[]): MonthPnl[] {
  const byMonth = new Map<string, MonthPnl>();
  for (const d of toDailyPnlPoints(points)) {
    const date = new Date(d.ts);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month}`;
    const seen = byMonth.get(key);
    if (seen) seen.value += d.value;
    else byMonth.set(key, { year, month, value: d.value });
  }
  return [...byMonth.values()].sort((a, b) => a.year - b.year || a.month - b.month);
}

export type EquityStats = {
  /** Calendar days with a PnL reading, the run's first day included (it counts from 0). */
  tradingDays: number;
  profitDays: number;
  /** `profitDays / tradingDays` as a percentage; `0` when there are no trading days. */
  profitDayPct: number;
  avgDailyPnl: number;
  bestDay: number;
  worstDay: number;
};

/** Day-level aggregates behind the Performance summary card and the Overview stats strip. */
export function equityStats(points: EquityPoint[]): EquityStats | null {
  const days = toDailyPnlPoints(points);
  if (days.length === 0) return null;
  const values = days.map((d) => d.value);
  const profitDays = values.filter((v) => v > 0).length;
  return {
    tradingDays: values.length,
    profitDays,
    profitDayPct: (profitDays / values.length) * 100,
    avgDailyPnl: values.reduce((s, v) => s + v, 0) / values.length,
    bestDay: Math.max(...values),
    worstDay: Math.min(...values),
  };
}

/**
 * Starting capital, backed out of the summary: the API never returns it directly, but publishes
 * `return_pct = net_pnl / starting_capital`. `null` whenever that inversion isn't defined —
 * notably for every live run, where the spec says `return_pct` is always null because
 * `ManifestAccount.balances` is empty. Callers fall back to absolute PnL.
 */
export function startingCapital(summary: RunSummary | undefined): number | null {
  if (!summary) return null;
  const pct = summary.return_pct;
  if (pct == null || pct === 0) return null;
  const capital = summary.net_pnl / pct;
  return Number.isFinite(capital) && capital > 0 ? capital : null;
}

const YEAR_MS = 365.25 * 86_400_000;
// Annualizing a handful of days produces nonsense (a good week reads as +40,000%), so CAGR is
// only defined once the run spans enough calendar time for the exponent to mean something.
const MIN_CAGR_SPAN_MS = 7 * 86_400_000;

/** Wall-clock span covered by the curve, in ms; `0` for an empty or single-point curve. */
export function curveSpanMs(points: EquityPoint[]): number {
  if (points.length < 2) return 0;
  const span = Number(points[points.length - 1].ts) - Number(points[0].ts);
  return Number.isFinite(span) && span > 0 ? span : 0;
}

/**
 * Compound annual growth rate, as a fraction, from a run's total return (`RunSummary.return_pct`)
 * and its calendar span. `null` when the run is too short to annualize, when no return is known,
 * or when a total wipeout leaves the growth factor non-positive (no real root).
 */
export function annualizedReturn(returnPct: number | null | undefined, spanMs: number): number | null {
  if (returnPct == null || spanMs < MIN_CAGR_SPAN_MS) return null;
  const growth = 1 + returnPct;
  if (growth <= 0) return null;
  const cagr = growth ** (YEAR_MS / spanMs) - 1;
  return Number.isFinite(cagr) ? cagr : null;
}

/**
 * Symmetric histogram of daily returns — Performance's "Daily Return Distribution". Bins span
 * ±max(|value|) so zero always falls on a bin edge and the two signs stay colourable as halves;
 * `binCount` is forced even for the same reason. Empty input yields no bins.
 */
export function toReturnHistogram(values: number[], binCount = 20): HistogramBin[] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return [];
  const bins = binCount % 2 === 0 ? binCount : binCount + 1;
  const extent = Math.max(...finite.map(Math.abs));
  // A run whose days are all exactly flat has no spread to bin; put everything in the middle.
  const width = (extent || 1) * 2 / bins;
  const out: HistogramBin[] = Array.from({ length: bins }, (_, i) => ({
    center: -extent + width * (i + 0.5),
    count: 0,
  }));
  for (const v of finite) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v + extent) / width)));
    out[idx].count += 1;
  }
  return out;
}
