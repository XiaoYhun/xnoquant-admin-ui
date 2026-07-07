"use client";
import { useState } from "react";
import { Eye, PlaybackSpeed } from "@solar-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPercent } from "@/lib/utils";
import type { StrategyRow, StrategyStatus } from "@/lib/mock/strategies";
import { StartPaperTradingDialog } from "./start-paper-trading-dialog";

// Gradient text tokens from the Figma design — the design colours every status/value this way.
const GRAD_GREEN = "bg-[linear-gradient(162deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_YELLOW = "bg-[linear-gradient(162deg,#fffbd6_0%,#f1c617_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

const STATUS_META: Record<StrategyStatus, { label: string; dot: string; text: string }> = {
  published: { label: "Published", dot: "#67e1c1", text: GRAD_GREEN },
  in_sample: { label: "In sample", dot: "#f1c617", text: GRAD_YELLOW },
  completed: { label: "Completed", dot: "#9db2ce", text: "text-[#9db2ce]" },
};

const COLS = [
  { key: "name", label: "Strategy Name", w: "16%", align: "left" },
  { key: "status", label: "Status", w: "12%", align: "left" },
  { key: "market", label: "Market", w: "11%", align: "right" },
  { key: "universe", label: "Universe", w: "11%", align: "right" },
  { key: "return", label: "Return", w: "11%", align: "right" },
  { key: "sharpe", label: "Sharpe", w: "10%", align: "right" },
  { key: "mdd", label: "Max drawdown", w: "11%", align: "right" },
  { key: "liveperf", label: "Live Perf", w: "10%", align: "left" },
  { key: "sendto", label: "Send to", w: "8%", align: "right" },
] as const;

export function StrategiesTable({ rows }: { rows: StrategyRow[] }) {
  const [sendTo, setSendTo] = useState<StrategyRow | null>(null);

  return (
    <>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            {COLS.map((c) => (
              <TableHead key={c.key} style={{ width: c.w }} className={c.align === "right" ? "text-right" : undefined}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const s = STATUS_META[r.status];
            return (
              <TableRow key={r.id}>
                <TableCell className="truncate text-sm font-semibold text-white" title={r.name}>
                  {r.name}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-2 whitespace-nowrap text-xs">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.dot }} />
                      <span className={s.text}>{s.label}</span>
                    </span>
                    <span className="text-xs text-[#9db2ce]">{r.statusUpdatedAt}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs text-white">{r.market}</TableCell>
                <TableCell className="text-right text-xs text-white">{r.universe}</TableCell>
                <TableCell className="text-right text-xs">
                  <span className={r.returnPct >= 0 ? GRAD_GREEN : GRAD_RED}>{formatPercent(r.returnPct)}</span>
                </TableCell>
                <TableCell className="text-right text-xs text-white">{r.sharpe.toFixed(2)}</TableCell>
                <TableCell className="text-right text-xs">
                  <span className={GRAD_RED}>{formatPercent(r.maxDrawdownPct)}</span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 rounded-[20px] bg-[rgba(103,225,193,0.1)] px-2 py-1 text-xs">
                    <Eye weight="Outline" className="size-4 text-primary" />
                    <span className={GRAD_GREEN}>View Live</span>
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    onClick={() => setSendTo(r)}
                    aria-label={`Send ${r.name} to paper trading`}
                    className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#151a24] p-2 text-primary transition-colors hover:bg-secondary"
                  >
                    <PlaybackSpeed weight="Bold" className="size-5" />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <StartPaperTradingDialog strategy={sendTo} onOpenChange={(open) => !open && setSendTo(null)} />
    </>
  );
}
