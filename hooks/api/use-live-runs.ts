import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { USE_MOCK } from "@/lib/constant";
import type { LiveRunRow } from "@/lib/mock/live-runs";
import { fetchRuns } from "./use-runs";
import { toLiveRunRow } from "@/lib/transform/runs";

// GAP-2: HFT `GET /api/runs` has no `mode` filter — fetch all runs, keep `mode==="live"`. Per-run
// summary + equity are NOT fetched here; they're deferred to the detail panel (fetched on open),
// so the list is a single call and the table's metric columns show "—" until a run is opened.
async function fetchLiveRunRows(): Promise<LiveRunRow[]> {
  return (await fetchRuns()).filter((r) => r.mode === "live").map(toLiveRunRow);
}

export function useLiveRuns() {
  return useQuery({
    queryKey: ["live-runs"],
    queryFn: () => (USE_MOCK ? mockApi.listLiveRuns() : fetchLiveRunRows()),
  });
}
