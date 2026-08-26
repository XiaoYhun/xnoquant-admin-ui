"use client";
import { cn } from "@/lib/utils";
import type { PromotionStage, Strategy } from "@/types/domain";

// How far a strategy has climbed the promotion ladder, in six steps:
//
//   Not simulated -> Backtested -> Paper trade promoted -> Paper trading
//                                -> Live trade promoted -> Live trading
//
// Two different things decide where a strategy sits. Which RUNG it's on comes off the strategy
// record: `paper_approved_version` / `live_approved_version` are the versions each basket has
// pinned. Whether it is merely cleared for that rung or actually TRADING on it needs the run list
// — a promotion is permission, not activity — so callers with runs to hand get the finer reading
// and callers without one fall back to the "promoted" wording, which is never wrong.
//
// Comparing an approval to `version` also says whether the clearance still applies: editing the
// code bumps `version` and strands the approval behind it, and the API refuses to launch until an
// admin re-promotes. That's reported as `stale` rather than as a plain promotion.
export type StrategyStage =
  | "none"
  | "backtested"
  | "paper-promoted"
  | "paper-trading"
  | "live-promoted"
  | "live-trading";

/** The coarse rung, for the things that branch on the ladder rather than on the wording. */
export type StageRung = "backtest" | "paper" | "live";

/**
 * The ladder in climbing order — what "sort by stage" has to mean. Alphabetical would put
 * Backtested above Live trading, which is backwards for a promotion review.
 */
export const STAGE_ORDER: StrategyStage[] = [
  "none",
  "backtested",
  "paper-promoted",
  "paper-trading",
  "live-promoted",
  "live-trading",
];

const STAGE_LABEL: Record<StrategyStage, string> = {
  none: "Not simulated",
  backtested: "Backtested",
  "paper-promoted": "Paper trade promoted",
  "paper-trading": "Paper trading",
  "live-promoted": "Live trade promoted",
  "live-trading": "Live trading",
};

export type StageInfo = {
  stage: StrategyStage;
  rung: StageRung;
  label: string;
  /** True when a promotion exists but is pinned to an older version than the current code. */
  stale: boolean;
  /** Trading right now — a run of this rung's mode is live. Drives the pulsing dot. */
  active: boolean;
};

/** The run facts the stage reading needs; a subset of `Run` so mock rows satisfy it too. */
type StageRun = { mode?: string | null; status?: string | null };

export function strategyStage(
  strategy: Pick<Strategy, "version" | "paper_approved_version" | "live_approved_version">,
  runs?: StageRun[],
): StageInfo {
  const { version, paper_approved_version: paper, live_approved_version: live } = strategy;
  const stale = (live != null && live !== version) || (paper != null && paper !== version);
  const isRunning = (mode: string) => !!runs?.some((r) => r.mode === mode && r.status === "running");
  const info = (stage: StrategyStage, rung: StageRung, active: boolean): StageInfo => ({
    stage,
    rung,
    label: STAGE_LABEL[stage],
    stale,
    active,
  });

  // Membership, not version equality: a stale approval still puts the strategy in the basket, and
  // the promote/run controls treat it that way (see nextPromotionStage / launchMode).
  if (live != null) {
    const active = isRunning("live");
    return info(active ? "live-trading" : "live-promoted", "live", active);
  }
  if (paper != null) {
    const active = isRunning("paper");
    return info(active ? "paper-trading" : "paper-promoted", "paper", active);
  }
  // "Backtested" is a claim about a finished simulation, so it wants a completed run — a backtest
  // still in flight has not produced anything to judge yet.
  const backtested = !!runs?.some((r) => r.mode === "backtest" && r.status === "completed");
  return info(backtested ? "backtested" : "none", "backtest", false);
}

// `ring` is spelled out rather than derived from `text`: Tailwind only emits classes it can see
// literally in the source, so a runtime `text-` -> `border-` swap produced a class that never
// existed and the hollow dot fell back to the default border grey.
const STAGE_STYLE: Record<StageRung, { dot: string; glow: string; ring: string; text: string }> = {
  backtest: { dot: "bg-[#9db2ce]", glow: "", ring: "border-[#9db2ce]", text: "text-[#9db2ce]" },
  paper: {
    dot: "bg-[#2d84ff]",
    glow: "shadow-[0_0_6px_1px_rgba(45,132,255,0.5)]",
    ring: "border-[#7fb2ff]",
    text: "text-[#7fb2ff]",
  },
  live: {
    dot: "bg-[#67e1c1]",
    glow: "shadow-[0_0_6px_1px_rgba(103,225,193,0.5)]",
    ring: "border-[#67e1c1]",
    text: "text-[#67e1c1]",
  },
};

/**
 * `● Paper running · v4` — the strategy's ladder position and the version it's on.
 *
 * `showVersion` is off wherever the version already has its own column; repeating it inside the
 * badge just doubles it on the same row.
 */
export function StrategyStageBadge({
  strategy,
  runs,
  className,
  showVersion = true,
}: {
  strategy: Pick<Strategy, "version" | "paper_approved_version" | "live_approved_version">;
  /** The strategy's runs, if the caller has them — without these a rung reads as "promoted". */
  runs?: StageRun[];
  className?: string;
  showVersion?: boolean;
}) {
  const { rung, label, stale, active } = strategyStage(strategy, runs);
  const style = STAGE_STYLE[rung];
  return (
    <span
      className={cn("flex shrink-0 items-center gap-1.5 text-xs font-medium", className)}
      title={
        stale
          ? "Promoted at an earlier version — editing the code revoked it. An admin must re-promote before this can run."
          : active
            ? undefined
            : label === STAGE_LABEL["paper-promoted"] || label === STAGE_LABEL["live-promoted"]
              ? "Cleared for this stage, but not currently trading."
              : undefined
      }
    >
      {/* Filled and pulsing while it trades; a hollow ring once it's only cleared to. */}
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          active
            ? cn("animate-pulse", style.dot, style.glow)
            : cn("border-[1.5px] bg-transparent", style.ring),
        )}
      />
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
