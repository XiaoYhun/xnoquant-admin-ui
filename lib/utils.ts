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
 * Short, readable handle for a run — `#XfPfqf36LY` rather than a full uuid (Figma 14175:48186).
 * Uses the tail of the id: run uuids are v7-style, so the leading characters are a shared
 * timestamp prefix and the distinguishing bits are at the end.
 */
export function shortRunId(id: string): string {
  return `#${id.replace(/-/g, "").slice(-10)}`;
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
    .format(n)
    .replace(/\s/g, "");
}
