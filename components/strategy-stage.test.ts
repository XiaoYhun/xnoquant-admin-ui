import { describe, it, expect } from "vitest";
import { strategyStage, nextPromotionStage, launchMode } from "./strategy-stage";

// The same comparison gates the Simulate modal's Mode selector (paper/live are only selectable
// when the approval is pinned to the CURRENT version), so these cases cover both surfaces.
const at = (version: number, paper?: number, live?: number) =>
  ({ version, paper_approved_version: paper, live_approved_version: live }) as Parameters<typeof strategyStage>[0];

describe("strategyStage", () => {
  const s = (version: number, paper: number | null, live: number | null) => ({
    version,
    paper_approved_version: paper,
    live_approved_version: live,
  });
  const run = (mode: string, status: string) => ({ mode, status });

  it("distinguishes never-run from backtested", () => {
    expect(strategyStage(s(1, null, null)).label).toBe("Not simulated");
    expect(strategyStage(s(1, null, null), []).label).toBe("Not simulated");
    // A backtest still in flight has produced nothing to judge yet.
    expect(strategyStage(s(1, null, null), [run("backtest", "running")]).label).toBe("Not simulated");
    expect(strategyStage(s(1, null, null), [run("backtest", "completed")]).label).toBe("Backtested");
  });

  it("separates permission to trade a rung from actually trading it", () => {
    const paper = s(4, 4, null);
    expect(strategyStage(paper, [run("paper", "stopped")])).toMatchObject({
      stage: "paper-promoted",
      label: "Paper trade promoted",
      active: false,
    });
    expect(strategyStage(paper, [run("paper", "running")])).toMatchObject({
      stage: "paper-trading",
      label: "Paper trading",
      active: true,
    });

    const live = s(2, 2, 2);
    expect(strategyStage(live, [run("live", "stopped")]).label).toBe("Live trade promoted");
    expect(strategyStage(live, [run("live", "running")]).label).toBe("Live trading");
  });

  it("reads a rung's activity from that rung's own mode", () => {
    // A paper run left running does not make a live-promoted strategy "Live trading".
    expect(strategyStage(s(2, 2, 2), [run("paper", "running")]).label).toBe("Live trade promoted");
  });

  it("falls back to the promoted wording when the caller has no runs", () => {
    // Never wrong, just less specific — a promotion is permission, so "promoted" always holds.
    expect(strategyStage(s(2, 2, 2)).label).toBe("Live trade promoted");
    expect(strategyStage(s(4, 4, null)).active).toBe(false);
  });

  it("prefers the higher rung when both baskets hold the strategy", () => {
    expect(strategyStage(s(2, 2, 2)).rung).toBe("live");
  });

  it("keeps a stranded approval on its rung, but flags it stale", () => {
    // Basket membership decides the rung, so this stays paper — matching what the promote and run
    // buttons offer — while `stale` records that the approval no longer authorises a launch.
    expect(strategyStage(s(34, 33, null))).toMatchObject({ rung: "paper", stale: true });
    expect(strategyStage(s(2, 2, 1)).stale).toBe(true);
    expect(strategyStage(s(2, 2, 2)).stale).toBe(false);
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
