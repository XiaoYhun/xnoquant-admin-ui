// Derivations for the MFT "Results" screens (Figma 15204:30669 and siblings).
//
// The XALPHA MFT API exposes only aggregate metrics (`/performance`, `/summary-aggregate`,
// `/summary-table`) plus flat `{times[], values[]}` series from `/charts?series=`. Several panels
// in the design — the monthly-return grid, the daily-PnL bars, the return histogram, the loss
// streaks, the top-5 drawdown table — are not endpoints; they are shapes of those same series.
// Computing them here keeps the views declarative and makes each derivation unit-testable, which
// matters because a wrong drawdown episode looks perfectly plausible on a chart.
//
// Units: `pnls` is CUMULATIVE (an equity curve), `returns` is PER-PERIOD and already expressed in
// percent — that is what both the mock series and the rendered design show ("+1.5", "-0.8"). No
// ×100 is applied to a `returns` value anywhere; ratios that come off `/performance` are a
// different thing and are scaled at their call sites.

import type { components } from "@/types/api/xalpha";

type StrategyChartData = components["schemas"]["models.StrategyChartData"];

/** One sample of a series: `t` is unix SECONDS (what the API sends), `v` the raw value. */
export interface Point {
  t: number;
  v: number;
}

/** Zip the API's parallel `times`/`values` arrays, dropping any unpaired or non-finite tail. */
export function toPoints(data?: StrategyChartData): Point[] {
  const times = data?.times ?? [];
  const values = data?.values ?? [];
  const n = Math.min(times.length, values.length);
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = times[i];
    const v = values[i];
    if (Number.isFinite(t) && Number.isFinite(v)) out.push({ t, v });
  }
  return out;
}

/** Restrict to one stage's inclusive `[from, to]` range. No range ⇒ everything. */
export function sliceStage(points: Point[], data?: StrategyChartData, stage?: string): Point[] {
  const range = stage ? data?.stages?.[stage] : undefined;
  if (range?.from == null || range?.to == null) return points;
  return points.filter((p) => p.t >= range.from! && p.t <= range.to!);
}

/**
 * The Period row's selection, held as a plain value so the shell can pass it down untouched.
 * `year: undefined` is "All". `month` (1-12) and `quarter` (1-4) are each only meaningful
 * alongside a year, and mutually exclusive — the Period row's Mo/Qtr/Ytd toggle sets one or
 * neither, never both.
 */
export interface PeriodSelection {
  year?: number;
  month?: number;
  quarter?: number;
}

function utc(t: number): Date {
  return new Date(t * 1000);
}

export function yearOf(t: number): number {
  return utc(t).getUTCFullYear();
}

/** 1-12, matching the Period row's month pills rather than JS's 0-11. */
export function monthOf(t: number): number {
  return utc(t).getUTCMonth() + 1;
}

/** 1-4, matching the Period row's quarter pills and `/periodic-summary`'s "Q1".."Q4" labels. */
export function quarterOf(t: number): number {
  return Math.floor((monthOf(t) - 1) / 3) + 1;
}

/** Every year the series touches, ascending — the Period row's pills are built from this. */
export function yearsOf(points: Point[]): number[] {
  return [...new Set(points.map((p) => yearOf(p.t)))].sort((a, b) => a - b);
}

export function filterByPeriod(points: Point[], period: PeriodSelection): Point[] {
  if (period.year == null) return points;
  return points.filter((p) => {
    if (yearOf(p.t) !== period.year) return false;
    if (period.month != null) return monthOf(p.t) === period.month;
    if (period.quarter != null) return quarterOf(p.t) === period.quarter;
    return true;
  });
}

/**
 * Cumulative series → per-period deltas. The first sample has no predecessor inside the window,
 * so it carries its own value as the period's change (an equity curve starting at 0 makes that
 * the correct first bar; one starting mid-run makes it the only defensible guess).
 */
export function toPeriodChanges(points: Point[]): Point[] {
  return points.map((p, i) => ({ t: p.t, v: i === 0 ? p.v : p.v - points[i - 1].v }));
}

export interface MonthlyReturnRow {
  year: number;
  /** 12 entries, Jan-Dec; `undefined` where the series has no sample in that month. */
  months: (number | undefined)[];
  /** Compounded total for the year, or `undefined` when the year is entirely empty. */
  total: number | undefined;
}

/**
 * Per-period returns → the design's year × month grid (Figma 15205:57102).
 *
 * Months COMPOUND rather than sum: a +10% day followed by a -10% day is -1%, not 0%. Values are
 * percent, so each is converted to a growth factor, multiplied, and converted back.
 */
export function monthlyReturns(points: Point[]): MonthlyReturnRow[] {
  const byYear = new Map<number, number[][]>();
  for (const p of points) {
    const y = yearOf(p.t);
    let row = byYear.get(y);
    if (!row) {
      row = Array.from({ length: 12 }, () => [] as number[]);
      byYear.set(y, row);
    }
    row[monthOf(p.t) - 1].push(p.v);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, buckets]) => {
      const months = buckets.map((vs) => (vs.length ? compound(vs) : undefined));
      const present = months.filter((m): m is number => m != null);
      return { year, months, total: present.length ? compound(present) : undefined };
    });
}

/** Compound a list of percent returns into one percent return. */
export function compound(percents: number[]): number {
  const factor = percents.reduce((acc, v) => acc * (1 + v / 100), 1);
  return (factor - 1) * 100;
}

// The Daily Return Distribution (Figma 15205:57662) is the same chart the HFT Performance view
// draws, so it reuses `toReturnHistogram` from ./results rather than binning again here — that one
// snaps bins to round widths centred on zero, which is what makes the axis read in whole percents
// and the loss half colourable as one block.

export interface StreakBar {
  /** Run length, in consecutive losing periods. */
  length: number;
  /** How many runs of exactly this length occurred. */
  count: number;
}

/**
 * Consecutive-loss streaks (Figma 15227:70198) from per-period returns: how many runs of 1 losing
 * period, of 2, and so on. A period is a loss when its return is strictly negative — a flat 0 day
 * ends a streak rather than extending it, since no loss was taken.
 */
export function lossStreaks(points: Point[]): StreakBar[] {
  const counts = new Map<number, number>();
  let run = 0;
  const flush = () => {
    if (run > 0) counts.set(run, (counts.get(run) ?? 0) + 1);
    run = 0;
  };
  for (const p of points) {
    if (p.v < 0) run++;
    else flush();
  }
  flush();
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([length, count]) => ({ length, count }));
}

/** The longest losing run, and how much it cost in total — the Risk panel's paired metric. */
export function worstLossStreak(points: Point[]): { length: number; total: number } | undefined {
  let best: { length: number; total: number } | undefined;
  let run = 0;
  let sum = 0;
  const flush = () => {
    if (run > 0 && (!best || run > best.length)) best = { length: run, total: sum };
    run = 0;
    sum = 0;
  };
  for (const p of points) {
    if (p.v < 0) {
      run++;
      sum += p.v;
    } else flush();
  }
  flush();
  return best;
}

export interface DrawdownEpisode {
  /** Unix seconds of the first period underwater. */
  start: number;
  /** Unix seconds of the deepest period. */
  trough: number;
  /** Deepest value reached (negative, in the series' own units). */
  depth: number;
  /** Periods from `start` to `trough`, inclusive of the trough. */
  length: number;
  /** Periods from `trough` back to level, or `undefined` when it never recovered. */
  recovery: number | undefined;
}

/**
 * Split a drawdown series (values ≤ 0, where 0 means "at a new peak") into underwater episodes —
 * the Top 5 drawdown table (Figma 15212:62017).
 *
 * An episode runs from the first negative sample until the series returns to 0 or above. The last
 * episode is kept even if it never recovers; its `recovery` is `undefined`, which the table shows
 * as "—" rather than pretending the strategy climbed back out.
 */
export function drawdownEpisodes(points: Point[]): DrawdownEpisode[] {
  const out: DrawdownEpisode[] = [];
  let startIdx: number | null = null;
  let troughIdx = 0;

  const close = (endIdx: number | null) => {
    if (startIdx == null) return;
    out.push({
      start: points[startIdx].t,
      trough: points[troughIdx].t,
      depth: points[troughIdx].v,
      length: troughIdx - startIdx + 1,
      recovery: endIdx == null ? undefined : endIdx - troughIdx,
    });
    startIdx = null;
  };

  for (let i = 0; i < points.length; i++) {
    if (points[i].v < 0) {
      if (startIdx == null) {
        startIdx = i;
        troughIdx = i;
      } else if (points[i].v < points[troughIdx].v) {
        troughIdx = i;
      }
    } else {
      close(i);
    }
  }
  close(null);
  return out;
}

/** The deepest episodes first — the table shows the top 5. */
export function topDrawdowns(points: Point[], limit = 5): DrawdownEpisode[] {
  return drawdownEpisodes(points)
    .sort((a, b) => a.depth - b.depth)
    .slice(0, limit);
}

// ── Derived risk statistics ─────────────────────────────────────────────────
// `/summary-table` answers five metrics per year and `/performance` answers the rest for the run
// as a whole, which left the Yearly Statistics grid with a column of "—" wherever a year needed a
// figure only the run-level endpoint had. Everything below re-derives those from the per-period
// series the grid already holds, so a year column stands on its own.
//
// Returns are PERCENT per period (see `compound`), and so is the drawdown series (see the Top 5
// drawdown table). Ratios are what the grid formats, so these convert on the way out.

const YEAR_SECONDS = 365.25 * 24 * 60 * 60;

/**
 * How many samples this window would hold in a year, from its own timestamps.
 *
 * Annualization can't assume 252 trading days: the same grid is fed by daily bars and by 10-minute
 * ones, and a fixed factor would scale an intraday year's volatility by an order of magnitude.
 * Counting the window's actual sample rate self-calibrates to whatever interval the run used, and
 * lands on ~252 for a year of daily bars because weekends simply hold no samples.
 */
function periodsPerYear(points: Point[]): number | undefined {
  if (points.length < 2) return undefined;
  const span = points[points.length - 1].t - points[0].t;
  if (span <= 0) return undefined;
  // `length - 1` intervals cover the span; the count is what a full year of them would be.
  return ((points.length - 1) / span) * YEAR_SECONDS;
}

function mean(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

/** Population standard deviation, matching the backend's `sharpe()` definition. */
function stdev(xs: number[], from = mean(xs)): number {
  return Math.sqrt(mean(xs.map((v) => (v - from) ** 2)));
}

/** Spread of the losing periods only, measured against zero — the Sortino denominator. */
function downsideDeviation(xs: number[]): number {
  const losses = xs.filter((v) => v < 0);
  return losses.length ? Math.sqrt(mean(losses.map((v) => v ** 2))) : 0;
}

/** Annualized standard deviation of the per-period returns, as a ratio. */
export function annualizedVolatility(returns: Point[]): number | undefined {
  const ppy = periodsPerYear(returns);
  if (ppy == null || returns.length < 2) return undefined;
  return (stdev(returns.map((p) => p.v)) / 100) * Math.sqrt(ppy);
}

/** `mean / stdev` of the per-period returns, scaled by √periods-per-year. */
export function annualizedSharpe(returns: Point[]): number | undefined {
  const ppy = periodsPerYear(returns);
  if (ppy == null || returns.length < 2) return undefined;
  const vs = returns.map((p) => p.v);
  const sd = stdev(vs);
  // A window that never moved has no risk to divide by; the backend reports 0 rather than ∞.
  return sd === 0 ? 0 : (mean(vs) / sd) * Math.sqrt(ppy);
}

/** Sharpe with only the downside counted as risk. */
export function annualizedSortino(returns: Point[]): number | undefined {
  const ppy = periodsPerYear(returns);
  if (ppy == null || returns.length < 2) return undefined;
  const vs = returns.map((p) => p.v);
  const dd = downsideDeviation(vs);
  // No losing period at all: same convention as Sharpe's flat window rather than a divide by zero.
  return dd === 0 ? 0 : (mean(vs) / dd) * Math.sqrt(ppy);
}

/**
 * The `1 - confidence` worst returns, ascending — the loss tail both risk figures read.
 *
 * The size is floored (with a float guard: `1 - 0.95` is 0.05000000000000004, and ceil-ing that
 * against a 100-sample window silently took six samples instead of five) and never empty, so a
 * short window still reports its worst period rather than nothing.
 */
function lossTail(returns: Point[], confidence: number): number[] {
  const sorted = returns.map((p) => p.v).sort((a, b) => a - b);
  const size = Math.max(1, Math.floor(sorted.length * (1 - confidence) + 1e-9));
  return sorted.slice(0, size);
}

/**
 * Historical Value at Risk — the `1 - confidence` quantile of the per-period returns, as a
 * negative ratio. Nearest-rank on the sorted sample, so it is always a return that actually
 * happened rather than an interpolation between two that didn't.
 */
export function valueAtRisk(returns: Point[], confidence = 0.95): number | undefined {
  if (!returns.length) return undefined;
  const tail = lossTail(returns, confidence);
  return tail[tail.length - 1] / 100;
}

/** Mean of the returns at or beyond {@link valueAtRisk} — the average of the tail, as a ratio. */
export function conditionalValueAtRisk(returns: Point[], confidence = 0.95): number | undefined {
  if (!returns.length) return undefined;
  return mean(lossTail(returns, confidence)) / 100;
}

/** Deepest point of the drawdown series, as a negative ratio. */
export function maxDrawdown(drawdown: Point[]): number | undefined {
  if (!drawdown.length) return undefined;
  return Math.min(...drawdown.map((p) => p.v)) / 100;
}

/**
 * The longest peak-to-trough descent, in periods — how long the worst decline took to bottom out,
 * as opposed to `Longest Recovery`, which measures the climb back from the trough.
 */
export function maxDrawdownDuration(drawdown: Point[]): number | undefined {
  const lengths = drawdownEpisodes(drawdown).map((e) => e.length);
  return lengths.length ? Math.max(...lengths) : undefined;
}

/** CAGR over the depth of the worst drawdown; undefined when the window never drew down. */
export function calmarRatio(cagr: number | undefined, maxDd: number | undefined): number | undefined {
  if (cagr == null || maxDd == null || maxDd === 0) return undefined;
  return cagr / Math.abs(maxDd);
}
