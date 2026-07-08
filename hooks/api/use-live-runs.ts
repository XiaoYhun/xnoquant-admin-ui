import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { USE_MOCK } from "@/lib/constant";
import type { LiveRunRow } from "@/lib/mock/live-runs";
import { fetchRunEquity, fetchRunSummary, fetchRuns } from "./use-runs";
import { toLiveRunRow } from "@/lib/transform/runs";

// GAP-2: HFT `GET /api/runs` has no `mode` filter — fetch all runs, filter to `mode==="live"`
// client-side. Each row needs Run + RunSummary + EquityPoint[] (N+1×2 fetches — see
// docs/plans/api-integration.md §4.C "Architectural cost"); composed here, inside the hook, so
// useLiveRuns keeps returning a plain, fully-populated LiveRunRow[] and the table/page (frozen
// for this phase) doesn't need to change.
async function fetchLiveRunRows(): Promise<LiveRunRow[]> {
  const runs = (await fetchRuns()).filter((r) => r.mode === "live");
  return Promise.all(
    runs.map(async (run) => {
      const [summary, equity] = await Promise.all([
        fetchRunSummary(run.id).catch(() => null),
        fetchRunEquity(run.id).catch(() => []),
      ]);
      return toLiveRunRow(run, summary, equity);
    }),
  );
}

export function useLiveRuns() {
  return useQuery({
    queryKey: ["live-runs"],
    queryFn: () => (USE_MOCK ? mockApi.listLiveRuns() : fetchLiveRunRows()),
  });
}
