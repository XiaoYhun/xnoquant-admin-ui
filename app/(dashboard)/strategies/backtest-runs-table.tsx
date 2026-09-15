"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkline } from "@/components/charts/sparkline";
import { PlaybackSpeedIcon } from "@/components/icons/playback-speed";
import { formatAmount, formatPercent } from "@/lib/utils";
import { resourceErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { canMutate, isShared } from "@/lib/rbac";
import { RunStatusPill } from "@/components/run-status-pill";
import { RunId } from "@/components/run-id";
import { StrategyTypeBadge } from "@/components/strategy-type-badge";
import { StartedAt } from "@/components/started-at";
import { useStopRun, useDeleteRun } from "@/hooks/api/use-backtest-runs";
import { useConsoleLog } from "@/store/console-log-store";
import { useHftStrategies } from "@/hooks/api/use-hft-strategies";
import { launchMode } from "@/components/strategy-stage";
import { PromoteStageDialog } from "../create-strategy/promote-stage-dialog";
import { SimulateModal } from "../create-strategy/simulate-modal";
import type { PaperRunRow } from "@/lib/mock/paper-runs";

const GRAD_GREEN = "bg-[linear-gradient(162deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

// `POST /api/runs/{id}/stop` returns 422 for a run that isn't in a stoppable state — only offer it
// for the states the engine can actually halt.
const STOPPABLE = new Set(["running", "paused", "pending"]);

const COLS = [
  { key: "status", label: "Status", w: "8%", align: "left" },
  { key: "id", label: "ID", w: "10%", align: "left" },
  { key: "name", label: "Strategy Name", w: "15%", align: "left" },
  { key: "owner", label: "Owner", w: "6%", align: "left" },
  { key: "symbol", label: "Symbol/Market", w: "12%", align: "left" },
  { key: "pnl", label: "PnL chart", w: "8%", align: "left" },
  { key: "return", label: "Return", w: "8%", align: "right" },
  { key: "sharpe", label: "Sharpe", w: "6%", align: "right" },
  { key: "mdd", label: "Max drawdown", w: "8%", align: "right" },
  { key: "started", label: "Started", w: "8%", align: "left" },
  { key: "action", label: "Action", w: "9%", align: "right" },
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
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<PaperRunRow | null>(null);
  const stopRun = useStopRun();
  const deleteRun = useDeleteRun();
  const addLog = useConsoleLog((s) => s.addLog);

  // "Start paper trading" needs the strategy's promotion state, which the run row alone doesn't
  // carry: `paper_approved_version` decides whether the click can launch straight away or has to
  // promote first. Rides the cached ["hft-strategies"] query — no extra request.
  const { data: strategies = [] } = useHftStrategies();
  const strategyOf = useMemo(() => new Map(strategies.map((s) => [s.id, s])), [strategies]);
  const [pendingPromote, setPendingPromote] = useState<PaperRunRow | null>(null);
  const [pendingLaunch, setPendingLaunch] = useState<PaperRunRow | null>(null);
  const pendingPromoteStrategy = pendingPromote?.strategyId ? strategyOf.get(pendingPromote.strategyId) : undefined;
  const pendingLaunchStrategy = pendingLaunch?.strategyId ? strategyOf.get(pendingLaunch.strategyId) : undefined;
  // SimulateModal owns neither of these; they're launch-time choices its caller holds (same as
  // the Strategy List's own SimulateModal usage).
  const [hftMarket, setHftMarket] = useState("tick-l2");
  const [hftInterval, setHftInterval] = useState("1m");
  // Seed the launch dialog from the backtest itself: an MFT (bar) backtest starts paper on the same
  // bars, not on the dialog's tick default.
  const openLaunch = (r: PaperRunRow) => {
    setHftMarket(r.barInterval ? "bar-ohlc" : "tick-l2");
    if (r.barInterval) setHftInterval(r.barInterval);
    setPendingLaunch(r);
  };

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
      <Table className="table-fixed min-w-[1500px]">
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
            // Stop and Delete are both owner-or-admin: lab visibility lets a researcher SEE a
            // lab-mate's backtest but every mutation 404s, so hide the controls entirely.
            const writable = canMutate(r, { userId, isAdmin });
            // "Start paper trading" needs the strategy already approved for paper at its current
            // version (POST /api/runs' own gate — see resolve_strategy in the HFT API). Not yet
            // approved: only an admin can fix that, via the same promote-then-launch dialogs the
            // click opens. Already past paper (live-approved): this button isn't the way there.
            const strategy = r.strategyId ? strategyOf.get(r.strategyId) : undefined;
            const paperMode = strategy ? launchMode(strategy) : undefined;
            const paperBlocked = !strategy
              ? "Strategy not found."
              : paperMode === "live"
                ? "This strategy is already promoted to live."
                : paperMode === "backtest" && !isAdmin
                  ? "Ask an admin to promote this strategy to paper first."
                  : undefined;
            return (
              <TableRow
                opaque
                key={r.id}
                data-state={r.id === selectedId ? "selected" : undefined}
                onClick={() => onSelect(r.id)}
                className="cursor-pointer"
              >
                <TableCell sticky="left">
                  <RunStatusPill status={r.status} reason={r.error} />
                </TableCell>
                <TableCell className="truncate text-sm text-white">
                  <RunId id={r.id} />
                </TableCell>
                {/* Keep the cell a table-cell so it inherits `align-middle` — a `flex` class here
                    would override display and top-align the name on the taller two-band rows. */}
                <TableCell className="text-sm font-semibold text-white">
                  <span className="flex min-w-0 items-center">
                    <span className="truncate" title={r.strategyName}>{r.strategyName}</span>
                    <StrategyTypeBadge type={r.strategyType} />
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
                  {r.sharpe == null ? <span className="text-muted-foreground">—</span> : formatAmount(r.sharpe, 2)}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {r.maxDrawdownPct == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className={GRAD_RED}>{formatPercent(r.maxDrawdownPct)}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <StartedAt iso={r.startedAt} />
                </TableCell>
                <TableCell sticky="right" className="text-right">
                  {!writable ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      {/* Figma 14008:35644 — Start paper trading (Playback Speed). Already paper-approved:
                          launches straight away. Not yet approved: admin promotes to paper first (using
                          this backtest as evidence), then the launch dialog opens automatically. */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Start paper trading for ${r.strategyName}`}
                            disabled={!!paperBlocked}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (paperBlocked) return;
                              if (paperMode === "paper") openLaunch(r);
                              else setPendingPromote(r); // paperMode === "backtest" && isAdmin
                            }}
                            className="inline-flex size-[30px] cursor-pointer items-center justify-center rounded-lg bg-surface p-1.5 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="size-[18px] overflow-hidden">
                              <PlaybackSpeedIcon className="size-full" />
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{paperBlocked ?? "Start paper trading"}</TooltipContent>
                      </Tooltip>
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

      {pendingPromote && pendingPromoteStrategy && (
        <PromoteStageDialog
          open={!!pendingPromote}
          onOpenChange={(open) => !open && setPendingPromote(null)}
          strategyId={pendingPromote.strategyId ?? ""}
          strategyName={pendingPromote.strategyName}
          version={pendingPromoteStrategy.version}
          stage="paper"
          basedOnRunId={pendingPromote.id}
          onPromoted={() => {
            const run = pendingPromote;
            setPendingPromote(null);
            openLaunch(run);
          }}
        />
      )}

      {pendingLaunch && pendingLaunchStrategy && (
        <SimulateModal
          open={!!pendingLaunch}
          onOpenChange={(open) => !open && setPendingLaunch(null)}
          strategyName={pendingLaunch.strategyName}
          strategyId={pendingLaunch.strategyId ?? ""}
          hftType={pendingLaunchStrategy.strategy_type}
          hftMarket={hftMarket}
          onHftMarketChange={setHftMarket}
          hftInterval={hftInterval}
          onHftIntervalChange={setHftInterval}
          onLaunched={(run) => {
            addLog("success", `Started paper trading for "${pendingLaunch.strategyName}"`);
            setPendingLaunch(null);
            router.push(`/paper-trading?run=${run.id}`);
          }}
        />
      )}
    </>
  );
}
