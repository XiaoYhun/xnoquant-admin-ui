import { describe, it, expect } from "vitest";
import { strategyStage } from "./strategy-stage";

// The same comparison gates the Simulate modal's Mode selector (paper/live are only selectable
// when the approval is pinned to the CURRENT version), so these cases cover both surfaces.
const at = (version: number, paper?: number, live?: number) =>
  ({ version, paper_approved_version: paper, live_approved_version: live }) as Parameters<typeof strategyStage>[0];

describe("strategyStage", () => {
  it("is backtesting when nothing has been promoted", () => {
    expect(strategyStage(at(3))).toEqual({ stage: "backtest", label: "Backtesting", stale: false });
  });

  it("reports paper when the paper approval matches the current version", () => {
    expect(strategyStage(at(3, 3))).toEqual({ stage: "paper", label: "Paper running", stale: false });
  });

  it("prefers live over paper when both match", () => {
    expect(strategyStage(at(3, 3, 3))).toEqual({ stage: "live", label: "Live trading", stale: false });
  });

  it("falls back to backtesting when an approval is stranded behind an edit", () => {
    // v4 with a v3 approval: the API refuses to launch until an admin re-promotes, so calling
    // this "Paper running" would claim a capability the strategy no longer has.
    expect(strategyStage(at(4, 3))).toEqual({ stage: "backtest", label: "Backtesting", stale: true });
    expect(strategyStage(at(4, 3, 3))).toEqual({ stage: "backtest", label: "Backtesting", stale: true });
  });

  it("treats a stale live approval as stale even while paper is current", () => {
    // Re-promoted to paper at v4 but live is still pinned to v3 — paper is what it can do.
    expect(strategyStage(at(4, 4, 3))).toEqual({ stage: "paper", label: "Paper running", stale: false });
  });
});
