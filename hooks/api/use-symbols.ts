import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { HFT_API_URL, USE_MOCK } from "@/lib/constant";
import type { components } from "@/types/api/hft";

// Symbols are scoped to a venue (`GET /api/symbols?venue_id=`) — used by the simulate-modal
// symbol multi-select once an account (and therefore its venue) is chosen. Raw HFT payload, no
// envelope — apiGet, not apiGetData.
export type Symbol = components["schemas"]["Symbol"];

export function useSymbols(venueId?: string) {
  return useQuery({
    queryKey: ["symbols", venueId],
    queryFn: () =>
      USE_MOCK
        ? Promise.resolve([] as Symbol[])
        : apiGet<Symbol[]>(`${HFT_API_URL}/api/symbols${venueId ? `?venue_id=${venueId}` : ""}`),
    enabled: !!venueId,
  });
}
