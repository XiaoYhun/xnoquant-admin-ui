"use client";
import type { ReactNode } from "react";
import { Bolt } from "@solar-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FlashValue } from "@/components/ui/flash-value";
import { RunStatusPill } from "@/components/run-status-pill";
import { StartLiveTradingDialog } from "../../paper-trading/start-live-trading-dialog";
import { isApprovalStale } from "@/hooks/api/use-live-basket";
import { cn, formatPercent } from "@/lib/utils";
import type { PaperRunRow } from "@/lib/mock/paper-runs";
import type { AlphaPoolRow } from "./page";

// Gradient text tokens from the Figma design — same metric styling as the paper/live tables.
const GRAD_GREEN = "bg-[linear-gradient(162deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

const PILL =
  "inline-flex h-7 items-center rounded-[40px] border border-white/25 bg-[rgba(14,20,42,0.5)] px-3 text-xs font-medium text-white shadow-[inset_0_0_8px_0_rgba(63,216,189,0.15)] backdrop-blur-[2px]";

const DASH = <span className="text-muted-foreground">—</span>;

function MiniRows({ items }: { items: ReactNode[] }) {
  return (
    <div className="flex flex-col">
      {items.map((node, i) => (
        <div key={i} className={cn("flex min-h-[40px] min-w-0 items-center px-4", items.length > 1 && "bg-surface")}>
          {node}
        </div>
      ))}
    </div>
  );
}

const COLS = [
  { key: "status", label: "Status", w: "8%", align: "left" },
  { key: "id", label: "ID", w: "9%", align: "left" },
  { key: "name", label: "Strategy Name", w: "14%", align: "left" },
  { key: "account", label: "Account", w: "10%", align: "left" },
  { key: "symbol", label: "Symbol/Market", w: "13%", align: "left" },
  { key: "tf", label: "TF", w: "5%", align: "left" },
  { key: "return", label: "Return", w: "7%", align: "right" },
  { key: "sharpe", label: "Sharpe", w: "5%", align: "right" },
  { key: "mdd", label: "MDD", w: "7%", align: "right" },
  { key: "note", label: "Note", w: "14%", align: "left" },
  { key: "action", label: "Action", w: "8%", align: "right" },
] as const;

export function AlphaPoolTable({
  rows,
  onOpenDetail,
  onStarted,
}: {
  rows: AlphaPoolRow[];
  onOpenDetail: (row: AlphaPoolRow) => void;
  onStarted: (run: PaperRunRow) => void;
}) {
  return (
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
        {rows.map(({ member, run }) => {
          const stale = isApprovalStale(member);
          return (
            <TableRow
              opaque
              key={member.strategy_id}
              className="cursor-pointer"
              onClick={() => onOpenDetail({ member, run })}
            >
              <TableCell sticky="left">{run ? <RunStatusPill status={run.status} /> : DASH}</TableCell>
              <TableCell className="truncate text-sm text-white">{run?.id ?? DASH}</TableCell>
              {/* Keep the cell a table-cell so it inherits `align-middle` — a `flex` class here
                  would override display and top-align the name on the taller two-band rows. */}
              <TableCell className="text-sm font-semibold text-white">
                <span className="flex min-w-0 items-center">
                  <span className="truncate" title={member.strategy_name}>
                    {member.strategy_name}
                  </span>
                  {/* current_version has moved past the reviewed one — the strategy stays listed but
                      can't launch live runs until an admin re-promotes it. */}
                  {stale && (
                    <span
                      title={`Approved v${member.approved_version}, now at v${member.current_version}`}
                      className="ml-2 inline-flex shrink-0 items-center rounded-[20px] border border-[#f1c617]/40 bg-[#f1c617]/10 px-2 py-0.5 text-[10px] font-normal text-[#f1c617]"
                    >
                      Needs re-approval
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell className="overflow-hidden p-0 align-middle">
                {run ? (
                  <MiniRows
                    items={run.accounts.map((a) => (
                      <span key={a} title={a} className={cn(PILL, "min-w-0 max-w-full")}>
                        <span className="truncate">{a}</span>
                      </span>
                    ))}
                  />
                ) : (
                  <span className="px-4">{DASH}</span>
                )}
              </TableCell>
              <TableCell className="p-0 align-middle">
                {run ? (
                  <MiniRows
                    items={run.symbols.map((s) => (
                      <span key={s.symbol} className="flex items-center gap-2 whitespace-nowrap text-xs">
                        <span className="text-white">{s.symbol}</span>
                        <span className="text-[#9db2ce]">|</span>
                        <span className={GRAD_GREEN}>{s.market}</span>
                      </span>
                    ))}
                  />
                ) : (
                  <span className="px-4">{DASH}</span>
                )}
              </TableCell>
              <TableCell>{run ? <span className={PILL}>{run.timeframe}</span> : DASH}</TableCell>
              <TableCell className="text-right text-xs">
                {run?.returnPct == null ? (
                  DASH
                ) : (
                  <FlashValue value={run.returnPct}>
                    <span className={run.returnPct >= 0 ? GRAD_GREEN : GRAD_RED}>
                      {formatPercent(run.returnPct)}
                    </span>
                  </FlashValue>
                )}
              </TableCell>
              <TableCell className="text-right text-xs text-white">
                {run?.sharpe == null ? DASH : <FlashValue value={run.sharpe}>{run.sharpe.toFixed(2)}</FlashValue>}
              </TableCell>
              <TableCell className="text-right text-xs">
                {run?.maxDrawdownPct == null ? (
                  DASH
                ) : (
                  <FlashValue value={run.maxDrawdownPct}>
                    <span className={GRAD_RED}>{formatPercent(run.maxDrawdownPct)}</span>
                  </FlashValue>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {member.note ? (
                  <span className="line-clamp-2" title={member.note}>
                    {member.note}
                  </span>
                ) : (
                  DASH
                )}
              </TableCell>
              <TableCell sticky="right" className="text-right" onClick={(e) => e.stopPropagation()}>
                {run && !stale ? (
                  // The Tooltip must wrap the dialog, not the button: DialogTrigger's `asChild`
                  // merges onto its immediate child, and a Tooltip root renders no DOM node to
                  // merge onto — so the click never reaches the button. Chaining the two
                  // `asChild` slots (DialogTrigger → TooltipTrigger → button) does work.
                  <Tooltip>
                    <StartLiveTradingDialog
                      run={run}
                      onSuccess={() => onStarted(run)}
                      trigger={
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Start live trading for ${member.strategy_name}`}
                            className="group inline-flex cursor-pointer items-center justify-center rounded-lg bg-surface p-2 transition-all hover:bg-[linear-gradient(135deg,#fffbd6_0%,#f1c617_100%)] active:scale-95 active:brightness-90"
                          >
                            <Bolt
                              weight="Bold"
                              className="size-5 text-[#f1c617] transition-colors group-hover:text-[#151a24]"
                            />
                          </button>
                        </TooltipTrigger>
                      }
                    />
                    <TooltipContent>Start live trading</TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    type="button"
                    disabled
                    title={
                      stale
                        ? "Edited since promotion — an admin must re-promote it before it can go live."
                        : "Promoted without a source run, so there's nothing to launch from."
                    }
                    className="inline-flex cursor-not-allowed items-center justify-center rounded-lg bg-surface p-2 opacity-40"
                  >
                    <Bolt weight="Bold" className="size-5 text-[#f1c617]" />
                  </button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
