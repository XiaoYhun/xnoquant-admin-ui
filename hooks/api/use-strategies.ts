import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { apiGetData, apiGetPage } from "@/lib/api-client";
import { USE_MOCK, XALPHA_API_URL } from "@/lib/constant";
import type { StrategyRow, StrategyStatus, StrategyGroup, StrategyAnalytics } from "@/lib/mock/strategies";
import type { StrategyType } from "@/types/domain";
import type { components } from "@/types/api/xalpha";

// XALPHA envelope (docs/plans/api-integration.md §5.A/§5.B) — unwrap `.data` via apiGetData/apiGetPage.
type StrategyInfo = components["schemas"]["models.StrategyInfo"];
type UserResearchPerformanceRecord = components["schemas"]["models.UserResearchPerformanceRecord"];
type StrategyStatsResult = components["schemas"]["models.StrategyStatsResult"];
type UsageStatItem = components["schemas"]["models.UsageStatItem"];

// GAP-6: XALPHA `StrategyInfo` has no `status` values matching our 3-state UI union — map the
// research lifecycle (created/submitted/published/completed/error) down to it; anything that
// isn't published/completed (including `error`) falls back to "in_sample".
const STATUS_MAP: Record<string, StrategyStatus> = {
  published: "published",
  completed: "completed",
  created: "in_sample",
  submitted: "in_sample",
};

// GAP-6: `group` (MFT/HFT), `strategyType` (taker/maker/arbitrage) and `timeframe` don't exist on
// XALPHA `StrategyInfo` — best-effort infer from `tags[]`, else placeholder. See plan §6 GAP-6.
function toGroup(tags: string[] | undefined): StrategyGroup {
  const upper = (tags ?? []).map((t) => t.toUpperCase());
  return upper.includes("HFT") ? "HFT" : "MFT";
}

function toStrategyType(tags: string[] | undefined): StrategyType {
  const lower = (tags ?? []).map((t) => t.toLowerCase());
  if (lower.includes("maker")) return "maker";
  if (lower.includes("arbitrage")) return "arbitrage";
  return "taker";
}

function toStrategyRow(info: StrategyInfo): StrategyRow {
  const perf = info.performance?.performance;
  return {
    id: info.id ?? "",
    name: info.name ?? "",
    status: STATUS_MAP[info.status ?? ""] ?? "in_sample",
    statusUpdatedAt: info.updated_at ?? info.published_at ?? info.created_at ?? "",
    market: info.market ?? "",
    universe: info.universe ?? "",
    group: toGroup(info.tags),
    strategyType: toStrategyType(info.tags),
    timeframe: "—", // GAP-6: no source field
    returnPct: (perf?.cumulative_return ?? 0) * 100, // ratio -> percent
    sharpe: perf?.sharpe ?? 0,
    maxDrawdownPct: (perf?.max_drawdown ?? 0) * 100, // ratio -> percent
    livePerfSeries: [], // sparkline needs a per-row GET /strategies/{id}/charts fetch; unused by the table today
  };
}

export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: async (): Promise<StrategyRow[]> => {
      if (USE_MOCK) return mockApi.listStrategies();
      const { data } = await apiGetPage<StrategyInfo[]>(`${XALPHA_API_URL}/strategies?limit=200`);
      return (data ?? []).map(toStrategyRow);
    },
  });
}

export function useStrategyAnalytics() {
  return useQuery({
    queryKey: ["strategies", "analytics"],
    queryFn: async (): Promise<StrategyAnalytics> => {
      if (USE_MOCK) return mockApi.getStrategyAnalytics();
      const [performance, strategies, markets] = await Promise.all([
        apiGetData<UserResearchPerformanceRecord>(`${XALPHA_API_URL}/stats/performance`),
        apiGetData<StrategyStatsResult>(`${XALPHA_API_URL}/stats/strategies`),
        apiGetData<UsageStatItem[]>(`${XALPHA_API_URL}/stats/markets`),
      ]);
      const byDate = strategies.by_date ?? [];
      return {
        portfolioPerformance: {
          categories: (performance.times ?? []).map(String),
          data: performance.values ?? [],
        },
        strategyPipeline: {
          categories: byDate.map((d) => d.date ?? ""),
          total: byDate.map((d) => d.total ?? 0),
          published: byDate.map((d) => d.published ?? 0),
        },
        marketAllocation: (markets ?? []).map((m) => ({ name: m.name ?? "", value: m.pct ?? 0 })),
      };
    },
  });
}
