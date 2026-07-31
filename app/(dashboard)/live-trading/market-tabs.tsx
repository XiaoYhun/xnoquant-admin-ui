"use client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// The three market types both Live trading screens filter by (Figma 14756:46805 / 14773:24424).
// `value` is what `marketForSymbol` (lib/transform/runs.ts) writes onto each row's symbols, so
// no new enum is needed — the labels are just the design's wording for those values.
export const MARKETS = [
  { value: "Vietnam", label: "Stocks" },
  { value: "VNFuture", label: "Future" },
  { value: "Crypto", label: "Crypto" },
] as const;

export type Market = (typeof MARKETS)[number]["value"];

export const DEFAULT_MARKET: Market = "Vietnam";

export function MarketTabs({ value, onChange }: { value: Market; onChange: (market: Market) => void }) {
  return (
    <Tabs value={value} onValueChange={(v) => v && onChange(v as Market)}>
      <TabsList>
        {MARKETS.map((m) => (
          <TabsTrigger key={m.value} value={m.value}>
            {m.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function matchesMarket(row: { symbols: { market: string }[] }, market: Market): boolean {
  return row.symbols.some((s) => s.market === market);
}
