"use client";
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LiveSnapshotProvider, useLiveSnapshot } from "@/hooks/api/use-run-live-snapshot";
import type { OrderbookSymbol } from "@/hooks/api/use-orderbook-symbols";

// Right rail of the Live trade screen (Figma 14779:27408). Opens on the market tab's default
// symbol — nothing to search or select first — and follows the tab when it changes. Symbol
// selection and the running-run binding live in the page (live-trade/page.tsx), which is the one
// that knows the loaded runs and can resolve which run to tail for the chosen symbol.
//
// Depth comes from the selected symbol's run `/live/stream` `orderbooks` frames — the only
// order-book source that exists (HFT has no order-book endpoint; `DataSourceType: "orderbook"`
// in types/api/hft.ts is the only trace of a planned one), so with nothing running there is
// nothing to show and the panel says so rather than inventing a ladder.
//
// The quote strip's last/change and the board's ceiling/reference/floor plus matched volume
// ("KL") and turnover ("GT") have no field in the live frame at all, so they read "—" until an
// endpoint supplies them.
const DASH = <span className="text-[#9db2ce]">—</span>;

// The depth ladder does not group thousands ("1927.90").
const ladderNum = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

type OrderbookProps = {
  /** Every symbol on a currently-running, non-backtest run. Empty when nothing is running. */
  options: OrderbookSymbol[];
  /** Selected symbol name; falls back to the first option until the user picks one. */
  symbol: string | null;
  onSymbolChange: (symbol: string) => void;
};

// Scoped subscription: only the selected symbol's run streams, and it re-binds on change.
export function OrderbookPanel({ options, symbol, onSymbolChange }: OrderbookProps) {
  const selected = options.find((o) => o.symbol === symbol) ?? options[0];
  return (
    <LiveSnapshotProvider runId={selected?.runId} isLive={!!selected}>
      <OrderbookBody options={options} selected={selected} onSymbolChange={onSymbolChange} />
    </LiveSnapshotProvider>
  );
}

function OrderbookBody({
  options,
  selected,
  onSymbolChange,
}: {
  options: OrderbookSymbol[];
  selected: OrderbookSymbol | undefined;
  onSymbolChange: (symbol: string) => void;
}) {
  const { snapshot } = useLiveSnapshot();
  const live = selected ? snapshot?.orderbooks.find((o) => o.symbolId === selected.symbolId) : undefined;

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

  const emptyMessage = selected
    ? "Waiting for the first book update…"
    : "No active symbols — start a paper or live run to see its order book here.";

  return (
    <aside className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
      {/* h-12 matches the table's header row (TableHead) so the two bars line up side by side. */}
      <div className="flex h-12 w-full shrink-0 items-center border-b border-border bg-secondary px-4">
        <h2 className="text-base font-semibold leading-5 text-white">Orderbook</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 py-3">
        <div className="flex shrink-0 flex-col gap-1 px-4">
          <div className="flex items-center justify-between gap-2">
            <Select value={selected?.symbol ?? ""} onValueChange={(v) => v && onSymbolChange(v)} disabled={!selected}>
              <SelectTrigger className="h-auto w-auto gap-1 border-0 bg-transparent p-0 text-xl font-medium leading-7 text-white shadow-none dark:bg-transparent dark:hover:bg-transparent [&_svg]:size-5 [&_svg]:text-white [&_svg]:opacity-100">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.symbol} value={o.symbol}>
                    {o.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Last traded price and its change have no field in the live frame. */}
            <div className="flex items-center gap-1.5 text-base font-medium leading-6">{DASH}</div>
          </div>

          {/* Ceiling / reference / floor use the board's own palette (Trần / Sàn), not the
              green-red PnL palette. No live source for any of these, nor for matched volume
              ("KL") / turnover ("GT") — labels stay so the strip keeps its shape. */}
          <div className="flex items-center justify-between py-0.5 text-xs leading-[18px]">
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
          <div className="flex h-9 w-full shrink-0 items-center border-y border-border bg-surface text-sm leading-5 whitespace-nowrap text-[#9db2ce]">
            <div className="flex h-full min-w-0 flex-1 items-center px-4">Amount Buy</div>
            <div className="flex h-full min-w-0 flex-1 items-center justify-end px-4">P.Buy</div>
            <div className="flex h-full min-w-0 flex-1 items-center px-4">P.Sell</div>
            <div className="flex h-full min-w-0 flex-1 items-center justify-end px-4">Amount Sell</div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-1">
            {levels.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#9db2ce]">{emptyMessage}</p>
            ) : (
              levels.map(({ bid, ask }, i) => (
                <div key={i} className="flex h-7 w-full shrink-0 items-center px-2 text-sm leading-5">
                  <div className="flex h-full min-w-0 flex-1 items-center px-4 text-white">{bid?.qty ?? ""}</div>
                  {/* Depth bar grows inward from the spread, proportional to size. The anchored end
                      (where the two sides meet) stays square; the growing end is rounded. Figma has
                      both ends square — rounding is a deliberate refinement, keep it. */}
                  <div className="relative flex h-full min-w-0 flex-1 items-center justify-end px-4">
                    {bid && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 right-0 rounded-l-[4px] bg-[rgba(103,225,193,0.2)]"
                        style={{ width: `${(bid.qty / maxAmount) * 100}%` }}
                      />
                    )}
                    <span className="relative text-[#67e1c1]">{bid ? ladderNum.format(bid.price) : ""}</span>
                  </div>
                  <div className="relative flex h-full min-w-0 flex-1 items-center px-4">
                    {ask && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 rounded-r-[4px] bg-[rgba(229,17,82,0.2)]"
                        style={{ width: `${(ask.qty / maxAmount) * 100}%` }}
                      />
                    )}
                    <span className="relative text-[#67e1c1]">{ask ? ladderNum.format(ask.price) : ""}</span>
                  </div>
                  <div className="flex h-full min-w-0 flex-1 items-center justify-end px-4 text-white">
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
