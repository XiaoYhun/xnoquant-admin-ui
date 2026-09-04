"use client";

// The Sharpe / Return / MDD thresholds the run-list filter rows carry (Figma: "Sharpe >= 2.5").
// Held as the raw strings the inputs contain — a half-typed "-" is a state the user passes
// through, and parsing happens where the rows are matched.
export type MetricThresholds = { sharpe: string; returnPct: string; mdd: string };

export const NO_THRESHOLDS: MetricThresholds = { sharpe: "", returnPct: "", mdd: "" };

const FIELDS = [
  { key: "sharpe", label: "Sharpe >=", placeholder: "2.5" },
  { key: "returnPct", label: "Return >=", placeholder: "100%" },
  // Drawdown is negative in these rows ("-0.11%"), so >= is "no deeper than".
  { key: "mdd", label: "MDD >=", placeholder: "-0.15" },
] as const;

/** Blank (or half-typed) narrows nothing; otherwise a run with no metric yet is out. */
function atLeast(value: number | null, threshold: string): boolean {
  const min = Number.parseFloat(threshold);
  if (Number.isNaN(min)) return true;
  return value != null && value >= min;
}

/** Return and MDD are percent numbers on the row (12.3 = +12.3%), so the inputs read as percent. */
export function matchesThresholds(
  row: { sharpe: number | null; returnPct: number | null; maxDrawdownPct: number | null },
  t: MetricThresholds,
): boolean {
  return atLeast(row.sharpe, t.sharpe) && atLeast(row.returnPct, t.returnPct) && atLeast(row.maxDrawdownPct, t.mdd);
}

export function MetricFilters({
  value,
  onChange,
}: {
  value: MetricThresholds;
  onChange: (next: MetricThresholds) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {FIELDS.map((f) => (
        <div key={f.key} className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">{f.label}</span>
          <input
            value={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            inputMode="decimal"
            placeholder={f.placeholder}
            aria-label={f.label}
            className="h-8 w-20 rounded-full border border-border bg-background px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      ))}
    </div>
  );
}
