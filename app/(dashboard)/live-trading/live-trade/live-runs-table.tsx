"use client";
import { useState, type ReactNode } from "react";
import { Pause, CloseCircle } from "@solar-icons/react";
import { resourceErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { canMutate, isShared } from "@/lib/rbac";
import { RunStatusPill } from "@/components/run-status-pill";
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
import { cn, formatPercent, shortRunId } from "@/lib/utils";
import { useStopRun } from "@/hooks/api/use-runs";
import { useDemoteStrategy } from "@/hooks/api/use-live-basket";
import type { PaperRunRow } from "@/lib/mock/paper-runs";

// Gradient text tokens straight from the Figma design (green / yellow / red).
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
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
            "flex min-h-[40px] min-w-0 items-center px-4",
            items.length > 1 && "bg-surface",
          )}
        >
          {node}
        </div>
      ))}
    </div>
  );
}

const COLS = [
  { key: "status", label: "Status", w: "8%", align: "left" },
  { key: "id", label: "ID", w: "8%", align: "left" },
  { key: "name", label: "Strategy Name", w: "15%", align: "left" },
  { key: "owner", label: "Owner", w: "7%", align: "left" },
  { key: "account", label: "Account", w: "10%", align: "left" },
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
  rows: PaperRunRow[];
  onOpenDetail: (run: PaperRunRow) => void;
}) {
  const stopRun = useStopRun();
  const demoteStrategy = useDemoteStrategy();
  const { userId, isAdmin } = useAuth();
  const [pendingStop, setPendingStop] = useState<PaperRunRow | null>(null);
  const [pendingDemote, setPendingDemote] = useState<PaperRunRow | null>(null);

  return (
    <>
      <Table className="table-fixed min-w-[1600px]">
        <TableHeader>
          <TableRow>
            {COLS.map((c, i) => (
              <TableHead
                key={c.key}
                style={{ width: c.w }}
                sticky={i === 0 ? "left" : i === COLS.length - 1 ? "right" : undefined}
                className={c.align === "right" ? "text-right" : undefined}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            return (
              <TableRow opaque key={r.id} className="cursor-pointer" onClick={() => onOpenDetail(r)}>
                <TableCell sticky="left">
                  <RunStatusPill status={r.status} showDot />
                </TableCell>
                <TableCell className="truncate text-sm text-white" title={r.id}>
                  {shortRunId(r.id)}
                </TableCell>
                {/* Keep the cell a table-cell so it inherits `align-middle` — a `flex` class here
                    would override display and top-align the name on the taller two-band rows. */}
                <TableCell className="text-sm font-semibold text-white">
                  <span className="flex min-w-0 items-center">
                    <span className="truncate" title={r.strategyName}>{r.strategyName}</span>
                    {/* RBAC plan: a lab-mate's live run is a read-only share, not owned by the caller. */}
                    {isShared(r, userId) && (
                      <span className="ml-2 inline-flex shrink-0 items-center rounded-[20px] border border-[#1d2939] bg-[#151a24] px-2 py-0.5 text-[10px] font-normal text-[#9db2ce]">
                        Shared
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="truncate text-xs text-white" title={r.owner ?? undefined}>
                  {r.owner ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="overflow-hidden p-0 align-middle">
                  <MiniRows
                    items={r.accounts.map((a) => (
                      <span key={a} title={a} className={cn(PILL, "min-w-0 max-w-full")}>
                        <span className="truncate">{a}</span>
                      </span>
                    ))}
                  />
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
                <TableCell sticky="right" className="text-right">
                  {/* Hide write controls for runs the caller can't mutate (e.g. a lab-mate's run). */}
                  {/* Design 14773:24424: a running bot can be stopped; anything already halted can be
                      demoted out of the live basket. Demote is admin-only (DELETE /api/live-basket). */}
                  {!canMutate(r, { userId, isAdmin }) ? null : r.status === "running" ? (
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
                  ) : isAdmin ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDemote(r);
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-[20px] border border-[#ff135b]/40 bg-[#ff135b]/10 px-2 py-1 text-xs text-[#ff135b] transition-colors hover:bg-[#ff135b]/20"
                    >
                      <CloseCircle weight="Bold" className="size-4" />
                      Demote
                    </button>
                  ) : null}
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
            <p className="text-xs text-destructive">{resourceErrorMessage(stopRun.error, "this run")}</p>
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

      <Dialog
        open={!!pendingDemote}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDemote(null);
            demoteStrategy.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demote to paper trading</DialogTitle>
            <DialogDescription>
              Remove &ldquo;{pendingDemote?.strategyName}&rdquo; from the live basket. It goes back to paper trading
              only — no new live runs can be launched until an admin promotes it again.
            </DialogDescription>
          </DialogHeader>
          {demoteStrategy.isError && (
            <p className="text-xs text-destructive">
              {resourceErrorMessage(demoteStrategy.error, "the live basket")}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={demoteStrategy.isPending}
              onClick={() => {
                if (pendingDemote?.strategyId) {
                  demoteStrategy.mutate(pendingDemote.strategyId, { onSuccess: () => setPendingDemote(null) });
                }
              }}
            >
              {demoteStrategy.isPending ? "Demoting…" : "Demote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
