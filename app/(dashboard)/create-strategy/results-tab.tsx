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
import { RunHistoryPicker } from "./run-history-picker";
import { RunMetaStrip } from "./run-meta-strip";
import { LiveSnapshotProvider } from "@/hooks/api/use-run-live-snapshot";
import { isPendingBacktest, symbolNamesOf, useRun } from "@/hooks/api/use-runs";
import type { Run } from "@/types/domain";

// The Figma tab bar (14876:146506) shows five; Latency is kept on the end as a sixth — its
// per-stage AVG/LAST/MAX cards have no home in the Execution design, which covers latency only as
// a summary metric plus a distribution.
const VIEWS = ["Overview", "Performance", "Risk", "Execution", "Cost & Capacity", "Latency"] as const;

// Figma pills (14876:146506): no track behind the row, 8px gap, active pill = Neutral/Black 800.
const TAB_LIST = "gap-2 rounded-none bg-transparent p-0";
const TAB_TRIGGER =
  "rounded-[40px] px-3 py-2 text-sm text-[#9db2ce] data-[state=active]:bg-[#1d2939] data-[state=active]:text-white data-[state=active]:shadow-none";

// Figma 15235:33194 — the "Period:" row, HFT only. Same pill as the view tabs one size down:
// 12px text, 12px gaps, active = Neutral/Black 800.
//
// NOT WIRED TO DATA, deliberately. In-sample / out-of-sample exists nowhere in the HFT API — no
// query param on /summary, /equity-curve, /cost-curve or /trades, and no split marker on Run or
// RunManifest (only `backtest_range` start→end). So the selection is held here and read by
// nothing; All/IS/OS all describe the whole run until the backend can split it. Inventing a
// client-side split ratio would put a number on screen that no backtest produced.
const PERIODS = ["All", "IS", "OS"] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_TAB_LIST = "gap-3 rounded-none bg-transparent p-0";
const PERIOD_TAB_TRIGGER =
  "rounded-[40px] px-3 py-1 text-xs font-normal leading-[18px] text-[#9db2ce] data-[state=active]:bg-[#1d2939] data-[state=active]:text-white data-[state=active]:shadow-none";

// A failed run wrote no artifacts worth charting — the engine died before or during it — so the
// six views below would render an all-"—" shell that never says why. Replace them with the reason
// the API recorded (`Run.error`), the same failure the run-history picker badges "Failed".
function RunFailedScreen({ reason }: { reason?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-6 px-4 py-20 text-center">
      <div
        className="flex size-[104px] items-center justify-center rounded-[28px] bg-[#0a0d12]"
        style={{ boxShadow: "0 0 60px 8px rgba(255,19,91,0.45)" }}
      >
        <Danger weight="Outline" className="size-12 text-[#ff135b]" />
      </div>
      <h3 className="text-3xl font-bold text-white">Simulation Failed</h3>
      {/* The gradient is clipped to the glyphs, so it can't share an element with the tint. */}
      <p className="max-w-2xl rounded-xl bg-[rgba(255,19,91,0.08)] px-6 py-4 text-base font-medium break-words whitespace-pre-wrap">
        <span className="bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent">
          {reason?.trim() || "The API recorded no reason."}
        </span>
      </p>
    </div>
  );
}

/**
 * Which Results screen a strategy gets. The two are separate components rather than one with
 * branches: the MFT engine reports bar-level results with no orderbook, no fill latency and no
 * per-tick attribution, so its views diverge from the HFT set rather than subsetting it — and
 * HFT-only chrome (the Period row below) has no meaning on the MFT side.
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
  if (variant === "mft") return <MftResultsView strategyId={strategyId} />;
  return <HftResultsTab strategyId={strategyId} focusRun={focusRun} />;
}

function HftResultsTab({
  strategyId,
  focusRun,
}: {
  strategyId?: string;
  focusRun?: Run;
}) {
  const [view, setView] = useState<string>("Overview");
  const [period, setPeriod] = useState<Period>("All");
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

      <div className="flex items-center gap-3">
        <span className="text-xs leading-[18px] font-medium text-white">Period:</span>
        <Tabs value={period} onValueChange={(v) => v && setPeriod(v as Period)}>
          <TabsList className={PERIOD_TAB_LIST}>
            {PERIODS.map((p) => (
              <TabsTrigger key={p} value={p} className={PERIOD_TAB_TRIGGER}>
                {p}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

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
            {view === "Overview" && <OverviewView runId={selectedRun?.id} summaryEnabled={isBacktest && !isLive} isLive={isLive} />}
            {view === "Performance" && <PerformanceView runId={selectedRun?.id} summaryEnabled={isBacktest && !isLive} isLive={isLive} />}
            {view === "Risk" && <RiskView runId={selectedRun?.id} isLive={isLive} />}
            {view === "Execution" && <ExecutionView runId={selectedRun?.id} isLive={isLive} />}
            {view === "Cost & Capacity" && <CostCapacityView runId={selectedRun?.id} summaryEnabled={isBacktest && !isLive} isLive={isLive} />}
            {view === "Latency" && <LatencyView isLive={isLive} />}
          </div>
        </LiveSnapshotProvider>
      )}
    </div>
  );
}
