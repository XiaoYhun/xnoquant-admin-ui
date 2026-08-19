import { describe, it, expect } from "vitest";
import { strategyStage, nextPromotionStage, launchMode } from "./strategy-stage";

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

describe("nextPromotionStage", () => {
  const s = (paper: number | null, live: number | null) => ({
    paper_approved_version: paper,
    live_approved_version: live,
  });
  it("offers paper to a strategy that has never been promoted", () => {
    expect(nextPromotionStage(s(null, null))).toBe("paper");
  });
  it("offers live once the strategy is in the paper basket", () => {
    expect(nextPromotionStage(s(3, null))).toBe("live");
  });
  it("still offers live when the paper approval has gone stale", () => {
    // The regression: strategyStage() calls a stale strategy `backtest`, which offered "Promote to
    // paper" right beside the "Demote paper" button acting on that very promotion.
    expect(nextPromotionStage(s(33, null))).toBe("live");
  });
  it("offers nothing above live", () => {
    expect(nextPromotionStage(s(2, 2))).toBeNull();
    expect(nextPromotionStage(s(2, 1))).toBeNull();
  });
});

describe("launchMode", () => {
  const s = (paper: number | null, live: number | null) => ({
    paper_approved_version: paper,
    live_approved_version: live,
  });
  it("backtests a strategy that has never been promoted", () => {
    expect(launchMode(s(null, null))).toBe("backtest");
  });
  it("runs paper once it's in the paper basket, stale approval included", () => {
    expect(launchMode(s(3, null))).toBe("paper");
    expect(launchMode(s(33, null))).toBe("paper");
  });
  it("runs live from the live basket", () => {
    expect(launchMode(s(2, 2))).toBe("live");
  });
});
