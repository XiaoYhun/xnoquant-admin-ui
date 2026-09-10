import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { apiGet } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { TradeHistoryRow } from "@/lib/mock/paper-runs";
import type { SampleScope, TradePage } from "@/types/domain";
import { fetchRunRowPage, type RunRowPage, type RunsQuery } from "./use-runs";
import { toTradeHistoryRow } from "@/lib/transform/runs";

// Paper Trading is `GET /api/runs?mode=paper` — one server page, narrowed and counted upstream.
// Per-run summary + equity are NOT fetched here; they're deferred to the detail panel
// (useRunSummary/useRunEquity on open), so the list is a single call and the table's metric
// columns show "—" until a run is opened.
//
// `query` is the page's whole filter state, including `page`/`size` — see useBacktestRuns.
export function usePaperRuns(query: RunsQuery = {}) {
  return useQuery({
    queryKey: ["paper-runs", query],
    queryFn: async (): Promise<RunRowPage> => {
      // Mock ignores `query` — every filter is served by the API, and there is no mock run store
      // to narrow. The whole mock list comes back as a single page.
      if (USE_MOCK) {
        const rows = await mockApi.listPaperRuns();
        return { rows, total: rows.length };
      }
      return fetchRunRowPage({ ...query, mode: "paper" });
    },
    placeholderData: (prev) => prev, // keep rows on screen while a new page or search resolves
  });
}

export function useTradeHistory(runId: string | undefined, sample?: SampleScope) {
  return useQuery({
    queryKey: ["trade-history", runId, sample],
    queryFn: async (): Promise<TradeHistoryRow[]> => {
      if (USE_MOCK) return mockApi.getTradeHistory(runId as string);
      // API defaults to page=0/size=100; Overview + paper/live Trades tabs have no pager UI yet,
      // so this surfaces the first page only — see docs/plans/api-integration.md §4.D.
      const page = await apiGet<TradePage>(
        `${HFT_API_URL}/api/runs/${runId}/trades?page=0&size=100${sample ? `&sample=${sample}` : ""}`,
      );
      const rows = Array.isArray(page?.rows) ? page.rows : [];
      return rows.map(toTradeHistoryRow);
    },
    enabled: !!runId,
  });
}
