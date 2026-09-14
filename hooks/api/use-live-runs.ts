import { useQuery } from "@tanstack/react-query";
import { USE_MOCK } from "@/lib/constant";
import { mockApi } from "@/lib/mock";
import { fetchRunRowPage, fetchRunsPage, type RunRowPage, type RunsQuery } from "./use-runs";
import type { AssetKind } from "@/components/market-tabs";

// Live trade is `GET /api/runs?mode=live` — one server page, narrowed and counted upstream.
// Per-run summary + equity are NOT fetched here; they're deferred to the detail panel (fetched
// on open), so the list is a single call and the table's metric columns show "—" until a run is
// opened.
//
// `query` is the page's whole filter state, including `page`/`size` — see useBacktestRuns.
export function useLiveRuns(query: RunsQuery = {}) {
  return useQuery({
    queryKey: ["live-runs", query],
    queryFn: async (): Promise<RunRowPage> => {
      // Mock ignores `query`, same as usePaperRuns' mock branch.
      if (USE_MOCK) {
        const rows = await mockApi.listLiveRuns();
        return { rows, total: rows.length };
      }
      return fetchRunRowPage({ ...query, mode: "live" });
    },
    placeholderData: (prev) => prev, // keep rows on screen while a new page or search resolves
  });
}

/**
 * The KPI strip's three counts, for a market tab.
 *
 * Counted by the server rather than summed over the rows: with the table paged, the browser only
 * ever holds one page, and a headline that described one page would be wrong the moment the list
 * ran past it. Each call asks for a single row and reads `total`, which is the filtered COUNT(*)
 * — the rows themselves are discarded.
 *
 * Deliberately NOT narrowed by the search box or the Only Running switch: the strip describes the
 * market tab. `engine` IS applied, like `asset_kind` — otherwise the tiles would describe a wider
 * set of runs than the HFT/MFT-filtered table below them.
 */
export function useLiveRunCounts(assetKind?: AssetKind, engine?: RunsQuery["engine"]) {
  return useQuery({
    queryKey: ["live-run-counts", assetKind ?? "", engine ?? ""],
    queryFn: async () => {
      const base: RunsQuery = { mode: "live", asset_kind: assetKind, engine, size: 1 };
      const [all, running, paused] = await Promise.all([
        fetchRunsPage(base),
        fetchRunsPage({ ...base, status: "running" }),
        fetchRunsPage({ ...base, status: "paused" }),
      ]);
      return { total: all.total, running: running.total, paused: paused.total };
    },
    enabled: !USE_MOCK,
  });
}
