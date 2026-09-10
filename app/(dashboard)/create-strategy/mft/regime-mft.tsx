"use client";
// MFT Results → "Regime" (Figma 15212:65719). Peak-hour metrics, PnL by session hour, Sharpe by
// volatility regime and the regime breakdown table.
//
// `/api/runs/{id}/volatility-regime` covers the ATR buckets (low/normal/high Sharpe, % PnL).
// Peak-hour concentration is on `/summary`. Session-hour bars and Top-3 Hours have no endpoint.
import { useMemo } from "react";
import type { EChartsOption } from "echarts";

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
import { useRunSummary, useRunVolatilityRegime } from "@/hooks/api/use-runs";
import { formatAmount } from "@/lib/utils";
import type { PeriodSelection } from "@/lib/transform/mft-results";
import type { VolRegimeBucket, VolRegimeSummary } from "@/types/domain";
import {
  ChartCard,
  EMPTY,
  GREEN_TEXT,
  MetricPanel,
  count,
  num,
  pctFromPercent,
  shareFromRatio,
  toneBySign,
  type Metric,
} from "./results-chrome";

const GREEN = "#67e1c1";
const RED = "#ff135b";

const FALLBACK_LOW = 0.5;
const FALLBACK_HIGH = 1;

function formatAtrThr(thr: number): string {
  const pct = thr > 0 && thr < 0.1 ? thr * 100 : thr;
  const digits = Math.abs(pct - Math.round(pct)) < 1e-9 ? 0 : 1;
  return `${formatAmount(pct, digits)}%`;
}

function regimeLabels(data: VolRegimeSummary | null | undefined): {
  low: string;
  normal: string;
  high: string;
  lowSub: string;
  highSub: string;
  chart: [string, string, string];
} {
  const low = formatAtrThr(data?.config.low_thr ?? FALLBACK_LOW);
  const high = formatAtrThr(data?.config.high_thr ?? FALLBACK_HIGH);
  return {
    low: `Low (ATR<${low})`,
    normal: `Normal (ATR ${low}-${high})`,
    high: `High (ATR>${high})`,
    lowSub: `ATR < ${low}`,
    highSub: `ATR > ${high}`,
    chart: [`Low vol\nATR<${low}`, `Normal\n${low}–${high}`, `High vol\nATR>${high}`],
  };
}

function sharpeOption(labels: [string, string, string], values: (number | null)[]): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: "#9db2ce", interval: 0, lineHeight: 14 },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 10 } },
    series: [
      {
        type: "bar",
        name: "Sharpe",
        data: values.map((v) =>
          v == null
            ? null
            : { value: v, itemStyle: { color: v >= 0 ? GREEN : RED, borderRadius: [4, 4, 0, 0] } },
        ),
        barMaxWidth: 40,
      },
    ],
  };
}

function bucketRow(label: string, bucket: VolRegimeBucket | undefined) {
  return {
    label,
    sharpe: bucket?.sharpe,
    // Round-trips closed on a day in this bucket. Both this and `win_rate` are `#[serde(default)]`
    // upstream, so a bucket cached before they existed deserializes as 0 / null rather than failing.
    trades: bucket?.trades,
    winRate: bucket?.win_rate,
    pnlShare: bucket?.pnl_share_pct,
  };
}

export function RegimeMft({
  runId,
}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
  runId?: string;
}) {
  const volQ = useRunVolatilityRegime(runId);
  const summaryQ = useRunSummary(runId);
  const data = volQ.data ?? undefined;
  const labels = regimeLabels(data);

  const peakHour = summaryQ.data?.peak_hour_concentration_pct;
  const peakHourPct =
    peakHour == null || !Number.isFinite(peakHour)
      ? null
      : Math.abs(peakHour) <= 1
        ? peakHour * 100
        : peakHour;

  const metrics: Metric[] = [
    {
      label: "Peak Hour Concentration",
      value: peakHourPct == null ? EMPTY : `${formatAmount(peakHourPct, 1)}%`,
      tone: peakHourPct == null ? undefined : GREEN_TEXT,
    },
    { label: "Top-3 Hours", value: EMPTY },
    {
      label: "Low Vol Sharpe",
      value: num(data?.low_vol.sharpe),
      sub: data ? labels.lowSub : undefined,
    },
    {
      label: "High Vol Sharpe",
      value: num(data?.high_vol.sharpe),
      sub: data ? labels.highSub : undefined,
    },
  ];

  const sharpeValues = useMemo(
    () => [data?.low_vol.sharpe ?? null, data?.normal_vol.sharpe ?? null, data?.high_vol.sharpe ?? null],
    [data],
  );
  const hasSharpe = sharpeValues.some((v) => v != null);

  const volStatus = chartStatus({
    idle: !runId,
    loading: volQ.isLoading,
    error: volQ.isError,
    empty: !data,
  });
  const sharpeStatus = chartStatus({
    idle: !runId,
    loading: volQ.isLoading,
    error: volQ.isError,
    empty: !data || !hasSharpe,
  });

  const rows = [
    bucketRow(labels.low, data?.low_vol),
    bucketRow(labels.normal, data?.normal_vol),
    bucketRow(labels.high, data?.high_vol),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricPanel rows={[metrics]} />

      <ChartCard title="PnL by session hour">
        <ChartState
          status="empty"
          height={196}
          detail="Hour-of-day PnL is not on the volatility-regime or summary APIs."
        />
      </ChartCard>

      <ChartCard title="Sharpe by volatility regime">
        <ChartState
          status={sharpeStatus}
          height={196}
          detail={
            volQ.isError
              ? "Volatility-regime Sharpe could not be loaded."
              : "Not available for this run — bar-mode, single-symbol backtests with realized trades only."
          }
        >
          <BaseChart option={sharpeOption(labels.chart, sharpeValues)} style={{ height: 196 }} />
        </ChartState>
      </ChartCard>

      <div className="min-w-0 overflow-hidden rounded-xl border border-[#1d2939] bg-background">
        <div className="border-b border-[#1d2939] bg-[#151a24] px-4 py-2">
          <span className="text-sm leading-5 font-medium text-white">Regime breakdown</span>
        </div>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="h-10">Regime</TableHead>
              <TableHead className="h-10 text-right">Sharpe</TableHead>
              <TableHead className="h-10 text-right">Win rate</TableHead>
              <TableHead className="h-10 text-right">Trades</TableHead>
              <TableHead className="h-10 text-right">% PnL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell className="py-2 text-xs text-white">{r.label}</TableCell>
                <TableCell className="py-2 text-right text-xs text-white">{num(r.sharpe)}</TableCell>
                <TableCell className="py-2 text-right text-xs text-[#9db2ce]">
                  {shareFromRatio(r.winRate)}
                </TableCell>
                <TableCell className="py-2 text-right text-xs text-[#9db2ce]">
                  {volStatus === "ready" ? count(r.trades) : EMPTY}
                </TableCell>
                <TableCell className={`py-2 text-right text-xs ${toneBySign(r.pnlShare)}`}>
                  {pctFromPercent(r.pnlShare)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
