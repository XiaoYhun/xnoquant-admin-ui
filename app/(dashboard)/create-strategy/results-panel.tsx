"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ResultsTab } from "./results-tab";
import { SamplesTab } from "./samples-tab";
import { FeaturesTab } from "./features-tab";
import { DataTab } from "./data-tab";
import { OperatorsTab } from "./operators-tab";

// Right-panel underline tabs (Figma 14180:15378). Each tab's content lives in its own
// component file (owned by a subagent).
const TABS = ["Samples", "Results", "Data", "Features", "Operators"] as const;
type Tab = (typeof TABS)[number];

export function ResultsPanel({
  onUseTemplate,
  variant = "hft",
  strategyId,
}: {
  onUseTemplate?: (code: string) => void;
  variant?: "mft" | "hft";
  strategyId?: string;
}) {
  const [tab, setTab] = useState<Tab>("Results");
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-11 shrink-0 items-stretch overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const on = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "relative flex flex-[1_0_auto] cursor-pointer items-center justify-center px-3 text-sm whitespace-nowrap transition-colors",
                on ? "font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn(on && "bg-[linear-gradient(163deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent")}>
                {t}
              </span>
              {on && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[linear-gradient(163deg,#cff8ea_0%,#67e1c1_100%)]" />
              )}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
        {tab === "Samples" && <SamplesTab onUseTemplate={onUseTemplate} />}
        {tab === "Results" && <ResultsTab variant={variant} strategyId={strategyId} />}
        {tab === "Data" && <DataTab />}
        {tab === "Features" && <FeaturesTab />}
        {tab === "Operators" && <OperatorsTab />}
      </div>
    </div>
  );
}
