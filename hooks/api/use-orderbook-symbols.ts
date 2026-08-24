import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { USE_MOCK } from "@/lib/constant";
import { fetchSymbols } from "./use-symbols";
import { useVenues } from "./use-venues";
import { useAccounts } from "./use-accounts";
import { marketForVenue } from "@/lib/transform/runs";
import type { Account, Instrument, Venue } from "@/types/domain";

/** One selectable order book: the symbol and what `/api/market-data/orderbook/stream` needs to open it. */
export type OrderbookSymbol = {
  symbol: string;
  venueId: string;
  /** "Crypto" / "VNFuture" / "Vietnam" — the market tab this symbol belongs under. */
  market: string;
  /** Only set for venues that need credentials to read market data (SSI). */
  accountId?: string;
};

// The picker lists the whole instrument catalog — VN30F1M and the crypto pairs alike — because
// `/api/market-data/orderbook/stream` serves any symbol on any configured venue independent of a
// running paper/live run. (It used to be derived from the running runs, which was the only source
// before that endpoint existed: with nothing running there was nothing to look at.)
//
// The stream keys on the venue-native symbol name, so duplicates across venues (BTCUSDT on both
// binance_spot and binance_futures) collapse to one entry — first venue in catalog order wins.
// Each entry carries its market so the panel can follow the page's Stocks/Future/Crypto tab.
export function toOrderbookSymbols(
  symbols: Instrument[],
  venues: Venue[],
  accounts: Account[],
): OrderbookSymbol[] {
  // SSI reads market data over a credentialed session, so its books need an `account_id` or the
  // stream answers 400. Every other venue type reads anonymously.
  const needsAccount = new Set(venues.filter((v) => v.venue_type === "ssi").map((v) => v.id));
  const venueTypes = new Map(venues.map((v) => [v.id, v.venue_type]));
  const bySymbol = new Map<string, OrderbookSymbol>();
  for (const s of symbols) {
    if (bySymbol.has(s.symbol)) continue;
    bySymbol.set(s.symbol, {
      symbol: s.symbol,
      venueId: s.venue_id,
      // Same rule the run rows use, so a symbol lands under the same tab in both places.
      market: marketForVenue(venueTypes.get(s.venue_id), s.instrument_class),
      accountId: needsAccount.has(s.venue_id)
        ? accounts.find((a) => a.venue_id === s.venue_id)?.id
        : undefined,
    });
  }
  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function useOrderbookSymbols(): OrderbookSymbol[] {
  const { data: symbols = [] } = useQuery({
    queryKey: ["symbols", "all"],
    queryFn: async (): Promise<Instrument[]> => (USE_MOCK ? [] : fetchSymbols()),
  });
  const { data: venues = [] } = useVenues();
  const { data: accounts = [] } = useAccounts();
  return useMemo(() => toOrderbookSymbols(symbols, venues, accounts), [symbols, venues, accounts]);
}
