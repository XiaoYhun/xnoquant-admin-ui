"use client";
// MFT Results → "Overview" (Figma 15204:30669). Six sparkline KPI cards, the equity curve with its
// nine-metric strip, and the yearly summary table.
import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { MaximizeSquareMinimalistic } from "@solar-icons/react";

import { BaseChart } from "@/components/charts/base-chart";
import { ChartState, chartStatus } from "@/components/charts/chart-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatAmount } from "@/lib/utils";
import {
  filterByPeriod,
  sliceStage,
  toPoints,
  type PeriodSelection,
  type Point,
} from "@/lib/transform/mft-results";
import { bucketedSummaryRows } from "@/lib/transform/run-as-mft";
import { useMftResultsSource } from "@/hooks/api/use-mft-results-source";
import { useRunCurrency } from "@/hooks/api/use-runs";
import type { SampleScope } from "@/types/domain";
import type { Granularity } from "../mft-results-view";
import {
  ChartCard,
  EMPTY,
  GREEN_TEXT,
  RED_TEXT,
  count,
  durationDays,
  shareFromRatio,
  num,
  pctFromRatio,
  toneBySign,
} from "./results-chrome";

function dateLabel(t: number): string {
  return new Date(t * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

// ---- KPI cards (Figma 15204:30766) -----------------------------------------------------------

interface KpiCard {
  label: string;
  value: string;
  /** Unit shown small and baseline-aligned after the value. */
  unit?: string;
  /** Second line under the value. */
  note?: string;
  tone?: string;
  spark?: number[];
}

function KpiCards({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="flex min-w-0 flex-col rounded-xl border border-[#1d2939] bg-[rgba(29,33,38,0.2)] p-2"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-xs leading-[18px] text-[#9db2ce]">{c.label}</span>
            <div className="flex min-w-0 items-end gap-1">
              <span
                title={c.value}
                className={cn("min-w-0 truncate text-base leading-5 font-semibold", c.tone ?? "text-white")}
              >
                {c.value}
              </span>
              {c.unit && (
                <span className="shrink-0 text-[10px] leading-[14px] text-[#9db2ce]">{c.unit}</span>
              )}
            </div>
            <span className="text-[10px] leading-[14px] text-[#9db2ce]">{c.note ?? " "}</span>
          </div>
          {/* Sparkline strip hidden for now (product ask) — `spark` stays on every card and the
              Sparkline component/series plumbing are untouched, so this is a one-line revert. */}
        </div>
      ))}
    </div>
  );
}

// ---- equity curve ----------------------------------------------------------------------------

function equityOption(equity: Point[], drawdown: Point[]): EChartsOption {
  const labels = equity.map((p) => dateLabel(p.t));
  // Drawdown is fetched as its own series, so it is aligned onto the equity axis by timestamp
  // rather than assumed to be sample-for-sample identical.
  const ddByTime = new Map(drawdown.map((p) => [p.t, p.v]));
  const ddAligned = equity.map((p) => ddByTime.get(p.t) ?? null);
  const hasDrawdown = ddAligned.some((v) => v != null);

  return {
    tooltip: { trigger: "axis" },
    legend: { show: false },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: "#9db2ce",
        interval: Math.max(0, Math.ceil(labels.length / 7) - 1),
      },
    },
    yAxis: [
      { type: "value", scale: true, axisLabel: { fontSize: 10 } },
      {
        type: "value",
        max: 0,
        splitLine: { show: false },
        axisLabel: { fontSize: 10, formatter: (v: number) => `${formatAmount(v, 0)}%` },
      },
    ],
    series: [
      {
        type: "line",
        name: "Net Equity",
        data: equity.map((p) => p.v),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: "#67e1c1" },
        itemStyle: { color: "#67e1c1" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(103,225,193,0.35)" },
              { offset: 1, color: "rgba(103,225,193,0)" },
            ],
          },
        },
      },
      ...(hasDrawdown
        ? [
            {
              type: "line" as const,
              name: "Drawdown",
              yAxisIndex: 1,
              data: ddAligned,
              smooth: true,
              showSymbol: false,
              connectNulls: true,
              lineStyle: { width: 1.5, color: "#ff135b" },
              itemStyle: { color: "#ff135b" },
              areaStyle: {
                color: {
                  type: "linear" as const,
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: "rgba(255,19,91,0)" },
                    { offset: 1, color: "rgba(255,19,91,0.35)" },
                  ],
                },
              },
            },
          ]
        : []),
    ],
  };
}

function StripMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-1 basis-[74px] flex-col gap-1">
      <span className="truncate text-[10px] leading-[14px] text-[#9db2ce]">{label}</span>
      <span className={cn("text-sm leading-5 whitespace-nowrap", tone ?? "text-white")}>{value}</span>
    </div>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {dashed ? (
        <span className="h-0 w-[15px] border-t border-dashed" style={{ borderColor: color }} />
      ) : (
        <span className="h-1 w-[15px] rounded-full" style={{ backgroundColor: color }} />
      )}
      <span className="text-[10px] leading-[14px] text-[#9db2ce]">{label}</span>
    </div>
  );
}

// ---- summary table (Figma 15205:55638) -------------------------------------------------------
// One row per year, month or quarter depending on the Period row's Mo/Qtr/Ytd toggle (F-046/
// F-070) — same five metric columns either way, only the title and the first column's header and
// values change.

function SummaryTable({
  title,
  columnLabel,
  rows,
}: {
  title: string;
  columnLabel: string;
  rows: { time?: string; sharpe?: number; cagr?: number; max_drawdown?: number; profit_factor?: number; calmar?: number }[];
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#1d2939] bg-background">
      <div className="border-b border-[#1d2939] bg-[#151a24] px-4 py-2">
        <span className="text-sm leading-5 font-medium text-white">{title}</span>
      </div>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="h-10">{columnLabel}</TableHead>
            <TableHead className="h-10">Sharpe</TableHead>
            <TableHead className="h-10">CAGR</TableHead>
            <TableHead className="h-10">Max drawdown</TableHead>
            <TableHead className="h-10">Profit factor</TableHead>
            <TableHead className="h-10">Calmar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.time}>
              <TableCell className="py-2 text-xs text-white">{r.time ?? EMPTY}</TableCell>
              <TableCell className="py-2 text-xs text-white">{num(r.sharpe)}</TableCell>
              <TableCell className={cn("py-2 text-xs", toneBySign(r.cagr))}>
                {pctFromRatio(r.cagr)}
              </TableCell>
              <TableCell className={cn("py-2 text-xs", RED_TEXT)}>
                {pctFromRatio(r.max_drawdown)}
              </TableCell>
              <TableCell className="py-2 text-xs text-white">{num(r.profit_factor)}</TableCell>
              <TableCell className="py-2 text-xs text-white">{num(r.calmar)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function OverviewMft({
  strategyId,
  stage,
  period,
  runId,
  sample,
  granularity,
  availableMonths,
  availableQuarters,
}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
  runId?: string;
  sample?: SampleScope;
  /** The Period row's Mo/Qtr/Ytd toggle — picks which summary table variant renders below. */
  granularity: Granularity;
  /** F-071: months (1-12) / quarters (1-4) `period.year`'s series actually covers — same values
      the Period row's own Mo/Qtr pills are filtered to, so the Monthly/Quarterly Summary table
      below hides the same "—" rows those pills hide. */
  availableMonths: number[];
  availableQuarters: number[];
}) {
  // `period` scopes `perf`/`summary` to the selected year (see summaryForPeriod) — this is the KPI
  // cards' and metric strip's own Period pill, not just the charts'.
  const src = useMftResultsSource({ strategyId, stage, runId, period, sample });
  const pnls = src.pnls;
  // Run-only figures, with no counterpart on the XALPHA strategy/stage payload the same strip
  // renders for a stage-scoped view.
  const summary = src.summary;
  const currency = useRunCurrency(runId);

  // Stage slice first (the charts endpoint returns every stage at once), then the Period row.
  // A run-scoped view has no stages, so sliceStage is a no-op.
  const equity = useMemo(
    () => filterByPeriod(sliceStage(toPoints(pnls.data), pnls.data, stage), period),
    [pnls.data, stage, period],
  );
  const drawdown = useMemo(
    () => filterByPeriod(sliceStage(toPoints(src.drawdown.data), src.drawdown.data, stage), period),
    [src.drawdown.data, stage, period],
  );
  const sharpePts = useMemo(
    () => filterByPeriod(sliceStage(toPoints(src.sharpe.data), src.sharpe.data, stage), period),
    [src.sharpe.data, stage, period],
  );
  const returnPts = useMemo(
    () => filterByPeriod(sliceStage(toPoints(src.returns.data), src.returns.data, stage), period),
    [src.returns.data, stage, period],
  );
  const perf = src.perf;
  const summaryRows = src.summaryRows;

  // Stage-wide series (NOT period-filtered) for the Monthly/Quarterly Summary table — it always
  // shows every month/quarter of the selected year, regardless of which one the Period row's own
  // pills currently narrow the charts above to. Same pattern as Performance's `stageReturns`.
  const stagePnls = useMemo(
    () => sliceStage(toPoints(pnls.data), pnls.data, stage),
    [pnls.data, stage],
  );
  const stageReturns = useMemo(
    () => sliceStage(toPoints(src.returns.data), src.returns.data, stage),
    [src.returns.data, stage],
  );
  const stageDrawdown = useMemo(
    () => sliceStage(toPoints(src.drawdown.data), src.drawdown.data, stage),
    [src.drawdown.data, stage],
  );
  const bucketRows = useMemo(() => {
    if (granularity === "Ytd" || period.year == null) return undefined;
    const rows = bucketedSummaryRows(
      granularity === "Mo" ? "month" : "quarter",
      period.year,
      { pnls: stagePnls, returns: stageReturns, drawdown: stageDrawdown },
      src.periods,
      src.summary,
    );
    // F-071: bucketedSummaryRows always returns one row per calendar month/quarter, in bucket
    // order (index i = bucket i+1) — drop the ones outside the run's own coverage so the table
    // agrees with the Period row's Mo/Qtr pills above it, instead of listing them as all "—".
    const available = granularity === "Mo" ? availableMonths : availableQuarters;
    return rows.filter((_, i) => available.includes(i + 1));
  }, [
    granularity,
    period.year,
    stagePnls,
    stageReturns,
    stageDrawdown,
    src.periods,
    src.summary,
    availableMonths,
    availableQuarters,
  ]);
  // F-046: at most the 5 most recent years, same cap as the Period row's own year pills.
  const yearlyRows = summaryRows?.slice(-5);
  const tableRows = granularity === "Ytd" ? yearlyRows : bucketRows;
  const tableTitle =
    granularity === "Mo" ? "Monthly Summary" : granularity === "Qtr" ? "Quarterly Summary" : "Yearly Summary";
  const tableColumnLabel = granularity === "Mo" ? "Month" : granularity === "Qtr" ? "Quarter" : "Year";

  const a = perf?.analysis;
  const p = perf?.performance;

  // Both are honest derivations of the daily return series rather than API fields: a day is a
  // "profit day" when its return is positive, and the series has one sample per trading day.
  const profitDays = returnPts.length
    ? returnPts.filter((x) => x.v > 0).length / returnPts.length
    : undefined;
  const tradingDays = returnPts.length || undefined;

  const netPnl = a?.end_value != null && a?.start_value != null ? a.end_value - a.start_value : undefined;
  const fee = a?.total_fee;
  const net = p?.cumulative_return;
  const costDrag = fee != null && net != null && net + fee !== 0 ? fee / (net + fee) : undefined;

  const cards: KpiCard[] = [
    {
      // The settlement currency is only known on the run path — same gating as Avg Win/Avg Loss.
      label: summary ? `Net PnL (${currency})` : "Net PnL",
      value: netPnl == null ? EMPTY : `${netPnl > 0 ? "+" : ""}${formatAmount(netPnl, 0)}`,
      note: pctFromRatio(p?.cumulative_return),
      tone: toneBySign(netPnl),
      spark: equity.map((x) => x.v),
    },
    {
      label: "Sharpe Ratio",
      value: num(p?.sharpe),
      spark: sharpePts.map((x) => x.v),
    },
    {
      label: "Max Drawdown",
      value: pctFromRatio(p?.max_drawdown),
      tone: RED_TEXT,
      spark: drawdown.map((x) => x.v),
    },
    {
      // Net PnL per unit of traded notional, in bps - the engine reports it on the summary
      // (edge_gross_bps - cost_bps == edge_net_bps), which is what the control plane shows here.
      label: "Return / Turnover",
      value: summary?.edge_net_bps == null ? EMPTY : `${formatAmount(summary.edge_net_bps, 2)} bp`,
      tone: toneBySign(summary?.edge_net_bps),
    },
    {
      // Cost ÷ gross, the same drag Cost & Edge shows: `total_fee` is a fraction of capital, and
      // gross = net + fee on that same basis. Shown negative, as the drag it is.
      label: "Cost Drag",
      value: costDrag == null ? EMPTY : pctFromRatio(-Math.abs(costDrag)),
      tone: costDrag == null ? undefined : RED_TEXT,
    },
  ];

  const equityStatus = chartStatus({
    loading: pnls.isLoading,
    error: pnls.isError,
    empty: !equity.length,
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <KpiCards cards={cards} />

      <ChartCard
        title="Equity Curve"
        right={
          // F-069: the trailing-range pills (All/1M/3M/1W) were redundant with the Period row above
          // and are removed; the expand button is the only control left here.
          <button
            type="button"
            aria-label="Expand Equity Curve chart"
            className="inline-flex cursor-pointer items-center justify-center text-[#9db2ce] transition-colors hover:text-white"
          >
            <MaximizeSquareMinimalistic className="size-5" />
          </button>
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-wrap gap-4">
            <StripMetric
              label="Total Return"
              value={pctFromRatio(p?.cumulative_return)}
              tone={toneBySign(p?.cumulative_return)}
            />
            <StripMetric
              label="Ann. Return"
              value={pctFromRatio(p?.annual_return)}
              tone={toneBySign(p?.annual_return)}
            />
            <StripMetric label="Max Drawdown" value={pctFromRatio(p?.max_drawdown)} tone={RED_TEXT} />
            <StripMetric label="MDD Duration" value={durationDays(summary?.max_drawdown_duration_days)} />
            <StripMetric
              label="Profit Days"
              value={profitDays == null ? EMPTY : `${formatAmount(profitDays * 100, 0)}%`}
              tone={profitDays == null ? undefined : GREEN_TEXT}
            />
            <StripMetric label="Trading Days" value={count(tradingDays)} />
            <StripMetric label="Total Trades" value={count(a?.total_trades)} />
            {/* Per-order latency is engine telemetry, published only on a running run's
                `/live/stream`; a finished backtest has none. */}
            <StripMetric label="Avg Latency" value={EMPTY} />
            <StripMetric label="Fill Rate" value={shareFromRatio(summary?.fill_rate)} />
          </div>

          <ChartState status={equityStatus} detail="No equity points for this stage and period.">
            <BaseChart option={equityOption(equity, drawdown)} style={{ height: 240 }} />
          </ChartState>

          <div className="flex items-center justify-center gap-6">
            <LegendDot color="#67e1c1" label="Net Equity" />
            {/* Gross equity needs per-period fees; MFT reports one aggregate fee for the run. */}
            <LegendDot color="#9db2ce" label="Gross Equity" dashed />
            <LegendDot color="#ff135b" label="Drawdown" />
          </div>
        </div>
      </ChartCard>

      {tableRows && tableRows.length > 0 && (
        <SummaryTable title={tableTitle} columnLabel={tableColumnLabel} rows={tableRows} />
      )}
    </div>
  );
}
