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
  return `${sign}${n.toFixed(2)}%`;
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
