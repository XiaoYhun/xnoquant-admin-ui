"use client";
import { useState } from "react";
import { TrashBinTrash } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useDeletePortfolio } from "@/hooks/api/use-portfolios";
import { formatCurrency } from "@/lib/utils";
import type { Portfolio } from "@/types/domain";

// Brand gradient used across "running" status text, allocation amounts, and slider fill/thumb.
const GRADIENT_TEXT = "bg-[linear-gradient(170deg,#cff8ea_0%,var(--primary)_100%)] bg-clip-text text-transparent";

export function PortfolioList({
  portfolios,
  total,
  isLoading,
}: {
  portfolios: Portfolio[];
  total: number;
  isLoading: boolean;
}) {
  const deletePortfolio = useDeletePortfolio();
  const [pendingDelete, setPendingDelete] = useState<Portfolio | null>(null);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border shadow-[0_4px_12px_0_rgba(0,0,0,0.05)]">
      <header className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">All portfolios</h2>
        <span className="text-sm font-medium text-foreground">&bull; {total}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading&hellip;</p>}
        {!isLoading && portfolios.length === 0 && (
          <div className="flex flex-1 flex-col items-center rounded-xl border border-dashed border-border py-10">
            <p className="text-xs text-muted-foreground">No portfolios yet.</p>
          </div>
        )}
        {portfolios.map((p) => {
          // Fill % = this account's share of the portfolio's own total (no per-account
          // capital figure exists in the mock data to divide by instead).
          const shareTotal = p.sources.reduce((sum, s) => sum + s.amount, 0) || 1;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-4 rounded-xl border border-border px-4 py-3 shadow-[0_2px_8px_0_rgba(152,162,179,0.15)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-foreground">{p.name}</span>
                  <span className={`text-xs ${GRADIENT_TEXT}`}>
                    &bull; {p.status === "running" ? "Running" : "Stopped"}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${p.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setPendingDelete(p)}
                >
                  <TrashBinTrash weight="Outline" className="size-5" />
                </Button>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-muted-foreground">Total Allocation:</span>
                <span className="text-lg font-semibold text-foreground">{formatCurrency(p.total_allocation)}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">Sources (Live Accounts)</span>
                <div className="flex flex-col gap-2">
                  {p.sources.map((s) => (
                    <div
                      key={s.account_id}
                      className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-3 py-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{s.account_name}</span>
                        <span className={`text-sm font-semibold ${GRADIENT_TEXT}`}>{formatCurrency(s.amount)}</span>
                      </div>
                      <Slider
                        value={[(s.amount / shareTotal) * 100]}
                        disabled
                        className="[&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:bg-[linear-gradient(135deg,#cff8ea_0%,var(--primary)_100%)] [&_[data-slot=slider-thumb]]:opacity-100 [&_[data-slot=slider-track]]:h-[5px] [&_[data-slot=slider-track]]:bg-secondary [&_[data-slot=slider-range]]:bg-[linear-gradient(179deg,#cff8ea_0%,var(--primary)_100%)]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete portfolio</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{pendingDelete?.name}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePortfolio.isPending}
              onClick={() => {
                if (pendingDelete) {
                  deletePortfolio.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
