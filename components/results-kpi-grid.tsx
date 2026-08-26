"use client";
// The run summary block shown above every Results view — Figma 14876:145548. Two rows of four:
// Net PnL / Trades / Win rate / Profit Factor, then Max Drawdown / Sharpe Ratio / Cost Drag /
// Edge net.
//
// Lives here rather than beside either caller: the run-detail panel and the Overview view both
// need it, and the panel already imports Overview, so putting it in either would be circular.
//
// Profit Factor and the win-rate wins|losses breakdown have no source in RunSummary (no
// profit-factor field; total_trades counts fills, not closing trades), so those render "—" with
// an explanatory title.
import { cn, currencyDigits, formatAmount } from "@/lib/utils";
import { currencySymbol } from "@/lib/transform/runs";
import type { RunSummary } from "@/types/domain";

const GRAD_GREEN = "bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(160deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

// KPI grid cell — label/value/extra layout shell shared by both Charts tabs' KPI blocks; every
// visual variation (size, tone, unit) is supplied by the caller.
function KpiCell({
  label,
  size,
  value,
  valueClassName,
  extra,
  extraClassName,
  title,
}: {
  label: string;
  size: "sm" | "base";
  value: string;
  valueClassName: string;
  extra?: string;
  extraClassName?: string;
  title?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs leading-[18px] text-[#9db2ce]">{label}</span>
      <div className="flex min-w-0 items-end gap-1" title={title}>
        <span
          className={cn(
            size === "sm" ? "text-sm" : "text-base",
            "min-w-0 truncate leading-5 font-semibold",
            valueClassName,
          )}
        >
          {value}
        </span>
        {extra && <span className={cn("shrink-0", extraClassName)}>{extra}</span>}
      </div>
    </div>
  );
}

// Two rows of 4 KPIs in one bordered block — Figma 14876:145548. Profit Factor and the win-rate
// wins|losses breakdown have no source in RunSummary (no profit-factor field; total_trades counts
// fills, not closing trades), so those render "—" with an explanatory title — same convention as

// ── Charts tab (live variant, Figma 14890:143542) ──────────────────────────
// Two rows of 4 KPIs off RunSummary. Profit Factor and the win-rate wins|losses breakdown have no
// API source (no profit-factor field; total_trades counts fills, not closing trades) — those two
// render "—" with an explanatory title, same convention as the live-trade page's KpiCard.
export function ResultsKpiGrid({ summary, currency }: { summary: RunSummary | undefined; currency: string }) {
  const digits = currencyDigits(currency);
  const netPnl = summary?.net_pnl;
  const netPnlTone = netPnl != null && netPnl < 0 ? GRAD_RED : GRAD_GREEN;
  const returnPct = summary?.return_pct;
  const mdd = summary?.max_drawdown;
  const mddPct = summary?.max_drawdown_pct;
  const winRate = summary?.win_rate;
  const sharpe = summary?.sharpe_annualized ?? summary?.sharpe;
  const costBps = summary?.cost_bps;
  const edgeNet = summary?.edge_net_bps;
  const trades = summary?.total_trades;

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[#1d2939] bg-[rgba(29,33,38,0.2)] px-3 py-2">
      <div className="grid w-full grid-cols-4 gap-4">
        <KpiCell
          label="Net PnL"
          size="sm"
          value={
            netPnl == null
              ? "—"
              : `${netPnl >= 0 ? "+" : "-"}${formatAmount(Math.abs(netPnl), digits)} ${currencySymbol(currency)}`
          }
          valueClassName={netPnl == null ? "text-muted-foreground" : netPnlTone}
          extra={returnPct == null ? undefined : `(${returnPct >= 0 ? "+" : ""}${formatAmount(returnPct * 100, 1)}%)`}
          extraClassName={cn("text-xs font-medium", netPnlTone)}
        />
        <KpiCell
          label="Trades"
          size="base"
          value={trades == null ? "—" : trades.toLocaleString()}
          valueClassName="text-white"
        />
        <KpiCell
          label="Win rate"
          size="sm"
          value={winRate == null ? "—" : `${formatAmount(winRate * 100, 2)}%`}
          valueClassName="text-white"
          extra="—"
          extraClassName="text-xs text-[#9db2ce]"
          title="Wins|losses counts aren't available — total_trades counts fills, not closing trades."
        />
        <KpiCell
          label="Profit Factor"
          size="base"
          value="—"
          valueClassName="text-muted-foreground"
          title="Not available — RunSummary has no profit-factor field."
        />
      </div>
      <div className="h-px w-full bg-[#1d2939]" />
      <div className="grid w-full grid-cols-4 gap-4">
        <KpiCell
          label="Max Drawdown"
          size="sm"
          value={mdd == null ? "—" : `-${formatAmount(Math.abs(mdd), digits)} ${currencySymbol(currency)}`}
          valueClassName={mdd == null ? "text-muted-foreground" : GRAD_RED}
          extra={mddPct == null ? undefined : `(-${formatAmount(Math.abs(mddPct * 100), 1)}%)`}
          extraClassName={cn("text-xs font-medium", GRAD_RED)}
        />
        <KpiCell
          label="Sharpe Ratio"
          size="base"
          value={sharpe == null ? "—" : formatAmount(sharpe, 2)}
          valueClassName="text-white"
        />
        <KpiCell
          label="Cost Drag"
          size="base"
          value={costBps == null ? "—" : formatAmount(costBps, 2)}
          valueClassName="text-white"
        />
        <KpiCell
          label="Edge net"
          size="base"
          value={edgeNet == null ? "—" : formatAmount(edgeNet, 2)}
          valueClassName="text-white"
          extra={edgeNet == null ? undefined : "bp"}
          extraClassName="text-[10px] text-[#9db2ce]"
        />
      </div>
    </div>
  );
}
