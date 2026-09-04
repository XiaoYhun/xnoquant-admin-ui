"use client";
// MFT Results → "Regime" (Figma 15212:65719). Regime panel, PnL by session hour, Sharpe by
// volatility regime and the regime breakdown table.
//
// This screen splits results two ways the MFT results API cannot: by INTRADAY session hour, and by
// an ATR volatility bucket. The results series are one sample per trading day with no intraday
// component, and no ATR (or any market data) travels with them — so every panel here is the design
// rendered against an absent source.
import { ChartState } from "@/components/charts/chart-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PeriodSelection } from "@/lib/transform/mft-results";
import { ChartCard, EMPTY, MetricPanel, NoSourceNote, emptyMetrics } from "./results-chrome";

const REGIMES = ["Low (ATR<0.5%)", "Normal (ATR 0.5%-1%)", "High (ATR>1%)"];

export function RegimeMft({}: {
  strategyId?: string;
  stage: string;
  period: PeriodSelection;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetricPanel
        rows={[
          emptyMetrics(["Peak Hour Concentration", "Top-3 Hours", "Low Vol Sharpe", "High Vol Sharpe"]),
        ]}
      />
      <NoSourceNote>
        Regime analysis needs intraday timestamps and a volatility measure alongside the results.
        MFT returns one sample per trading day and no market data, so neither the session-hour split
        nor the ATR buckets can be computed here.
      </NoSourceNote>

      <ChartCard title="PnL by session hour">
        <ChartState
          status="empty"
          detail="The MFT results series carry one point per trading day, with no intraday breakdown."
        />
      </ChartCard>

      <ChartCard title="Sharpe by volatility regime">
        <ChartState
          status="empty"
          detail="Bucketing by ATR needs the underlying market data, which the results API does not return."
        />
      </ChartCard>

      <div className="min-w-0 overflow-hidden rounded-xl border border-[#1d2939] bg-background">
        <div className="border-b border-[#1d2939] bg-[#151a24] px-4 py-2">
          <span className="text-sm leading-5 font-medium text-white">Regime breakdown</span>
        </div>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="h-10">Regime</TableHead>
              <TableHead className="h-10 text-right">Sharpe</TableHead>
              <TableHead className="h-10 text-right">Win rate</TableHead>
              <TableHead className="h-10 text-right">Trades</TableHead>
              <TableHead className="h-10 text-right">% PnL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {REGIMES.map((r) => (
              <TableRow key={r}>
                <TableCell className="py-2 text-xs text-white">{r}</TableCell>
                {[0, 1, 2, 3].map((i) => (
                  <TableCell key={i} className="py-2 text-right text-xs text-[#9db2ce]">
                    {EMPTY}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
