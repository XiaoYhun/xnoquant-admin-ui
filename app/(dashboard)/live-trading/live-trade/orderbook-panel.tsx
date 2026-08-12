"use client";
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { orderbookFor } from "@/lib/mock/orderbook";
import { LiveSnapshotProvider, useLiveSnapshot } from "@/hooks/api/use-run-live-snapshot";

// Right rail of the Live trade screen (Figma 14779:27408). Opens on the market tab's default
// symbol — nothing to search or select first — and follows the tab when it changes. Symbol
// selection and the running-run binding live in the page (live-trade/page.tsx), which is the one
// that knows the loaded runs and can resolve which run to tail for the chosen symbol.

// The quote header groups thousands ("1,927.50"); the depth ladder does not ("1927.90").
const quoteNum = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ladderNum = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

export function OrderbookPanel({
  symbol,
  symbolOptions,
  onSymbolChange,
  runId,
  runSymbols,
}: {
  symbol: string;
  symbolOptions: string[];
  onSymbolChange: (symbol: string) => void;
  /** The running run trading `symbol`, or undefined when none is running. */
  runId: string | undefined;
  /** The bound run's manifest symbol list — a live orderbook frame's `symbol_id` indexes into it. */
  runSymbols: { symbol: string }[] | undefined;
}) {
  const book = useMemo(() => orderbookFor(symbol), [symbol]);
  // One scale across BOTH sides so bid and ask depth stay comparable — in Figma 14779:27408 the
  // buy amounts (28–42) fill most of their column while the sells (3–4) read as thin slivers.
  // Floored at 1 so an empty/zero ladder can't divide by zero into a NaN width.
  const maxAmount = useMemo(
    () => Math.max(1, ...book.levels.flatMap((l) => [l.amountBuy, l.amountSell])),
    [book],
  );
  const up = book.changePct >= 0;
  const symbolIndex = runSymbols ? runSymbols.findIndex((s) => s.symbol === symbol) : -1;

  return (
    <aside className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
      {/* h-12 matches the table's header row (TableHead) so the two bars line up side by side. */}
      <div className="flex h-12 w-full shrink-0 items-center border-b border-border bg-secondary px-4">
        <h2 className="text-base font-semibold leading-5 text-white">Orderbook</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 py-3">
        <div className="flex shrink-0 flex-col gap-1 px-4">
          <div className="flex items-center justify-between gap-2">
            <Select value={symbol} onValueChange={(v) => v && onSymbolChange(v)}>
              <SelectTrigger className="h-auto w-auto gap-1 border-0 bg-transparent p-0 text-xl font-medium leading-7 text-white shadow-none dark:bg-transparent dark:hover:bg-transparent [&_svg]:size-5 [&_svg]:text-white [&_svg]:opacity-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {symbolOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <span className={cn("text-base font-medium leading-6", up ? "text-[#67e1c1]" : "text-[#ff135b]")}>
                {quoteNum.format(book.last)}
              </span>
              <span
                className={cn(
                  "flex items-center justify-center gap-0.5 rounded-[12px] p-0.5 text-xs leading-[18px]",
                  up ? "bg-[#67e1c1]/30 text-[#67e1c1]" : "bg-[#ff135b]/30 text-[#ff135b]",
                )}
              >
                <span aria-hidden className="text-[10px] leading-none">
                  {up ? "▲" : "▼"}
                </span>
                {quoteNum.format(Math.abs(book.change))} ({up ? "+" : "−"}
                {Math.abs(book.changePct).toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Ceiling / reference / floor use the board's own palette (Trần / Sàn), not the
              green-red PnL palette. Kept on `orderbookFor` mock data — the live snapshot has no
              source for ceiling/reference/floor, matched volume ("KL") or turnover ("GT"). */}
          <div className="flex items-center justify-between py-0.5 text-xs leading-[18px]">
            <div className="flex items-center gap-1.5">
              <span className="flex items-center text-[#dc6bde]">
                <span aria-hidden className="mr-0.5 text-[10px] leading-none">
                  ▲
                </span>
                {quoteNum.format(book.ceiling)}
              </span>
              <span className="flex items-center gap-[3px] text-[#f1c617]">
                <span aria-hidden className="size-2 rounded-[1px] bg-[#f1c617]" />
                {quoteNum.format(book.reference)}
              </span>
              <span className="flex items-center text-[#0fdee6]">
                <span aria-hidden className="mr-0.5 text-[10px] leading-none">
                  ▼
                </span>
                {quoteNum.format(book.floor)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5">
                <span className="text-[#9db2ce]">KL:</span>
                <span className="text-white">{book.volume}</span>
              </span>
              <span className="flex items-center gap-0.5">
                <span className="text-[#9db2ce]">GT:</span>
                <span className="text-white">{book.turnover}</span>
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
            {book.levels.map((level, i) => (
              <div key={i} className="flex h-7 w-full shrink-0 items-center px-2 text-sm leading-5">
                <div className="flex h-full min-w-0 flex-1 items-center px-4 text-white">{level.amountBuy}</div>
                {/* Depth bar grows inward from the spread, proportional to size. The anchored end
                    (where the two sides meet) stays square; the growing end is rounded. Figma has
                    both ends square — rounding is a deliberate refinement, keep it. */}
                <div className="relative flex h-full min-w-0 flex-1 items-center justify-end px-4">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 right-0 rounded-l-[4px] bg-[rgba(103,225,193,0.2)]"
                    style={{ width: `${(level.amountBuy / maxAmount) * 100}%` }}
                  />
                  <span className="relative text-[#67e1c1]">{ladderNum.format(level.priceBuy)}</span>
                </div>
                <div className="relative flex h-full min-w-0 flex-1 items-center px-4">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 rounded-r-[4px] bg-[rgba(229,17,82,0.2)]"
                    style={{ width: `${(level.amountSell / maxAmount) * 100}%` }}
                  />
                  <span className="relative text-[#67e1c1]">{ladderNum.format(level.priceSell)}</span>
                </div>
                <div className="flex h-full min-w-0 flex-1 items-center justify-end px-4 text-white">
                  {level.amountSell}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
