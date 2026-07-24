"use client";
import { useState, type ReactNode } from "react";
import { Pause, Play } from "@solar-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/charts/sparkline";
import { FlashValue } from "@/components/ui/flash-value";
import { cn, formatPercent } from "@/lib/utils";
import { useStopRun } from "@/hooks/api/use-runs";
import type { RunStatus } from "@/types/domain";
import type { LiveRunRow } from "@/lib/mock/live-runs";

// Gradient text tokens straight from the Figma design (green / yellow / red).
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_YELLOW = "bg-[linear-gradient(162deg,#fffbd6_0%,#f1c617_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

// Glassy pill (Account + TF): white/25 border, translucent dark fill, faint green inner glow.
const PILL =
  "inline-flex h-7 items-center rounded-[40px] border border-white/25 bg-[rgba(14,20,42,0.5)] px-3 text-xs font-medium text-white shadow-[inset_0_0_8px_0_rgba(63,216,189,0.15)] backdrop-blur-[2px]";

// Stacks paired "mini-rows" (account[i] ↔ symbol[i]); the 2nd band gets a subtle tint so
// the pairs read as distinct rows and stay aligned across the Account and Symbol columns.
function MiniRows({ items }: { items: ReactNode[] }) {
  return (
    <div className="flex flex-col">
      {items.map((node, i) => (
        <div
          key={i}
          className={cn(
            "flex min-h-[40px] items-center px-4",
            items.length > 1 && "bg-surface",
          )}
        >
          {node}
        </div>
      ))}
    </div>
  );
}

// Status pill: tinted background + coloured dot + gradient (or muted) label.
const STATUS_META: Record<RunStatus, { label: string; dot: string; bg: string; text: string }> = {
  running: { label: "Running", dot: "#67e1c1", bg: "rgba(103,225,193,0.1)", text: GRAD_GREEN },
  paused: { label: "Paused", dot: "#f1c617", bg: "rgba(241,198,23,0.1)", text: GRAD_YELLOW },
  failed: { label: "Failed", dot: "#ff135b", bg: "rgba(255,19,91,0.1)", text: GRAD_RED },
  stopped: { label: "Stopped", dot: "#9db2ce", bg: "rgba(157,178,206,0.1)", text: "text-[#9db2ce]" },
  completed: { label: "Completed", dot: "#9db2ce", bg: "rgba(157,178,206,0.1)", text: "text-[#9db2ce]" },
  pending: { label: "Pending", dot: "#9db2ce", bg: "rgba(157,178,206,0.1)", text: "text-[#9db2ce]" },
};

const COLS = [
  { key: "status", label: "Status", w: "8%", align: "left" },
  { key: "id", label: "ID", w: "8%", align: "left" },
  { key: "name", label: "Strategy Name", w: "11%", align: "left" },
  { key: "alpha", label: "Alpha Status", w: "7%", align: "left" },
  { key: "owner", label: "Owner", w: "7%", align: "left" },
  { key: "account", label: "Account", w: "7%", align: "left" },
  { key: "symbols", label: "Symbols/Market", w: "11%", align: "left" },
  { key: "tf", label: "TF", w: "5%", align: "left" },
  { key: "pnl", label: "PnL chart", w: "8%", align: "left" },
  { key: "return", label: "Return", w: "7%", align: "right" },
  { key: "sharpe", label: "Sharpe", w: "5%", align: "right" },
  { key: "mdd", label: "Max drawdown", w: "8%", align: "right" },
  { key: "action", label: "Action", w: "8%", align: "right" },
] as const;

export function LiveRunsTable({
  rows,
  onOpenDetail,
}: {
  rows: LiveRunRow[];
  onOpenDetail: (run: LiveRunRow) => void;
}) {
  const stopRun = useStopRun();
  const [pendingStop, setPendingStop] = useState<LiveRunRow | null>(null);

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
              <TableRow key={r.id} className="cursor-pointer" onClick={() => onOpenDetail(r)}>
                <TableCell>
                  <span
                    className="inline-flex items-center gap-2 rounded-[20px] px-2 py-1 text-xs"
                    style={{ backgroundColor: s.bg }}
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.dot }} />
                    <span className={s.text}>{s.label}</span>
                  </span>
                </TableCell>
                <TableCell className="truncate text-sm text-white">{r.id}</TableCell>
                <TableCell className="truncate text-sm font-semibold text-white" title={r.strategyName}>
                  {r.strategyName}
                </TableCell>
                <TableCell>
                  <span className={`text-xs ${GRAD_YELLOW}`}>{r.alphaStatus}</span>
                </TableCell>
                <TableCell className="truncate text-xs text-white" title={r.owner ?? undefined}>
                  {r.owner ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="p-0 align-middle">
                  <MiniRows items={r.accounts.map((a) => <span key={a} className={PILL}>{a}</span>)} />
                </TableCell>
                <TableCell className="p-0 align-middle">
                  <MiniRows
                    items={r.symbols.map((sym) => (
                      <span key={sym.symbol} className="flex items-center gap-2 whitespace-nowrap text-xs">
                        <span className="text-white">{sym.symbol}</span>
                        <span className="text-[#9db2ce]">|</span>
                        <span className={GRAD_GREEN}>{sym.market}</span>
                      </span>
                    ))}
                  />
                </TableCell>
                <TableCell>
                  <span className={PILL}>{r.timeframe}</span>
                </TableCell>
                <TableCell>
                  {r.pnlSeries.length ? (
                    <Sparkline data={r.pnlSeries} className="h-9 w-full" />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {r.returnPct == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <FlashValue value={r.returnPct}>
                      <span className={r.returnPct >= 0 ? GRAD_GREEN : GRAD_RED}>{formatPercent(r.returnPct)}</span>
                    </FlashValue>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs text-white">
                  {r.sharpe == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <FlashValue value={r.sharpe}>{r.sharpe.toFixed(2)}</FlashValue>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {r.maxDrawdownPct == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <FlashValue value={r.maxDrawdownPct}>
                      <span className={GRAD_RED}>{formatPercent(r.maxDrawdownPct)}</span>
                    </FlashValue>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "running" ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingStop(r);
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-[20px] border border-[#1d2939] bg-[#151a24] px-2 py-1 text-xs text-[#9db2ce] transition-colors hover:text-white"
                    >
                      <Pause weight="Bold" className="size-4" />
                      Stop Bot
                    </button>
                  ) : (
                    // GAP-7: HFT has no start/resume endpoint (only POST /api/runs/{id}/stop) — see
                    // hooks/api/use-runs.ts. Disabled until the backend adds one.
                    <button
                      type="button"
                      disabled
                      title="Start/resume isn't supported by the backend yet"
                      className="inline-flex cursor-not-allowed items-center gap-1 rounded-[20px] border border-[#1d2939] bg-[#151a24] px-2 py-1 text-xs text-primary opacity-50"
                    >
                      <Play weight="Bold" className="size-4" />
                      Start Bot
                    </button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog
        open={!!pendingStop}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStop(null);
            stopRun.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop bot</DialogTitle>
            <DialogDescription>
              Are you sure you want to stop &ldquo;{pendingStop?.strategyName}&rdquo; ({pendingStop?.id})? This will
              halt live trading for this run.
            </DialogDescription>
          </DialogHeader>
          {stopRun.isError && (
            <p className="text-xs text-destructive">Couldn&rsquo;t stop the bot. Please try again.</p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={stopRun.isPending}
              onClick={() => {
                if (pendingStop) {
                  stopRun.mutate(pendingStop.id, { onSuccess: () => setPendingStop(null) });
                }
              }}
            >
              {stopRun.isPending ? "Stopping…" : "Stop Bot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
