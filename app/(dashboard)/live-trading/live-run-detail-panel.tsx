"use client";
import { CloseIcon } from "@/components/icons/close";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LineChart } from "@/components/charts/line-chart";
import { cn, formatPercent } from "@/lib/utils";
import type { RunStatus } from "@/types/domain";
import type { LiveRunRow } from "@/lib/mock/live-runs";
import { useRunSummary, useRunEquity } from "@/hooks/api/use-runs";
import { USE_MOCK } from "@/lib/constant";
import { toRunDetail } from "@/lib/transform/runs";

// Right-side slide-in panel for a Live Trading row — same Dialog shell, header layout and
// slide-in animation as the Strategy List's strategy-detail-panel.tsx (Figma node 13964:132139),
// with body content tailored to a live run (stats + PnL chart) instead of Code/Results tabs.
const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_YELLOW = "bg-[linear-gradient(162deg,#fffbd6_0%,#f1c617_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

// Same status tokens as live-runs-table.tsx's STATUS_META.
const STATUS_META: Record<RunStatus, { label: string; dot: string; text: string }> = {
  running: { label: "Running", dot: "#67e1c1", text: GRAD_GREEN },
  paused: { label: "Paused", dot: "#f1c617", text: GRAD_YELLOW },
  failed: { label: "Failed", dot: "#ff135b", text: GRAD_RED },
  stopped: { label: "Stopped", dot: "#9db2ce", text: "text-[#9db2ce]" },
  completed: { label: "Completed", dot: "#9db2ce", text: "text-[#9db2ce]" },
  pending: { label: "Pending", dot: "#9db2ce", text: "text-[#9db2ce]" },
};

// Same glassy pill treatment as live-runs-table.tsx's PILL (Account + TF).
const PILL =
  "inline-flex h-7 shrink-0 items-center rounded-[40px] border border-white/25 bg-[rgba(14,20,42,0.5)] px-3 text-xs font-medium text-white shadow-[inset_0_0_8px_0_rgba(63,216,189,0.15)] backdrop-blur-[2px]";

function StatTile({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-semibold text-white", valueClassName)}>{value}</span>
    </div>
  );
}

export function LiveRunDetailPanel({
  open,
  onOpenChange,
  run,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: LiveRunRow | null;
}) {
  const s = run ? STATUS_META[run.status] : null;
  // Summary + equity are fetched here — only when the panel is open for a run — not per-row on the
  // list. Skipped in mock mode (the mock row already carries its metrics).
  const summaryQ = useRunSummary(!USE_MOCK && run ? run.id : undefined);
  const equityQ = useRunEquity(!USE_MOCK && run ? run.id : undefined);
  const lazy = !USE_MOCK && !!run;
  const detailLoading = lazy && (summaryQ.isLoading || equityQ.isLoading);
  const detail =
    USE_MOCK && run
      ? { returnPct: run.returnPct ?? 0, sharpe: run.sharpe ?? 0, maxDrawdownPct: run.maxDrawdownPct ?? 0, pnlSeries: run.pnlSeries }
      : toRunDetail(summaryQ.data ?? null, equityQ.data ?? [], run?.startingEquity ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-y-0 left-auto right-0 flex h-dvh w-[min(960px,92vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-l bg-background p-0 duration-300 sm:max-w-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
      >
        <DialogTitle className="sr-only">{run?.strategyName ?? "Live run detail"}</DialogTitle>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-4 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="truncate text-base font-semibold text-white">{run?.strategyName}</span>
            {s && (
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.dot }} />
                <span className={cn("text-xs", s.text)}>{s.label}</span>
              </span>
            )}

            <div className="h-5 w-px shrink-0 bg-[#344054]" />

            {run?.accounts.map((a) => (
              <span key={a} className={PILL}>
                {a}
              </span>
            ))}
            {run?.symbols.map((sym) => (
              <span key={sym.symbol} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs">
                <span className="text-white">{sym.symbol}</span>
                <span className="text-[#9db2ce]">|</span>
                <span className={GRAD_GREEN}>{sym.market}</span>
              </span>
            ))}
            {run && <span className={PILL}>{run.timeframe}</span>}
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="inline-flex shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-white"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {run && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <StatTile
                  label="Return"
                  value={detailLoading ? "—" : formatPercent(detail.returnPct)}
                  valueClassName={detailLoading ? undefined : detail.returnPct >= 0 ? GRAD_GREEN : GRAD_RED}
                />
                <StatTile label="Sharpe" value={detailLoading ? "—" : detail.sharpe.toFixed(2)} />
                <StatTile
                  label="Max drawdown"
                  value={detailLoading ? "—" : formatPercent(detail.maxDrawdownPct)}
                  valueClassName={detailLoading ? undefined : GRAD_RED}
                />
              </div>

              <div className="rounded-xl border border-border">
                <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">Equity curve</div>
                <div className="p-2">
                  {detailLoading ? (
                    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                      Loading…
                    </div>
                  ) : detail.pnlSeries.length === 0 ? (
                    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                      No equity data.
                    </div>
                  ) : (
                    <LineChart
                      categories={detail.pnlSeries.map((_, i) => `T-${detail.pnlSeries.length - i}`)}
                      series={[{ name: "Equity", data: detail.pnlSeries }]}
                      style={{ height: 260 }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
