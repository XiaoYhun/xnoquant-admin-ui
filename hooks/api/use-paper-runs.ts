import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { apiGet } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { PaperRunRow, TradeHistoryRow } from "@/lib/mock/paper-runs";

export function usePaperRuns() {
  return useQuery({
    queryKey: ["paper-runs"],
    queryFn: () =>
      USE_MOCK ? mockApi.listPaperRuns() : apiGet<PaperRunRow[]>(`${HFT_API_URL}/api/runs?mode=paper`),
  });
}

export function useTradeHistory(runId: string | undefined) {
  return useQuery({
    queryKey: ["trade-history", runId],
    queryFn: () =>
      USE_MOCK
        ? mockApi.getTradeHistory(runId as string)
        : apiGet<TradeHistoryRow[]>(`${HFT_API_URL}/api/runs/${runId}/trades`),
    enabled: !!runId,
  });
}
