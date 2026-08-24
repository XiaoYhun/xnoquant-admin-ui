import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import type { components } from "@/types/api/hft";

// Symbols are scoped to a venue (`GET /api/symbols?venue_id=`) — used by the simulate-modal
// symbol multi-select once an account (and therefore its venue) is chosen. Raw HFT payload, no
// envelope — apiGet, not apiGetData.
export type Symbol = components["schemas"]["Symbol"];

// Delisted instruments can't be traded, so they never belong in a picker. Only "delisted" is
// excluded — the venue also reports "break", "settling" and "pending_trading", which are ordinary
// transient session states ("break" alone covers roughly half the catalog).
const isDelisted = (s: Symbol) => s.status?.toLowerCase() === "delisted";

/** `GET /api/symbols[?venue_id=]` — the whole catalog when no venue is given. */
export async function fetchSymbols(venueId?: string): Promise<Symbol[]> {
  const all = await apiGet<Symbol[]>(`${HFT_API_URL}/api/symbols${venueId ? `?venue_id=${venueId}` : ""}`);
  return (all ?? []).filter((s) => !isDelisted(s));
}

export function useSymbols(venueId?: string) {
  return useQuery({
    queryKey: ["symbols", venueId],
    queryFn: async (): Promise<Symbol[]> => (USE_MOCK ? [] : fetchSymbols(venueId)),
    enabled: !!venueId,
  });
}
