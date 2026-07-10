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
  type StrategyChartData,
} from "@/hooks/api/use-strategy-results";
import { useStrategyById } from "@/hooks/api/use-strategy-run";
import { RunningSimulateScreen } from "./running-simulate-screen";
import { PerformanceMftView } from "./performance-mft";
import { AnalysisMftView } from "./analysis-mft";

const GREEN_TEXT =
  "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";

// Multi-stage overlay chart colors — copied exactly from xno-builder (train/test/live). xno-builder
// has no dedicated simulate color (its charts only ever carry train/test/live); any other stage
// falls back below.
const STAGE_COLORS = {
  train: "#38C9A7",
  test: "#FFA500",
  live: "#3B82F6",
};
const STAGE_FALLBACK = "#67e1c1";

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

// Returns [time,value] pairs (as string/number tuples for an ECharts category axis) for one
// stage's [from,to] range (inclusive). Guards missing stage/from/to/timestamp lookups.
function extractStageData(data: StrategyChartData, name: string): [string, number][] {
  const times = data.times ?? [];
  const values = data.values ?? [];
  const range = data.stages?.[name];
  if (range?.from == null || range?.to == null) return [];
  const fromIdx = times.indexOf(range.from);
  const toIdx = times.indexOf(range.to);
  if (fromIdx === -1 || toIdx === -1) return [];
  return times.slice(fromIdx, toIdx + 1).map((t, i) => [String(t), values[fromIdx + i]]);
}

// One colored line series for a stage segment ([time,value] pairs). Series-level `color` + emphasis
// pin the color so hover doesn't fall back to the theme palette (which starts green) and repaint the
// line; the area fades full-color → transparent (xno-builder parity).
function stageSeries(name: string, color: string, data: [string, number][]) {
  return {
    type: "line" as const,
    name,
    color,
    data,
    smooth: true,
    showSymbol: false,
    symbol: "none" as const,
    connectNulls: true,
    lineStyle: { width: 2, color },
    itemStyle: { color },
    emphasis: { lineStyle: { width: 2, color } },
    areaStyle: {
      color: {
        type: "linear" as const,
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color },
          { offset: 1, color: `${color}00` },
        ],
      },
    },
  };
}

// Multi-stage overlay (xno-builder parity): draw the sequential Train / Test / Live segments as
// separate colored lines on one shared date axis. A data "simulate" stage spans the FULL range and
// overlaps train+test, so it is intentionally NOT drawn — exactly like xno-builder, which only ever
// renders train/test/live. Cumulative: Test appears once you leave the Train stage; Live is always
// included (empty when the strategy has no live stage). Falls back to one line when no
// train/test/live boundaries exist.
function buildMultiStageOption(data: StrategyChartData, stage: string): EChartsOption {
  const times = data.times ?? [];
  const values = data.values ?? [];
  const stages = data.stages ?? {};
  const tr = stages.train;
  const te = stages.test;

  const shared = {
    tooltip: {
      trigger: "axis" as const,
      // Title = the hovered date (the category is a raw unix-seconds string); values capped at 2dp.
      formatter: (params: unknown) => {
        const arr = (Array.isArray(params) ? params : [params]) as Array<{
          axisValue?: string;
          marker?: string;
          seriesName?: string;
          value?: unknown;
        }>;
        if (!arr.length) return "";
        const title = formatTimestamp(Number(arr[0].axisValue));
        const rows = arr
          .map((p) => {
            const raw = Array.isArray(p.value) ? p.value[1] : p.value;
            const val = typeof raw === "number" ? raw.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(raw ?? "");
            return `${p.marker ?? ""} ${p.seriesName ?? ""}: ${val}`;
          })
          .join("<br/>");
        return `${title}<br/>${rows}`;
      },
    },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    yAxis: { type: "value" as const },
  };
  const axisFor = (arr: number[]) => ({
    type: "category" as const,
    data: arr.map(String),
    boundaryGap: false,
    axisTick: { show: false },
    axisLabel: {
      fontSize: 10,
      color: "#9db2ce",
      interval: Math.max(0, Math.ceil(arr.length / 8) - 1),
      formatter: (v: string) => formatTimestamp(Number(v)),
    },
  });

  // No sequential stage boundaries → one plain line over everything.
  if (!stages.train && !stages.test && !stages.live) {
    return {
      ...shared,
      xAxis: axisFor(times),
      series: [stageSeries("", STAGE_FALLBACK, times.map((t, i) => [String(t), values[i]]))],
    };
  }

  // X-axis window: Train → train range; Test → train→test; Simulate/Live → full timeline.
  let axisTimes = times;
  if (stage === "train" && tr?.from != null && tr?.to != null) {
    axisTimes = times.filter((t) => t >= tr.from! && t <= tr.to!);
  } else if (stage === "test" && tr?.from != null && te?.to != null) {
    axisTimes = times.filter((t) => t >= tr.from! && t <= te.to!);
  }

  const series = [
    stageSeries("Train", STAGE_COLORS.train, extractStageData(data, "train")),
    stage !== "train" ? stageSeries("Test", STAGE_COLORS.test, extractStageData(data, "test")) : null,
    stageSeries("Live", STAGE_COLORS.live, extractStageData(data, "live")),
  ].filter(Boolean) as ReturnType<typeof stageSeries>[];

  return { ...shared, xAxis: axisFor(axisTimes), series };
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
              <TableCell className="text-left text-white">{r.time}</TableCell>
              <TableCell className="text-left text-white">{formatMetricNumber(r.sharpe)}</TableCell>
              <TableCell className={cn("text-left", metricPositive(r.cagr) ? GREEN_TEXT : "text-[#ff135b]")}>
                {formatMetricPercent(r.cagr)}
              </TableCell>
              <TableCell className="text-left text-[#ff135b]">
                {formatMetricNumber((r.max_drawdown ?? 0) * 100)}%
              </TableCell>
              <TableCell className="text-left text-white">{formatMetricNumber(r.profit_factor)}</TableCell>
              <TableCell className="text-left text-white">{formatMetricNumber(r.calmar)}</TableCell>
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
  const { data, isLoading } = useStrategyChart(strategyId, series);

  return (
    <ChartCard title={meta.title} onRemove={onRemove}>
      {isLoading ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          Loading data...
        </div>
      ) : !data?.times?.length ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <BaseChart option={buildMultiStageOption(data, stage)} style={{ height: 240 }} />
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
  const { data: strategy, isLoading: strategyLoading } = useStrategyById(strategyId);

  const toggleSeries = (name: string) => {
    setSelectedSeries((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
  };

  const showNoResults =
    !USE_MOCK && !strategyLoading && (!strategyId || !strategy || strategy.status === "created");

  if (showNoResults) return <NoResultsState />;

  if (!USE_MOCK && strategy) {
    if (strategy.status === "error") return <ErrorState />;
    if (strategy.status === "canceled") return <CanceledState />;
    // Only completed/published show results (and fire the summary/chart API calls); anything still
    // in flight (running/queued/evaluating/waiting/…) shows the progress screen instead of 404ing.
    if (strategy.status !== "completed" && strategy.status !== "published") {
      return <RunningSimulateScreen strategy={strategy} />;
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-sm font-medium text-white">Stage:</span>
        {/* Live is clickable only when the strategy is eligible and the lock-up has elapsed
            (xno-builder parity: valid_to_show_live && live_remaining_days <= 0). */}
        <Tabs value={selectedStage} onValueChange={(v) => v && setSelectedStage(v)}>
          <TabsList>
            {STAGES.map((s) => (
              <TabsTrigger
                key={s.value}
                value={s.value}
                disabled={s.value === "live" && !(strategy?.valid_to_show_live && (strategy?.live_remaining_days ?? 0) <= 0)}
              >
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
        {view === "Performance" && (
          <PerformanceMftView strategyId={strategyId} stage={selectedStage} market={strategy?.market} />
        )}
        {view === "Analysis" && <AnalysisMftView strategy={strategy} strategyId={strategyId} />}
      </div>
    </div>
  );
}
