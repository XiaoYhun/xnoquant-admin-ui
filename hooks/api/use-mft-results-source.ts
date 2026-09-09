import { useMemo } from "react";
import { useRunEquity, useRunSummary } from "@/hooks/api/use-runs";
import { useStrategyChart, useSummaryTable } from "@/hooks/api/use-strategy-results";
import { useStrategyPerformance } from "@/hooks/api/use-strategy-performance";
import { runToMftCharts, runToMftPerf, runToMftSummaryRows } from "@/lib/transform/run-as-mft";
import type { StrategyChartData, SummaryTableItem } from "@/hooks/api/use-strategy-results";
import type { StrategyPerformanceDetail } from "@/hooks/api/use-strategy-performance";

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
  summaryRows: SummaryTableItem[] | undefined;
  pnls: ChartQ;
  returns: ChartQ;
  drawdown: ChartQ;
  sharpe: ChartQ;
} {
  const equityQ = useRunEquity(runId);
  const summaryQ = useRunSummary(runId);
  const fromRun = useMemo(() => {
    if (!runId) return null;
    const charts = runToMftCharts(equityQ.data);
    const q = (data: StrategyChartData): ChartQ => ({
      data,
      isLoading: equityQ.isLoading,
      isError: equityQ.isError,
    });
    return {
      perf: runToMftPerf(summaryQ.data),
      summaryRows: runToMftSummaryRows(equityQ.data, summaryQ.data),
      pnls: q(charts.pnls),
      returns: q(charts.returns),
      drawdown: q(charts.drawdown),
      sharpe: q(charts.sharpe),
    };
  }, [runId, equityQ.data, equityQ.isLoading, equityQ.isError, summaryQ.data]);

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
    summaryRows: table.data,
    pnls,
    returns,
    drawdown: dd,
    sharpe,
  };
}
