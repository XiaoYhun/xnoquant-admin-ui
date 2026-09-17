"use client";
// Create Strategy "Results" tab shell — Figma 14876:146505. First row: pill view-tabs on the left,
// the run-history picker on the right. Second row: the "Period:" pills (Figma 15235:33194) — a
// narrower All/IS/OS, not the old Train/Test/Simulate/Paper Trade row that design dropped. Each
// view lives in its own file. Everything here stays width-responsive: min-w-0 so the panel never
// forces horizontal overflow.
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Danger } from "@solar-icons/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewView } from "./overview-view";
import { PerformanceView } from "./performance-view";
import { RiskView } from "./risk-view";
import { ExecutionView } from "./execution-view";
import { CostCapacityView } from "./cost-capacity-view";
import { LatencyView } from "./latency-view";
import { MftResultsView } from "./mft-results-view";
import { XalphaMftResultsView } from "./xalpha-mft-results-view";
import { RunHistoryPicker } from "./run-history-picker";
import { RunMetaStrip } from "./run-meta-strip";
import { LiveSnapshotProvider } from "@/hooks/api/use-run-live-snapshot";
import { isPendingBacktest, symbolNamesOf, useRun } from "@/hooks/api/use-runs";
import { useSamplePeriodRow } from "./sample-period-row";
import type { Run } from "@/types/domain";

// The Figma tab bar (14876:146506) shows five; Latency is kept on the end as a sixth — its
// per-stage AVG/LAST/MAX cards have no home in the Execution design, which covers latency only as
// a summary metric plus a distribution.
const VIEWS = ["Overview", "Performance", "Risk", "Execution", "Cost & Capacity", "Latency"] as const;

// Figma pills (14876:146506): no track behind the row, 8px gap, active pill = Neutral/Black 800.
const TAB_LIST = "gap-2 rounded-none bg-transparent p-0";
const TAB_TRIGGER =
  "rounded-[40px] px-3 py-2 text-sm text-[#9db2ce] data-[state=active]:bg-[#1d2939] data-[state=active]:text-white data-[state=active]:shadow-none";

// A failed run wrote no artifacts worth charting — the engine died before or during it — so the
// six views below would render an all-"—" shell that never says why. Replace them with the reason
// the API recorded (`Run.error`), the same failure the run-history picker badges "Failed".
function RunFailedScreen({ reason }: { reason?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-2xl bg-[#0a0d12]"
        style={{ boxShadow: "0 0 28px 4px rgba(255,19,91,0.35)" }}
      >
        <Danger weight="Outline" className="size-7 text-[#ff135b]" />
      </div>
      <h3 className="text-lg font-semibold text-white">Simulation Failed</h3>
      {/* The gradient is clipped to the glyphs, so it can't share an element with the tint. */}
      <p className="max-w-xl rounded-lg bg-[rgba(255,19,91,0.08)] px-4 py-2.5 text-xs font-medium break-words whitespace-pre-wrap">
        <span className="bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent">
          {reason?.trim() || "The API recorded no reason."}
        </span>
      </p>
    </div>
  );
}

/**
 * Which Results screen a strategy gets.
 *
 * MFT lab (XALPHA editors) keeps the original stage-based Results (Overview / Performance /
 * Analysis). The six-screen Figma 15204 UI is HFT/Create strategy/Results and is shown for
 * MFT-type *runs* (manifest `data_kind.kind === "bar"`), not for the MFT lab.
 */
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
  if (variant === "mft") return <XalphaMftResultsView strategyId={strategyId} />;
  return <HftResultsTab strategyId={strategyId} focusRun={focusRun} />;
}

/** Bar/OHLC runs are the MFT engine; missing `data_kind` stays on the HFT views (safe default). */
function isMftTypeRun(run?: Run): boolean {
  return run?.manifest.data_kind?.kind === "bar";
}

function HftResultsTab({
  strategyId,
  focusRun,
}: {
  strategyId?: string;
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
  // `/summary` is asked for a finished backtest only. It is the one result endpoint a paper/live
  // run never answers usefully here, and no run answers it while RUNNING: the pnl parquet is
  // mid-write, so it 500s for the whole life of the run and the live frame carries those same
  // headline fields. Paper Trading's run-detail panel applies the running half of this gate too.
  const isBacktest = selectedRun?.mode === "backtest";
  const failed = selectedRun?.status === "failed";
  // Frames name symbols by dense index only, so the manifest supplies the tickers. A backtest
  // that is still queued is fetched for a second reason: useRun re-asks for it every 5s until the
  // engine picks it up, so the tab moves off "pending" on its own.
  const { data: run } = useRun(isLive || isPendingBacktest(selectedRun) ? selectedRun?.id : undefined);
  const symbolNames = useMemo(() => symbolNamesOf(run), [run]);

  // The picker hands over a snapshot of the run and never revisits it, so the poll's copy has to
  // replace it — otherwise the views keep querying under a status that has since changed. Compared
  // during render, like the two syncs above.
  if (run && run.id === selectedRun?.id && run.status !== selectedRun.status) setSelectedRun(run);

  // Keep the list behind the picker honest too: it is a separate, unpolled query, so without this
  // its row would still badge the run "Pending" after the poll saw it start. A cache write, not an
  // invalidation — the record in hand is already the newer one.
  const qc = useQueryClient();
  useEffect(() => {
    if (!selectedRun) return;
    qc.setQueryData<Run[]>(["strategy-runs"], (prev) =>
      prev?.some((r) => r.id === selectedRun.id && r.status !== selectedRun.status)
        ? prev.map((r) => (r.id === selectedRun.id ? selectedRun : r))
        : prev,
    );
  }, [selectedRun, qc]);

  // The "Period: All | IS | OS" row — shared by the HFT and MFT branches below (see
  // sample-period-row.tsx for the backtest/admin/split rules).
  const { row: periodRow, sample } = useSamplePeriodRow(selectedRun);

  const mftRun = isMftTypeRun(selectedRun) && !isLive;

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4">
      {mftRun ? (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <RunHistoryPicker strategyId={strategyId} selectedRunId={selectedRun?.id} onSelect={setSelectedRun} />
          </div>
          {periodRow}
          {failed ? (
            <RunFailedScreen reason={selectedRun?.error} />
          ) : (
            <LiveSnapshotProvider runId={selectedRun?.id} isLive={isLive} symbolNames={symbolNames}>
              <MftResultsView runId={selectedRun?.id} sample={sample} />
            </LiveSnapshotProvider>
          )}
        </>
      ) : (
        <>
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

      {periodRow}

      {/* What the views below are describing: symbols, engine, account, period. Reads the
          selected run's manifest, so it costs nothing beyond what the picker already fetched. */}
      <RunMetaStrip run={selectedRun} />

      {failed ? (
        <RunFailedScreen reason={selectedRun?.error} />
      ) : (
        /*
          One `/live/stream` subscription for the whole tab. It lives above the view switch so
          switching views doesn't tear the connection down and lose the accumulated Sharpe series,
          and so six views share one connection instead of opening six.
        */
        <LiveSnapshotProvider runId={selectedRun?.id} isLive={isLive} symbolNames={symbolNames}>
          {/* Remount every view when the run changes. ECharts merges options by default, so a
              series that is conditional — Overview's Gross PnL line only exists when the run has a
              cost curve — survives into the next run's chart and draws data that isn't its own.
              Keying here also resets each view's local toggles (range, period) for the new run.
              Kept off the provider so the live subscription isn't torn down on a view switch. */}
          <div key={`${selectedRun?.id ?? strategyId ?? "no-run"}:${selectedRun?.status ?? ""}`} className="min-w-0">
            {view === "Overview" && <OverviewView runId={selectedRun?.id} summaryEnabled={isBacktest && !isLive} isLive={isLive} sample={sample} />}
            {view === "Performance" && <PerformanceView runId={selectedRun?.id} summaryEnabled={isBacktest && !isLive} isLive={isLive} sample={sample} />}
            {view === "Risk" && <RiskView runId={selectedRun?.id} isLive={isLive} sample={sample} />}
            {view === "Execution" && <ExecutionView runId={selectedRun?.id} isLive={isLive} sample={sample} />}
            {view === "Cost & Capacity" && <CostCapacityView runId={selectedRun?.id} summaryEnabled={isBacktest && !isLive} isLive={isLive} sample={sample} />}
            {view === "Latency" && <LatencyView isLive={isLive} />}
          </div>
        </LiveSnapshotProvider>
      )}
        </>
      )}
    </div>
  );
}
