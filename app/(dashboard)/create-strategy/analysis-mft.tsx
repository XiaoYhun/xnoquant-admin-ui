"use client";
// MFT "Analysis" tab — ported from xno-builder's strategy Analysis tab. Two parts:
// (A) IS Testing Status — always rendered, drives off the simulate-stage evaluations.
// (B) Event Analytics — self/cross correlation + before/after comparison chart, shown only when
// the strategy has a submitted event.
import { useState } from "react";
import type { EChartsOption } from "echarts";
import { CheckCircle, CloseCircle, AltArrowDown, Record as RecordIcon } from "@solar-icons/react";

import { cn } from "@/lib/utils";
import { BaseChart } from "@/components/charts/base-chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useStrategyEvaluations,
  useStrategyCorrelation,
  useStrategyComparison,
  type EvaluationRecord,
  type StrategyEventCorrelationItem,
  type ComparisonTimeSeriesResult,
} from "@/hooks/api/use-strategy-analysis";
import type { StrategyInfo } from "@/hooks/api/use-strategy-run";
import type { components } from "@/types/api/xalpha";

type StrategySubmitEvent = components["schemas"]["models.StrategySubmitEvent"];

const GREEN_TEXT =
  "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";

// ---------------------------------------------------------------------------
// A. IS Testing Status
// ---------------------------------------------------------------------------

type FilterKey = "all" | "pass" | "fail" | "pending";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pass", label: "Pass" },
  { key: "fail", label: "Fail" },
  { key: "pending", label: "Pending" },
];

const METRIC_LABELS: Record<string, string> = {
  sharpe: "Sharpe Ratio",
  cagr: "CAGR",
  max_drawdown: "Max Drawdown",
  profit_factor: "Profit factor",
  calmar: "Calmar",
};

const CONDITION_SYMBOLS: Record<string, string> = {
  ge: "≥",
  le: "≤",
  gt: ">",
  lt: "<",
  eq: "=",
};

// cagr/max_drawdown are ratios (0.184 -> "18%"/"18.4%"); every other metric renders raw.
const PERCENT_METRICS = new Set(["cagr", "max_drawdown"]);

function formatThreshold(metric?: string, threshold?: number): string {
  if (threshold == null) return "--";
  if (metric && PERCENT_METRICS.has(metric)) return `${(threshold * 100).toFixed(0)}%`;
  return `${threshold}`;
}

function formatEvalValue(metric?: string, value?: number | null): string {
  if (value == null) return "--";
  if (metric && PERCENT_METRICS.has(metric)) return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
}

function EvaluationRow({ result }: { result: EvaluationRecord }) {
  const { metric, passed, condition, threshold, value } = result;
  const isPending = value == null;
  const tone = isPending ? "pending" : passed ? "pass" : "fail";

  const toneClass = {
    pass: "text-primary",
    fail: "text-[#ff135b]",
    pending: "text-muted-foreground",
  }[tone];

  const sym = condition ? (CONDITION_SYMBOLS[condition] ?? condition) : "";

  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-2.5">
      {tone === "pass" && <CheckCircle weight="Bold" className="size-5 shrink-0 text-primary" />}
      {tone === "fail" && <CloseCircle weight="Bold" className="size-5 shrink-0 text-[#ff135b]" />}
      {tone === "pending" && <RecordIcon weight="Bold" className="size-5 shrink-0 text-muted-foreground" />}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm text-white">
          {metric ? (METRIC_LABELS[metric] ?? metric) : "--"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          Target: {sym}
          {formatThreshold(metric, threshold)}
        </span>
      </div>
      <span className={cn("shrink-0 text-sm font-medium", toneClass)}>{formatEvalValue(metric, value)}</span>
    </div>
  );
}

function TestingStatusCard({ strategyId }: { strategyId?: string }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const { data } = useStrategyEvaluations(strategyId);
  const results = data?.results ?? [];

  const counts: Record<FilterKey, number> = {
    all: results.length,
    pass: results.filter((r) => r.passed).length,
    fail: results.filter((r) => !r.passed && r.value != null).length,
    pending: results.filter((r) => r.value == null).length,
  };

  const filtered = results.filter((r) => {
    if (filter === "pass") return r.passed;
    if (filter === "fail") return !r.passed && r.value != null;
    if (filter === "pending") return r.value == null;
    return true;
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm font-medium text-white">IS Testing Status</span>
        <Tabs value={filter} onValueChange={(v) => v && setFilter(v as FilterKey)}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key} className="gap-1.5">
                {f.label}
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {counts[f.key]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {filtered.length === 0 ? (
        <div className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No metrics to show
        </div>
      ) : (
        filtered.map((r, i) => <EvaluationRow key={r.metric ?? i} result={r} />)
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// B. Event Analytics — event picker + correlation + comparison chart
// ---------------------------------------------------------------------------

function EventDropdown({
  events,
  selectedId,
  onSelect,
}: {
  events: StrategySubmitEvent[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const selected = events.find((e) => e.id === selectedId);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium"
        >
          <span className={GREEN_TEXT}>{selected?.name ?? "Select event"}</span>
          <AltArrowDown weight="Outline" className="size-4 text-muted-foreground opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <div className="flex flex-col">
          {events.map((e) => (
            <div
              key={e.id}
              onClick={() => e.id && onSelect(e.id)}
              className="cursor-pointer rounded-[6px] px-2 py-2 text-xs text-white hover:bg-secondary/60"
            >
              {e.name}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CorrelationLegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function SelfCorrelationGauge({ items }: { items: StrategyEventCorrelationItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Please resolve the failed metrics before checking correlation
      </p>
    );
  }

  const values = items.map((c) => c.correlation ?? 0);
  const selfMin = Math.min(...values);
  const selfMax = Math.max(...values);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-2 rounded-full bg-secondary">
        <div
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${(selfMin + 1) * 50}%` }}
        />
        <div
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff135b]"
          style={{ left: `${(selfMax + 1) * 50}%` }}
        />
      </div>
      <div className="flex items-center gap-4">
        <CorrelationLegendDot color="#67e1c1" label={`Min ${selfMin.toFixed(2)}`} />
        <CorrelationLegendDot color="#ff135b" label={`Max ${selfMax.toFixed(2)}`} />
      </div>
    </div>
  );
}

function CrossCorrelationTable({ items }: { items: StrategyEventCorrelationItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Strategy ID</TableHead>
            <TableHead>Correlation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c, i) => (
            <TableRow key={c.strategy_id ?? i}>
              <TableCell className="max-w-[200px] truncate text-muted-foreground">
                {c.strategy_id ?? "--"}
              </TableCell>
              <TableCell className={(c.correlation ?? 0) >= 0 ? "text-primary" : "text-[#ff135b]"}>
                {(c.correlation ?? 0).toFixed(4)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CorrelationDetails({
  strategyId,
  eventId,
  published,
}: {
  strategyId?: string;
  eventId?: string;
  published: boolean;
}) {
  const { data } = useStrategyCorrelation(strategyId, eventId, published);
  const self = data?.self_correlation ?? [];
  const cross = data?.cross_correlation ?? [];
  const score = data?.score;

  if (self.length === 0 && cross.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-muted-foreground">No correlation data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-white">Self correlation</span>
          {score != null && <span className="text-xs text-muted-foreground">Score: {score.toFixed(4)}</span>}
        </div>
        <SelfCorrelationGauge items={self} />
      </div>
      {cross.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-white">Cross correlation</span>
          <CrossCorrelationTable items={cross} />
        </div>
      )}
    </div>
  );
}

// unix seconds -> "MM/DD/YYYY"
function formatComparisonDate(v: string): string {
  const d = new Date(Number(v) * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function buildComparisonOption(
  before: ComparisonTimeSeriesResult,
  after: ComparisonTimeSeriesResult,
): EChartsOption {
  return {
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: (before.times ?? []).map(String),
      axisLabel: { formatter: (v: string) => formatComparisonDate(v) },
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: (v: number) => `${v.toFixed(0)}%` },
    },
    series: [
      {
        name: "Before",
        type: "line",
        data: before.values ?? [],
        smooth: true,
        symbol: "none",
        connectNulls: true,
        lineStyle: { width: 2, color: "#67E1C0" },
        itemStyle: { color: "#67E1C0" },
      },
      {
        name: "After",
        type: "line",
        data: after.values ?? [],
        smooth: true,
        symbol: "none",
        connectNulls: true,
        lineStyle: { width: 2, color: "#2D84FF" },
        itemStyle: { color: "#2D84FF" },
      },
    ],
  };
}

function ComparisonChart({ strategyId, eventId }: { strategyId?: string; eventId?: string }) {
  const { data } = useStrategyComparison(strategyId, eventId);
  const before = data?.before ?? {};
  const after = data?.after ?? {};

  if (!before.times?.length) {
    return <p className="text-sm text-muted-foreground">No comparison data</p>;
  }

  return <BaseChart option={buildComparisonOption(before, after)} style={{ height: 260 }} />;
}

function EventAnalytics({ strategy, strategyId }: { strategy: StrategyInfo; strategyId?: string }) {
  const events = strategy.events ?? [];
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(
    () => (events.find((e) => e.default) ?? events[0])?.id,
  );
  const selectedEvent =
    events.find((e) => e.id === selectedEventId) ?? events.find((e) => e.default) ?? events[0];
  const eventId = selectedEvent?.id;
  const published = strategy.status === "published";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-white">Event Analytics</span>
        <EventDropdown events={events} selectedId={eventId} onSelect={setSelectedEventId} />
      </div>
      <CorrelationDetails strategyId={strategyId} eventId={eventId} published={published} />
      {published && (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="border-b border-border px-4 py-3 text-sm font-medium text-white">
            Performance Comparison
          </div>
          <div className="p-4">
            <ComparisonChart strategyId={strategyId} eventId={eventId} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AnalysisMftView({ strategy, strategyId }: { strategy?: StrategyInfo; strategyId?: string }) {
  return (
    <div className="flex flex-col gap-6">
      <TestingStatusCard strategyId={strategyId} />
      {strategy && strategy.events?.some((e) => e.submited) && (
        <EventAnalytics strategy={strategy} strategyId={strategyId} />
      )}
    </div>
  );
}
