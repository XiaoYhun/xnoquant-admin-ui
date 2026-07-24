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
import { Sparkline } from "@/components/charts/sparkline";
import { FlashValue } from "@/components/ui/flash-value";
import { cn, formatPercent } from "@/lib/utils";
import type { PaperRunRow } from "@/lib/mock/paper-runs";

// Gradient text tokens from the Figma design.
const GRAD_GREEN = "bg-[linear-gradient(162deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

// Glassy pill (Account + TF): white/25 border, translucent dark fill, faint green inner glow.
const PILL =
  "inline-flex h-7 items-center rounded-[40px] border border-white/25 bg-[rgba(14,20,42,0.5)] px-3 text-xs font-medium text-white shadow-[inset_0_0_8px_0_rgba(63,216,189,0.15)] backdrop-blur-[2px]";

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

const COLS = [
  { key: "id", label: "ID", w: "8%", align: "left" },
  { key: "name", label: "Strategy Name", w: "12%", align: "left" },
  { key: "status", label: "Status", w: "8%", align: "left" },
  { key: "owner", label: "Owner", w: "7%", align: "left" },
  { key: "account", label: "Account", w: "8%", align: "left" },
  { key: "symbol", label: "Symbol/Market", w: "12%", align: "left" },
  { key: "tf", label: "TF", w: "5%", align: "left" },
  { key: "pnl", label: "PnL chart", w: "10%", align: "left" },
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
  return (
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
        {rows.map((r) => (
          <TableRow
            key={r.id}
            data-state={r.id === selectedId ? "selected" : undefined}
            onClick={() => onSelect(r.id)}
            className="cursor-pointer"
          >
            <TableCell className="truncate text-sm text-white">{r.id}</TableCell>
            <TableCell className="truncate text-sm font-semibold text-white" title={r.strategyName}>
              {r.strategyName}
            </TableCell>
            <TableCell>
              <span className={`text-xs ${GRAD_GREEN}`}>Paper Trading</span>
            </TableCell>
            <TableCell className="truncate text-xs text-white" title={r.owner ?? undefined}>
              {r.owner ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="p-0 align-middle">
              <MiniRows items={r.accounts.map((a) => <span key={a} className={PILL}>{a}</span>)} />
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
              <button
                type="button"
                aria-label={`Start live trading for ${r.strategyName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(r.id);
                }}
                className="group inline-flex cursor-pointer items-center justify-center rounded-lg bg-surface p-2 transition-all hover:bg-[linear-gradient(135deg,#fffbd6_0%,#f1c617_100%)] active:scale-95 active:brightness-90"
              >
                <Bolt
                  weight="Bold"
                  className="size-5 text-[#f1c617] transition-colors group-hover:text-[#151a24]"
                />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
