"use client";
// MFT Results → "Performance" (Figma 15205:56946). Ratio panel, the Yearly Statistics grid, the
// monthly-return heatmap, net daily PnL bars and the daily-return histogram.
import { useCallback, useMemo } from "react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { ChartState, chartStatus } from "@/components/charts/chart-state";
import { formatAmount } from "@/lib/utils";
import { toReturnHistogram } from "@/lib/transform/results";
import {
  filterByPeriod,
  monthlyReturns,
  sliceStage,
  toPeriodChanges,
  toPoints,
  yearOf,
  type PeriodSelection,
} from "@/lib/transform/mft-results";
import { useStrategyChart, useSummaryTable } from "@/hooks/api/use-strategy-results";
import { useStrategyPerformance } from "@/hooks/api/use-strategy-performance";
import {
  ChartCard,
  MetricPanel,
  YELLOW_TEXT,
  num,
  pctFromPercent,
  pctFromRatio,
  toneBySign,
  type Metric,
} from "./results-chrome";
import { YearlyStatistics, statisticsYears, type Scope } from "./yearly-statistics";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const GREEN = "#67e1c1";
const RED = "#ff135b";

function dateLabel(t: number): string {
  return new Date(t * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });
}

// ---- monthly return heatmap (Figma 15205:57102) ----------------------------------------------

/** Cell tint: hue by sign, opacity by magnitude relative to the grid's largest absolute month. */
function cellStyle(v: number | undefined, peak: number): React.CSSProperties {
  if (v == null || peak <= 0) return {};
  const weight = Math.min(1, Math.abs(v) / peak);
  // Floor the alpha so a small but real month still reads as coloured rather than blank.
  const alpha = 0.12 + weight * 0.5;
  return { backgroundColor: `${v >= 0 ? "rgba(103,225,193," : "rgba(255,19,91,"}${alpha})` };
}

function MonthlyReturns({ rows }: { rows: ReturnType<typeof monthlyReturns> }) {
  const peak = Math.max(
    0,
    ...rows.flatMap((r) => r.months.filter((m): m is number => m != null).map(Math.abs)),
  );

  return (
    <ChartCard
      title="Monthly Return"
      right={
        <div className="flex items-center gap-2">
          <span className="text-[10px] leading-[14px] text-[#9db2ce]">Less</span>
          <span className="h-2 w-16 rounded-full bg-[linear-gradient(90deg,rgba(255,19,91,0.6)_0%,rgba(29,41,57,1)_50%,rgba(103,225,193,0.6)_100%)]" />
          <span className="text-[10px] leading-[14px] text-[#9db2ce]">More</span>
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs leading-[18px] font-medium text-white">
                Year
              </th>
              {MONTHS.map((m) => (
                <th
                  key={m}
                  className="px-1 py-2 text-center text-xs leading-[18px] font-medium text-white"
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year}>
                <td className="px-3 py-1 text-xs leading-[18px] text-white">{r.year}</td>
                {r.months.map((v, i) => (
                  <td key={i} className="p-0.5">
                    <div
                      className="flex h-7 items-center justify-center rounded text-[10px] leading-[14px] text-white"
                      style={cellStyle(v, peak)}
                      title={v == null ? undefined : `${MONTHS[i]} ${r.year}: ${pctFromPercent(v)}`}
                    >
                      {v == null ? "" : formatAmount(v, 1)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ---- charts ----------------------------------------------------------------------------------

function dailyPnlOption(points: { t: number; v: number }[]): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: points.map((p) => dateLabel(p.t)),
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: "#9db2ce",
        interval: Math.max(0, Math.ceil(points.length / 8) - 1),
      },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 10 } },
    series: [
      {
        type: "bar",
        name: "Net PnL",
        data: points.map((p) => ({ value: p.v, itemStyle: { color: p.v >= 0 ? GREEN : RED } })),
        barMaxWidth: 12,
      },
    ],
  };
}

function distributionOption(bins: ReturnType<typeof toReturnHistogram>): EChartsOption {
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number; value: number }[];
        const b = bins[arr[0]?.dataIndex ?? 0];
        if (!b) return "";
        return `${formatAmount(b.lower, 2)}% – ${formatAmount(b.lower + (bins[1]?.lower - bins[0]?.lower || 0), 2)}%<br/>${arr[0].value} days`;
      },
    },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: bins.map((b) => `${formatAmount(b.center, 1)}%`),
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: "#9db2ce",
        interval: Math.max(0, Math.ceil(bins.length / 10) - 1),
      },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 10 } },
    series: [
      {
        type: "bar",
        name: "Days",
        data: bins.map((b) => ({
          value: b.count,
          itemStyle: { color: b.center < 0 ? RED : GREEN },
        })),
        barCategoryGap: "10%",
      },
    ],
  };
}

// ---- view ------------------------------------------------------------------------------------

export function PerformanceMft({
  strategyId,
  stage,
  period,
}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
}) {
  const { data: perf } = useStrategyPerformance(strategyId, stage);
  const { data: summaryRows } = useSummaryTable(strategyId, stage);
  const returns = useStrategyChart(strategyId, "returns");
  const pnls = useStrategyChart(strategyId, "pnls");
  const dd = useStrategyChart(strategyId, "drawdown");

  // Stage slice first (the charts endpoint returns every stage at once), then the Period row.
  const returnPts = useMemo(
    () => filterByPeriod(sliceStage(toPoints(returns.data), returns.data, stage), period),
    [returns.data, stage, period],
  );
  const dailyPnl = useMemo(
    () => toPeriodChanges(filterByPeriod(sliceStage(toPoints(pnls.data), pnls.data, stage), period)),
    [pnls.data, stage, period],
  );

  const monthly = useMemo(() => monthlyReturns(returnPts), [returnPts]);
  const bins = useMemo(() => toReturnHistogram(returnPts.map((p) => p.v)), [returnPts]);

  // Stage-wide series (NOT period-filtered) back the year columns — each column narrows to its own
  // year, so pre-filtering to the selected period would empty every other column.
  const stageReturns = useMemo(
    () => sliceStage(toPoints(returns.data), returns.data, stage),
    [returns.data, stage],
  );
  const stageDrawdown = useMemo(
    () => sliceStage(toPoints(dd.data), dd.data, stage),
    [dd.data, stage],
  );

  const years = useMemo(() => statisticsYears(summaryRows), [summaryRows]);
  const scopeFor = useCallback(
    (year?: number): Scope =>
      year == null
        ? { isAll: true, perf, returns: stageReturns, drawdown: stageDrawdown }
        : {
            isAll: false,
            row: summaryRows?.find((r) => Number(r.time) === year),
            returns: stageReturns.filter((p) => yearOf(p.t) === year),
            drawdown: stageDrawdown.filter((p) => yearOf(p.t) === year),
          },
    [perf, summaryRows, stageReturns, stageDrawdown],
  );

  const p = perf?.performance;
  const a = perf?.analysis;

  const rows: Metric[][] = [
    [
      { label: "Sharpe Ratio", value: num(p?.sharpe), tone: YELLOW_TEXT },
      { label: "Sortino Ratio", value: num(p?.sortino), tone: YELLOW_TEXT },
      { label: "Calmar Ratio", value: num(p?.calmar), tone: YELLOW_TEXT },
      { label: "Volatility (ann.)", value: pctFromRatio(p?.volatility) },
    ],
    [
      {
        label: "Best Trade",
        value: pctFromRatio(a?.best_trade),
        tone: toneBySign(a?.best_trade),
      },
      { label: "Avg Loss", value: pctFromRatio(a?.avg_loss_trade), tone: toneBySign(a?.avg_loss_trade) },
      { label: "Payoff Ratio", value: num(p?.win_loss_ratio), tone: YELLOW_TEXT },
      { label: "Recovery Factor", value: num(p?.recovery_factor), tone: YELLOW_TEXT },
    ],
  ];

  const pnlStatus = chartStatus({
    loading: pnls.isLoading,
    error: pnls.isError,
    empty: !dailyPnl.length,
  });
  const distStatus = chartStatus({
    loading: returns.isLoading,
    error: returns.isError,
    empty: !bins.length,
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricPanel rows={rows} />

      {years.length > 0 ? (
        <YearlyStatistics years={years} scopeFor={scopeFor} />
      ) : (
        <div className="rounded-xl border border-[#1d2939] bg-background px-4 py-8 text-center text-xs text-[#9db2ce]">
          No yearly breakdown for this stage.
        </div>
      )}

      {monthly.length > 0 ? (
        <MonthlyReturns rows={monthly} />
      ) : (
        <ChartCard title="Monthly Return">
          <ChartState status="empty" detail="No return series for this stage and period." />
        </ChartCard>
      )}

      <ChartCard title="Net Daily PnL">
        <ChartState status={pnlStatus} detail="No PnL series for this stage and period.">
          <BaseChart option={dailyPnlOption(dailyPnl)} style={{ height: 240 }} />
        </ChartState>
      </ChartCard>

      <ChartCard title="Daily Return Distribution">
        <ChartState status={distStatus} detail="No return series for this stage and period.">
          <BaseChart option={distributionOption(bins)} style={{ height: 240 }} />
        </ChartState>
      </ChartCard>
    </div>
  );
}
