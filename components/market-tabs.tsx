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

/** A market a symbol can actually carry. `marketOf` answers with one of these, or nothing. */
export type MarketValue = (typeof MARKETS)[number]["value"];

/**
 * `all` is a TAB, not a market — no symbol is ever tagged with it, and `marketOf` never returns
 * it. It exists so the lists can open on everything they hold instead of on one market's slice.
 */
export const ALL_MARKETS = "all";
export type Market = MarketValue | typeof ALL_MARKETS;

// Showing everything is the honest first view: defaulting to one market hides most of the table
// behind a tab the reader never asked for and may not notice.
export const DEFAULT_MARKET: Market = ALL_MARKETS;

const TABS: { value: Market; label: string }[] = [{ value: ALL_MARKETS, label: "All" }, ...MARKETS];

export function MarketTabs({ value, onChange }: { value: Market; onChange: (market: Market) => void }) {
  return (
    <Tabs value={value} onValueChange={(v) => v && onChange(v as Market)}>
      <TabsList>
        {TABS.map((m) => (
          <TabsTrigger key={m.value} value={m.value}>
            {m.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function matchesMarket(row: { symbols: { market: string }[] }, market: Market): boolean {
  return market === ALL_MARKETS || row.symbols.some((s) => s.market === market);
}

/** The tab a row belongs to, or null when its symbols map to no known market. */
export function marketOf(row: { symbols: { market: string }[] }): MarketValue | null {
  return MARKETS.find((m) => matchesMarket(row, m.value))?.value ?? null;
}

/** Narrows a `?market=` query value to a tab, falling back to the default. */
export function marketFromParam(value: string | null | undefined): Market {
  return TABS.find((m) => m.value === value)?.value ?? DEFAULT_MARKET;
}
