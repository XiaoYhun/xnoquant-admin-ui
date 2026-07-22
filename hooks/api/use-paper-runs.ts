import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { apiGet } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { PaperRunRow, TradeHistoryRow } from "@/lib/mock/paper-runs";
import type { TradePage } from "@/types/domain";
import { fetchRuns } from "./use-runs";
import { toPaperRunRow, toTradeHistoryRow } from "@/lib/transform/runs";

// GAP-2: `GET /api/runs` has no `mode` filter — fetch all, keep `mode==="paper"`. Per-run summary
// + equity are NOT fetched here; they're deferred to the detail panel (useRunSummary/useRunEquity
// on open), so the list is a single call and the table's metric columns show "—" until a run is
// opened.
async function fetchPaperRunRows(): Promise<PaperRunRow[]> {
  return (await fetchRuns()).filter((r) => r.mode === "paper").map(toPaperRunRow);
}

export function usePaperRuns() {
  return useQuery({
    queryKey: ["paper-runs"],
    queryFn: () => (USE_MOCK ? mockApi.listPaperRuns() : fetchPaperRunRows()),
  });
}

export function useTradeHistory(runId: string | undefined) {
  return useQuery({
    queryKey: ["trade-history", runId],
    queryFn: async (): Promise<TradeHistoryRow[]> => {
      if (USE_MOCK) return mockApi.getTradeHistory(runId as string);
      // API defaults to page=0/size=100; the Trades tab (run-detail-panel.tsx, out of scope
      // here) has no pager UI yet, so this surfaces the first page only — see
      // docs/plans/api-integration.md §4.D.
      const page = await apiGet<TradePage>(`${HFT_API_URL}/api/runs/${runId}/trades?page=0&size=100`);
      return page.rows.map(toTradeHistoryRow);
    },
    enabled: !!runId,
  });
}
