"use client";
// Create Strategy "Results" tab shell — Figma 14876:146505. One row: pill view-tabs on the left,
// the run-history picker on the right. The old "Period:" row (Train/Test/Simulate/Paper Trade) is
// gone from the design. Each view lives in its own file. Everything here stays width-responsive:
// min-w-0 so the panel never forces horizontal overflow.
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewView } from "./overview-view";
import { PerformanceView } from "./performance-view";
import { RiskView } from "./risk-view";
import { ExecutionView } from "./execution-view";
import { CostCapacityView } from "./cost-capacity-view";
import { LatencyView } from "./latency-view";
import { MftResultsView } from "./mft-results-view";
import { RunHistoryPicker } from "./run-history-picker";
import { RunMetaStrip } from "./run-meta-strip";
import { LiveSnapshotProvider } from "@/hooks/api/use-run-live-snapshot";
import { symbolNamesOf, useRun } from "@/hooks/api/use-runs";
import type { Run } from "@/types/domain";

// The Figma tab bar (14876:146506) shows five; Latency is kept on the end as a sixth — its
// per-stage AVG/LAST/MAX cards have no home in the Execution design, which covers latency only as
// a summary metric plus a distribution.
const VIEWS = ["Overview", "Performance", "Risk", "Execution", "Cost & Capacity", "Latency"] as const;

// Figma pills (14876:146506): no track behind the row, 8px gap, active pill = Neutral/Black 800.
const TAB_LIST = "gap-2 rounded-none bg-transparent p-0";
const TAB_TRIGGER =
  "rounded-[40px] px-3 py-2 text-sm text-[#9db2ce] data-[state=active]:bg-[#1d2939] data-[state=active]:text-white data-[state=active]:shadow-none";

export function ResultsTab({
  variant = "hft",
  strategyId,
  focusRun,
}: {
  variant?: "mft" | "hft";
  strategyId?: string;
  /** A just-launched run to select, overriding the picker's newest-run default. */
  focusRun?: Run;
}) {
  const [view, setView] = useState<string>("Overview");
  // Which run the views describe. Undefined = the picker's default (the newest run).
  const [selectedRun, setSelectedRun] = useState<Run | undefined>(undefined);
  // Drop the selection when the strategy tab changes: the picker re-defaults to the new strategy's
  // newest run, but it only announces that default when nothing is selected. Keeping the old run
  // here left the label showing one run while every view queried the previous strategy's run.
  const [prevStrategyId, setPrevStrategyId] = useState(strategyId);
  if (prevStrategyId !== strategyId) {
    setPrevStrategyId(strategyId);
    setSelectedRun(undefined);
  }
  // Jump to a newly launched run. Compared during render rather than synced in an effect (the
  // pattern above, and what react-hooks/set-state-in-effect requires); keyed on the id so
  // re-launching the SAME run id doesn't fight a selection the user has since changed.
  const [prevFocusId, setPrevFocusId] = useState(focusRun?.id);
  if (focusRun && prevFocusId !== focusRun.id) {
    setPrevFocusId(focusRun.id);
    setSelectedRun(focusRun);
  }
  // Only a running run publishes live snapshots; anything else reads the persisted artifacts.
  const isLive = selectedRun?.status === "running";
  // Frames name symbols by dense index only, so the manifest supplies the tickers.
  const { data: run } = useRun(isLive ? selectedRun?.id : undefined);
  const symbolNames = useMemo(() => symbolNamesOf(run), [run]);

  if (variant === "mft") return <MftResultsView strategyId={strategyId} />;

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => v && setView(v)}>
          <TabsList className={TAB_LIST}>
            {VIEWS.map((v) => (
              <TabsTrigger key={v} value={v} className={TAB_TRIGGER}>
                {v}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <RunHistoryPicker strategyId={strategyId} selectedRunId={selectedRun?.id} onSelect={setSelectedRun} />
      </div>

      {/* What the views below are describing: symbols, engine, account, period. Reads the
          selected run's manifest, so it costs nothing beyond what the picker already fetched. */}
      <RunMetaStrip run={selectedRun} />

      {/*
        One `/live/stream` subscription for the whole tab. It lives above the view switch so
        switching views doesn't tear the connection down and lose the accumulated Sharpe series,
        and so six views share one connection instead of opening six.
      */}
      <LiveSnapshotProvider runId={selectedRun?.id} isLive={isLive} symbolNames={symbolNames}>
        {/* Remount every view when the run changes. ECharts merges options by default, so a
            series that is conditional — Overview's Gross PnL line only exists when the run has a
            cost curve — survives into the next run's chart and draws data that isn't its own.
            Keying here also resets each view's local toggles (range, period) for the new run.
            Kept off the provider so the live subscription isn't torn down on a view switch. */}
        <div key={selectedRun?.id ?? strategyId ?? "no-run"} className="min-w-0">
          {view === "Overview" && <OverviewView runId={selectedRun?.id} />}
          {view === "Performance" && <PerformanceView runId={selectedRun?.id} />}
          {view === "Risk" && <RiskView runId={selectedRun?.id} isLive={isLive} />}
          {view === "Execution" && <ExecutionView runId={selectedRun?.id} isLive={isLive} />}
          {view === "Cost & Capacity" && <CostCapacityView runId={selectedRun?.id} />}
          {view === "Latency" && <LatencyView isLive={isLive} />}
        </div>
      </LiveSnapshotProvider>
    </div>
  );
}
