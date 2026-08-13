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
import { useResetRisk } from "@/hooks/api/use-risk";
import type { AccountRiskThreshold } from "@/types/domain";

// The "Restart" action on a Stop-trading row (Figma 14975:44103). `POST /api/risk/reset` is not a
// bare button: it re-baselines the portfolio and every monitored account to the capital the admin
// confirms they actually hold after the Red-triggered stop/flatten, and that figure becomes both
// the new baseline AND the new high-water mark. Getting it wrong silently distorts every later
// drawdown reading, so the numbers are shown for confirmation rather than assumed.
//
// Prefilled from the current thresholds, which are what the platform believed before the halt.
const INPUT =
  "h-9 w-40 shrink-0 rounded-lg border border-border bg-background px-3 text-right text-sm text-white outline-none focus:border-white/25";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioBaseline: number | null;
  accounts: AccountRiskThreshold[];
};

export function ResetRiskDialog(props: Props) {
  const { open, onOpenChange, portfolioBaseline, accounts } = props;
  // Keyed on the prefill, so reopening — or the thresholds query resolving after this was
  // opened — remounts the form with fresh values instead of syncing them through an effect.
  const seed = `${portfolioBaseline ?? ""}|${accounts.map((a) => `${a.account_id}:${a.baseline_equity}`).join(",")}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Restart trading</DialogTitle>
          <DialogDescription>
            Confirm the capital actually held now. These become the new baselines and the new
            high-water marks for every future drawdown reading, and the halt is lifted.
          </DialogDescription>
        </DialogHeader>
        {open && <ResetForm key={seed} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function ResetForm({ onOpenChange, portfolioBaseline, accounts }: Props) {
  const reset = useResetRisk();
  const [portfolio, setPortfolio] = useState(portfolioBaseline == null ? "" : String(portfolioBaseline));
  const [perAccount, setPerAccount] = useState<Record<string, string>>(() =>
    Object.fromEntries(accounts.map((a) => [a.account_id, String(a.baseline_equity)])),
  );

  const portfolioNum = Number(portfolio);
  const entries = accounts.map((a) => [a.account_id, Number(perAccount[a.account_id] ?? "")] as const);
  const valid =
    portfolio.trim() !== "" &&
    Number.isFinite(portfolioNum) &&
    portfolioNum > 0 &&
    entries.every(([, v]) => Number.isFinite(v) && v > 0);

  return (
    <>
      <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto py-2">
        <label className="flex items-center justify-between gap-4">
          <span className="min-w-0 truncate text-sm font-medium text-white">Portfolio (all accounts)</span>
          <input
            className={INPUT}
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            inputMode="decimal"
          />
        </label>
        {accounts.map((a) => (
          <label key={a.account_id} className="flex items-center justify-between gap-4">
            <span className="min-w-0 truncate text-sm text-muted-foreground" title={a.account_name}>
              {a.account_name}
            </span>
            <input
              className={INPUT}
              value={perAccount[a.account_id] ?? ""}
              onChange={(e) => setPerAccount((prev) => ({ ...prev, [a.account_id]: e.target.value }))}
              inputMode="decimal"
            />
          </label>
        ))}
        {accounts.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No account thresholds are configured, so only the portfolio baseline is re-confirmed.
          </p>
        )}
        {!!reset.error && <p className="text-xs text-destructive">{resourceErrorMessage(reset.error)}</p>}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={reset.isPending}>
          Cancel
        </Button>
        <Button
          disabled={!valid || reset.isPending}
          onClick={() =>
            reset.mutate(
              { portfolio_baseline_equity: portfolioNum, account_baselines: Object.fromEntries(entries) },
              { onSuccess: () => onOpenChange(false) },
            )
          }
        >
          {reset.isPending ? "Restarting…" : "Restart trading"}
        </Button>
      </DialogFooter>
    </>
  );
}
