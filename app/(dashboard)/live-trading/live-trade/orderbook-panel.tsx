"use client";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SYMBOLS_BY_MARKET, defaultSymbolFor, orderbookFor } from "@/lib/mock/orderbook";
import type { Market } from "../market-tabs";

// Right rail of the Live trade screen (Figma 14779:27408). Opens on the market tab's default
// symbol — nothing to search or select first — and follows the tab when it changes.

const num = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function OrderbookPanel({ market }: { market: Market }) {
  // Keyed by market so switching tabs falls back to that market's default, while an explicit
  // pick inside a tab sticks.
  const [picked, setPicked] = useState<Partial<Record<Market, string>>>({});
  const symbol = picked[market] ?? defaultSymbolFor(market);
  const book = useMemo(() => orderbookFor(symbol), [symbol]);
  const up = book.changePct >= 0;

  const maxBuy = Math.max(...book.levels.map((l) => l.amountBuy));
  const maxSell = Math.max(...book.levels.map((l) => l.amountSell));

  return (
    <aside className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
      <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Orderbook</h2>
      </div>

      <div className="flex shrink-0 flex-col gap-1 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <Select value={symbol} onValueChange={(v) => v && setPicked((p) => ({ ...p, [market]: v }))}>
            <SelectTrigger className="h-auto w-auto gap-1 border-0 bg-transparent p-0 text-lg font-semibold text-white shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(SYMBOLS_BY_MARKET[market] ?? []).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className={cn("text-base font-semibold", up ? "text-[#67e1c1]" : "text-[#ff135b]")}>
              {num.format(book.last)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                up ? "bg-[#67e1c1]/10 text-[#67e1c1]" : "bg-[#ff135b]/10 text-[#ff135b]",
              )}
            >
              {up ? "▲" : "▼"} {num.format(Math.abs(book.change))} ({up ? "+" : "−"}
              {Math.abs(book.changePct).toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-[#c084fc]">▲ {num.format(book.ceiling)}</span>
          <span className="text-[#f1c617]">■ {num.format(book.reference)}</span>
          <span className="text-[#38bdf8]">▼ {num.format(book.floor)}</span>
          <span className="text-muted-foreground">
            KL: <span className="text-white">{book.volume}</span>
          </span>
          <span className="text-muted-foreground">
            GT: <span className="text-white">{book.turnover}</span>
          </span>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span>Amount Buy</span>
        <span className="text-right">P.Buy</span>
        <span className="pl-3">P.Sell</span>
        <span className="text-right">Amount Sell</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {book.levels.map((level, i) => (
          <div key={i} className="grid grid-cols-4 items-center px-4 py-1.5 text-xs">
            <span className="text-white">{level.amountBuy}</span>
            {/* Depth bar grows from the price toward the amount, proportional to size. */}
            <span className="relative flex justify-end px-2 py-1">
              <span
                aria-hidden
                className="absolute inset-y-0 right-0 rounded-sm bg-[#67e1c1]/20"
                style={{ width: `${(level.amountBuy / maxBuy) * 100}%` }}
              />
              <span className="relative text-[#67e1c1]">{num.format(level.priceBuy)}</span>
            </span>
            <span className="relative flex justify-start px-2 py-1 pl-3">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-sm bg-[#ff135b]/20"
                style={{ width: `${(level.amountSell / maxSell) * 100}%` }}
              />
              <span className="relative text-[#67e1c1]">{num.format(level.priceSell)}</span>
            </span>
            <span className="text-right text-white">{level.amountSell}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
