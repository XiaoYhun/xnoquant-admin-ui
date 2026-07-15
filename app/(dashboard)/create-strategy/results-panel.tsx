"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ResultsTab } from "./results-tab";
import { SamplesTab } from "./samples-tab";
import { FeaturesTab } from "./features-tab";
import { DataTab } from "./data-tab";
import { OperatorsTab } from "./operators-tab";
import { HftSamplesTab } from "./hft-samples-tab";
import { HftFeaturesTab } from "./hft-features-tab";

// Right-panel underline tabs (Figma 14180:15378). The HFT lab shows a reduced set with its own
// Samples/Features designs (Figma 14562-20367 / 14567-26137); MFT keeps the full catalog set.
const MFT_TABS = ["Samples", "Results", "Data", "Features", "Operators"] as const;
const HFT_TABS = ["Samples", "Features", "Results"] as const;
export type ResultsPanelTab = (typeof MFT_TABS)[number];

export function ResultsPanel({
  onUseTemplate,
  variant = "hft",
  strategyId,
  tab: controlledTab,
  onTabChange,
}: {
  onUseTemplate?: (code: string) => void;
  variant?: "mft" | "hft";
  strategyId?: string;
  tab?: ResultsPanelTab;
  onTabChange?: (tab: ResultsPanelTab) => void;
}) {
  const [internalTab, setInternalTab] = useState<ResultsPanelTab>("Results");
  const tab = controlledTab ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;
  const tabs: readonly ResultsPanelTab[] = variant === "hft" ? HFT_TABS : MFT_TABS;
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-11 shrink-0 items-stretch overflow-x-auto border-b border-border">
        {tabs.map((t) => {
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
        {tab === "Samples" &&
          (variant === "hft" ? <HftSamplesTab onUseTemplate={onUseTemplate} /> : <SamplesTab onUseTemplate={onUseTemplate} />)}
        {tab === "Results" && <ResultsTab variant={variant} strategyId={strategyId} />}
        {tab === "Features" && (variant === "hft" ? <HftFeaturesTab strategyId={strategyId} /> : <FeaturesTab />)}
        {tab === "Data" && variant === "mft" && <DataTab />}
        {tab === "Operators" && variant === "mft" && <OperatorsTab />}
      </div>
    </div>
  );
}
