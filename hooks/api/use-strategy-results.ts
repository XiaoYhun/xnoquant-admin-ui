import { useQuery } from "@tanstack/react-query";
import { apiGetData } from "@/lib/api-client";
import { USE_MOCK, XALPHA_API_URL } from "@/lib/constant";
import { PNL_SERIES, RETURNS_SERIES, YEARLY_ROWS } from "@/lib/mock/strategy-builder";
import type { components } from "@/types/api/xalpha";

// Create Strategy "Results" tab (MFT) — XALPHA envelope, unwrap `.data` via apiGetData.
// Mirrors xno-builder's useListSeries/useStrategyStageSummaryAggregate/useStrategySummaryData/
// usePNLsChartData, ported from SWR to React Query.
export type SeriesInfo = components["schemas"]["models.SeriesInfo"];
export type SummaryAggregateItem = components["schemas"]["models.SummaryAggregateItem"];
export type SummaryTableItem = components["schemas"]["models.SummaryTableItem"];
export type StrategyChartData = components["schemas"]["models.StrategyChartData"];

const MOCK_SERIES: SeriesInfo[] = [
  { name: "pnls", description: "Profit and loss" },
  { name: "returns", description: "Returns" },
  { name: "sharpe", description: "Sharpe ratio" },
  { name: "drawdown", description: "Drawdown" },
];

// "+18.4%" / "-8.6%" -> 0.184 / -0.086 — matches the ratio units the real API returns
// (cagr/max_drawdown/etc. are ratios, not pre-multiplied percentages).
function pctToRatio(pct: string): number {
  return Number(pct.replace("%", "")) / 100;
}

const MOCK_AGGREGATE: SummaryAggregateItem = (() => {
  const latest = YEARLY_ROWS[0];
  return {
    sharpe: latest.sharpe,
    cagr: pctToRatio(latest.cagr),
    max_drawdown: pctToRatio(latest.maxDd),
    profit_factor: latest.profitFactor,
    calmar: latest.calmar,
  };
})();

const MOCK_SUMMARY_TABLE: SummaryTableItem[] = YEARLY_ROWS.map((r) => ({
  time: r.year,
  sharpe: r.sharpe,
  cagr: pctToRatio(r.cagr),
  max_drawdown: pctToRatio(r.maxDd),
  profit_factor: r.profitFactor,
  calmar: r.calmar,
}));

const DAY_SECONDS = 86400;

// Deterministic unix-second timestamps (one per day, ending today) for the mock chart series.
function daySeries(length: number): number[] {
  const today = Math.floor(Date.now() / 1000 / DAY_SECONDS) * DAY_SECONDS;
  return Array.from({ length }, (_, i) => today - (length - 1 - i) * DAY_SECONDS);
}

// Splits the mock series into train(60%)/test(20%)/simulate(10%)/live(10%) stage ranges so
// switching the Stage pill visibly slices the mock chart too, not just the real API's.
function mockStages(times: number[]): Record<string, { from: number; to: number }> {
  const n = times.length;
  const trainEnd = Math.max(1, Math.floor(n * 0.6));
  const testEnd = Math.max(trainEnd, Math.floor(n * 0.8));
  const simulateEnd = Math.max(testEnd, Math.floor(n * 0.9));
  return {
    train: { from: times[0], to: times[trainEnd - 1] },
    test: { from: times[trainEnd - 1], to: times[testEnd - 1] },
    simulate: { from: times[testEnd - 1], to: times[simulateEnd - 1] },
    live: { from: times[simulateEnd - 1], to: times[n - 1] },
  };
}

function buildMockChart(values: number[]): StrategyChartData {
  const times = daySeries(values.length);
  return { times, values, stages: mockStages(times) };
}

const MOCK_CHARTS: Record<string, StrategyChartData> = {
  pnls: buildMockChart(PNL_SERIES),
  returns: buildMockChart(RETURNS_SERIES),
  sharpe: buildMockChart(RETURNS_SERIES.map((v) => Number((v / 3).toFixed(2)))),
  drawdown: buildMockChart(
    PNL_SERIES.map((v, i, arr) => Number(Math.min(0, v - Math.max(...arr.slice(0, i + 1))).toFixed(2))),
  ),
};

// Slices {times,values} down to a stage's [from,to] range (looked up in `stages`) — done here via
// `select` so switching stages re-slices already-fetched data instead of refetching.
function sliceStage(
  data: StrategyChartData | undefined,
  stage?: string,
): { times: number[]; values: number[] } {
  const times = data?.times ?? [];
  const values = data?.values ?? [];
  const range = stage ? data?.stages?.[stage] : undefined;
  if (range?.from == null || range?.to == null) return { times, values };
  const fromIdx = times.indexOf(range.from);
  const toIdx = times.indexOf(range.to);
  if (fromIdx === -1 || toIdx === -1) return { times, values };
  return { times: times.slice(fromIdx, toIdx + 1), values: values.slice(fromIdx, toIdx + 1) };
}

// Multi-select options for "Select charts" — no strategyId/stage dependency, so no `enabled` gate.
export function useResultSeries() {
  return useQuery({
    queryKey: ["strategy-results", "series"],
    queryFn: async (): Promise<SeriesInfo[]> => {
      if (USE_MOCK) return MOCK_SERIES;
      return apiGetData<SeriesInfo[]>(`${XALPHA_API_URL}/series`);
    },
  });
}

export function useSummaryAggregate(strategyId?: string, stage?: string) {
  return useQuery({
    queryKey: ["strategy-results", "summary-aggregate", strategyId, stage],
    queryFn: async (): Promise<SummaryAggregateItem> => {
      if (USE_MOCK) return MOCK_AGGREGATE;
      return apiGetData<SummaryAggregateItem>(
        `${XALPHA_API_URL}/strategies/${strategyId}/stages/${stage}/summary-aggregate`,
      );
    },
    enabled: USE_MOCK || (!!strategyId && !!stage),
  });
}

export function useSummaryTable(strategyId?: string, stage?: string) {
  return useQuery({
    queryKey: ["strategy-results", "summary-table", strategyId, stage],
    queryFn: async (): Promise<SummaryTableItem[]> => {
      if (USE_MOCK) return MOCK_SUMMARY_TABLE;
      return apiGetData<SummaryTableItem[]>(
        `${XALPHA_API_URL}/strategies/${strategyId}/stages/${stage}/summary-table`,
      );
    },
    enabled: USE_MOCK || (!!strategyId && !!stage),
  });
}

// Chart data doesn't depend on `stage` server-side (the endpoint returns all stages at once) —
// only strategyId+series gate the fetch/cache key; `stage` just drives the client-side `select` slice.
export function useStrategyChart(strategyId?: string, stage?: string, series?: string) {
  return useQuery({
    queryKey: ["strategy-results", "chart", strategyId, series],
    queryFn: async (): Promise<StrategyChartData> => {
      if (USE_MOCK) return MOCK_CHARTS[series ?? ""] ?? buildMockChart(PNL_SERIES);
      return apiGetData<StrategyChartData>(`${XALPHA_API_URL}/strategies/${strategyId}/charts?series=${series}`);
    },
    enabled: USE_MOCK || (!!strategyId && !!series),
    select: (data) => sliceStage(data, stage),
  });
}
