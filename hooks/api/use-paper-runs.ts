import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { apiGet } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { PaperRunRow, TradeHistoryRow } from "@/lib/mock/paper-runs";
import type { TradePage } from "@/types/domain";
import { fetchRunEquity, fetchRunSummary, fetchRuns } from "./use-runs";
import { toPaperRunRow, toTradeHistoryRow } from "@/lib/transform/runs";

// GAP-2 + N+1 compose — same approach as use-live-runs.ts, filtered to `mode==="paper"`.
async function fetchPaperRunRows(): Promise<PaperRunRow[]> {
  const runs = (await fetchRuns()).filter((r) => r.mode === "paper");
  return Promise.all(
    runs.map(async (run) => {
      const [summary, equity] = await Promise.all([
        fetchRunSummary(run.id).catch(() => null),
        fetchRunEquity(run.id).catch(() => []),
      ]);
      return toPaperRunRow(run, summary, equity);
    }),
  );
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
