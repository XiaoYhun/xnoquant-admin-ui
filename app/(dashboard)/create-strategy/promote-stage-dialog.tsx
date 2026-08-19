"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { resourceErrorMessage } from "@/lib/api-client";
import { usePromoteStrategy } from "@/hooks/api/use-promotions";
import type { PromotionStage } from "@/types/domain";

// Moves a strategy up the ladder: backtest -> paper -> live. Admin-only, and the server checks
// the rung below is satisfied — promoting to paper needs a completed backtest at THIS version,
// promoting to live needs a version-matching paper promotion. Those come back as 422s with a
// caller-facing message, which is why the error is surfaced verbatim rather than summarised.
const NOTE_INPUT =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-white/25";

const STAGE_COPY: Record<PromotionStage, { title: string; blurb: string }> = {
  paper: {
    title: "Promote to paper",
    blurb:
      "Approves this strategy to run against the live feed with simulated fills. Requires a completed backtest at this exact version.",
  },
  live: {
    title: "Promote to live",
    blurb:
      "Approves this strategy to trade for real. Requires an existing paper promotion at this exact version.",
  },
};

export function PromoteStageDialog({
  open,
  onOpenChange,
  strategyId,
  strategyName,
  version,
  stage,
  basedOnRunId,
  onPromoted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyId: string;
  strategyName: string;
  version: number;
  /** The rung being promoted TO. */
  stage: PromotionStage;
  /** The run whose results justify this, when promoting from a run's row or detail panel. It is
   *  what Alpha pool joins on to show a promotion's metrics, so it is passed wherever known. */
  basedOnRunId?: string;
  onPromoted: (stage: PromotionStage) => void;
}) {
  const [note, setNote] = useState("");
  const promote = usePromoteStrategy();
  const copy = STAGE_COPY[stage];

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setNote("");
      promote.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {copy.blurb} Pins &ldquo;{strategyName}&rdquo; at{" "}
            <strong className="text-white">v{version}</strong> — any later edit revokes it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Note (optional)</span>
            <input
              className={NOTE_INPUT}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this version is approved"
            />
          </label>
          {!!promote.error && (
            <p className="text-xs text-destructive">{resourceErrorMessage(promote.error, "this strategy")}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={promote.isPending}>
            Cancel
          </Button>
          <Button
            disabled={promote.isPending}
            onClick={() =>
              promote.mutate(
                {
                  stage,
                  strategyId,
                  note: note.trim() || null,
                  ...(basedOnRunId ? { based_on_run_id: basedOnRunId } : {}),
                },
                {
                  onSuccess: () => {
                    handleOpenChange(false);
                    onPromoted(stage);
                  },
                },
              )
            }
          >
            {promote.isPending ? "Promoting…" : copy.title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
