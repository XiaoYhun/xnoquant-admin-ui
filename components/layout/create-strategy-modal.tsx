"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bolt, ClockCircle } from "@solar-icons/react";
import type { ComponentType } from "react";
import type { IconProps } from "@solar-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Figma node 14135:29458 — "Select Strategy Type" popup: pick MFT or HFT, then Create strategy
// routes into the builder. HFT is the default selection (matches the design).
type StrategyType = "mft" | "hft";

const OPTIONS: { id: StrategyType; label: string; icon: ComponentType<IconProps> }[] = [
  { id: "mft", label: "MFT Strategy", icon: ClockCircle },
  { id: "hft", label: "HFT Strategy", icon: Bolt },
];

export function CreateStrategyModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<StrategyType>("hft");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[420px] gap-5 rounded-[40px] border-8 border-[rgba(103,225,193,0.2)] bg-[#0a0e14] px-6 py-7"
      >
        <DialogTitle className="text-center text-xl font-semibold text-white">Select Strategy Type</DialogTitle>

        <div className="flex flex-col gap-2">
          {OPTIONS.map(({ id, label, icon: Icon }) => {
            const on = selected === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-2 text-left transition-colors",
                  on ? "border-[#cff8ea] bg-primary/10" : "border-border hover:bg-secondary/50",
                )}
              >
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-[4px] p-1",
                    on ? "bg-primary/20" : "bg-secondary",
                  )}
                >
                  <Icon weight="Outline" className="size-4 text-white" />
                </span>
                <span className="flex-1 text-sm font-medium text-white">{label}</span>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md bg-primary transition-opacity",
                    on ? "opacity-100" : "opacity-0",
                  )}
                >
                  <svg viewBox="0 0 20 20" fill="none" className="size-3 text-black">
                    <path
                      d="M4.5 10.5l3.2 3.2 7-8"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 w-[118px] cursor-pointer rounded-full bg-secondary text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              router.push(`/create-strategy?type=${selected}`);
            }}
            className="h-10 w-[118px] cursor-pointer rounded-full bg-[linear-gradient(161deg,#cff8ea_0%,var(--primary)_100%)] text-xs font-medium text-black transition-opacity hover:opacity-90"
          >
            Create strategy
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
