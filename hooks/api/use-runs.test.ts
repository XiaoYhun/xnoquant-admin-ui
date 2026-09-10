import { describe, it, expect } from "vitest";
import { realSummary } from "./use-runs";
import type { RunSummary } from "@/types/domain";

// `oversized` marks a run whose parquet artifacts were too large for the result service to load.
// The API still answers 200, but every field on the body is a zeroed placeholder.
const summary = (over: Partial<RunSummary> = {}) =>
  ({ net_pnl: 1234, sharpe_annualized: 2.5, total_trades: 99, ...over }) as RunSummary;

describe("realSummary", () => {
  it("passes a computed summary through untouched", () => {
    const s = summary();
    expect(realSummary(s)).toBe(s);
  });

  it("passes one that explicitly reports it is not oversized", () => {
    const s = summary({ oversized: false });
    expect(realSummary(s)).toBe(s);
  });

  it("drops an oversized summary, whose numbers are placeholders rather than results", () => {
    expect(realSummary(summary({ oversized: true }))).toBeUndefined();
  });

  it("leaves nothing as nothing", () => {
    expect(realSummary(undefined)).toBeUndefined();
  });
});
