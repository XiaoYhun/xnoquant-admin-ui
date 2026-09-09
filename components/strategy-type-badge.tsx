import { cn } from "@/lib/utils";

// Which engine ran this: HFT (L2/tick) or MFT (OHLC/bar). Derived from the manifest's
// `data_kind` — see `strategyGroup` in lib/transform/runs.ts — and shown beside the strategy name
// in every run table, where the name alone doesn't say which lab a run belongs to.
//
// Teal for HFT, blue for MFT: the same two accents the detail panel and the sidebar's lab toggle
// already use, so the colour carries the meaning at a glance and the label confirms it.
const STYLES = {
  HFT: "border-[rgba(103,225,193,0.4)] bg-[rgba(103,225,193,0.1)] text-[#67e1c1]",
  MFT: "border-[rgba(103,133,225,0.4)] bg-[rgba(103,133,225,0.1)] text-[#90c1ff]",
} as const;

export function StrategyTypeBadge({ type }: { type: "HFT" | "MFT" }) {
  return (
    <span
      className={cn(
        "ml-2 inline-flex shrink-0 items-center rounded-[20px] border px-2 py-0.5 text-[10px] font-normal",
        STYLES[type],
      )}
    >
      {type}
    </span>
  );
}
