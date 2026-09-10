"use client";

import { useMemo, useRef, useState } from "react";
import { AltArrowDown, Magnifer } from "@solar-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOrderbookSymbols } from "@/hooks/api/use-orderbook-symbols";
import { ALL_MARKETS, type Market } from "@/components/market-tabs";
import { cn } from "@/lib/utils";

/** "no symbol filter" — the same sentinel the plain `<Select>` used before. */
export const ALL_SYMBOLS = "all";

/**
 * How many matches the list renders at once. The catalog spans every venue, so an unfiltered
 * "Crypto" list is thousands of pairs; the cap keeps the popover from mounting all of them, and
 * the reader narrows with the search box rather than by scrolling.
 */
const MAX_VISIBLE = 100;

/**
 * The run lists' symbol filter, sent to `GET /api/runs?symbol=`.
 *
 * Fed by the instrument catalog, not by the runs on screen: the lists page server-side now, so
 * options derived from the loaded rows would only ever describe the current page and would shift
 * underneath the reader as they paged. The trade-off is that the catalog also offers symbols
 * nothing has traded yet — picking one lands on an honest empty state.
 *
 * Reuses `useOrderbookSymbols` because it already collapses the catalog per symbol and tags each
 * one with the market tab it belongs under (the same `marketForVenue` rule the rows use), which is
 * exactly what this needs; on Live trade the orderbook rail has usually loaded it already.
 */
export function SymbolFilter({
  market,
  value,
  onChange,
}: {
  market: Market;
  value: string;
  onChange: (symbol: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const catalog = useOrderbookSymbols();

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog
      .filter((s) => (market === ALL_MARKETS || s.market === market) && (!q || s.symbol.toLowerCase().includes(q)))
      .map((s) => s.symbol);
  }, [catalog, market, query]);

  const visible = options.slice(0, MAX_VISIBLE);

  const pick = (symbol: string) => {
    onChange(symbol);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        aria-label="Symbol filter"
        className="flex h-8 w-auto shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 text-xs text-foreground"
      >
        {value === ALL_SYMBOLS ? "All symbols" : value}
        <AltArrowDown size={14} weight="Outline" className="shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5" onOpenAutoFocus={(e) => {
          // Radix would otherwise focus the first item; the search box is what the reader wants.
          e.preventDefault();
          inputRef.current?.focus();
        }}>
        <div className="mb-1 flex h-8 items-center gap-2 rounded-[10px] border border-border px-2">
          <Magnifer size={14} weight="Outline" className="shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbols..."
            className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-56 overflow-y-auto">
          <button
            type="button"
            onClick={() => pick(ALL_SYMBOLS)}
            className={cn(
              "flex w-full cursor-pointer items-center rounded-[6px] px-2 py-2 text-left text-xs hover:bg-secondary/60",
              value === ALL_SYMBOLS ? "text-white" : "text-muted-foreground",
            )}
          >
            All symbols
          </button>
          {visible.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => pick(symbol)}
              className={cn(
                "flex w-full cursor-pointer items-center rounded-[6px] px-2 py-2 text-left text-xs hover:bg-secondary/60",
                value === symbol ? "text-white" : "text-muted-foreground",
              )}
            >
              {symbol}
            </button>
          ))}
          {options.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              {catalog.length === 0 ? "No symbols loaded." : "No matches."}
            </p>
          )}
          {options.length > visible.length && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              {options.length - visible.length} more &mdash; keep typing to narrow.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
