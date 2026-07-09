"use client";
// Create Strategy "Results" tab shell — Period sub-tabs + Overview/Performance/Risk views.
// Each view lives in its own file (owned by a subagent). Everything here stays width-responsive:
// min-w-0 so the panel never forces horizontal overflow.
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewView } from "./overview-view";
import { PerformanceView } from "./performance-view";
import { RiskView } from "./risk-view";
import { MftResultsView } from "./mft-results-view";

const PERIODS = ["Train", "Test", "Simulate", "Paper Trade"] as const;
const VIEWS = ["Overview", "Performance", "Risk"] as const;

export function ResultsTab({
  variant = "hft",
  strategyId,
}: {
  variant?: "mft" | "hft";
  strategyId?: string;
}) {
  const [period, setPeriod] = useState<string>("Train");
  const [view, setView] = useState<string>("Overview");

  if (variant === "mft") return <MftResultsView strategyId={strategyId} />;

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-sm font-medium text-white">Period:</span>
        <Tabs value={period} onValueChange={(v) => v && setPeriod(v)}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p} value={p}>
                {p}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={view} onValueChange={(v) => v && setView(v)}>
        <TabsList>
          {VIEWS.map((v) => (
            <TabsTrigger key={v} value={v}>
              {v}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="min-w-0">
        {view === "Overview" && <OverviewView />}
        {view === "Performance" && <PerformanceView />}
        {view === "Risk" && <RiskView />}
      </div>
    </div>
  );
}
