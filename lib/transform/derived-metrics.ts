import type { RunSummary } from "@/types/domain";

// F-074/F-075: RunSummary metrics the backend doesn't compute server-side. Ported from the
// backend team's reference UI (hft-platform web/src/features/runs/derived-metrics.ts) so
// run-as-mft.ts and yearly-statistics.tsx share one implementation instead of inlining the
// formulas twice.

/** Mean win ÷ |mean loss| — how much a typical winner pays relative to a typical loser. */
export function payoffRatio(s: RunSummary): number | null {
  return s.avg_loss === 0 ? null : s.avg_win / Math.abs(s.avg_loss);
}

/**
 * Net PnL ÷ max drawdown, both in raw PnL units (unannualized). Distinct from the server's
 * `calmar`, which annualizes net PnL first — "recovery factor" is conventionally this
 * unannualized ratio, so it's computed directly here rather than re-exporting `calmar` under
 * this name.
 */
export function recoveryFactor(s: RunSummary): number | null {
  return s.max_drawdown === 0 ? null : s.net_pnl / s.max_drawdown;
}

/**
 * Expected PnL per trade: `win_rate * avg_win - (1 - win_rate) * |avg_loss|`. `avg_loss` is
 * already negative (mean of losing trades' pnl), so it's abs'd here to match the textbook
 * formula's sign convention.
 */
export function expectancy(s: RunSummary): number {
  return s.win_rate * s.avg_win - (1 - s.win_rate) * Math.abs(s.avg_loss);
}
