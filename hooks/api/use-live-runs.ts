import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { apiGet } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { LiveRunRow } from "@/lib/mock/live-runs";

export function useLiveRuns() {
  return useQuery({
    queryKey: ["live-runs"],
    queryFn: () => (USE_MOCK ? mockApi.listLiveRuns() : apiGet<LiveRunRow[]>(`${HFT_API_URL}/api/runs?mode=live`)),
  });
}
