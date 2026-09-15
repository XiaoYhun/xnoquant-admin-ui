import { describe, expect, it } from "vitest";
import { resolveSamplePeriod } from "./sample-period";

describe("resolveSamplePeriod", () => {
  it("is not a backtest at all outside mode 'backtest'", () => {
    for (const mode of ["paper", "live"] as const) {
      const r = resolveSamplePeriod({ mode, oosStartDate: "2024-01-01", isAdmin: true, period: "IS" });
      expect(r.isBacktest).toBe(false);
      expect(r.splitAvailable).toBe(false);
      expect(r.sample).toBeUndefined();
      expect(r.periodHint).toBe("This run has no in-sample / out-of-sample split.");
    }
  });

  it("disables the split for a non-admin, pinning to All regardless of the selected period", () => {
    const r = resolveSamplePeriod({ mode: "backtest", oosStartDate: "2024-01-01", isAdmin: false, period: "OS" });
    expect(r.isBacktest).toBe(true);
    expect(r.splitAvailable).toBe(false);
    expect(r.sample).toBeUndefined();
    expect(r.periodHint).toBe("Out-of-sample results are admin-only.");
  });

  it("disables the split for a backtest with no oos_start_date, even for an admin", () => {
    const r = resolveSamplePeriod({ mode: "backtest", oosStartDate: null, isAdmin: true, period: "OS" });
    expect(r.splitAvailable).toBe(false);
    expect(r.sample).toBeUndefined();
    expect(r.periodHint).toBe("This run has no in-sample / out-of-sample split.");
  });

  it("sends the matching sample for an admin backtest with a readable split", () => {
    const base = { mode: "backtest" as const, oosStartDate: "2024-01-01", isAdmin: true };
    expect(resolveSamplePeriod({ ...base, period: "All" })).toMatchObject({ splitAvailable: true, sample: "all" });
    expect(resolveSamplePeriod({ ...base, period: "IS" })).toMatchObject({ splitAvailable: true, sample: "in_sample" });
    expect(resolveSamplePeriod({ ...base, period: "OS" })).toMatchObject({
      splitAvailable: true,
      sample: "out_of_sample",
    });
  });

  it("has no hint once the split is actually available", () => {
    const r = resolveSamplePeriod({ mode: "backtest", oosStartDate: "2024-01-01", isAdmin: true, period: "All" });
    expect(r.periodHint).toBeUndefined();
  });
});
