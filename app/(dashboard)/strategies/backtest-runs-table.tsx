"use client";
import { useState } from "react";
import { Stop, TrashBinMinimalistic } from "@solar-icons/react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkline } from "@/components/charts/sparkline";
import { formatPercent } from "@/lib/utils";
import { resourceErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { canMutate, isShared } from "@/lib/rbac";
import { useStopRun, useDeleteRun } from "@/hooks/api/use-backtest-runs";
import { useConsoleLog } from "@/store/console-log-store";
import type { PaperRunRow } from "@/lib/mock/paper-runs";

const GRAD_GREEN = "bg-[linear-gradient(162deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

const STATUS_CLASS: Record<string, string> = {
  running: GRAD_GREEN,
  completed: GRAD_GREEN,
  paused: "text-[#f1c617]",
  pending: "text-[#9db2ce]",
  stopped: "text-[#9db2ce]",
  failed: GRAD_RED,
};

// `POST /api/runs/{id}/stop` returns 422 for a run that isn't in a stoppable state — only offer it
// for the states the engine can actually halt.
const STOPPABLE = new Set(["running", "paused", "pending"]);

const COLS = [
  { key: "id", label: "ID", w: "10%", align: "left" },
  { key: "name", label: "Strategy Name", w: "18%", align: "left" },
  { key: "status", label: "Status", w: "9%", align: "left" },
  { key: "owner", label: "Owner", w: "9%", align: "left" },
  { key: "symbol", label: "Symbol/Market", w: "14%", align: "left" },
  { key: "pnl", label: "PnL chart", w: "11%", align: "left" },
  { key: "return", label: "Return", w: "8%", align: "right" },
  { key: "sharpe", label: "Sharpe", w: "6%", align: "right" },
  { key: "mdd", label: "Max drawdown", w: "8%", align: "right" },
  { key: "action", label: "Action", w: "7%", align: "right" },
] as const;

export function BacktestRunsTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: PaperRunRow[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const { userId, isAdmin } = useAuth();
  const [pendingDelete, setPendingDelete] = useState<PaperRunRow | null>(null);
  const stopRun = useStopRun();
  const deleteRun = useDeleteRun();
  const addLog = useConsoleLog((s) => s.addLog);

  const handleStop = async (r: PaperRunRow) => {
    try {
      await stopRun.mutateAsync(r.id);
      addLog("success", `Stopped "${r.strategyName}"`);
    } catch (err) {
      addLog("error", `Stop failed: ${resourceErrorMessage(err, "this run")}`);
    }
  };

  const handleDelete = async (r: PaperRunRow) => {
    try {
      await deleteRun.mutateAsync(r.id);
      addLog("success", `Deleted "${r.strategyName}"`);
    } catch (err) {
      addLog("error", `Delete failed: ${resourceErrorMessage(err, "this run")}`);
    }
  };

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
            // Stop and Delete are both owner-or-admin: lab visibility lets a researcher SEE a
            // lab-mate's backtest but every mutation 404s, so hide the controls entirely.
            const writable = canMutate(r, { userId, isAdmin });
            return (
              <TableRow
                key={r.id}
                data-state={r.id === selectedId ? "selected" : undefined}
                onClick={() => onSelect(r.id)}
                className="cursor-pointer"
              >
                <TableCell className="truncate text-sm text-white">{r.id}</TableCell>
                <TableCell className="flex items-center text-sm font-semibold text-white">
                  <span className="truncate" title={r.strategyName}>{r.strategyName}</span>
                  {isShared(r, userId) && (
                    <span className="ml-2 inline-flex shrink-0 items-center rounded-[20px] border border-[#1d2939] bg-[#151a24] px-2 py-0.5 text-[10px] font-normal text-[#9db2ce]">
                      Shared
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`text-xs ${STATUS_CLASS[r.status] ?? "text-white"}`}>{r.status}</span>
                </TableCell>
                <TableCell className="truncate text-xs text-white" title={r.owner ?? undefined}>
                  {r.owner ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="truncate text-xs">
                  {r.symbols.length ? (
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-white">{r.symbols[0].symbol}</span>
                      <span className="text-[#9db2ce]">|</span>
                      <span className={GRAD_GREEN}>{r.symbols[0].market}</span>
                      {r.symbols.length > 1 && (
                        <span className="text-muted-foreground">+{r.symbols.length - 1}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
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
                    <span className={r.returnPct >= 0 ? GRAD_GREEN : GRAD_RED}>{formatPercent(r.returnPct)}</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs text-white">
                  {r.sharpe == null ? <span className="text-muted-foreground">—</span> : r.sharpe.toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {r.maxDrawdownPct == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className={GRAD_RED}>{formatPercent(r.maxDrawdownPct)}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!writable ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      {STOPPABLE.has(r.status) && (
                        <button
                          type="button"
                          aria-label={`Stop ${r.strategyName}`}
                          disabled={stopRun.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStop(r);
                          }}
                          className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-surface p-2 text-[#9db2ce] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Stop weight="Bold" className="size-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Delete ${r.strategyName}`}
                        disabled={deleteRun.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete(r);
                        }}
                        className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-surface p-2 text-[#9db2ce] transition-colors hover:text-[#ff135b] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <TrashBinMinimalistic weight="Bold" className="size-4" />
                      </button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete backtest run</DialogTitle>
            <DialogDescription>
              Delete the run for &ldquo;{pendingDelete?.strategyName}&rdquo;? Its results are removed permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) handleDelete(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
