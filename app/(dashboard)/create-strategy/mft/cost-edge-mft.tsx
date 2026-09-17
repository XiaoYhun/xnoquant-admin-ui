"use client";
// MFT Results → "Cost & Edge" (Figma 15212:62900). Cost panel, the cost-breakdown donut, the
// cumulative cost/gross curve, turnover, the gross-to-net waterfall and the PnL attribution table.
//
// The metric panel and the waterfall's two endpoints (Gross/Net PnL) only ever needed
// `analysis.total_fee` — the MFT-shaped view of `RunSummary.total_fee` (see run-as-mft.ts). The
// donut, the waterfall's three middle rows, the cumulative chart, turnover and PnL attribution are
// all run-scoped additions: they read `summary` (the run's own `RunSummary`, off
// `useMftResultsSource` — undefined on the XALPHA strategy/stage feed) plus three fresh endpoints,
// so they only render once `runId` is set. The XALPHA path keeps every empty state it had before.
import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { ChartState, chartStatus } from "@/components/charts/chart-state";
import {
  useRunCostCurve,
  useRunCurrency,
  useRunSymbolPnl,
  useRunTurnover,
  type CostPoint,
  type TurnoverPoint,
} from "@/hooks/api/use-runs";
import { PnlAttributionTable } from "@/components/pnl-attribution-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, currencyDigits, formatAmount, formatCompact } from "@/lib/utils";
import { currencySymbol } from "@/lib/transform/runs";
import { equityDayLabel } from "@/lib/transform/results";
import { costBreakdownSlices } from "@/lib/transform/run-detail";
import { toPoints, type PeriodSelection, type Point } from "@/lib/transform/mft-results";
import { useMftResultsSource } from "@/hooks/api/use-mft-results-source";
import type { SampleScope } from "@/types/domain";
import {
  ChartCard,
  EMPTY,
  GREEN_TEXT,
  MetricPanel,
  NoSourceNote,
  RED_TEXT,
  pctFromRatio,
  toneBySign,
  type Metric,
} from "./results-chrome";

interface WaterfallRow {
  label: string;
  /** Ratio (0.42 = +42%), or undefined when the MFT engine cannot decompose this step. */
  value?: number;
  /** Small note under the value, e.g. "15.4% of gross". */
  note?: string;
  /** Endpoints are full-width totals; the steps between them are deductions. */
  kind: "total" | "step";
}

function Waterfall({ rows }: { rows: WaterfallRow[] }) {
  const span = Math.max(0, ...rows.map((r) => Math.abs(r.value ?? 0)));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {rows.map((r) => {
        const width = r.value == null || span <= 0 ? 0 : (Math.abs(r.value) / span) * 100;
        const positive = (r.value ?? 0) >= 0;
        return (
          <div key={r.label} className="flex min-w-0 items-center gap-3">
            <span className="w-[110px] shrink-0 truncate text-xs leading-[18px] text-[#9db2ce]">
              {r.label}
            </span>
            <div className="h-6 min-w-0 flex-1 overflow-hidden rounded bg-[#151a24]">
              {r.value != null && (
                <div
                  className={cn(
                    "h-full rounded",
                    r.kind === "total"
                      ? "bg-[#67e1c1]"
                      : positive
                        ? "bg-[#67e1c1]"
                        : "bg-[#ff135b]",
                  )}
                  // A real but tiny deduction still gets a visible sliver.
                  style={{ width: `${Math.max(width, r.value === 0 ? 0 : 1.5)}%` }}
                />
              )}
            </div>
            <div className="flex w-[104px] shrink-0 flex-col items-end">
              <span
                className={cn(
                  "text-xs leading-[18px] whitespace-nowrap",
                  r.value == null ? "text-[#9db2ce]" : r.kind === "total" ? GREEN_TEXT : toneBySign(r.value),
                )}
              >
                {r.value == null ? EMPTY : pctFromRatio(r.value)}
              </span>
              {r.note && (
                <span className="text-[10px] leading-[14px] text-[#9db2ce]">{r.note}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Cost Breakdown donut swatches — Commission/Tax match the waterfall's cost-red family loosely but
// stay distinguishable from each other; Slippage and the single-slice "Total Fee" fallback reuse
// the blue HFT Cost & Capacity already uses for its own one-slice donut.
const SLICE_COLORS: Record<string, [string, string]> = {
  Commission: ["#cfdbf8", "#2d84ff"],
  Tax: ["#ffe8b8", "#f1c617"],
  Slippage: ["#ffcce2", "#ff135b"],
  "Total Fee": ["#cfdbf8", "#2d84ff"],
};

const grad = (from: string, to: string) => ({
  type: "linear" as const,
  x: 0,
  y: 0,
  x2: 1,
  y2: 1,
  colorStops: [
    { offset: 0, color: from },
    { offset: 1, color: to },
  ],
});

/**
 * Step-join the cumulative-fee curve onto the equity/PnL timestamps — same algorithm HFT's
 * overview-view.tsx uses to build its Gross line from `/cost-curve` + equity, reimplemented here
 * because the point shapes differ (`Point.t` unix seconds off the MFT series vs `EquityPoint.ts`
 * epoch ms). `[]` when either side has nothing to join.
 */
function joinCostToEquity(
  equity: Point[],
  cost: CostPoint[],
): { t: number; cost: number; net: number; gross: number }[] {
  if (equity.length === 0 || cost.length === 0) return [];
  const sorted = [...cost].sort((a, b) => a.ts - b.ts);
  let i = 0;
  let cumulative = 0;
  return equity.map((p) => {
    const tsMs = p.t * 1000;
    while (i < sorted.length && sorted[i].ts <= tsMs) {
      cumulative = sorted[i].cumulative;
      i += 1;
    }
    // `p.v` is the run's net PnL at this point; gross adds back the cost taken out of it.
    return { t: p.t, cost: cumulative, net: p.v, gross: p.v + cumulative };
  });
}

function costGrossOption(
  points: { t: number; cost: number; net: number; gross: number }[],
  digits: number,
): EChartsOption {
  return {
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => formatAmount(Number(v), digits) },
    legend: { bottom: 0, textStyle: { color: "#9db2ce", fontSize: 10 } },
    grid: { left: 8, right: 8, top: 16, bottom: 40, containLabel: true },
    xAxis: {
      type: "category",
      data: points.map((p) => equityDayLabel(p.t * 1000)),
      boundaryGap: false,
      axisLabel: { fontSize: 10, hideOverlap: true },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: (v: string | number) => formatCompact(Number(v)) } },
    series: [
      {
        name: "Gross PnL",
        type: "line",
        // The legend swatch takes the series color, not lineStyle, so both are set or the
        // swatches disagree with the lines they stand for.
        color: "#67e1c1",
        data: points.map((p) => p.gross),
        showSymbol: false,
        lineStyle: { width: 1.5, color: "#67e1c1" },
      },
      {
        // Yellow: three lines share this box, so net needs its own hue rather than a second shade
        // of the gross green above it.
        name: "Net PnL",
        type: "line",
        color: "#f1c617",
        data: points.map((p) => p.net),
        showSymbol: false,
        lineStyle: { width: 1.5, color: "#f1c617" },
      },
      {
        name: "Cumulative Cost",
        type: "line",
        color: "#ff9783",
        data: points.map((p) => p.cost),
        showSymbol: false,
        lineStyle: { width: 1.5, color: "#ff9783", type: "dashed" },
      },
    ],
  };
}

/** Running sum of `turnover`, falling back to the endpoint's own `cumulative` when it's present. */
function cumulativeTurnoverPoints(points: TurnoverPoint[]): { label: string; value: number }[] {
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  let running = 0;
  return sorted.map((pt) => {
    running += pt.turnover;
    return { label: equityDayLabel(pt.ts), value: pt.cumulative ?? running };
  });
}

function turnoverOption(points: { label: string; value: number }[]): EChartsOption {
  return {
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => formatCompact(Number(v)) },
    xAxis: {
      type: "category",
      data: points.map((p) => p.label),
      boundaryGap: false,
      axisLabel: { fontSize: 10, hideOverlap: true },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: (v: string | number) => formatCompact(Number(v)) } },
    series: [
      {
        type: "line",
        data: points.map((p) => p.value),
        showSymbol: false,
        lineStyle: { width: 1.5, color: "#f1c617" },
      },
    ],
  };
}

export function CostEdgeMft({
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
  // `period` scopes `perf`/`summary` to the selected year — Gross/Net PnL and cost drag here are
  // the same run-level figures the Overview KPI cards show, just re-laid-out.
  const src = useMftResultsSource({ strategyId, stage, runId, period, sample });
  const perf = src.perf;
  const summary = src.summary;
  const p = perf?.performance;
  const a = perf?.analysis;

  const net = p?.cumulative_return;
  const cost = a?.total_fee;
  const gross = net != null && cost != null ? net + cost : undefined;
  const trades = a?.total_trades;

  const currency = useRunCurrency(runId);
  const digits = currencyDigits(currency);

  const rows: Metric[][] = [
    [
      { label: "Gross PnL", value: pctFromRatio(gross), tone: toneBySign(gross) },
      { label: "Net PnL", value: pctFromRatio(net), tone: toneBySign(net) },
      {
        label: "Total Cost",
        value: cost == null ? EMPTY : pctFromRatio(-Math.abs(cost)),
        tone: cost == null ? undefined : RED_TEXT,
      },
      {
        label: "Cost Drag",
        value: gross ? pctFromRatio(-Math.abs((cost ?? 0) / gross)) : EMPTY,
        tone: gross ? RED_TEXT : undefined,
        sub: gross ? "cost ÷ gross" : undefined,
      },
    ],
    [
      {
        label: "Fee % of Profit",
        value: net && cost != null ? pctFromRatio(Math.abs(cost / net)) : EMPTY,
        sub: net && cost != null ? "cost ÷ net PnL" : undefined,
      },
      {
        // Basis points, as the design shows: a per-trade slice of a run-level fee is far below
        // 0.01%, so a percentage rounds every strategy to "0.00%".
        label: "Fee per Trade",
        value: cost != null && trades ? `${formatAmount((cost / trades) * 10_000, 2)} bp` : EMPTY,
      },
      // Both are tick-denominated, and the MFT engine has no notion of an instrument tick.
      { label: "Profit/Tick Ratio", value: EMPTY },
      { label: "After-Fee Buffer", value: EMPTY },
    ],
  ];

  // Every waterfall row is a share of GROSS, which is what a gross-to-net breakdown means: the
  // bar starts at 100% and each cost is the slice it takes out of it. The API reports commission,
  // tax, slippage and net as MONEY, so they divide by gross money (net + fee) rather than by
  // starting capital — dividing by capital left the steps unable to add up to the bar above them.
  // `undefined` without a summary (the XALPHA path) or without gross to divide by.
  const hasSplit = summary?.commission_total != null && summary?.tax_total != null;
  const grossMoney =
    summary != null && Number.isFinite(summary.net_pnl + summary.total_fee)
      ? summary.net_pnl + summary.total_fee
      : undefined;
  const shareOfGross = (amount: number | null | undefined) =>
    grossMoney && amount != null ? -(Math.abs(amount) / grossMoney) : undefined;
  const commissionRatio = shareOfGross(summary?.commission_total);
  const taxRatio = shareOfGross(summary?.tax_total);
  const slippageRatio = shareOfGross(summary?.slippage_total);

  const waterfall: WaterfallRow[] = [
    { label: "Gross PnL", value: grossMoney ? 1 : undefined, kind: "total" },
    { label: "− Commission", value: commissionRatio, kind: "step" },
    { label: "− Tax", value: taxRatio, kind: "step" },
    { label: "− Slippage", value: slippageRatio, kind: "step" },
    {
      label: "Net PnL",
      value: grossMoney && summary != null ? summary.net_pnl / grossMoney : undefined,
      kind: "total",
    },
  ];

  // Cost Breakdown — commission/tax/slippage when the run recorded the split, else one Total Fee
  // slice plus slippage (see costBreakdownSlices). `[]` on the XALPHA path (`summary` undefined).
  const slices = useMemo(() => costBreakdownSlices(summary), [summary]);
  const sliceTotal = slices.reduce((s, x) => s + x.value, 0);
  const donutOption = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: "item",
        // The donut sits in a half-width card, so an edge slice's tooltip spilled outside it —
        // `confine` keeps it inside the chart box.
        confine: true,
        valueFormatter: (v: unknown) => `${formatAmount(Number(v), digits)} ${currencySymbol(currency)}`,
      },
      series: [
        {
          type: "pie",
          radius: ["62%", "92%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data: slices.map((s) => {
            const [from, to] = SLICE_COLORS[s.key] ?? SLICE_COLORS["Total Fee"];
            return { name: s.key, value: s.value, itemStyle: { color: grad(from, to), borderWidth: 0 } };
          }),
        },
      ],
    }),
    [slices, digits, currency],
  );

  // Cumulative cost & Gross PnL — `/cost-curve` step-joined onto the run's own PnL series (the
  // same `pnls` chart Overview draws), same construction as HFT overview-view.tsx's Gross line.
  const { data: costCurve = [] } = useRunCostCurve(runId, sample);
  const equityPts = useMemo(() => toPoints(src.pnls.data), [src.pnls.data]);
  const costGrossPoints = useMemo(() => joinCostToEquity(equityPts, costCurve), [equityPts, costCurve]);
  const costGrossOpt = useMemo(() => costGrossOption(costGrossPoints, digits), [costGrossPoints, digits]);
  const costGrossStatus = chartStatus({
    loading: src.pnls.isLoading,
    error: src.pnls.isError,
    empty: costGrossPoints.length === 0,
  });
  const costGrossDetail = src.pnls.isError
    ? "The equity curve for this run could not be loaded."
    : "No cost/PnL points for this run yet.";

  // Turnover — cumulative traded notional, `/turnover-curve`.
  const { data: turnover = [], isLoading: turnoverLoading, isError: turnoverError } = useRunTurnover(runId, sample);
  const turnoverPoints = useMemo(() => cumulativeTurnoverPoints(turnover), [turnover]);
  const turnoverOpt = useMemo(() => turnoverOption(turnoverPoints), [turnoverPoints]);
  const turnoverStatus = chartStatus({
    loading: turnoverLoading,
    error: turnoverError,
    empty: turnoverPoints.length === 0,
  });
  const turnoverDetail = turnoverError
    ? "Turnover for this run could not be loaded."
    : "No turnover has been recorded for this run yet.";

  // PnL attribution — shared with HFT Cost & Capacity rather than a second copy of the table.
  const {
    data: symbolPnl = [],
    isLoading: symbolPnlLoading,
    isError: symbolPnlError,
  } = useRunSymbolPnl(runId, sample);
  const symbolPnlStatus = chartStatus({
    loading: symbolPnlLoading,
    error: symbolPnlError,
    empty: symbolPnl.length === 0,
  });
  const symbolPnlDetail = symbolPnlError
    ? "PnL attribution for this run could not be loaded."
    : "No per-symbol PnL has been recorded for this run yet.";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricPanel rows={rows} />

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Cost Breakdown">
          {slices.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-4">
              <div className="relative size-[148px] shrink-0">
                <BaseChart option={donutOption} style={{ height: 148 }} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <span className="text-[10px] leading-4 text-[#9db2ce]">Total Cost</span>
                  {/* The donut's hole is 62% of 148px (~92px), so a long total (millions of VND)
                      would otherwise run out over the ring. Ellipsis it and show the full figure in
                      a tooltip — which needs pointer events back, since the overlay disables them. */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="pointer-events-auto max-w-[84px] truncate text-sm leading-[18px] font-semibold text-white">
                        {formatAmount(sliceTotal, digits)} {currencySymbol(currency)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {formatAmount(sliceTotal, digits)} {currencySymbol(currency)}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="flex min-w-[160px] flex-1 flex-col gap-2.5">
                {slices.map((s) => {
                  const [from, to] = SLICE_COLORS[s.key] ?? SLICE_COLORS["Total Fee"];
                  return (
                    <div key={s.key} className="flex min-w-0 items-center gap-2">
                      <span className="flex min-w-0 flex-1 items-center gap-1">
                        <span
                          className="size-3 shrink-0 rounded"
                          style={{ backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
                        />
                        <span className="truncate text-[10px] leading-[14px] text-[#9db2ce]">{s.key}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="text-xs leading-[18px] font-semibold text-white">
                          {formatAmount(s.value, digits)}
                        </span>
                        <span className="text-[10px] leading-[14px] text-[#9db2ce]">
                          ({formatAmount(s.share * 100, 0)}%)
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <ChartState
              status="empty"
              detail={
                runId
                  ? "No fee has been recorded for this run yet."
                  : "MFT reports one combined fee for the run, so commission, tax and slippage cannot be split apart."
              }
            />
          )}
        </ChartCard>

        <ChartCard title="Cumulative cost & Gross PnL">
          {runId ? (
            <ChartState status={costGrossStatus} detail={costGrossDetail}>
              <BaseChart option={costGrossOpt} />
            </ChartState>
          ) : (
            <ChartState
              status="empty"
              detail="Charting cost against gross PnL needs a per-period cost series; only a run-level fee total is returned."
            />
          )}
        </ChartCard>
      </div>

      {runId && (
        <ChartCard title="Turnover">
          <ChartState status={turnoverStatus} detail={turnoverDetail}>
            <BaseChart option={turnoverOpt} />
          </ChartState>
        </ChartCard>
      )}

      <ChartCard title="Gross to Net">
        <div className="flex min-w-0 flex-col gap-4">
          <Waterfall rows={waterfall} />
          <div className="flex flex-col items-center gap-2">
            <span className="rounded-[40px] border border-[#1d2939] bg-[#0a0e14] px-3 py-1 text-[11px] leading-[16px] text-[#9db2ce]">
              Σ Net = Gross − Commission − Tax − Slippage
            </span>
            {cost == null ? (
              <NoSourceNote>No fee total for this stage yet.</NoSourceNote>
            ) : !hasSplit ? (
              <NoSourceNote>
                {`MFT reports a single combined cost of ${pctFromRatio(Math.abs(cost))} for this stage, not the per-component split the middle three rows show.`}
              </NoSourceNote>
            ) : null}
          </div>
        </div>
      </ChartCard>

      {runId && (
        <PnlAttributionTable rows={symbolPnl} currency={currency} status={symbolPnlStatus} detail={symbolPnlDetail} />
      )}
    </div>
  );
}
