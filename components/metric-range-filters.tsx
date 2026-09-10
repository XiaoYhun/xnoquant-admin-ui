"use client";
// Min–Max range filters for the three result metrics every run list shows: Sharpe, Return % and
// Max DD %. Shared by Backtesting, Paper Trading, Live trade and Alpha pool, which all render
// rows of the same `PaperRunRow` shape.
//
// The three run lists send these to `GET /api/runs` as `min_*`/`max_*` (see `metricRangeParams`);
// Alpha pool pages over promotions rather than runs, so it still narrows in the browser with
// `matchesMetricRanges`.
//
// Bounds are held as strings, not numbers, so a half-typed "-" or a cleared box doesn't collapse
// into 0 and silently filter the table.

export type MetricRange = { min: string; max: string };
export type MetricRanges = { sharpe: MetricRange; returnPct: MetricRange; maxDd: MetricRange };

export const EMPTY_METRIC_RANGES: MetricRanges = {
  sharpe: { min: "", max: "" },
  returnPct: { min: "", max: "" },
  maxDd: { min: "", max: "" },
};

/** The row fields the filters read — `PaperRunRow`'s metric columns. */
export type MetricRow = {
  sharpe: number | null;
  returnPct: number | null;
  maxDrawdownPct: number | null;
};

function parse(bound: string): number | null {
  const text = bound.trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * `magnitude` compares absolute values, for Max DD: the column is always negative ("-4.10%"), so
 * "0 – 5" reads as "drew down at most 5%". The bounds are taken by magnitude and reordered too,
 * so typing "-5 – 0" means the same thing instead of matching nothing.
 */
function inRange(value: number | null, range: MetricRange, magnitude = false): boolean {
  let lo = parse(range.min);
  let hi = parse(range.max);
  if (lo == null && hi == null) return true;
  // Bounded, but this run has no such number yet (the API leaves it null until the run has fills).
  if (value == null) return false;
  let v = value;
  if (magnitude) {
    v = Math.abs(v);
    if (lo != null) lo = Math.abs(lo);
    if (hi != null) hi = Math.abs(hi);
    if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
  }
  return (lo == null || v >= lo) && (hi == null || v <= hi);
}

/** True while no bound is set — i.e. these filters are narrowing nothing. */
export function isEmptyMetricRanges(ranges: MetricRanges): boolean {
  return Object.values(ranges).every((r) => !r.min.trim() && !r.max.trim());
}

/**
 * Alpha pool members can have no source run at all; they pass while no bound is set (the list's
 * existing "keep it visible" rule) and drop out once one is, having nothing to compare.
 */
export function matchesMetricRanges(row: MetricRow | null | undefined, ranges: MetricRanges): boolean {
  if (!row) return isEmptyMetricRanges(ranges);
  return (
    inRange(row.sharpe, ranges.sharpe) &&
    inRange(row.returnPct, ranges.returnPct) &&
    inRange(row.maxDrawdownPct, ranges.maxDd, true)
  );
}

/**
 * The `GET /api/runs` bounds these ranges translate to. Named exactly as the API's query
 * parameters so the query object can be spread straight into `RunsQuery`.
 */
export type MetricBounds = {
  min_sharpe?: number;
  max_sharpe?: number;
  min_return_pct?: number;
  max_return_pct?: number;
  min_drawdown_pct?: number;
  max_drawdown_pct?: number;
};

/**
 * Ranges -> server bounds.
 *
 * Two conversions, both forced by what the API stores. `return_pct` and `max_drawdown_pct` are
 * FRACTIONS on the server (`net_pnl / starting_capital`), while these boxes are typed in percent,
 * so those four bounds are divided by 100 — Sharpe is a bare ratio and passes through. And
 * `max_drawdown_pct` is a positive magnitude server-side, which is what the Max DD boxes already
 * mean (`0 – 5` = drew down at most 5%), so those two are taken by magnitude and reordered.
 *
 * A run with no cached summary has NULL in all three columns, so any bound drops it — the same
 * rule `matchesMetricRanges` applies to a row whose metric is still null.
 */
export function metricRangeParams(ranges: MetricRanges): MetricBounds {
  const [minDd, maxDd] = magnitudeBounds(ranges.maxDd);
  return {
    min_sharpe: parse(ranges.sharpe.min) ?? undefined,
    max_sharpe: parse(ranges.sharpe.max) ?? undefined,
    min_return_pct: pct(ranges.returnPct.min),
    max_return_pct: pct(ranges.returnPct.max),
    min_drawdown_pct: minDd,
    max_drawdown_pct: maxDd,
  };
}

/** A percent box as the fraction the API compares against. */
function pct(bound: string): number | undefined {
  const value = parse(bound);
  return value == null ? undefined : value / 100;
}

/** Max DD's pair, by magnitude and in ascending order — `-5 – 0` and `0 – 5` mean the same thing. */
function magnitudeBounds(range: MetricRange): [number | undefined, number | undefined] {
  let lo = pct(range.min);
  let hi = pct(range.max);
  if (lo != null) lo = Math.abs(lo);
  if (hi != null) hi = Math.abs(hi);
  if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
  return [lo, hi];
}

const BOUND_INPUT =
  "h-8 w-[72px] rounded-[10px] border border-border bg-background px-3 text-xs text-white outline-none " +
  "placeholder:text-muted-foreground focus-visible:border-ring";

function RangeField({
  label,
  range,
  onChange,
}: {
  label: string;
  range: MetricRange;
  onChange: (next: MetricRange) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-xs whitespace-nowrap text-muted-foreground">{label}</span>
      <input
        value={range.min}
        onChange={(e) => onChange({ ...range, min: e.target.value })}
        inputMode="decimal"
        placeholder="Min"
        aria-label={`${label} minimum`}
        className={BOUND_INPUT}
      />
      <span className="text-xs text-muted-foreground">&ndash;</span>
      <input
        value={range.max}
        onChange={(e) => onChange({ ...range, max: e.target.value })}
        inputMode="decimal"
        placeholder="Max"
        aria-label={`${label} maximum`}
        className={BOUND_INPUT}
      />
    </div>
  );
}

/** Renders the three fields as siblings, so each page drops them straight into its filter row. */
export function MetricRangeFilters({
  value,
  onChange,
}: {
  value: MetricRanges;
  onChange: (next: MetricRanges) => void;
}) {
  return (
    <>
      <RangeField label="Sharpe" range={value.sharpe} onChange={(sharpe) => onChange({ ...value, sharpe })} />
      <RangeField
        label="Return %"
        range={value.returnPct}
        onChange={(returnPct) => onChange({ ...value, returnPct })}
      />
      <RangeField label="Max DD %" range={value.maxDd} onChange={(maxDd) => onChange({ ...value, maxDd })} />
    </>
  );
}
