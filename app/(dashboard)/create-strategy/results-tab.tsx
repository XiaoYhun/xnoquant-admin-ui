"use client";
// Create Strategy "Results" tab shell — Figma 14876:146505. One row: pill view-tabs on the left,
// the run-history picker on the right. The old "Period:" row (Train/Test/Simulate/Paper Trade) is
// gone from the design. Each view lives in its own file. Everything here stays width-responsive:
// min-w-0 so the panel never forces horizontal overflow.
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewView } from "./overview-view";
import { PerformanceView } from "./performance-view";
import { RiskView } from "./risk-view";
import { ExecutionView } from "./execution-view";
import { CostCapacityView } from "./cost-capacity-view";
import { LatencyView } from "./latency-view";
import { MftResultsView } from "./mft-results-view";
import { RunHistoryPicker } from "./run-history-picker";
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
}: {
  variant?: "mft" | "hft";
  strategyId?: string;
}) {
  const [view, setView] = useState<string>("Overview");
  // Which run the views describe. Undefined = the picker's default (the newest run).
  const [selectedRun, setSelectedRun] = useState<Run | undefined>(undefined);

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

      <div className="min-w-0">
        {view === "Overview" && <OverviewView runId={selectedRun?.id} />}
        {view === "Performance" && <PerformanceView />}
        {view === "Risk" && (
          <RiskView runId={selectedRun?.id} isLive={selectedRun?.status === "running"} />
        )}
        {view === "Execution" && (
          <ExecutionView runId={selectedRun?.id} isLive={selectedRun?.status === "running"} />
        )}
        {view === "Cost & Capacity" && <CostCapacityView runId={selectedRun?.id} />}
        {view === "Latency" && <LatencyView />}
      </div>
    </div>
  );
}
