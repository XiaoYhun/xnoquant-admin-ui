"use client";
import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAccounts } from "@/hooks/api/use-accounts";
import { useVenues } from "@/hooks/api/use-venues";
import type { StrategyRow } from "@/lib/mock/strategies";

const ACCOUNT_SLOTS = ["Account 1", "Account 2"];

// MVP: no real API call — "Start paper trading" just closes the dialog (per brief).
export function StartPaperTradingDialog({
  strategy,
  onOpenChange,
}: {
  strategy: StrategyRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: accounts = [] } = useAccounts();
  const { data: venues = [] } = useVenues();
  // Keyed by slot index; falls back to the Nth account so each row starts pre-filled
  // (matches the Figma design) without needing an effect to sync default state.
  const [selectedOverrides, setSelectedOverrides] = useState<Record<number, string>>({});
  const selected = ACCOUNT_SLOTS.map((_, index) => selectedOverrides[index] ?? accounts[index]?.id ?? "");

  const venueName = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return venues.find((v) => v.id === account?.venue_id)?.name ?? "—";
  };

  return (
    <Dialog open={!!strategy} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[20px] border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start paper trading</DialogTitle>
          <DialogDescription>You are about to start paper trading for this strategy.</DialogDescription>
        </DialogHeader>

        {strategy && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Strategy</span>
                <span className="font-medium text-foreground">{strategy.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Timeframe</span>
                <span className="font-medium text-foreground">{strategy.timeframe}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Market</span>
                <span className="font-medium text-foreground">{strategy.market}</span>
              </div>
            </div>

            {ACCOUNT_SLOTS.map((label, index) => (
              <div key={label} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2">
                <div className="flex flex-col gap-1.5 px-1">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <Select
                    value={selected[index]}
                    onValueChange={(v) => setSelectedOverrides((prev) => ({ ...prev, [index]: v ?? "" }))}
                  >
                    <SelectTrigger className="h-10 w-full rounded-[20px] border-border bg-background px-3 text-sm text-foreground">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selected[index] && (
                  <div className="flex items-center gap-6 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="text-muted-foreground">Venue</span>
                      <span className="font-medium text-foreground">{venueName(selected[index])}</span>
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="text-muted-foreground">Asset</span>
                      <span className="font-medium text-foreground">{strategy.universe}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="flex-1 rounded-full">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="button" className="flex-1 rounded-full">
              Start paper trading
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
