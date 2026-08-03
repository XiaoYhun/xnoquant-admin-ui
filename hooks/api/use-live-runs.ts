import { useQuery } from "@tanstack/react-query";
import { USE_MOCK } from "@/lib/constant";
import type { PaperRunRow } from "@/lib/mock/paper-runs";
import { fetchRuns, type RunsQuery } from "./use-runs";
import { toPaperRunRow } from "@/lib/transform/runs";

// GAP-2: HFT `GET /api/runs` has no `mode` filter — fetch a page of runs, keep `mode==="live"`.
// Per-run summary + equity are NOT fetched here; they're deferred to the detail panel (fetched on
// open), so the list is a single call and the table's metric columns show "—" until a run is opened.
async function fetchLiveRunRows(query: RunsQuery): Promise<PaperRunRow[]> {
  return (await fetchRuns(query)).filter((r) => r.mode === "live").map(toPaperRunRow);
}

// `query` goes to the server (`q` = strategy-name search, `status` = exact match). Paging stays
// client-side — see the GAP-2 note in use-runs.ts.
export function useLiveRuns(query: RunsQuery = {}) {
  return useQuery({
    queryKey: ["live-runs", query.q ?? "", query.status ?? ""],
    queryFn: () => (USE_MOCK ? Promise.resolve<PaperRunRow[]>([]) : fetchLiveRunRows(query)),
    placeholderData: (prev) => prev, // keep rows on screen while a new search resolves
  });
}
