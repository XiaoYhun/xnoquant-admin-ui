"use client";
// MFT Simulate "running" screen — ports xno-builder's RunningSimulateScreen.tsx to our tokens.
// Shown by mft-results-view while the active strategy's status is running/queued/evaluating/
// waiting; flips out once useStrategyById's poll reports a terminal status.
import { useMemo } from "react";
import { CheckCircle } from "@solar-icons/react";
import { useCancelStrategy, useStrategyProgress, type StrategyInfo } from "@/hooks/api/use-strategy-run";

export function RunningSimulateScreen({ strategy }: { strategy: StrategyInfo }) {
  const { data: progress } = useStrategyProgress(strategy.id);
  const { mutate: cancelStrategy, isPending: isCancelling } = useCancelStrategy();

  const progressPercentage = progress?.progress_percentage ?? 0;
  const isCompleted = progressPercentage === 100;

  const progressText = useMemo(() => {
    if (strategy.status === "queued") return "Queued";
    if (strategy.status === "waiting") return "Waiting";
    return isCompleted ? "Completed" : `Running simulation...${progressPercentage}/100%`;
  }, [progressPercentage, strategy.status, isCompleted]);

  return (
    <div className="p-6">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center py-16">
        <div className="mb-8 w-full">
          <div className="relative h-12 w-full overflow-hidden rounded-full border border-border bg-background">
            <div
              className="absolute top-0 left-0 flex h-full items-center bg-[linear-gradient(90deg,#67e1c1_0%,#168b74_100%)] px-6 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progressPercentage, 0)}%` }}
            >
              <span className="text-sm font-semibold whitespace-nowrap text-white/90">{progressText}</span>
            </div>
            <div className="absolute top-0 right-0 flex h-full items-center px-6 text-white">
              {isCompleted ? (
                <CheckCircle weight="Outline" className="size-5" />
              ) : (
                <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
            </div>
          </div>
        </div>

        {!isCompleted && (
          <button
            type="button"
            onClick={() => strategy.id && cancelStrategy(strategy.id)}
            disabled={isCancelling}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-secondary px-6 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCancelling ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                <span>Cancelling...</span>
              </>
            ) : (
              <span>Cancel</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
