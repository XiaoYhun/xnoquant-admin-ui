import { useMemo } from "react";
import { realSummary, useRunEquity, useRunPeriodicSummary, useRunSummary } from "@/hooks/api/use-runs";
import { useStrategyChart, useSummaryTable } from "@/hooks/api/use-strategy-results";
import { useStrategyPerformance } from "@/hooks/api/use-strategy-performance";
import { runToMftCharts, runToMftPerf, runToMftSummaryRows } from "@/lib/transform/run-as-mft";
import type { StrategyChartData, SummaryTableItem } from "@/hooks/api/use-strategy-results";
import type { StrategyPerformanceDetail } from "@/hooks/api/use-strategy-performance";
import type { PeriodSummary, RunSummary } from "@/types/domain";

type ChartQ = {
  data: StrategyChartData | undefined;
  isLoading: boolean;
  isError: boolean;
};

/** One feed for the six Figma-15204 screens: XALPHA strategy+stage, or an HFT bar run. */
export function useMftResultsSource({
  strategyId,
  stage,
  runId,
}: {
  strategyId?: string;
  stage?: string;
  runId?: string;
}): {
  perf: StrategyPerformanceDetail | undefined;
  /**
   * The run's raw `GET /api/runs/{id}/summary`, for the panels whose metrics have no counterpart
   * in `StrategyPerformanceDetail`. Undefined on the XALPHA strategy/stage path.
   */
  summary: RunSummary | undefined;
  summaryRows: SummaryTableItem[] | undefined;
  /**
   * `GET /api/runs/:id/periodic-summary` — a full `RunSummary` per calendar year, which is the
   * only source with per-year trade, execution and cost figures. Undefined on the XALPHA
   * strategy/stage path, which has no equivalent endpoint.
   */
  periods: PeriodSummary[] | undefined;
  pnls: ChartQ;
  returns: ChartQ;
  drawdown: ChartQ;
  sharpe: ChartQ;
} {
  const equityQ = useRunEquity(runId);
  const summaryQ = useRunSummary(runId);
  const periodsQ = useRunPeriodicSummary(runId);
  // Dropped rather than rendered when the run's artifacts were too big to compute over — see
  // `realSummary`. Every panel below then shows its ordinary empty state.
  const summary = realSummary(summaryQ.data);
  const fromRun = useMemo(() => {
    if (!runId) return null;
    const charts = runToMftCharts(equityQ.data, summary);
    const q = (data: StrategyChartData): ChartQ => ({
      data,
      isLoading: equityQ.isLoading,
      isError: equityQ.isError,
    });
    return {
      perf: runToMftPerf(summary),
      summary,
      summaryRows: runToMftSummaryRows(equityQ.data, summary),
      periods: periodsQ.data,
      pnls: q(charts.pnls),
      returns: q(charts.returns),
      drawdown: q(charts.drawdown),
      sharpe: q(charts.sharpe),
    };
  }, [runId, equityQ.data, equityQ.isLoading, equityQ.isError, summary, periodsQ.data]);

  const xId = runId ? undefined : strategyId;
  const perf = useStrategyPerformance(xId, stage);
  const table = useSummaryTable(xId, stage);
  const pnls = useStrategyChart(xId, "pnls");
  const returns = useStrategyChart(xId, "returns");
  const dd = useStrategyChart(xId, "drawdown");
  const sharpe = useStrategyChart(xId, "sharpe");

  if (fromRun) return fromRun;
  return {
    perf: perf.data,
    summary: undefined,
    summaryRows: table.data,
    periods: undefined,
    pnls,
    returns,
    drawdown: dd,
    sharpe,
  };
}
