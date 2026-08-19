"use client";
import { cn } from "@/lib/utils";
import type { PromotionStage, Strategy } from "@/types/domain";

// How far a strategy has climbed the promotion ladder — backtest -> paper -> live.
//
// Read straight off the strategy record: `paper_approved_version` / `live_approved_version` are
// the versions each basket has pinned, so comparing them to `version` says both which stage the
// strategy is cleared for AND whether that clearance still applies. Editing the code bumps
// `version`, which strands the approval behind it; the API then refuses to launch until an admin
// re-promotes, so a stale approval is reported as such rather than as a live promotion.
export type StrategyStage = "backtest" | "paper" | "live";

export type StageInfo = {
  stage: StrategyStage;
  label: string;
  /** True when a promotion exists but is pinned to an older version than the current code. */
  stale: boolean;
};

export function strategyStage(strategy: Pick<Strategy, "version" | "paper_approved_version" | "live_approved_version">): StageInfo {
  const { version, paper_approved_version: paper, live_approved_version: live } = strategy;
  if (live != null && live === version) return { stage: "live", label: "Live trading", stale: false };
  if (paper != null && paper === version) return { stage: "paper", label: "Paper running", stale: false };
  // A promotion pinned to an older version no longer authorises anything — the strategy is back
  // to backtesting until it's re-promoted.
  const stale = (live != null && live !== version) || (paper != null && paper !== version);
  return { stage: "backtest", label: "Backtesting", stale };
}

const STAGE_STYLE: Record<StrategyStage, { dot: string; text: string }> = {
  backtest: { dot: "bg-[#9db2ce]", text: "text-[#9db2ce]" },
  paper: { dot: "bg-[#2d84ff] shadow-[0_0_6px_1px_rgba(45,132,255,0.5)]", text: "text-[#7fb2ff]" },
  live: { dot: "bg-[#67e1c1] shadow-[0_0_6px_1px_rgba(103,225,193,0.5)]", text: "text-[#67e1c1]" },
};

/**
 * `● Paper running · v4` — the strategy's ladder position and the version it's on.
 *
 * `showVersion` is off wherever the version already has its own column; repeating it inside the
 * badge just doubles it on the same row.
 */
export function StrategyStageBadge({
  strategy,
  className,
  showVersion = true,
}: {
  strategy: Pick<Strategy, "version" | "paper_approved_version" | "live_approved_version">;
  className?: string;
  showVersion?: boolean;
}) {
  const { stage, label, stale } = strategyStage(strategy);
  const style = STAGE_STYLE[stage];
  return (
    <span
      className={cn("flex shrink-0 items-center gap-1.5 text-xs font-medium", className)}
      title={
        stale
          ? "Promoted at an earlier version — editing the code revoked it. An admin must re-promote before this can run."
          : undefined
      }
    >
      <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
      <span className={style.text}>{label}</span>
      {stale && <span className="text-[#f1c617]">(stale)</span>}
      {showVersion && (
        <>
          <span className="text-[#475467]">·</span>
          <span className="text-[#9db2ce]">v{strategy.version}</span>
        </>
      )}
    </span>
  );
}

/**
 * Pill colours for a "promote to <stage>" action, keyed by the rung being ENTERED — amber for
 * paper, green for live — so the button previews where the strategy is going rather than where it
 * is. Shared by the Create Strategy toolbar and the Strategy List row action.
 */
export const PROMOTE_PILL: Record<PromotionStage, string> = {
  paper: "border-[#f1c617]/40 bg-[rgba(241,198,23,0.12)] text-[#f1c617]",
  live: "border-[#67e1c1]/40 bg-[rgba(103,225,193,0.12)] text-[#67e1c1]",
};

/**
 * Run statuses that count as a paper run having succeeded, for the live rung's evidence check.
 *
 * `stopped` is included deliberately: a paper run tails a live feed and never completes on its
 * own, so every finished paper run ends up `stopped`. Requiring `completed` would make the live
 * promotion permanently unreachable. `running` is excluded — stop it and review before promoting.
 */
export const PAPER_RUN_SUCCEEDED = new Set(["stopped", "completed"]);

/**
 * The rung a strategy can be promoted to next, or null once it's live.
 *
 * Keyed on basket membership rather than on {@link strategyStage}, which reports `backtest` for a
 * strategy whose approval has gone stale. A stale paper approval still puts the strategy in the
 * paper basket — it's what "Demote paper" acts on — so the forward direction from there is live,
 * not paper again. Whether that promotion is actually allowed is a separate evidence check.
 */
export function nextPromotionStage(
  strategy: Pick<Strategy, "paper_approved_version" | "live_approved_version">,
): PromotionStage | null {
  if (strategy.live_approved_version != null) return null;
  return strategy.paper_approved_version != null ? "live" : "paper";
}

/**
 * The mode a launch from this strategy runs in: the highest rung it has been promoted to.
 *
 * Basket membership again, for the same reason as {@link nextPromotionStage} — a strategy with a
 * stale paper approval is still a paper strategy, and offering it a backtest run would be a step
 * backwards from what the ladder says it is.
 */
export function launchMode(
  strategy: Pick<Strategy, "paper_approved_version" | "live_approved_version">,
): "backtest" | "paper" | "live" {
  if (strategy.live_approved_version != null) return "live";
  return strategy.paper_approved_version != null ? "paper" : "backtest";
}
