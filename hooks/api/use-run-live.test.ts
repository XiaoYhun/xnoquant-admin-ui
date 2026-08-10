import { describe, it, expect } from "vitest";
import { toLiveSharpeSample } from "./use-run-live";

describe("toLiveSharpeSample", () => {
  it("prefers sharpe_annualized and reads updated_at_ms", () => {
    expect(
      toLiveSharpeSample({ sharpe: 1.2, sharpe_annualized: 3.4, updated_at_ms: 1000 }),
    ).toEqual({ ts: 1000, sharpe: 3.4 });
  });

  it("falls back to sharpe", () => {
    expect(toLiveSharpeSample({ sharpe: 1.5, updated_at_ms: 2 })).toEqual({ ts: 2, sharpe: 1.5 });
  });

  it("returns null without a sharpe field", () => {
    expect(toLiveSharpeSample({ net_pnl: 1 })).toBeNull();
  });
});
