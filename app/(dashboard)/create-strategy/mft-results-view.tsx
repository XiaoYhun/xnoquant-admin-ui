"use client";
// Six-screen Results UI from Figma 15204:30669 (HFT/Create strategy/Results) and siblings.
// Wired to MFT-type (bar) runs — Create Strategy's HFT-lab run picker and the run-detail
// Charts tab. MFT lab Create Strategy still uses xalpha-mft-results-view.tsx (XALPHA stages).
import { useMemo, useState } from "react";
import { Danger } from "@solar-icons/react";

import { cn } from "@/lib/utils";
import { USE_MOCK } from "@/lib/constant";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  sliceStage,
  toPoints,
  yearsOf,
  type PeriodSelection,
} from "@/lib/transform/mft-results";
import { useMftResultsSource } from "@/hooks/api/use-mft-results-source";
import { useStrategyById } from "@/hooks/api/use-strategy-run";
import type { SampleScope } from "@/types/domain";
import { RunningSimulateScreen } from "./running-simulate-screen";
import { DropdownPill, PillTabs, SegmentedTabs } from "./mft/results-chrome";
import { OverviewMft } from "./mft/overview-mft";
import { PerformanceMft } from "./mft/performance-mft";
import { RiskMft } from "./mft/risk-mft";
import { ExecutionMft } from "./mft/execution-mft";
import { CostEdgeMft } from "./mft/cost-edge-mft";
import { RegimeMft } from "./mft/regime-mft";

const VIEWS = [
  { value: "Overview", label: "Overview" },
  { value: "Performance", label: "Performance" },
  { value: "Risk", label: "Risk" },
  { value: "Execution", label: "Execution" },
  { value: "Cost & Edge", label: "Cost & Edge" },
  { value: "Regime", label: "Regime" },
] as const;
type View = (typeof VIEWS)[number]["value"];

const STAGES = [
  { value: "train", label: "Train" },
  { value: "test", label: "Test" },
  { value: "simulate", label: "Simulate" },
  { value: "live", label: "Live" },
] as const;

// F-046: Mo (month pills) / Qtr (quarter pills) / Ytd (today's year pills), right-aligned next to
// the year pills — exported so OverviewMft (the only view that draws the toggle) can key its
// summary table variant off the same value.
const GRANULARITIES = [
  { value: "Mo", label: "Mo" },
  { value: "Qtr", label: "Qtr" },
  { value: "Ytd", label: "Ytd" },
] as const;
export type Granularity = (typeof GRANULARITIES)[number]["value"];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const QUARTERS = [1, 2, 3, 4] as const;

// ---- status screens (unchanged behaviour, xno-builder's KetQuaStrategy look) -------------------

function StatusCard({ title, subtitle, danger }: { title: string; subtitle?: string; danger?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div
        className="relative rounded-[12px] border border-border bg-background p-3 shadow-2xl"
        style={{
          boxShadow:
            "0 0 4px 0 rgba(255,19,91,0.30), 0 0 16px 0 #ff135b, 0 0 24px 0 #ff135b, 0 0 32px 0 #ff135b",
        }}
      >
        <Danger weight="Outline" className="size-8 text-[#ff135b]" />
      </div>
      <div className={cn("text-xl font-semibold", danger ? "text-[#ff135b]" : "text-white")}>{title}</div>
      {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

// ---- period row (Figma 15205:55604 / 15236:33381) ---------------------------------------------

function PeriodRow({
  years,
  period,
  onChange,
  granularity,
  onGranularityChange,
}: {
  years: number[];
  period: PeriodSelection;
  onChange: (p: PeriodSelection) => void;
  /** Omitted on every view but Overview, which is the only frame that draws the toggle. */
  granularity?: Granularity;
  onGranularityChange?: (g: Granularity) => void;
}) {
  // F-046: "show max 5 years" — applies to the year pills AND the year dropdown, on every view,
  // not just Ytd. `years` stays ascending, so the tail is the most recent 5.
  const recentYears = useMemo(() => years.slice(-5), [years]);
  const fallbackYear = recentYears[recentYears.length - 1];
  const yearOptions = useMemo(
    () => [{ value: -1, label: "All" }, ...recentYears.map((y) => ({ value: y, label: String(y) }))],
    [recentYears],
  );

  const yearDropdown = (onPick: (y: number) => void) => (
    <Popover>
      <PopoverTrigger asChild>
        <DropdownPill label={period.year ?? fallbackYear ?? "—"} className="h-7" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-28 p-1.5">
        <div className="flex flex-col">
          {recentYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => onPick(y)}
              className="cursor-pointer rounded-[6px] px-2 py-2 text-left text-xs text-white hover:bg-secondary/60"
            >
              {y}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <span className="shrink-0 text-xs leading-[18px] font-medium text-white">Period:</span>

      {granularity === "Mo" ? (
        <>
          {yearDropdown((y) => onChange({ year: y, month: period.month }))}
          <PillTabs
            size="sm"
            className="gap-1"
            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
            value={period.month ?? 1}
            onChange={(m) => onChange({ year: period.year ?? fallbackYear, month: m })}
          />
        </>
      ) : granularity === "Qtr" ? (
        <>
          {yearDropdown((y) => onChange({ year: y, quarter: period.quarter }))}
          <PillTabs
            size="sm"
            className="gap-1"
            options={QUARTERS.map((q) => ({ value: q, label: `Q${q}/${period.year ?? fallbackYear}` }))}
            value={period.quarter ?? 1}
            onChange={(q) => onChange({ year: period.year ?? fallbackYear, quarter: q })}
          />
        </>
      ) : (
        <PillTabs
          size="sm"
          options={yearOptions}
          value={period.year ?? -1}
          onChange={(y) => onChange(y === -1 ? {} : { year: y })}
        />
      )}

      {granularity && onGranularityChange && (
        <div className="ml-auto">
          <SegmentedTabs
            options={GRANULARITIES}
            value={granularity}
            onChange={(g) => {
              onGranularityChange(g);
              // Switching to Ytd drops month/quarter; switching to Mo/Qtr needs a year to qualify it.
              onChange(
                g === "Ytd"
                  ? { year: period.year }
                  : g === "Mo"
                    ? { year: period.year ?? fallbackYear, month: period.month ?? 1 }
                    : { year: period.year ?? fallbackYear, quarter: period.quarter ?? 1 },
              );
            }}
          />
        </div>
      )}
    </div>
  );
}

// ---- view --------------------------------------------------------------------------------------

export function MftResultsView({
  strategyId,
  runId,
  sample,
}: {
  strategyId?: string;
  /** When set, results come from the HFT run artifacts instead of XALPHA strategy/stage. */
  runId?: string;
  /** The "Period: All | IS | OS" row's selection — ignored on the XALPHA strategy/stage feed. */
  sample?: SampleScope;
}) {
  const [stage, setStage] = useState<string>("train");
  const [view, setView] = useState<View>("Overview");
  const [period, setPeriod] = useState<PeriodSelection>({});
  const [granularity, setGranularity] = useState<Granularity>("Ytd");
  const runScoped = !!runId;

  // A sample change can drop the year the Period row (below) has selected — e.g. a year with no
  // in-sample trades disappears entirely under OS. Reset to "All" rather than leave the pills
  // pointed at a year no longer in `years`. Compared during render, same pattern as the other
  // "reset on prop change" syncs in results-tab.tsx.
  const [prevSample, setPrevSample] = useState(sample);
  if (prevSample !== sample) {
    setPrevSample(sample);
    setPeriod({});
  }

  const { data: strategy, isLoading: strategyLoading } = useStrategyById(runScoped ? undefined : strategyId);
  const src = useMftResultsSource({
    strategyId: runScoped ? undefined : strategyId,
    stage,
    runId,
    sample,
  });

  // The Period pills are built from whatever the series actually covers for this stage, so a
  // strategy trained over two years never offers a third empty year.
  const years = useMemo(
    () => yearsOf(sliceStage(toPoints(src.returns.data), src.returns.data, runScoped ? undefined : stage)),
    [src.returns.data, stage, runScoped],
  );

  // Only Overview draws the Year/Month toggle; the other five frames show the year pills alone.
  const isOverview = view === "Overview";
  // Memoised — every view keys its derivations on this object, so rebuilding it each render would
  // invalidate the monthly/drawdown/streak memos on every keystroke and hover. Declared above the
  // status early-returns below, since hooks cannot sit after a conditional return.
  const effectivePeriod = useMemo(
    () => (isOverview ? period : { year: period.year }),
    [isOverview, period],
  );

  const liveReady = Boolean(strategy?.valid_to_show_live && (strategy?.live_remaining_days ?? 0) <= 0);

  const showNoResults =
    !runScoped &&
    !USE_MOCK &&
    !strategyLoading &&
    (!strategyId || !strategy || strategy.status === "created");

  if (showNoResults) {
    return (
      <StatusCard title="No Results Yet" subtitle="Run simulation to view charts and performance metrics" />
    );
  }

  if (!runScoped && !USE_MOCK && strategy) {
    if (strategy.status === "error") return <StatusCard title="Something went wrong!" danger />;
    if (strategy.status === "canceled") return <StatusCard title="Simulate run was canceled!" danger />;
    // Only completed/published show results (and fire the summary/chart API calls); anything still
    // in flight (running/queued/evaluating/waiting/…) shows the progress screen instead of 404ing.
    if (strategy.status !== "completed" && strategy.status !== "published") {
      return <RunningSimulateScreen strategy={strategy} />;
    }
  }


  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PeriodRow
        years={years}
        period={period}
        onChange={setPeriod}
        granularity={isOverview ? granularity : undefined}
        onGranularityChange={isOverview ? setGranularity : undefined}
      />

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <PillTabs options={VIEWS} value={view} onChange={setView} />
        {!runScoped && (
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs leading-[18px] font-medium text-white">Stage:</span>
            <Popover>
              <PopoverTrigger asChild>
                <DropdownPill label={STAGES.find((s) => s.value === stage)?.label ?? stage} />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-36 p-1.5">
                <div className="flex flex-col">
                  {STAGES.map((s) => {
                    // xno-builder parity: Live only unlocks once the lock-up has elapsed.
                    const disabled = s.value === "live" && !liveReady;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => setStage(s.value)}
                        className={cn(
                          "cursor-pointer rounded-[6px] px-2 py-2 text-left text-xs text-white hover:bg-secondary/60",
                          disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                          s.value === stage && "bg-secondary/60",
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Remount on stage/run/sample change: ECharts merges options by default, so a series that
          exists under one selection and not the next (a year with no in-sample trades vanishing
          under OS, same idea as a stage change) survives into the following chart and draws data
          that isn't its own. Keying here also resets each view's local range/window toggles. */}
      <div key={`${runId ?? stage}:${sample ?? "default"}`} className="min-w-0">
        {view === "Overview" && (
          <OverviewMft
            strategyId={strategyId}
            stage={stage}
            period={effectivePeriod}
            runId={runId}
            sample={sample}
            granularity={granularity}
          />
        )}
        {view === "Performance" && (
          <PerformanceMft strategyId={strategyId} stage={stage} period={effectivePeriod} runId={runId} sample={sample} />
        )}
        {view === "Risk" && (
          <RiskMft strategyId={strategyId} stage={stage} period={effectivePeriod} runId={runId} sample={sample} />
        )}
        {view === "Execution" && (
          <ExecutionMft strategyId={strategyId} stage={stage} period={effectivePeriod} runId={runId} sample={sample} />
        )}
        {view === "Cost & Edge" && (
          <CostEdgeMft strategyId={strategyId} stage={stage} period={effectivePeriod} runId={runId} sample={sample} />
        )}
        {view === "Regime" && (
          <RegimeMft strategyId={strategyId} stage={stage} period={effectivePeriod} runId={runId} sample={sample} />
        )}
      </div>
    </div>
  );
}
