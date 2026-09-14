"use client";

import { cn } from "@/lib/utils";

/** Narrows a run list to one engine. Pairs with the HFT/MFT badge the rows already show. */
export type StrategyTypeFilterValue = "all" | "HFT" | "MFT";

/** The server's counterpart to a pick: `GET /api/runs?engine=`. `undefined` lets every engine through. */
export function engineOf(value: StrategyTypeFilterValue): "hft" | "mft" | undefined {
  return value === "HFT" ? "hft" : value === "MFT" ? "mft" : undefined;
}

const OPTIONS: { value: StrategyTypeFilterValue; label: string; title: string; active: string }[] = [
  { value: "all", label: "All", title: "All types", active: "bg-secondary text-white shadow-sm" },
  { value: "HFT", label: "HFT", title: "HFT", active: "bg-[#67e1c1] text-black" },
  { value: "MFT", label: "MFT", title: "MFT", active: "bg-[#7b61ff] text-white" },
];

export function StrategyTypeFilter({
  value,
  onChange,
}: {
  value: StrategyTypeFilterValue;
  onChange: (value: StrategyTypeFilterValue) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Strategy type"
      className="inline-flex h-8 items-center gap-0.5 rounded-full border border-border bg-background p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          aria-label={o.title}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? o.active : "text-muted-foreground hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
