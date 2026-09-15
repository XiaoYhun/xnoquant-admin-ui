"use client";
// The "Period: All | IS | OS" row (Figma 15235:33194) — wired to `?sample=` on every run-result
// endpoint (SampleScope in types/domain.ts). Shared by all four Results surfaces this pass touches
// (Create Strategy's HFT and MFT branches in results-tab.tsx, Paper Trading's backtest and live
// Charts tabs in run-detail-panel.tsx) so the rule and the row's look stay identical instead of
// drifting between four hand-copies — this used to live only on the HFT path.
//
// The backtest/admin/split rule itself is `resolveSamplePeriod` in lib/sample-period.ts, not here:
// this file pulls in `useAuth`, which initializes Firebase at import time, so keeping the rule out
// of it is what lets it be unit-tested on its own.
import { useState } from "react";
import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { PERIODS, resolveSamplePeriod, type Period } from "@/lib/sample-period";
import type { Run, SampleScope } from "@/types/domain";

const PERIOD_TAB_LIST = "gap-3 rounded-none bg-transparent p-0";
const PERIOD_TAB_TRIGGER =
  "rounded-[40px] px-3 py-1 text-xs font-normal leading-[18px] text-[#9db2ce] data-[state=active]:bg-[#1d2939] data-[state=active]:text-white data-[state=active]:shadow-none";

/**
 * Takes the `Run` record itself rather than an id: three of the four call sites already have one
 * in hand (the run-history picker's selection, or a `useRun` already fetched for another reason),
 * and fetching a fourth copy here would be a second request for the same row on those three.
 */
export function useSamplePeriodRow(run: Run | undefined): {
  row: ReactNode;
  sample: SampleScope | undefined;
  isBacktest: boolean;
} {
  const [period, setPeriod] = useState<Period>("All");
  const { isAdmin } = useAuth();
  const { isBacktest, splitAvailable, sample, periodHint } = resolveSamplePeriod({
    mode: run?.mode,
    oosStartDate: run?.manifest?.oos_start_date,
    isAdmin,
    period,
  });
  const effectivePeriod: Period = splitAvailable ? period : "All";

  const row = isBacktest ? (
    <div className="flex items-center gap-3" title={periodHint}>
      <span className="text-xs leading-[18px] font-medium text-white">Period:</span>
      <Tabs value={effectivePeriod} onValueChange={(v) => v && setPeriod(v as Period)}>
        <TabsList className={PERIOD_TAB_LIST}>
          {PERIODS.map((p) => (
            <TabsTrigger key={p} value={p} disabled={!splitAvailable && p !== "All"} className={PERIOD_TAB_TRIGGER}>
              {p}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  ) : null;

  return { row, sample, isBacktest };
}
