"use client";
// MFT Results → "Execution" (Figma 15212:62240). Execution-quality panel, the holding-time
// histogram and the exit-reason strip.
//
// Every figure on this screen describes an individual FILL — when it happened, how long the
// position was held, how far the price slipped, whether the order filled at all.
//
// A RUN-scoped view gets four of them as run-level aggregates on `GET /api/runs/{id}/summary`:
// `avg_holding_time_secs`, `trades_under_6h_pct`, `overnight_trades_pct`, `fill_rate` and
// `slippage_bps`. The XALPHA strategy/stage feed has none of them, and neither feed returns the
// trades themselves, so the two distributions below stay unfilled rather than being approximated.
import { ChartState } from "@/components/charts/chart-state";
import { formatAmount } from "@/lib/utils";
import type { PeriodSelection } from "@/lib/transform/mft-results";
import { useMftResultsSource } from "@/hooks/api/use-mft-results-source";
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
  runId,
}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
  runId?: string;
}) {
  const { perf, summary } = useMftResultsSource({ strategyId, stage, runId });
  const a = perf?.analysis;

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
      ...emptyMetrics(["Slippage (Std)", "Daily Turnover"]),
      // The one honest neighbour of "avg trade size": how many trades the run actually closed.
      { label: "Closed Trades", value: count(a?.total_closed_trades ?? a?.total_trades) },
    ],
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricPanel rows={rows} />
      <NoSourceNote>
        {summary
          ? "Holding time, fill rate and mean slippage are run-level figures from the results API. The rest of this screen is measured per fill — the engine returns no fill timestamps, slippage dispersion or turnover, so those stay blank."
          : "Execution quality is measured per fill. The MFT results API returns aggregates over closed trades only — no fill timestamps, holding times, slippage or fill ratios — so these figures stay blank until the engine reports trade-level records."}
      </NoSourceNote>

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
