"use client";
import type { ReactNode } from "react";
import { QuestionCircle, CloseCircle } from "@solar-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PlusIcon } from "@/components/icons/plus";

// Figma node 14197:30033 — "Simulate" configuration modal opened from the toolbar's
// Simulate button. All fields are static display (no data wiring), matching the rest of
// the toolbar's no-op controls.

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-[20px] border border-border bg-background px-3 py-2.5 text-sm text-white shadow-xs ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function GroupBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2">
      <span className="text-sm font-medium text-white">{title}</span>
      {children}
    </div>
  );
}

export function SimulateModal({
  open,
  onOpenChange,
  strategyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyName: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[460px] gap-0 overflow-y-auto rounded-[20px] border-border bg-background p-0">
        <div className="bg-surface px-4 py-2.5">
          <DialogTitle className="bg-[linear-gradient(177deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-lg font-semibold text-transparent">
            Simulate &quot;{strategyName}&quot;
          </DialogTitle>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Bind this strategy to an account and one more symbols, then launch in paper or live mode.
          </p>

          <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Strategy</span>
              <span className="text-sm font-medium text-white">{strategyName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Timeframe</span>
              <span className="text-sm font-medium text-white">5min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Market</span>
              <span className="text-sm font-medium text-white">Crypto</span>
            </div>
          </div>

          <GroupBox title="General Configuration">
            <Field label="Account selection">
              <Pill>
                <span className="text-muted-foreground">Select account...</span>
                <QuestionCircle weight="Outline" className="size-4 shrink-0 text-muted-foreground" />
              </Pill>
            </Field>
            <Field label="Symbol">
              <Pill>USDT</Pill>
            </Field>
            <Field label="Balances">
              <div className="flex items-center gap-2">
                <Pill className="flex-1">USDT</Pill>
                <Pill className="flex-1">100000</Pill>
                <button type="button" aria-label="Remove balance" className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-white">
                  <CloseCircle weight="Outline" className="size-5" />
                </button>
              </div>
              <button
                type="button"
                className="mt-1 inline-flex w-fit cursor-pointer items-center gap-1 text-xs text-primary"
              >
                <PlusIcon className="size-4" />
                Add balance
              </button>
            </Field>
          </GroupBox>

          <GroupBox title="Execution">
            <div className="flex gap-2">
              <Field label="Max slice size">
                <Pill>1000</Pill>
              </Field>
              <Field label="TWAP interval (ms)">
                <Pill>1000</Pill>
              </Field>
              <Field label="Chase (ticks)">
                <Pill>100</Pill>
              </Field>
            </div>

            <div className="h-px bg-border" />

            <span className="text-sm text-[#d0d5dd]">Simulation only (paper)</span>
            <div className="flex gap-2">
              <Field label="Cancel ratio">
                <Pill>0</Pill>
              </Field>
              <Field label="Latency">
                <Pill>
                  <span>Zero</span>
                  <QuestionCircle weight="Outline" className="size-4 shrink-0 text-muted-foreground" />
                </Pill>
              </Field>
            </div>

            <div className="h-px bg-border" />

            <span className="text-sm text-[#d0d5dd]">Virtual channel (backtest cost model)</span>
            <div className="flex gap-2">
              <Field label="Rhai cost (ns)">
                <Pill>0</Pill>
              </Field>
              <Field label="L2 cost (ns)">
                <Pill>0</Pill>
              </Field>
              <Field label="Trade cost (ns)">
                <Pill>0</Pill>
              </Field>
            </div>
            <div className="flex gap-2">
              <Field label="L2 queue capacity">
                <Pill>64</Pill>
              </Field>
              <Field label="Trade queue capacity">
                <Pill>64</Pill>
              </Field>
            </div>
          </GroupBox>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 cursor-pointer rounded-full border border-border bg-black px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 cursor-pointer rounded-full bg-[linear-gradient(171deg,#cff8ea_0%,#67e1c1_100%)] px-3 py-2 text-xs font-medium text-[#0d0d0d] transition-opacity hover:opacity-90"
          >
            Simulate
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
