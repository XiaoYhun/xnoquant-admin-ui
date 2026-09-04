"use client";
// MFT Results → "Execution" (Figma 15212:62240). Execution-quality panel, the holding-time
// histogram and the exit-reason strip.
//
// Every figure on this screen describes an individual FILL — when it happened, how long the
// position was held, how far the price slipped, whether the order filled at all. The MFT engine
// reports aggregates over closed trades and never the trades themselves, so the screen is built to
// the design and left unfilled rather than approximated from returns.
import { ChartState } from "@/components/charts/chart-state";
import type { PeriodSelection } from "@/lib/transform/mft-results";
import { useStrategyPerformance } from "@/hooks/api/use-strategy-performance";
import {
  ChartCard,
  EMPTY,
  MetricPanel,
  NoSourceNote,
  count,
  emptyMetrics,
  type Metric,
} from "./results-chrome";

export function ExecutionMft({
  strategyId,
  stage,
}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
}) {
  const { data: perf } = useStrategyPerformance(strategyId, stage);
  const a = perf?.analysis;

  const rows: Metric[][] = [
    [
      // `avg_win_trade_duration` / `avg_loss_trade_duration` DO exist on the payload, but the API
      // documents no unit for them (bars? seconds? days?), and a duration rendered in the wrong
      // unit is worse than one left blank.
      { label: "Avg Holding Time", value: EMPTY },
      { label: "Trades < 6h", value: EMPTY },
      { label: "Overnight Trades", value: EMPTY },
      { label: "Fill Rate", value: EMPTY },
    ],
    [
      ...emptyMetrics(["Slippage (Avg)", "Slippage (Std)", "Daily Turnover"]),
      // The one honest neighbour of "avg trade size": how many trades the run actually closed.
      { label: "Closed Trades", value: count(a?.total_closed_trades ?? a?.total_trades) },
    ],
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricPanel rows={rows} />
      <NoSourceNote>
        Execution quality is measured per fill. The MFT results API returns aggregates over closed
        trades only — no fill timestamps, holding times, slippage or fill ratios — so these figures
        stay blank until the engine reports trade-level records.
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
