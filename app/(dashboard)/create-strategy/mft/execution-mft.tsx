"use client";
// MFT Results → "Execution" (Figma 15212:62240). Execution-quality panel, the holding-time
// histogram and the exit-reason strip.
//
// Every figure on this screen describes an individual FILL — when it happened, how long the
// position was held, how far the price slipped, whether the order filled at all.
//
// A RUN-scoped view gets four of them as run-level aggregates on `GET /api/runs/{id}/summary`:
// `avg_holding_time_secs`, `trades_under_6h_pct`, `overnight_trades_pct`, `fill_rate` and
// `slippage_bps`, plus per-fill slippage/latency dispersion and distributions off
// `/execution-detail` (undefined on the XALPHA strategy/stage feed, which keeps its empty states).
// Holding time and exit reason still need per-trade records neither feed returns.
import { useMemo } from "react";
import { BaseChart } from "@/components/charts/base-chart";
import { ChartState, chartStatus } from "@/components/charts/chart-state";
import { useRunExecutionDetail } from "@/hooks/api/use-runs";
import { formatAmount } from "@/lib/utils";
import type { PeriodSelection } from "@/lib/transform/mft-results";
import { buildHistogramBarOption, toHistogramBars } from "@/lib/transform/run-detail";
import { useMftResultsSource } from "@/hooks/api/use-mft-results-source";
import type { SampleScope } from "@/types/domain";
import {
  ChartCard,
  EMPTY,
  MetricPanel,
  NoSourceNote,
  count,
  duration,
  emptyMetrics,
  shareFromRatio,
  type Metric,
} from "./results-chrome";

export function ExecutionMft({
  strategyId,
  stage,
  period,
  runId,
  sample,
}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
  runId?: string;
  sample?: SampleScope;
}) {
  // `period` scopes `perf`/`summary` to the selected year — every figure on this screen is a
  // run-level aggregate already, so it narrows the same way the Overview KPI cards do.
  const { perf, summary } = useMftResultsSource({ strategyId, stage, runId, period, sample });
  const a = perf?.analysis;
  const execQ = useRunExecutionDetail(runId, sample);
  const exec = execQ.data;

  // An HFT bar-run carries these four on `/api/runs/{id}/summary`; the XALPHA strategy/stage feed
  // does not, and `avg_win_trade_duration` / `avg_loss_trade_duration` on that payload are
  // documented with no unit (bars? seconds? days?), so that path still reads blank.
  const rows: Metric[][] = [
    [
      { label: "Avg Holding Time", value: duration(summary?.avg_holding_time_secs) },
      // `_pct` names a FRACTION in [0, 1] on this payload, not a percentage.
      { label: "Trades < 6h", value: shareFromRatio(summary?.trades_under_6h_pct) },
      { label: "Overnight Trades", value: shareFromRatio(summary?.overnight_trades_pct) },
      { label: "Fill Rate", value: shareFromRatio(summary?.fill_rate) },
    ],
    [
      { label: "Slippage (Avg)", value: summary?.slippage_bps == null ? EMPTY : `${formatAmount(summary.slippage_bps, 2)} bp` },
      {
        label: "Slippage (Std)",
        value: exec?.slippage_std_bps == null ? EMPTY : `${formatAmount(exec.slippage_std_bps, 2)} bp`,
      },
      ...emptyMetrics(["Daily Turnover"]),
      // The one honest neighbour of "avg trade size": how many trades the run actually closed.
      { label: "Closed Trades", value: count(a?.total_closed_trades ?? a?.total_trades) },
    ],
  ];

  const slippageBars = useMemo(() => toHistogramBars(exec?.slippage_histogram ?? []), [exec]);
  const latencyBars = useMemo(() => toHistogramBars(exec?.latency_histogram ?? []), [exec]);
  const slippageOption = useMemo(() => buildHistogramBarOption(slippageBars, "bp"), [slippageBars]);
  const latencyOption = useMemo(() => buildHistogramBarOption(latencyBars, "ms"), [latencyBars]);
  const slippageStatus = chartStatus({ loading: execQ.isLoading, error: execQ.isError, empty: !slippageBars.length });
  const latencyStatus = chartStatus({ loading: execQ.isLoading, error: execQ.isError, empty: !latencyBars.length });
  const distributionDetail = execQ.isError
    ? "Execution detail for this run could not be loaded."
    : "No fills have been recorded for this run yet.";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricPanel rows={rows} />
      <NoSourceNote>
        {summary
          ? "Holding time, fill rate, mean/dispersion slippage and the per-fill distributions below are run-level figures from the results API. Holding time and exit reason still need per-trade entry/exit records the engine does not return, so those stay blank."
          : "Execution quality is measured per fill. The MFT results API returns aggregates over closed trades only — no fill timestamps, holding times, slippage or fill ratios — so these figures stay blank until the engine reports trade-level records."}
      </NoSourceNote>

      {runId && (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Slippage distribution">
            <ChartState status={slippageStatus} detail={distributionDetail}>
              <BaseChart option={slippageOption} />
            </ChartState>
          </ChartCard>
          <ChartCard title="Latency distribution">
            <ChartState status={latencyStatus} detail={distributionDetail}>
              <BaseChart option={latencyOption} />
            </ChartState>
          </ChartCard>
        </div>
      )}

      <ChartCard title="Holding time distribution">
        <ChartState
          status="empty"
          detail="Bucketing trades by holding time needs each trade's entry and exit time, which the MFT engine does not return."
        />
      </ChartCard>

      <ChartCard title="Exit reason">
        <ChartState
          status="empty"
          detail="Exit reasons are recorded per trade; the MFT results API exposes no per-trade breakdown."
        />
      </ChartCard>
    </div>
  );
}
