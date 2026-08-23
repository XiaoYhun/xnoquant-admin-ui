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
// Performance's "Weekly performance" panel uses `toWeekdayPnl`.
import type { EquityPoint, RunSummary } from "@/types/domain";

export type DayPoint = { label: string; value: number };
/** A day's net PnL with its timestamp retained (for month/weekday regrouping). */
export type DatedPnl = { ts: number; value: number };
export type MonthPnl = { year: number; /** 0-indexed, Jan = 0 */ month: number; value: number };
export type HistogramBin = {
  /** Inclusive lower edge, a round multiple of the bin width — what the axis labels. */
  lower: number;
  /** Bin mid-point, in the same unit as the input values. */
  center: number;
  count: number;
};
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

/** Local midnight for a timestamp — the calendar day a reader would say it falls on. */
function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Default width of the padded daily-PnL window, in calendar days. */
export const MIN_DAILY_PNL_DAYS = 7;

/**
 * Daily PnL widened to at least `minDays` calendar days, so an intraday run (the norm for HFT)
 * charts as a bar in context rather than one lonely column filling the panel.
 *
 * The real days are centred in the window and the rest are filled with `0` — a day the run did
 * not trade genuinely earned nothing, so the zero is truthful, and a zero-height bar reads as
 * empty. One day of data with `minDays = 7` gives three blanks, the day, three blanks.
 *
 * The window never extends past today: if centring would put bars in the future it slides back so
 * the right-most column is today, keeping its width. A run whose data is old enough that centring
 * stays in the past is left centred rather than padded out to today — otherwise a month-old run
 * would render as a month of blank space with its data pushed off the left edge.
 */
export function padDailyPnl(
  points: DatedPnl[],
  minDays = MIN_DAILY_PNL_DAYS,
  now = Date.now(),
): DayPoint[] {
  // No data at all stays empty, so callers keep showing their "no daily PnL" state rather than a
  // week of zeroes implying the run traded flat.
  if (points.length === 0) return [];

  const byDay = new Map<number, number>();
  for (const p of points) {
    const day = startOfLocalDay(p.ts);
    byDay.set(day, (byDay.get(day) ?? 0) + p.value);
  }

  const days = [...byDay.keys()].sort((a, b) => a - b);
  const dataFirst = days[0];
  const dataLast = days[days.length - 1];
  const today = startOfLocalDay(now);

  let first = dataFirst;
  let last = dataLast;
  const span = Math.round((dataLast - dataFirst) / DAY_MS) + 1;
  if (span < minDays) {
    const missing = minDays - span;
    // Odd remainders bias to the left, so the data sits at or right of centre.
    const before = Math.ceil(missing / 2);
    first -= before * DAY_MS;
    last += (missing - before) * DAY_MS;
  }

  // Slide back off the future. Guarded on `dataLast` so a clock-skewed run whose fills are
  // stamped ahead of now still has every real day drawn.
  if (last > today && dataLast <= today) {
    first -= last - today;
    last = today;
  }

  const out: DayPoint[] = [];
  for (let ts = first; ts <= last; ts = startOfLocalDay(ts + DAY_MS + DAY_MS / 2)) {
    out.push({ label: equityDayLabel(ts), value: byDay.get(ts) ?? 0 });
  }
  return out;
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

// Gross edge below which the Cost Drag ratio stops meaning anything — see `costDragPct`.
const MIN_GROSS_EDGE_BPS = 0.1;

/**
 * What share of the gross edge the fees eat, as a percentage — `null` when it isn't meaningful.
 *
 * The ratio only says something while the strategy has gross edge to erode. A run that hands its
 * whole edge back in fees lands on `edge_gross_bps ≈ 0`, and dividing by that prints percentages
 * in the tens of thousands (one dev run reads -62,206%) — worse than useless, since a bigger
 * number there looks like a worse result when it actually means "no edge either way". Below the
 * floor, callers show a dash; `cost_bps` is the figure that still holds.
 *
 * `cost_bps`/`edge_gross_bps` are REST-only — a running run's summary comes off the live frame,
 * which doesn't publish them — so presence is checked rather than assumed.
 */
export function costDragPct(summary: RunSummary | undefined | null): number | null {
  const gross = summary?.edge_gross_bps;
  if (summary?.cost_bps == null || gross == null) return null;
  if (Math.abs(gross) < MIN_GROSS_EDGE_BPS) return null;
  return (summary.cost_bps / gross) * 100;
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

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * Rounds a raw step up to the next 1 / 2 / 2.5 / 5 x 10^k.
 *
 * Exported because the axis has to pick label positions that are multiples of the bin width — the
 * two have to agree or the labels drift off the bars.
 */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const scaled = raw / pow;
  return (NICE_STEPS.find((n) => scaled <= n + 1e-9) ?? 10) * pow;
}

/**
 * Symmetric histogram of daily returns — Performance's "Daily Return Distribution": how many days
 * landed in each band of return.
 *
 * Bands are ROUND: the width is snapped up to the next 1/2/2.5/5 x 10^k and the edges are laid on
 * multiples of it from zero, so a band reads "-1.00% to -0.75%" and the axis ticks at whole
 * percents. Dividing the extent by `binCount` instead — what this did before — put the edges
 * wherever the single best day happened to fall, which is why the axis came out labelled -2.8%,
 * -1.7%, … and looked nothing like the design.
 *
 * `binCount` is a TARGET, not a promise: the real count is whatever covers ±max(|value|) at the
 * rounded width. Zero always falls on an edge and the count stays even, so the loss half is
 * exactly the first `bins.length / 2` entries and stays colourable as one block. Bins are
 * half-open — a flat day counts as non-negative. Empty input yields no bins.
 */
export function toReturnHistogram(values: number[], binCount = 20): HistogramBin[] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return [];
  const target = binCount % 2 === 0 ? binCount : binCount + 1;
  // A run whose days are all exactly flat has no spread to bin; give it a nominal one.
  const extent = Math.max(...finite.map(Math.abs)) || 1;
  const width = niceStep((extent * 2) / target);
  const half = Math.max(1, Math.ceil(extent / width - 1e-9));
  const bins = half * 2;
  const lowest = -half * width;
  const out: HistogramBin[] = Array.from({ length: bins }, (_, i) => ({
    lower: lowest + width * i,
    center: lowest + width * (i + 0.5),
    count: 0,
  }));
  for (const v of finite) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - lowest) / width)));
    out[idx].count += 1;
  }
  return out;
}
