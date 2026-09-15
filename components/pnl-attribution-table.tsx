"use client";
// "PnL attribution" table off `GET /api/runs/{id}/symbol-pnl` — shared by HFT Cost & Capacity and
// MFT Cost & Edge, which otherwise draw from two unrelated chrome systems (results-chart-card.tsx
// vs. mft/results-chrome.tsx). Lives here rather than beside either, same reason as
// ResultsKpiGrid: two unrelated callers, so neither owns it. Styled like MFT's own
// "Top 5 drawdown" / "Regime breakdown" tables (a bordered block with its own header, not wrapped
// in either engine's ChartCard) so it drops into both unchanged.
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartState, type ChartStatus } from "@/components/charts/chart-state";
import { cn, currencyDigits, formatSignedAmount } from "@/lib/utils";
import { currencySymbol } from "@/lib/transform/runs";
import type { SymbolPnlSummary } from "@/types/domain";

const GREEN_TEXT = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const RED_TEXT = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

function toneOf(v: number): string {
  return v >= 0 ? GREEN_TEXT : RED_TEXT;
}

export function PnlAttributionTable({
  rows,
  currency,
  status,
  detail,
}: {
  rows: SymbolPnlSummary[];
  currency: string;
  status: ChartStatus;
  detail?: string;
}) {
  const digits = currencyDigits(currency);
  const money = (v: number) => `${formatSignedAmount(v, digits)} ${currencySymbol(currency)}`;
  // Largest net PnL (either direction) first — the row a reader most wants to see.
  const sorted = [...rows].sort((a, b) => Math.abs(b.net_pnl) - Math.abs(a.net_pnl));

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background">
      <div className="border-b border-border bg-surface px-4 py-3">
        <span className="text-sm font-medium text-white">PnL attribution</span>
      </div>
      <div className="min-w-0 p-4">
        <ChartState status={status} detail={detail}>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Signal</TableHead>
                <TableHead className="text-right">Spread capture</TableHead>
                <TableHead className="text-right">Adverse sel.</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">Net PnL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.symbol_id}>
                  <TableCell className="text-white">{r.symbol}</TableCell>
                  <TableCell className={cn("text-right", toneOf(r.signal_pnl))}>{money(r.signal_pnl)}</TableCell>
                  <TableCell className={cn("text-right", toneOf(r.spread_capture))}>
                    {money(r.spread_capture)}
                  </TableCell>
                  <TableCell className={cn("text-right", toneOf(r.adverse_selection))}>
                    {money(r.adverse_selection)}
                  </TableCell>
                  <TableCell className="text-right text-white">{money(-Math.abs(r.total_fee))}</TableCell>
                  <TableCell className={cn("text-right font-semibold", toneOf(r.net_pnl))}>
                    {money(r.net_pnl)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ChartState>
      </div>
    </div>
  );
}
