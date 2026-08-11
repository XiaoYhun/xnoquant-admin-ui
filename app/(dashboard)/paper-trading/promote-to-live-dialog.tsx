"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { resourceErrorMessage } from "@/lib/api-client";
import { usePromoteStrategy } from "@/hooks/api/use-live-basket";
import type { PaperRunRow } from "@/lib/mock/paper-runs";

// Figma 14791:23301 ("Promote to Live Basket") — opened from a paper run's row action. Promotion
// is per *strategy* (POST /api/live-basket/{strategy_id}); the run this was judged from rides
// along as `based_on_run_id` so the Alpha pool can show its metrics.

export function PromoteToLiveDialog({
  run,
  open,
  onOpenChange,
  onPromoted,
}: {
  run: PaperRunRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPromoted: () => void;
}) {
  const [note, setNote] = useState("");
  const promote = usePromoteStrategy();

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setNote("");
      promote.reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = () => {
    if (!run?.strategyId) return;
    promote.mutate(
      { strategyId: run.strategyId, note: note.trim() || null, based_on_run_id: run.id },
      { onSuccess: onPromoted },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[480px] gap-0 overflow-hidden rounded-[20px] border-border bg-background p-0">
        <div className="bg-surface px-4 py-2.5">
          <DialogTitle className="text-lg font-semibold text-white">Promote to Live Basket</DialogTitle>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Approve &ldquo;{run?.strategyName}&rdquo; for live trading. Any later edit to its code will revoke this
            approval until it&rsquo;s re-promoted.
          </p>

          <label className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-2">
            <span className="text-sm text-muted-foreground">Note</span>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reviewed paper result, Sharpe 1.8 over 3 months..."
              className="min-h-[72px] resize-none rounded-xl border-border bg-background text-sm text-white"
            />
          </label>

          {promote.isError && (
            <p className="text-xs text-destructive">{resourceErrorMessage(promote.error, "the live basket")}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="flex-1 cursor-pointer rounded-full border border-border bg-black px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!run?.strategyId || promote.isPending}
            className="flex-1 cursor-pointer rounded-full bg-[linear-gradient(168deg,#cff8ea_0%,#67e1c1_100%)] px-3 py-2 text-xs font-medium text-[#0d0d0d] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {promote.isPending ? "Promoting…" : "Promote to Live"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
