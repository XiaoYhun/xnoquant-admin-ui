"use client";
import { type ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bolt } from "@solar-icons/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { marketOf } from "@/components/market-tabs";
import { PromoteStageDialog } from "../create-strategy/promote-stage-dialog";
import { useHftStrategies } from "@/hooks/api/use-hft-strategies";
import { nextPromotionStage } from "@/components/strategy-stage";
import type { PromotionStage } from "@/types/domain";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkline } from "@/components/charts/sparkline";
import { FlashValue } from "@/components/ui/flash-value";
import { cn, formatAmount, formatPercent } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { isShared } from "@/lib/rbac";
import { RunStatusPill } from "@/components/run-status-pill";
import { RunId } from "@/components/run-id";
import type { PaperRunRow } from "@/lib/mock/paper-runs";

// Gradient text tokens from the Figma design.
const GRAD_GREEN = "bg-[linear-gradient(162deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

// Glassy pill (Account + TF): white/10 border, translucent dark fill, faint green inner glow.
const PILL =
  "inline-flex h-7 items-center rounded-[40px] border border-white/10 bg-[rgba(14,20,42,0.5)] px-3 text-xs font-medium text-white shadow-[inset_0_0_8px_0_rgba(63,216,189,0.15)] backdrop-blur-[2px]";

// A cell that stacks one or more paired "mini-rows" (account[i] ↔ symbol[i]). When there
// are two, the second band gets a subtle tint so the pairs read as distinct rows and stay
// aligned across the Account and Symbol columns. Used with a `p-0` TableCell.
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
  { key: "name", label: "Strategy Name", w: "12%", align: "left" },
  { key: "owner", label: "Owner", w: "5%", align: "left" },
  { key: "account", label: "Account", w: "10%", align: "left" },
  { key: "symbol", label: "Symbol/Market", w: "14%", align: "left" },
  { key: "tf", label: "TF", w: "5%", align: "left" },
  { key: "pnl", label: "PnL chart", w: "7%", align: "left" },
  { key: "return", label: "Return", w: "8%", align: "right" },
  { key: "sharpe", label: "Sharpe", w: "6%", align: "right" },
  { key: "mdd", label: "Max drawdown", w: "8%", align: "right" },
  { key: "action", label: "Action", w: "8%", align: "right" },
] as const;

export function PaperRunsTable({
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
  const [pendingPromote, setPendingPromote] = useState<PaperRunRow | null>(null);
  // The ⚡ used to promote straight to live, which the API rejects unless a version-matching paper
  // promotion already exists. Resolve the strategy so it targets the actual next rung, with this
  // run as the justifying evidence. Rides the cached ["hft-strategies"] query — no extra request.
  const { data: strategies = [] } = useHftStrategies();
  const strategyOf = useMemo(() => new Map(strategies.map((s) => [s.id, s])), [strategies]);
  const pendingStrategy = pendingPromote?.strategyId ? strategyOf.get(pendingPromote.strategyId) : undefined;
  const pendingNextStage: PromotionStage | null = pendingStrategy
    ? nextPromotionStage(pendingStrategy)
    : null;
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
        {rows.map((r) => (
          <TableRow
            opaque
            key={r.id}
            data-state={r.id === selectedId ? "selected" : undefined}
            onClick={() => onSelect(r.id)}
            className="cursor-pointer"
          >
            <TableCell sticky="left">
              <RunStatusPill status={r.status} />
            </TableCell>
            <TableCell className="truncate text-sm text-white">
              <RunId id={r.id} />
            </TableCell>
            {/* Keep the cell a table-cell so it inherits `align-middle` — a `flex` class here
                would override display and top-align the name on the taller two-band rows. */}
            <TableCell className="text-sm font-semibold text-white">
              <span className="flex min-w-0 items-center">
                <span className="truncate" title={r.strategyName}>{r.strategyName}</span>
                {/* RBAC plan: a lab-mate's paper run is a read-only share, not owned by the caller. */}
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
                items={r.symbols.map((s) => (
                  <span key={s.symbol} className="flex items-center gap-2 whitespace-nowrap text-xs">
                    <span className="text-white">{s.symbol}</span>
                    <span className="text-[#9db2ce]">|</span>
                    <span className={GRAD_GREEN}>{s.market}</span>
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
                <FlashValue value={r.sharpe}>{formatAmount(r.sharpe, 2)}</FlashValue>
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
              {/* Promotion is admin-only (POST /api/promotions/live/{strategy_id}). */}
              {isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Promote ${r.strategyName} to live`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingPromote(r);
                      }}
                      className="group inline-flex cursor-pointer items-center justify-center rounded-lg bg-surface p-2 transition-all hover:bg-[linear-gradient(135deg,#fffbd6_0%,#f1c617_100%)] active:scale-95 active:brightness-90"
                    >
                      <Bolt
                        weight="Bold"
                        className="size-5 text-[#f1c617] transition-colors group-hover:text-[#151a24]"
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Promote to Live</TooltipContent>
                </Tooltip>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    {pendingPromote && pendingStrategy && pendingNextStage && (
      <PromoteStageDialog
        open={!!pendingPromote}
        onOpenChange={(open) => !open && setPendingPromote(null)}
        strategyId={pendingPromote.strategyId ?? ""}
        strategyName={pendingPromote.strategyName}
        version={pendingStrategy.version}
        stage={pendingNextStage}
        basedOnRunId={pendingPromote.id}
        onPromoted={(promoted) => {
          setPendingPromote(null);
          // Only a live promotion puts the strategy in Alpha pool; a paper one has no screen to
          // land on, so stay put.
          if (promoted !== "live") return;
          const market = pendingPromote ? marketOf(pendingPromote) : null;
          router.push(`/live-trading/alpha-pool${market ? `?market=${market}` : ""}`);
        }}
      />
    )}
    </>
  );
}
