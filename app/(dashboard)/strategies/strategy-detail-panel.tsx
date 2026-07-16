"use client";
import { useState } from "react";
import { SkipNext } from "@solar-icons/react";
import { CloseIcon } from "@/components/icons/close";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SAMPLE_CODE } from "@/lib/mock/strategy-builder";
import { ResultsTab } from "@/app/(dashboard)/create-strategy/results-tab";
import type { StrategyRow } from "@/lib/mock/strategies";

// Right-side slide-in panel for a Strategy List row — Figma node 13964:132139.
// Code|Results tabs copy the underline-tab pattern from create-strategy/results-panel.tsx;
// Results reuses create-strategy/results-tab.tsx as-is.
const TABS = ["Code", "Results"] as const;
type Tab = (typeof TABS)[number];

const CODE_LINES = SAMPLE_CODE.split("\n");

function CodeView() {
  return (
    <div className="flex h-full overflow-auto font-mono text-xs">
      <div className="select-none flex-none px-3 py-4 text-right leading-5 text-muted-foreground/60">
        {CODE_LINES.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <pre className="flex-1 px-2 py-4 leading-5 whitespace-pre text-white">{SAMPLE_CODE}</pre>
    </div>
  );
}

export function StrategyDetailPanel({
  open,
  onOpenChange,
  strategy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: StrategyRow | null;
}) {
  const [tab, setTab] = useState<Tab>("Code");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-y-0 left-auto right-0 flex h-dvh w-[min(960px,92vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-l bg-background p-0 duration-300 sm:max-w-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
      >
        <DialogTitle className="sr-only">{strategy?.name ?? "Strategy detail"}</DialogTitle>

        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-base font-semibold text-white">{strategy?.name}</span>
            <span className="flex shrink-0 items-center gap-1">
              <span className="size-2 shrink-0 rounded-full bg-[#7b61ff] shadow-[0_0_6px_1px_rgba(123,97,255,0.5)]" />
              <span
                className="bg-clip-text text-xs font-medium text-transparent"
                style={{ backgroundImage: "linear-gradient(148deg, #e9e8ff 0%, #b7b1ff 148%)" }}
              >
                MFT
              </span>
            </span>

            <div className="h-5 w-px shrink-0 bg-[#344054]" />

            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-2 py-1">
              <span className="size-2 shrink-0 rounded-full bg-muted-foreground" />
              <span className="text-xs text-muted-foreground">In sample</span>
            </span>

            <span className="inline-flex shrink-0 items-center gap-3 rounded-3xl border border-white/50 bg-gradient-to-b from-[rgba(123,97,255,0.8)] to-[rgba(123,97,255,0.2)] py-1 pr-2 pl-2 text-xs text-white backdrop-blur-[2px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-white" />
                Crypto
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-white" />
                BTC
              </span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-[34px] shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[linear-gradient(164deg,#cff8ea_0%,var(--primary)_100%)] px-3 text-xs font-medium text-black transition-opacity hover:opacity-90"
            >
              <SkipNext weight="Outline" className="size-3.5" />
              Start paper trading
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-white"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex h-11 shrink-0 items-stretch border-b border-border">
          {TABS.map((t) => {
            const on = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "relative flex cursor-pointer items-center justify-center px-6 text-sm whitespace-nowrap transition-colors",
                  on ? "font-semibold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn(on && "bg-[linear-gradient(163deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent")}>
                  {t}
                </span>
                {on && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[linear-gradient(163deg,#cff8ea_0%,#67e1c1_100%)]" />
                )}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "Code" && <CodeView />}
          {tab === "Results" && (
            <div className="h-full overflow-y-auto">
              <ResultsTab variant={strategy?.group === "MFT" ? "mft" : "hft"} strategyId={strategy?.id} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
