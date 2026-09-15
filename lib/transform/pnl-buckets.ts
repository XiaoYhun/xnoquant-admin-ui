// Equity-point derivations for the Yearly Statistics grid's "Best month" / "Worst month" /
// "Positive Months" rows (F-057). Ported from hft-platform's own control-plane reference,
// web/src/features/runs/pnl-buckets.ts, which backs the same three rows there.
//
// The MFT `returns` series (`runToMftCharts` in ./run-as-mft) comes back EMPTY whenever a run has
// no `return_pct` to scale by, which blanked these rows even where the equity curve itself had
// data. Bucketing raw equity DELTAS by calendar month and dividing by the run's own implied
// capital base needs only that one number, not a pre-scaled series. Adapted to this app's
// `Point { t: unix seconds, v }` and UTC month bucketing (`yearOf`/`monthOf` in ./mft-results),
// rather than the reference's browser-local time — every other date derivation in this module
// already reads UTC (see mft-results.ts and its `dateLabel` callers).

import { monthOf, toPeriodChanges, yearOf, type Point } from "./mft-results";

export interface MonthlyReturnRow {
  year: number;
  /** 12 entries, Jan-Dec; `undefined` where the equity curve had no delta that month. */
  months: (number | undefined)[];
}

/**
 * Net PnL by calendar year+month, as a % of `capitalBase` — SUMS the equity deltas within a month
 * rather than compounding them, since they are already fractions of the same fixed base (unlike
 * `monthlyReturns` in ./mft-results, which compounds already-percent PER-PERIOD returns). Only
 * months with at least one delta get a value; months the equity curve never touched are
 * `undefined` rather than zero-filled, so a partial year isn't penalized for months outside it.
 */
export function monthlyReturnPct(equity: Point[], capitalBase: number): MonthlyReturnRow[] {
  const byYear = new Map<number, (number | undefined)[]>();
  for (const { t, v: delta } of toPeriodChanges(equity)) {
    const y = yearOf(t);
    const m = monthOf(t) - 1;
    const months = byYear.get(y) ?? new Array<number | undefined>(12).fill(undefined);
    months[m] = (months[m] ?? 0) + (delta / capitalBase) * 100;
    byYear.set(y, months);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, months]) => ({ year, months }));
}

export interface MonthlyReturnStats {
  best: number | undefined;
  worst: number | undefined;
  positive: number;
  /** How many months actually had a value — the denominator "Positive Months" shows (`x/total`). */
  total: number;
}

/** Best/worst calendar-month return and the positive-month count, folded across every month in
 *  `rows` — the Yearly Statistics grid's "Best month"/"Worst month"/"Positive Months" rows. */
export function monthlyReturnStats(rows: { months: (number | undefined)[] }[]): MonthlyReturnStats {
  const values = rows.flatMap((r) => r.months.filter((m): m is number => m != null));
  if (values.length === 0) return { best: undefined, worst: undefined, positive: 0, total: 0 };
  return {
    best: Math.max(...values),
    worst: Math.min(...values),
    positive: values.filter((v) => v > 0).length,
    total: values.length,
  };
}
