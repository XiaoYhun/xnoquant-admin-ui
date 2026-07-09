"use client";
// MFT variant of the create-strategy "Results" tab — Figma node 13964:56918, reworked to match
// the xno-builder reference (`KetQuaStrategy.tsx` + `TongQuanComponent.tsx`) against the real
// XALPHA API. The HFT variant (results-tab.tsx's default content) is untouched; this is swapped
// in via `variant="mft"`.
import { useState } from "react";
import type { EChartsOption } from "echarts";
import { MaximizeSquareMinimalistic, AltArrowDown, Danger } from "@solar-icons/react";

import { cn } from "@/lib/utils";
import { USE_MOCK } from "@/lib/constant";
import { CloseIcon } from "@/components/icons/close";
import { BaseChart } from "@/components/charts/base-chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useResultSeries,
  useSummaryAggregate,
  useSummaryTable,
  useStrategyChart,
  type SummaryAggregateItem,
  type SummaryTableItem,
} from "@/hooks/api/use-strategy-results";
import { useStrategyById, isRunningStatus } from "@/hooks/api/use-strategy-run";
import { RunningSimulateScreen } from "./running-simulate-screen";
import { RETURNS_SERIES, CORRELATION_ROWS } from "@/lib/mock/strategy-builder";

const GREEN = "#67e1c1";
const RED = "#ff135b";
const GREEN_TEXT =
  "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";

const STAGES = [
  { label: "Train", value: "train" },
  { label: "Test", value: "test" },
  { label: "Simulate", value: "simulate" },
  { label: "Live", value: "live" },
] as const;
const VIEWS = ["Overview", "Performance", "Analysis"] as const;
const DEFAULT_SERIES = ["pnls", "returns", "sharpe", "drawdown"];

// title + line/area color per known series name; unknown series (future API additions) fall
// back to a plain green line titled from its own name.
const SERIES_META: Record<string, { title: string; kind: "twoTone" | "green" | "red" }> = {
  pnls: { title: "PNL", kind: "twoTone" },
  returns: { title: "Returns", kind: "twoTone" },
  sharpe: { title: "Sharpe", kind: "green" },
  drawdown: { title: "Drawdown", kind: "red" },
};

function metricPositive(n: number | undefined) {
  return n != null && n >= 0;
}

// Falsy (0/undefined/NaN) -> "0", matching xno-builder's formatNumber.
function formatMetricNumber(n?: number, fixed = 2): string {
  if (!n) return "0";
  return n.toLocaleString("en-US", { minimumFractionDigits: fixed, maximumFractionDigits: fixed });
}

// Ratio -> signed percent string, e.g. 0.184 -> "+18.40%".
function formatMetricPercent(n?: number, fixed = 2): string {
  if (!n) return "0";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(fixed)}%`;
}

function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function ExpandButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-white"
    >
      <MaximizeSquareMinimalistic className="size-5" />
    </button>
  );
}

// Two series clamped at zero (rather than nulled out) so the area/line reads green above 0,
// red below, with no gap at the zero-crossings.
function splitByZero(data: number[]) {
  return {
    positive: data.map((v) => (v >= 0 ? v : 0)),
    negative: data.map((v) => (v < 0 ? v : 0)),
  };
}

function twoToneAreaOption(data: number[]): EChartsOption {
  const { positive, negative } = splitByZero(data);
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((_, i) => `${i + 1}`),
      boundaryGap: false,
      axisLabel: { show: false },
      axisTick: { show: false },
    },
    yAxis: { type: "value" },
    series: [
      {
        type: "line",
        data: positive,
        smooth: true,
        showSymbol: false,
        symbol: "none",
        lineStyle: { width: 1.5, color: GREEN },
        itemStyle: { color: GREEN },
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
        z: 2,
      },
      {
        type: "line",
        data: negative,
        smooth: true,
        showSymbol: false,
        symbol: "none",
        lineStyle: { width: 1.5, color: RED },
        itemStyle: { color: RED },
        areaStyle: {
          color: {
            type: "linear",
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
        z: 1,
      },
    ],
  };
}

// Real/mock stage-sliced series chart: one solid color (green/red) or the two-tone split above,
// x-axis labeled with actual dates instead of the Performance tab's plain index labels.
function buildStageChartOption(
  times: number[],
  values: number[],
  kind: "twoTone" | "green" | "red",
): EChartsOption {
  const xAxisData = times.map((t) => formatTimestamp(t));
  const shared = {
    tooltip: { trigger: "axis" as const },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: xAxisData,
      boundaryGap: false,
      axisTick: { show: false },
      axisLabel: { fontSize: 10, interval: Math.max(0, Math.ceil(xAxisData.length / 8) - 1) },
    },
    yAxis: { type: "value" as const },
  };

  if (kind === "twoTone") {
    const { positive, negative } = splitByZero(values);
    return {
      ...shared,
      series: [
        {
          type: "line",
          data: positive,
          smooth: true,
          showSymbol: false,
          symbol: "none",
          lineStyle: { width: 1.5, color: GREEN },
          itemStyle: { color: GREEN },
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
          z: 2,
        },
        {
          type: "line",
          data: negative,
          smooth: true,
          showSymbol: false,
          symbol: "none",
          lineStyle: { width: 1.5, color: RED },
          itemStyle: { color: RED },
          areaStyle: {
            color: {
              type: "linear",
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
          z: 1,
        },
      ],
    };
  }

  const color = kind === "red" ? RED : GREEN;
  const colorStops =
    kind === "red"
      ? [
          { offset: 0, color: "rgba(255,19,91,0)" },
          { offset: 1, color: "rgba(255,19,91,0.35)" },
        ]
      : [
          { offset: 0, color: "rgba(103,225,193,0.35)" },
          { offset: 1, color: "rgba(103,225,193,0)" },
        ];
  return {
    ...shared,
    series: [
      {
        type: "line",
        data: values,
        smooth: true,
        showSymbol: false,
        symbol: "none",
        lineStyle: { width: 1.5, color },
        itemStyle: { color },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops } },
      },
    ],
  };
}

// ---- shared chart card chrome (title + remove + expand icon), Figma 14039:68722 ----
function ChartCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-[#151a24] px-4 py-3">
        <span className="text-sm font-medium text-white">{title}</span>
        <div className="flex shrink-0 items-center gap-3">
          {onRemove && (
            <button
              type="button"
              aria-label={`Remove ${title} chart`}
              onClick={onRemove}
              className="inline-flex cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-white"
            >
              <CloseIcon className="size-4" />
            </button>
          )}
          <ExpandButton label={`Expand ${title} chart`} />
        </div>
      </div>
      <div className="min-w-0 p-4">{children}</div>
    </div>
  );
}

// ---- Aggregate Data strip (Figma 13964:60439) — Sharpe/CAGR/Drawdown/Profit Factor/Calmar,
// matching xno-builder's AggregateDataTable exactly (5 fields, not the Figma mock's 6). ----
function AggregateDataStrip({ data }: { data?: SummaryAggregateItem }) {
  return (
    <div className="flex min-w-0 items-stretch overflow-hidden rounded-lg border border-border">
      <div className="flex shrink-0 items-center border-r border-border px-4 py-3">
        <span className="text-sm font-medium whitespace-nowrap text-white">Aggregate Data</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-5 px-4 py-2">
        <div className="flex min-w-0 flex-1 basis-[80px] flex-col gap-1">
          <span className="truncate text-xs text-muted-foreground">Sharpe</span>
          <span className="text-base font-semibold whitespace-nowrap text-white">
            {formatMetricNumber(data?.sharpe)}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 basis-[80px] flex-col gap-1">
          <span className="truncate text-xs text-muted-foreground">CAGR</span>
          <span
            className={cn(
              "text-base font-semibold whitespace-nowrap",
              metricPositive(data?.cagr) ? GREEN_TEXT : "text-[#ff135b]",
            )}
          >
            {formatMetricPercent(data?.cagr)}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 basis-[80px] flex-col gap-1">
          <span className="truncate text-xs text-muted-foreground">Drawdown</span>
          <span className="text-base font-semibold whitespace-nowrap text-[#ff135b]">
            {formatMetricPercent(data?.max_drawdown)}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 basis-[80px] flex-col gap-1">
          <span className="truncate text-xs text-muted-foreground">Profit Factor</span>
          <span className="text-base font-semibold whitespace-nowrap text-white">
            {formatMetricNumber(data?.profit_factor)}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 basis-[80px] flex-col gap-1">
          <span className="truncate text-xs text-muted-foreground">Calmar</span>
          <span className="text-base font-semibold whitespace-nowrap text-white">
            {formatMetricNumber(data?.calmar)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- Year table (Figma 13964:60476) — Year/Sharpe/CAGR/Max Drawdown/Profit Factor/Calmar. ----
function YearTable({ rows }: { rows: SummaryTableItem[] }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="bg-[#1d2939]">Year</TableHead>
            <TableHead className="bg-[#1d2939]">Sharpe</TableHead>
            <TableHead className="bg-[#1d2939]">CAGR</TableHead>
            <TableHead className="bg-[#1d2939]">Max Drawdown</TableHead>
            <TableHead className="bg-[#1d2939]">Profit Factor</TableHead>
            <TableHead className="bg-[#1d2939]">Calmar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.time}>
              <TableCell className="text-right text-white">{r.time}</TableCell>
              <TableCell className="text-right text-white">{formatMetricNumber(r.sharpe)}</TableCell>
              <TableCell className={cn("text-right", metricPositive(r.cagr) ? GREEN_TEXT : "text-[#ff135b]")}>
                {formatMetricPercent(r.cagr)}
              </TableCell>
              <TableCell className="text-right text-[#ff135b]">
                {formatMetricNumber((r.max_drawdown ?? 0) * 100)}%
              </TableCell>
              <TableCell className="text-right text-white">{formatMetricNumber(r.profit_factor)}</TableCell>
              <TableCell className="text-right text-white">{formatMetricNumber(r.calmar)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- one removable chart card per selected series (Figma 14039:68722 chrome). ----
function SeriesChartCard({
  series,
  strategyId,
  stage,
  onRemove,
}: {
  series: string;
  strategyId?: string;
  stage: string;
  onRemove: () => void;
}) {
  const meta = SERIES_META[series] ?? { title: series, kind: "green" as const };
  const { data, isLoading } = useStrategyChart(strategyId, stage, series);
  const times = data?.times ?? [];
  const values = data?.values ?? [];

  return (
    <ChartCard title={meta.title} onRemove={onRemove}>
      {isLoading ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          Loading data...
        </div>
      ) : times.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <BaseChart option={buildStageChartOption(times, values, meta.kind)} style={{ height: 240 }} />
      )}
    </ChartCard>
  );
}

function OverviewMft({
  strategyId,
  stage,
  selectedSeries,
  onToggleSeries,
}: {
  strategyId?: string;
  stage: string;
  selectedSeries: string[];
  onToggleSeries: (series: string) => void;
}) {
  const { data: aggregate } = useSummaryAggregate(strategyId, stage);
  const { data: summaryRows } = useSummaryTable(strategyId, stage);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <AggregateDataStrip data={aggregate} />
      {summaryRows && summaryRows.length > 0 && <YearTable rows={summaryRows} />}
      {selectedSeries.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Select one or more data to view charts
        </div>
      ) : (
        selectedSeries.map((series) => (
          <SeriesChartCard
            key={series}
            series={series}
            strategyId={strategyId}
            stage={stage}
            onRemove={() => onToggleSeries(series)}
          />
        ))
      )}
    </div>
  );
}

function PerformanceMft() {
  return (
    <ChartCard title="Returns">
      <BaseChart option={twoToneAreaOption(RETURNS_SERIES)} style={{ height: 260 }} />
    </ChartCard>
  );
}

function AnalysisMft() {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Strategy</TableHead>
            <TableHead>Universe</TableHead>
            <TableHead>Correlation</TableHead>
            <TableHead>Sharpe</TableHead>
            <TableHead>Returns</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {CORRELATION_ROWS.map((r) => (
            <TableRow key={r.name}>
              <TableCell className="text-white">{r.name}</TableCell>
              <TableCell className="text-white">{r.universe}</TableCell>
              <TableCell className="text-white">{r.correlation.toFixed(2)}</TableCell>
              <TableCell className="text-white">{r.sharpe}</TableCell>
              <TableCell className={r.returns.startsWith("-") ? "text-[#ff135b]" : GREEN_TEXT}>
                {r.returns}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- empty/error/canceled states (xno-builder's KetQuaStrategy look, our tokens). `danger`
// colors the title too, matching xno-builder's Error/Canceled cards (vs. the neutral "No Results
// Yet" title). ----
function StatusCard({ title, subtitle, danger }: { title: string; subtitle?: string; danger?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div
        className="relative rounded-[12px] border border-border bg-background p-3 shadow-2xl"
        style={{
          boxShadow: "0 0 4px 0 rgba(255,19,91,0.30), 0 0 16px 0 #ff135b, 0 0 24px 0 #ff135b, 0 0 32px 0 #ff135b",
        }}
      >
        <Danger weight="Outline" className="size-8 text-[#ff135b]" />
      </div>
      <div className={cn("text-xl font-semibold", danger ? "text-[#ff135b]" : "text-white")}>{title}</div>
      {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

function NoResultsState() {
  return (
    <StatusCard title="No Results Yet" subtitle="Run simulation to view charts and performance metrics" />
  );
}

function ErrorState() {
  return <StatusCard title="Something went wrong!" danger />;
}

function CanceledState() {
  return <StatusCard title="Simulate run was canceled!" danger />;
}

export function MftResultsView({ strategyId }: { strategyId?: string }) {
  const [selectedStage, setSelectedStage] = useState<string>("train");
  const [view, setView] = useState<string>("Overview");
  const [selectedSeries, setSelectedSeries] = useState<string[]>(DEFAULT_SERIES);

  const { data: series } = useResultSeries();
  // `isLoading` (not `isPending`) — a disabled query (no strategyId) sits in `pending` status
  // forever since it never fetches, which would permanently block the empty-state check below.
  // `isLoading` is `pending && fetching`, so it's false immediately once disabled/settled.
  const { data: aggregate, isLoading: aggregateLoading } = useSummaryAggregate(strategyId, selectedStage);
  const { data: strategy, isLoading: strategyLoading } = useStrategyById(strategyId);

  const toggleSeries = (name: string) => {
    setSelectedSeries((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
  };

  // T18 — status gating (xno-builder's KetQuaStrategy): no strategy/CREATED -> empty state;
  // running-ish -> the live progress screen; ERROR/CANCELED -> their cards; else -> results below.
  const showNoResults =
    !USE_MOCK &&
    !strategyLoading &&
    !aggregateLoading &&
    (!strategyId || !strategy || strategy.status === "created");

  if (showNoResults) return <NoResultsState />;

  if (!USE_MOCK && strategy) {
    if (isRunningStatus(strategy.status)) return <RunningSimulateScreen strategy={strategy} />;
    if (strategy.status === "error") return <ErrorState />;
    if (strategy.status === "canceled") return <CanceledState />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-sm font-medium text-white">Stage:</span>
        <Tabs value={selectedStage} onValueChange={(v) => v && setSelectedStage(v)}>
          <TabsList>
            {STAGES.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => v && setView(v)}>
          <TabsList>
            {VIEWS.map((v) => (
              <TabsTrigger key={v} value={v}>
                {v}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {view === "Overview" && (
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm font-medium whitespace-nowrap text-white">Select charts:</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 shrink-0 items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium text-white"
                >
                  Select data...
                  <AltArrowDown weight="Outline" className="size-4 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1.5">
                <div className="flex flex-col">
                  {series?.map((option) => {
                    const name = option.name ?? "";
                    const checked = selectedSeries.includes(name);
                    return (
                      <div
                        key={name}
                        onClick={() => toggleSeries(name)}
                        className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-2 text-xs text-white capitalize hover:bg-secondary/60"
                      >
                        <Checkbox checked={checked} />
                        {name}
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <div className="min-w-0">
        {view === "Overview" && (
          <OverviewMft
            strategyId={strategyId}
            stage={selectedStage}
            selectedSeries={selectedSeries}
            onToggleSeries={toggleSeries}
          />
        )}
        {view === "Performance" && <PerformanceMft />}
        {view === "Analysis" && <AnalysisMft />}
      </div>
    </div>
  );
}
