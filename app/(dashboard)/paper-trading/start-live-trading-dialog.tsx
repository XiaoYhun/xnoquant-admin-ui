"use client";
import { useState } from "react";
import { DangerTriangle } from "@solar-icons/react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaperRunRow } from "@/lib/mock/paper-runs";

// Mock account options for the account-select row — this dialog never calls a real
// API ("Start live trading" just closes it), so venue/asset are a fixed local lookup
// rather than sourced from lib/mock/accounts.ts (which has no venue/asset fields).
const DEMO_ACCOUNTS = [
  { id: "paper-vps-ps", label: "Paper_VPS_PS (đ 500,000,000)", venue: "VPS Securities", asset: "VN30F1M" },
  { id: "paper-ssi-ps", label: "Paper_SSI_PS (đ 500,000,000)", venue: "SSI Securities", asset: "VN30F2M" },
  { id: "paper-hft-01", label: "Paper_HFT_01 (đ 250,000,000)", venue: "TCBS", asset: "VN30F1M" },
];

export function StartLiveTradingDialog({ run }: { run: PaperRunRow }) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(DEMO_ACCOUNTS[0].id);
  const account = DEMO_ACCOUNTS.find((a) => a.id === accountId) ?? DEMO_ACCOUNTS[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="rounded-full bg-gradient-to-b from-[#fffbd6] to-[#f1c617] text-[#0d0d0d] hover:opacity-90"
        >
          Start live trading
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="bg-gradient-to-b from-[#fffbd6] to-[#f1c617] bg-clip-text text-transparent">
            Start Live Trading
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">You are about to start live trade for this strategy.</p>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Strategy</span>
            <span className="font-medium text-foreground">{run.strategyName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Timeframe</span>
            <span className="font-medium text-foreground">{run.timeframe}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Market</span>
            <span className="font-medium text-foreground">
              {run.symbols.map((s) => s.market).join(", ")}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Status</span>
            <span className="font-medium text-primary">Paper trading</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">Account</span>
          <Select value={accountId} onValueChange={(v) => setAccountId(v ?? DEMO_ACCOUNTS[0].id)}>
            <SelectTrigger className="w-full rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEMO_ACCOUNTS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs">
            <div>
              <span className="text-muted-foreground">Venue</span>
              <p className="font-medium text-foreground">{account.venue}</p>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Asset</span>
              <p className="font-medium text-foreground">{account.asset}</p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-[#f1c617]/40 bg-[#f1c617]/10 p-3 text-xs text-[#f1c617]">
          <DangerTriangle size={18} weight="Outline" className="mt-0.5 shrink-0" />
          <p>
            Starting live trade will execute real orders on the market. Make sure the bot configuration is correct
            before proceeding.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="rounded-full">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            className="rounded-full bg-gradient-to-b from-[#fffbd6] to-[#f1c617] text-[#0d0d0d] hover:opacity-90"
            onClick={() => setOpen(false)}
          >
            Start live trading
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
