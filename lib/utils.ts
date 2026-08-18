import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(n: number): string {
  return `${new Intl.NumberFormat("en-US").format(Math.round(n))} đ`;
}
export function formatPercent(n: number): string {
  const sign = n > 0 ? "+" : "";
  // Grouped: an annualized figure can run to four digits before the decimal point.
  return `${sign}${formatAmount(n)}%`;
}
/**
 * Short, readable handle for a run — `#019f4559-e48b` rather than a full uuid (Figma
 * 14175:48186): the first two dash-separated groups of the backend id, so what's on screen is a
 * literal prefix of the real id and can be matched against it by eye.
 *
 * Those twelve hex digits are exactly the 48-bit millisecond timestamp of a v7 uuid, so they
 * stay unique per run but sort chronologically and share a leading group within any ~65s window
 * — runs created close together look alike at a glance. The run tables hover-reveal the full id
 * via `title`; the results-tab run picker does not.
 */
export function shortRunId(id: string): string {
  const [first, second] = id.split("-");
  return `#${second ? `${first}-${second}` : first}`;
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
    .format(n)
    .replace(/\s/g, "");
}

/**
 * A money-like magnitude: grouped thousands and a fixed two decimals — `1,000,000.00`.
 *
 * Every PnL, drawdown, fee and turnover figure goes through this so they line up column to column.
 * Bare `toLocaleString()` was the old default in several places and gives *up to* three decimals
 * with no minimum, so the same run rendered `-50,014.108` in one card and `-50,014` in the next.
 *
 * Counts keep their own integer formatting — a fill count has no cents. Chart AXIS labels keep
 * `formatCompact`, since a 111,000,000.00 tick would not fit; their tooltips use this.
 */
export function formatAmount(n: number, digits = 2): string {
  // `-0` and values that round to it must not print "-0.00": callers prefix their own sign from
  // `n >= 0`, which is TRUE for -0, so the raw output collided into "+-0.0%".
  const safe = Object.is(n, -0) || Number(n.toFixed(digits)) === 0 ? 0 : n;
  return safe.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** `formatAmount` with an explicit leading `+` on gains — `+1,000.00` / `-1,000.00`. */
export function formatSignedAmount(n: number, digits = 2): string {
  return `${n > 0 ? "+" : ""}${formatAmount(n, digits)}`;
}
