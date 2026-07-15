"use client";
import { useState } from "react";
import { Bolt, ClockCircle } from "@solar-icons/react";
import type { ComponentType } from "react";
import type { IconProps } from "@solar-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { HftStrategyType } from "@/hooks/api/use-hft-strategies";

// Figma node 14135:29458 — "Select Strategy Type" popup: pick MFT or HFT, then confirm.
// Opened from the Editors "+" button to add a new editor. HFT is the default selection.
type StrategyType = "mft" | "hft";

const OPTIONS: { id: StrategyType; label: string; icon: ComponentType<IconProps> }[] = [
  { id: "mft", label: "MFT Strategy", icon: ClockCircle },
  { id: "hft", label: "HFT Strategy", icon: Bolt },
];

const HFT_TYPE_OPTIONS: { value: HftStrategyType; label: string }[] = [
  { value: "taker", label: "Taker" },
  { value: "maker", label: "Maker" },
  { value: "arbitrage", label: "Arbitrage" },
];

export function CreateStrategyModal({
  open,
  onOpenChange,
  onConfirm,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: (type: StrategyType, name: string, hftStrategyType?: HftStrategyType) => Promise<void> | void;
  // When set, the strategy type is fixed to the active lab mode and the MFT/HFT picker is hidden.
  mode?: StrategyType;
}) {
  const [selected, setSelected] = useState<StrategyType>(mode ?? "hft");
  const [hftType, setHftType] = useState<HftStrategyType>("taker");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setError(null);
    setSubmitting(false);
  };
  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };
  const handleCreate = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm?.(selected, name.trim(), selected === "hft" ? hftType : undefined);
      reset();
      onOpenChange(false);
    } catch {
      setError("Couldn't create — a strategy with this name may already exist.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[420px] gap-5 rounded-[40px] border-8 border-[rgba(103,225,193,0.2)] bg-[#0a0e14] px-6 py-7"
      >
        <DialogTitle className="text-center text-xl font-semibold text-white">Select Strategy Type</DialogTitle>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="strategy-name" className="text-xs font-medium text-muted-foreground">
            Strategy name
          </label>
          <input
            id="strategy-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="Enter a name"
            autoFocus
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-white placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {!mode && (
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
        )}

        {selected === "hft" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hft-strategy-type" className="text-xs font-medium text-muted-foreground">
              Strategy type
            </label>
            <Select value={hftType} onValueChange={(v) => v && setHftType(v as HftStrategyType)}>
              <SelectTrigger id="hft-strategy-type" className="h-10 w-full justify-between rounded-xl border-border bg-surface px-3 text-sm text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background!">
                {HFT_TYPE_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {error && <p className="text-center text-xs text-destructive">{error}</p>}

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="h-10 w-[118px] cursor-pointer rounded-full bg-secondary text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || submitting}
            onClick={handleCreate}
            className="h-10 w-[118px] cursor-pointer rounded-full bg-[linear-gradient(161deg,#cff8ea_0%,var(--primary)_100%)] text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create strategy"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
