import { useQuery } from "@tanstack/react-query";
import { USE_MOCK } from "@/lib/constant";
import { fetchRuns } from "./use-runs";
import type { Run } from "@/types/domain";

/** One selectable order book: the symbol, the run whose stream carries it, and its engine id. */
export type OrderbookSymbol = { symbol: string; runId: string; symbolId: number };

// Mirrors how the HFT control plane's own Runs screen fills its order-book picker: there is no
// symbols endpoint behind it — the list is derived from the runs themselves. Every run that is
// `running` and not a backtest (a backtest replays history and publishes no book) contributes
// each symbol in its manifest; duplicates keep the first run seen, and the list is sorted by name.
//
// `symbol_id` is the engine's dense SymbolId and is what `orderbooks[].symbol_id` refers to. The
// manifest happens to be ordered so that a symbol's array position equals it, but the field is
// authoritative — match on it rather than on the index.
export function toOrderbookSymbols(runs: Run[]): OrderbookSymbol[] {
  const bySymbol = new Map<string, OrderbookSymbol>();
  for (const run of runs) {
    if (run.status !== "running" || run.mode === "backtest") continue;
    for (const s of run.manifest.symbols) {
      if (!bySymbol.has(s.symbol)) {
        bySymbol.set(s.symbol, { symbol: s.symbol, runId: run.id, symbolId: s.symbol_id });
      }
    }
  }
  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** `GET /api/runs?size=200&status=running` — the same call the control plane makes. */
export function useOrderbookSymbols() {
  return useQuery({
    queryKey: ["orderbook-symbols"],
    queryFn: async () => (USE_MOCK ? [] : toOrderbookSymbols(await fetchRuns({ status: "running" }))),
  });
}
