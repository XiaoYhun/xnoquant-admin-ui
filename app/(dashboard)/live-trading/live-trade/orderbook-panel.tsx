"use client";
import { useMemo, useState } from "react";
import { AltArrowDown } from "@solar-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMarketOrderbook } from "@/hooks/api/use-market-orderbook";
import type { OrderbookSymbol } from "@/hooks/api/use-orderbook-symbols";

// Right rail of the Live trade screen (Figma 14779:27408). Opens on the first symbol — nothing to
// search or select first. Symbol selection lives in the page (live-trade/page.tsx).
//
// Depth comes from `/api/market-data/orderbook/stream`, which serves any symbol on any configured
// venue whether or not a run is using it — so the picker offers the whole catalog (VN30F1M and the
// crypto pairs alike), not just what happens to be running.
//
// The quote strip's last/change and the board's ceiling/reference/floor plus matched volume
// ("KL") and turnover ("GT") have no field in the book frame at all, so they read "—" until an
// endpoint supplies them.
const DASH = <span className="text-[#9db2ce]">—</span>;

// The depth ladder does not group thousands ("1927.90").
const ladderNum = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

type OrderbookProps = {
  /** The instrument catalog — every symbol whose book the market-data stream can serve. */
  options: OrderbookSymbol[];
  /** Selected symbol name; falls back to the first option until the user picks one. */
  symbol: string | null;
  onSymbolChange: (symbol: string) => void;
};

// The whole catalog is several thousand instruments, so the picker is a typeahead over a capped
// slice, not a plain <Select>: rendering every symbol as an item froze the page on open.
const MAX_SHOWN = 100;

// Scoped subscription: only the selected symbol streams, and it re-binds on change.
export function OrderbookPanel({ options, symbol, onSymbolChange }: OrderbookProps) {
  const selected = options.find((o) => o.symbol === symbol) ?? options[0];
  const { book: live, error } = useMarketOrderbook(selected);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.symbol.toLowerCase().includes(q)) : options;
  }, [options, query]);

  // Bids and asks arrive as separate ladders; the table renders them as paired rows, so zip them
  // and let the shorter side leave blanks rather than pretending a level exists on both.
  const levels = useMemo(() => {
    if (!live) return [];
    const depth = Math.max(live.bids.length, live.asks.length);
    return Array.from({ length: depth }, (_, i) => ({ bid: live.bids[i], ask: live.asks[i] }));
  }, [live]);

  // One scale across BOTH sides so bid and ask depth stay comparable — in Figma 14779:27408 the
  // buy amounts (28–42) fill most of their column while the sells (3–4) read as thin slivers.
  // Floored at 1 so an empty/zero ladder can't divide by zero into a NaN width.
  const maxAmount = useMemo(
    () => Math.max(1, ...levels.flatMap((l) => [l.bid?.qty ?? 0, l.ask?.qty ?? 0])),
    [levels],
  );

  // Not every venue publishes a book — DNSE answers "live orderbook viewing is not supported for
  // venue Dnse" — so show the venue's own reason rather than waiting on a stream that won't come.
  const emptyMessage = error ?? (selected ? "Waiting for the first book update…" : "No symbols available.");

  return (
        <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
      {/* h-12 matches the table's header row (TableHead) so the two bars line up side by side. */}
      <div className="flex h-12 w-full shrink-0 items-center border-b border-border bg-secondary px-4">
        <h2 className="text-sm font-semibold leading-5 text-white">Orderbook</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 py-3">
        <div className="flex shrink-0 flex-col gap-1 px-4">
          <div className="flex items-center justify-between gap-2">
            <Popover
              open={pickerOpen}
              onOpenChange={(next) => {
                setPickerOpen(next);
                setQuery("");
              }}
            >
              <PopoverTrigger
                disabled={!selected}
                className="flex cursor-pointer items-center gap-1 text-base font-medium leading-6 text-white outline-none disabled:cursor-not-allowed"
              >
                {selected?.symbol ?? "—"}
                <AltArrowDown weight="Outline" className="size-4" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1.5">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search symbol..."
                  className="mb-1 h-8 w-full rounded-md bg-secondary px-2 text-xs text-white outline-none placeholder:text-muted-foreground"
                />
                <div className="max-h-56 overflow-y-auto">
                  {matches.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">No matches.</p>
                  ) : (
                    matches.slice(0, MAX_SHOWN).map((o) => (
                      <div
                        key={o.symbol}
                        onClick={() => {
                          onSymbolChange(o.symbol);
                          setPickerOpen(false);
                        }}
                        className="cursor-pointer rounded-[6px] px-2 py-2 text-xs text-white hover:bg-secondary/60"
                      >
                        {o.symbol}
                      </div>
                    ))
                  )}
                  {matches.length > MAX_SHOWN && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      {matches.length - MAX_SHOWN} more — keep typing to narrow.
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {/* Last traded price and its change have no field in the live frame. */}
            <div className="flex items-center gap-1.5 text-sm font-medium leading-5">{DASH}</div>
          </div>

          {/* Ceiling / reference / floor use the board's own palette (Trần / Sàn), not the
              green-red PnL palette. No live source for any of these, nor for matched volume
              ("KL") / turnover ("GT") — labels stay so the strip keeps its shape. */}
          <div className="flex items-center justify-between py-0.5 text-[11px] leading-4">
            <div className="flex items-center gap-1.5">
              <span className="flex items-center text-[#dc6bde]">
                <span aria-hidden className="mr-0.5 text-[10px] leading-none">
                  ▲
                </span>
                {DASH}
              </span>
              <span className="flex items-center gap-[3px] text-[#f1c617]">
                <span aria-hidden className="size-2 rounded-[1px] bg-[#f1c617]" />
                {DASH}
              </span>
              <span className="flex items-center text-[#0fdee6]">
                <span aria-hidden className="mr-0.5 text-[10px] leading-none">
                  ▼
                </span>
                {DASH}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5">
                <span className="text-[#9db2ce]">KL:</span>
                {DASH}
              </span>
              <span className="flex items-center gap-0.5">
                <span className="text-[#9db2ce]">GT:</span>
                {DASH}
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-9 w-full shrink-0 items-center border-y border-border bg-surface text-xs leading-5 whitespace-nowrap text-[#9db2ce]">
            <div className="flex h-full min-w-0 flex-1 items-center px-2">Amount Buy</div>
            <div className="flex h-full min-w-0 flex-1 items-center justify-end px-2">P.Buy</div>
            <div className="flex h-full min-w-0 flex-1 items-center px-2">P.Sell</div>
            <div className="flex h-full min-w-0 flex-1 items-center justify-end px-2">Amount Sell</div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-1">
            {levels.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#9db2ce]">{emptyMessage}</p>
            ) : (
              levels.map(({ bid, ask }, i) => (
                <div key={i} className="flex h-7 w-full shrink-0 items-center px-2 text-xs leading-5">
                  <div className="flex h-full min-w-0 flex-1 items-center px-2 text-white">{bid?.qty ?? ""}</div>
                  {/* Depth bar grows inward from the spread, proportional to size. The anchored end
                      (where the two sides meet) stays square; the growing end is rounded. Figma has
                      both ends square — rounding is a deliberate refinement, keep it. */}
                  <div className="relative flex h-full min-w-0 flex-1 items-center justify-end px-2">
                    {bid && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 right-0 rounded-l-[4px] bg-[rgba(103,225,193,0.2)]"
                        style={{ width: `${(bid.qty / maxAmount) * 100}%` }}
                      />
                    )}
                    <span className="relative text-[#67e1c1]">{bid ? ladderNum.format(bid.price) : ""}</span>
                  </div>
                  <div className="relative flex h-full min-w-0 flex-1 items-center px-2">
                    {ask && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 rounded-r-[4px] bg-[rgba(229,17,82,0.2)]"
                        style={{ width: `${(ask.qty / maxAmount) * 100}%` }}
                      />
                    )}
                    <span className="relative text-[#67e1c1]">{ask ? ladderNum.format(ask.price) : ""}</span>
                  </div>
                  <div className="flex h-full min-w-0 flex-1 items-center justify-end px-2 text-white">
                    {ask?.qty ?? ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
