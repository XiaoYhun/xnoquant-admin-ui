"use client";
import { useState } from "react";
import { DangerTriangle, Rocket } from "@solar-icons/react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts } from "@/hooks/api/use-accounts";
import { useLaunchRun, type LaunchRequest } from "@/hooks/api/use-runs";
import type { PaperRunRow } from "@/lib/mock/paper-runs";
import type { StrategyType } from "@/types/domain";

// Figma node 13982:130240 ("Confirm live trade") — opened from a paper run's detail panel to
// promote it to live: pick the HFT execution style, bind account(s) (two legs for arbitrage),
// and launch via `useLaunchRun` (`POST /api/runs`).

const EXECUTION_TYPES: { value: StrategyType; label: string }[] = [
  { value: "taker", label: "Taker" },
  { value: "maker", label: "Maker" },
  { value: "arbitrage", label: "Arbitrage" },
];

function AccountSelect({
  label,
  value,
  onChange,
  accounts,
}: {
  label: string;
  value: string | undefined;
  onChange: (id: string) => void;
  accounts: { id: string; name: string }[];
}) {
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-2xl border border-border bg-surface p-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="h-auto w-full justify-between rounded-[20px] border-border bg-background px-3 py-2.5 text-sm text-white shadow-xs">
          <SelectValue placeholder="Select account..." />
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
  );
}

export function StartLiveTradingDialog({ run }: { run: PaperRunRow }) {
  const [open, setOpen] = useState(false);
  const { data: accounts } = useAccounts();

  const [executionType, setExecutionType] = useState<StrategyType>(run.executionType);
  const isArbitrage = executionType === "arbitrage";

  const [account1, setAccount1] = useState<string>();
  const [account2, setAccount2] = useState<string>();

  const handleExecutionTypeChange = (value: string) => {
    if (value !== "taker" && value !== "maker" && value !== "arbitrage") return;
    setExecutionType(value);
    if (value !== "arbitrage") setAccount2(undefined); // leg2 only applies to arbitrage
  };

  const launchRun = useLaunchRun();

  const strategyId = run.strategyId;
  const symbolIds = run.symbolIds;

  const accountsReady = isArbitrage ? !!account1 && !!account2 : !!account1;
  const canSubmit = accountsReady && !!strategyId && symbolIds.length > 0 && !launchRun.isPending;

  const handleSubmit = () => {
    if (!canSubmit || !account1 || !strategyId) return;
    const req: LaunchRequest = {
      strategy_id: strategyId,
      account_id: account1,
      extra_account_ids: isArbitrage && account2 ? [account2] : [],
      symbol_ids: symbolIds,
      mode: "live",
      live_condition: null, // live runs use the live pipeline, not the backtest cost model
    };
    launchRun.mutate(req, { onSuccess: () => setOpen(false) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="h-[34px] gap-1.5 rounded-full bg-gradient-to-b from-[#fffbd6] to-[#f1c617] text-[#0d0d0d] hover:opacity-90"
        >
          <Rocket weight="Bold" className="size-3.5" />
          Start live trading
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[480px] gap-0 rounded-[20px] border-border bg-background p-0">
        <div className="bg-surface px-4 py-2.5">
          <DialogTitle className="bg-gradient-to-b from-[#fffbd6] to-[#f1c617] bg-clip-text text-lg font-semibold text-transparent">
            Start Live Trading
          </DialogTitle>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">You are about to start live trade for this strategy.</p>

            <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Strategy</span>
                <span className="text-sm font-medium text-white">{run.strategyName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Timeframe</span>
                <span className="text-sm font-medium text-white">{run.timeframe}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Market</span>
                <span className="text-sm font-medium text-white">
                  {run.symbols.map((s) => s.market).join(", ")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Current Status</span>
                <span className="bg-[linear-gradient(168deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-sm text-transparent">
                  Paper trading
                </span>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">HFT Execution Type</span>
            <Select value={executionType} onValueChange={(v) => v && handleExecutionTypeChange(v)}>
              <SelectTrigger className="h-auto w-full justify-between rounded-[20px] border-border bg-surface px-3 py-2.5 text-sm text-white shadow-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXECUTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isArbitrage ? (
            <>
              <AccountSelect label="Account 1" value={account1} onChange={setAccount1} accounts={accounts ?? []} />
              <AccountSelect label="Account 2" value={account2} onChange={setAccount2} accounts={accounts ?? []} />
            </>
          ) : (
            <AccountSelect label="Account" value={account1} onChange={setAccount1} accounts={accounts ?? []} />
          )}

          <div className="flex items-center gap-3 rounded-xl border border-[#fffbd6]/50 bg-[#f1c617]/20 p-2">
            <DangerTriangle weight="Outline" className="size-6 shrink-0 text-[#f1c617]" />
            <p className="bg-gradient-to-b from-[#fffbd6] to-[#f1c617] bg-clip-text text-sm leading-5 text-transparent">
              Starting live trade will execute real orders on the market. Make sure the bot configuration is correct
              before proceeding.
            </p>
          </div>

          {launchRun.isError && (
            <p className="text-xs text-destructive">
              {launchRun.error instanceof Error
                ? launchRun.error.message
                : "Failed to start live trading. Please try again."}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 cursor-pointer rounded-full border border-border bg-black px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 cursor-pointer rounded-full bg-gradient-to-b from-[#fffbd6] to-[#f1c617] px-3 py-2 text-xs font-medium text-[#0d0d0d] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {launchRun.isPending ? "Starting…" : "Start live trading"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
