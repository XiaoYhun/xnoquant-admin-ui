// Pure rule behind the "Period: All | IS | OS" row (Figma 15235:33194) — see
// app/(dashboard)/create-strategy/sample-period-row.tsx for the row itself. Kept in its own
// plain module (no "use client", no React) rather than inline in that file: the row imports
// `useAuth`, which initializes Firebase at import time — pulling that into a unit test for this
// rule alone fails with `auth/invalid-api-key` outside a configured runtime.
import type { RunMode, SampleScope } from "@/types/domain";

export const PERIODS = ["All", "IS", "OS"] as const;
export type Period = (typeof PERIODS)[number];

// "All" has to send `all` explicitly — the API's own default is `in_sample`, so omitting the
// param would quietly narrow the one selection that asks for the whole range.
const SAMPLE_OF: Record<Period, SampleScope> = {
  All: "all",
  IS: "in_sample",
  OS: "out_of_sample",
};

/**
 * In-sample / out-of-sample is a backtest-only idea — the engine computes `oos_start_date` at
 * launch and leaves it null for paper/live — so the row belongs to backtest runs and is not
 * rendered at all for the others. Within a backtest, IS/OS still only describe different data when
 * the split is actually readable: a run launched before the field existed carries no split, and a
 * non-admin caller is forced to `in_sample` server-side whatever the client sends. Those two keep
 * the row but disable IS/OS and pin the selection to All, so it never promises a split the response
 * won't carry.
 */
export function resolveSamplePeriod(params: {
  mode: RunMode | undefined;
  oosStartDate: string | null | undefined;
  isAdmin: boolean;
  period: Period;
}): { isBacktest: boolean; splitAvailable: boolean; sample: SampleScope | undefined; periodHint: string | undefined } {
  const { mode, oosStartDate, isAdmin, period } = params;
  const isBacktest = mode === "backtest";
  const splitAvailable = isBacktest && isAdmin && oosStartDate != null;
  const effectivePeriod: Period = splitAvailable ? period : "All";
  // Undefined outside a backtest, or on a backtest whose split isn't readable — the result hooks
  // treat `undefined` as "let the server apply its own default".
  const sample = splitAvailable ? SAMPLE_OF[effectivePeriod] : undefined;
  const periodHint = splitAvailable
    ? undefined
    : isAdmin
      ? "This run has no in-sample / out-of-sample split."
      : "Out-of-sample results are admin-only.";
  return { isBacktest, splitAvailable, sample, periodHint };
}
