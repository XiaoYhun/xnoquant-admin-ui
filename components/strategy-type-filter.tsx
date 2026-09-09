"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Narrows a run list to one engine. Pairs with the HFT/MFT badge the rows already show. */
export type StrategyTypeFilterValue = "all" | "HFT" | "MFT";

export function StrategyTypeFilter({
  value,
  onChange,
}: {
  value: StrategyTypeFilterValue;
  onChange: (value: StrategyTypeFilterValue) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange((v as StrategyTypeFilterValue) ?? "all")}>
      <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All types</SelectItem>
        <SelectItem value="HFT">HFT</SelectItem>
        <SelectItem value="MFT">MFT</SelectItem>
      </SelectContent>
    </Select>
  );
}
