"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { RiskOverviewTab } from "./risk-overview-tab";
import { AlertLogTab } from "./alert-log-tab";

// Risk Management — Figma 14975:41599 (Risk overview) / 14975:44103 (Alert & Action log).
// Both tabs are admin surfaces over `/api/risk/*`; see hooks/api/use-risk.ts for which parts
// degrade for a non-admin rather than erroring.
//
// The tab bar is the design's own segmented style — full-height cells divided by rules, the
// active one lifted onto the surface colour — not the pill `Tabs` used for market/date filters.
const TABS = ["Risk overview", "Alert & Action log"] as const;
type Tab = (typeof TABS)[number];

export default function Page() {
  const [tab, setTab] = useState<Tab>("Risk overview");

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background">
        <div role="tablist" className="flex h-14 shrink-0 items-stretch border-b border-border">
          {TABS.map((t) => {
            const on = tab === t;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t)}
                className={cn(
                  "flex cursor-pointer items-center justify-center border-r border-border px-6 text-sm whitespace-nowrap transition-colors",
                  on
                    ? "bg-background font-semibold text-[#67e1c1]"
                    : "bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            );
          })}
          {/* Fills the rest of the bar with the inactive tabs' backdrop so the active cell reads
              as raised out of it, the way the design draws it. */}
          <div className="min-w-0 flex-1 bg-surface" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          {tab === "Risk overview" ? <RiskOverviewTab /> : <AlertLogTab />}
        </div>
      </div>
    </main>
  );
}
