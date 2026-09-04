"use client";
// MFT Results → "Cost & Edge" (Figma 15212:62900). Cost panel, the cost-breakdown donut, the
// cumulative cost/gross curve and the gross-to-net waterfall.
//
// MFT reports ONE fee figure for the whole run (`analysis.total_fee`). That is enough for the
// panel and for the waterfall's two endpoints, but not for the commission/tax/slippage split the
// donut and the middle waterfall rows are drawn around.
import { ChartState } from "@/components/charts/chart-state";
import { cn, formatAmount } from "@/lib/utils";
import type { PeriodSelection } from "@/lib/transform/mft-results";
import { useStrategyPerformance } from "@/hooks/api/use-strategy-performance";
import {
  ChartCard,
  EMPTY,
  GREEN_TEXT,
  MetricPanel,
  NoSourceNote,
  RED_TEXT,
  pctFromRatio,
  toneBySign,
  type Metric,
} from "./results-chrome";

interface WaterfallRow {
  label: string;
  /** Ratio (0.42 = +42%), or undefined when the MFT engine cannot decompose this step. */
  value?: number;
  /** Small note under the value, e.g. "15.4% of gross". */
  note?: string;
  /** Endpoints are full-width totals; the steps between them are deductions. */
  kind: "total" | "step";
}

function Waterfall({ rows }: { rows: WaterfallRow[] }) {
  const span = Math.max(0, ...rows.map((r) => Math.abs(r.value ?? 0)));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {rows.map((r) => {
        const width = r.value == null || span <= 0 ? 0 : (Math.abs(r.value) / span) * 100;
        const positive = (r.value ?? 0) >= 0;
        return (
          <div key={r.label} className="flex min-w-0 items-center gap-3">
            <span className="w-[110px] shrink-0 truncate text-xs leading-[18px] text-[#9db2ce]">
              {r.label}
            </span>
            <div className="h-6 min-w-0 flex-1 overflow-hidden rounded bg-[#151a24]">
              {r.value != null && (
                <div
                  className={cn(
                    "h-full rounded",
                    r.kind === "total"
                      ? "bg-[#67e1c1]"
                      : positive
                        ? "bg-[#67e1c1]"
                        : "bg-[#ff135b]",
                  )}
                  // A real but tiny deduction still gets a visible sliver.
                  style={{ width: `${Math.max(width, r.value === 0 ? 0 : 1.5)}%` }}
                />
              )}
            </div>
            <div className="flex w-[104px] shrink-0 flex-col items-end">
              <span
                className={cn(
                  "text-xs leading-[18px] whitespace-nowrap",
                  r.value == null ? "text-[#9db2ce]" : r.kind === "total" ? GREEN_TEXT : toneBySign(r.value),
                )}
              >
                {r.value == null ? EMPTY : pctFromRatio(r.value)}
              </span>
              {r.note && (
                <span className="text-[10px] leading-[14px] text-[#9db2ce]">{r.note}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CostEdgeMft({
  strategyId,
  stage,
}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
}) {
  const { data: perf } = useStrategyPerformance(strategyId, stage);
  const p = perf?.performance;
  const a = perf?.analysis;

  const net = p?.cumulative_return;
  const cost = a?.total_fee;
  const gross = net != null && cost != null ? net + cost : undefined;
  const trades = a?.total_trades;

  const rows: Metric[][] = [
    [
      { label: "Gross PnL", value: pctFromRatio(gross), tone: toneBySign(gross) },
      { label: "Net PnL", value: pctFromRatio(net), tone: toneBySign(net) },
      {
        label: "Total Cost",
        value: cost == null ? EMPTY : pctFromRatio(-Math.abs(cost)),
        tone: cost == null ? undefined : RED_TEXT,
      },
      {
        label: "Cost Drag",
        value: gross ? pctFromRatio(-Math.abs((cost ?? 0) / gross)) : EMPTY,
        tone: gross ? RED_TEXT : undefined,
        sub: gross ? "cost ÷ gross" : undefined,
      },
    ],
    [
      {
        label: "Fee % of Profit",
        value: net && cost != null ? pctFromRatio(Math.abs(cost / net)) : EMPTY,
        sub: net && cost != null ? "cost ÷ net PnL" : undefined,
      },
      {
        // Basis points, as the design shows: a per-trade slice of a run-level fee is far below
        // 0.01%, so a percentage rounds every strategy to "0.00%".
        label: "Fee per Trade",
        value: cost != null && trades ? `${formatAmount((cost / trades) * 10_000, 2)} bp` : EMPTY,
      },
      // Both are tick-denominated, and the MFT engine has no notion of an instrument tick.
      { label: "Profit/Tick Ratio", value: EMPTY },
      { label: "After-Fee Buffer", value: EMPTY },
    ],
  ];

  const waterfall: WaterfallRow[] = [
    { label: "Gross PnL", value: gross, kind: "total" },
    { label: "− Commission", kind: "step" },
    { label: "− Tax", kind: "step" },
    { label: "− Slippage", kind: "step" },
    { label: "Net PnL", value: net, kind: "total" },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricPanel rows={rows} />

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Cost Breakdown">
          <ChartState
            status="empty"
            detail="MFT reports one combined fee for the run, so commission, tax and slippage cannot be split apart."
          />
        </ChartCard>

        <ChartCard title="Cumulative cost & Gross PnL">
          <ChartState
            status="empty"
            detail="Charting cost against gross PnL needs a per-period cost series; only a run-level fee total is returned."
          />
        </ChartCard>
      </div>

      <ChartCard title="Gross to Net">
        <div className="flex min-w-0 flex-col gap-4">
          <Waterfall rows={waterfall} />
          <div className="flex flex-col items-center gap-2">
            <span className="rounded-[40px] border border-[#1d2939] bg-[#0a0e14] px-3 py-1 text-[11px] leading-[16px] text-[#9db2ce]">
              Σ Net = Gross − Commission − Tax − Slippage
            </span>
            <NoSourceNote>
              {cost == null
                ? "No fee total for this stage yet."
                : `MFT reports a single combined cost of ${pctFromRatio(Math.abs(cost))} for this stage, not the per-component split the middle three rows show.`}
            </NoSourceNote>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
