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
 * `year: undefined` is "All". `month` is 1-12 and only meaningful alongside a year.
 */
export interface PeriodSelection {
  year?: number;
  month?: number;
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

/** Every year the series touches, ascending — the Period row's pills are built from this. */
export function yearsOf(points: Point[]): number[] {
  return [...new Set(points.map((p) => yearOf(p.t)))].sort((a, b) => a - b);
}

export function filterByPeriod(points: Point[], period: PeriodSelection): Point[] {
  if (period.year == null) return points;
  return points.filter(
    (p) => yearOf(p.t) === period.year && (period.month == null || monthOf(p.t) === period.month),
  );
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
