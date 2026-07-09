import { useQuery } from "@tanstack/react-query";
import { apiGetData } from "@/lib/api-client";
import { USE_MOCK, XALPHA_API_URL } from "@/lib/constant";
import type { components } from "@/types/api/xalpha";

// GET /xalpha-api/v1/markets (XALPHA envelope, unwrap `.data` via apiGetData) — feeds the MFT
// Settings popover's cascading Market -> Universe dropdowns (toolbar.tsx SettingsMenu).
type MarketItem = components["schemas"]["models.MarketItem"];

export type Market = { name: string; universes: { name: string; total?: number }[] };

const MOCK_MARKETS: Market[] = [
  { name: "Vietnam Stock", universes: [{ name: "VN30" }, { name: "VN100" }] },
  { name: "Crypto Spot", universes: [{ name: "BTC" }, { name: "TOP100" }] },
];

export function useMarkets() {
  return useQuery({
    queryKey: ["markets"],
    staleTime: Infinity, // markets rarely change
    queryFn: async (): Promise<Market[]> => {
      if (USE_MOCK) return MOCK_MARKETS;
      const data = await apiGetData<MarketItem[]>(`${XALPHA_API_URL}/markets`);
      return (data ?? []).map((m) => ({
        name: m.name ?? "",
        universes: (m.universes ?? []).map((u) => ({ name: u.name ?? "", total: u.total })),
      }));
    },
  });
}
