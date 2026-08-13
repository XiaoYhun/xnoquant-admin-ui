"use client";
import { useMemo, useState } from "react";
import { Pen2 } from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resourceErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useRunningRuns, strategiesByAccount } from "@/hooks/api/use-runs";
import {
  useRiskStatus,
  useRiskThresholds,
  useSetAccountThreshold,
  useSetPortfolioThreshold,
} from "@/hooks/api/use-risk";
import { AccountLevelPill, DASH, GRAD_RED, Pill, moneyLabel, pctLabel } from "./risk-bits";
import { ThresholdDialog } from "./threshold-dialog";
import type { AccountRiskStatus } from "@/types/domain";

// Risk overview tab — Figma 14975:41599. Three KPI cards over the all-accounts table.
//
// The row joins three sources, because no single endpoint has all of it:
//   `/api/risk/status`     → name, current drawdown, yellow threshold, level
//   `/api/risk/thresholds` → Capital (`baseline_equity`) — admin-only, so a non-admin sees "—"
//   `/api/runs?status=running` → Strategy, which the risk API has no field for at all
const COLS = [
  { key: "name", label: "Name", w: "19%", align: "left" },
  { key: "capital", label: "Capital", w: "19%", align: "left" },
  { key: "strategy", label: "Strategy", w: "19%", align: "left" },
  { key: "drawdown", label: "Current drawdown", w: "12.5%", align: "left" },
  { key: "threshold", label: "Yellow threshold", w: "12.5%", align: "left" },
  { key: "status", label: "Status", w: "12.5%", align: "left" },
  { key: "action", label: "", w: "5.5%", align: "right" },
] as const;

// The ladder the Yellow-threshold select offers. Covers every value the design shows (-3 … -10)
// with a little headroom; an account already set to something off-ladder keeps its own value as
// an extra option so the select can render it (and the pencil can set anything at all).
const THRESHOLD_LADDER = [0.03, 0.05, 0.08, 0.1, 0.15, 0.2];

function KpiCard({
  label,
  value,
  valueClassName,
  badge,
  action,
  title,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex min-h-[26px] items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        {badge}
      </div>
      <span className="flex items-center gap-1.5" title={title}>
        <span className={cn("truncate text-sm font-semibold", valueClassName ?? "text-white")}>{value}</span>
        {action}
      </span>
    </div>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="inline-flex cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-white"
        >
          <Pen2 weight="Outline" className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function RiskOverviewTab() {
  const { data: status, isLoading, isError, error } = useRiskStatus();
  // Admin-only. A 403 here is expected for non-admins and must not take the tab down, so its
  // error is deliberately not surfaced — Capital simply renders "—".
  const { data: thresholds } = useRiskThresholds();
  const { data: runningRuns = [] } = useRunningRuns();
  const setPortfolio = useSetPortfolioThreshold();
  const setAccount = useSetAccountThreshold();

  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRiskStatus | null>(null);

  const capitalOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of thresholds?.accounts ?? []) map.set(t.account_id, t.baseline_equity);
    return map;
  }, [thresholds]);

  const strategiesOf = useMemo(() => strategiesByAccount(runningRuns), [runningRuns]);

  const accounts = status?.accounts ?? [];
  const alerting = accounts.filter((a) => a.level !== "ok").length;
  const portfolio = status?.portfolio;
  const portfolioCapital = thresholds?.portfolio?.baseline_equity ?? null;

  const saveAccount = (values: { pct: number; capital: number }) => {
    if (!editingAccount) return;
    setAccount.mutate(
      {
        accountId: editingAccount.account_id,
        yellow_drawdown_pct: values.pct,
        baseline_equity: values.capital,
      },
      { onSuccess: () => setEditingAccount(null) },
    );
  };

  // Changing the threshold from the row select keeps the account's existing capital. An account
  // with no threshold row yet has no capital to keep, so the select is disabled there and the
  // pencil (which asks for both) is the only way in.
  const quickSetThreshold = (account: AccountRiskStatus, pct: number) => {
    const capital = capitalOf.get(account.account_id);
    if (capital == null) return;
    setAccount.mutate({ accountId: account.account_id, yellow_drawdown_pct: pct, baseline_equity: capital });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 gap-4">
        <KpiCard
          label="Portfolio drawdown (current)"
          value={pctLabel(portfolio?.drawdown_pct) ?? "—"}
          valueClassName={portfolio?.drawdown_pct ? GRAD_RED : "text-white"}
        />
        <KpiCard
          label="Portfolio RED threshold"
          value={pctLabel(portfolio?.red_threshold_pct) ?? "Not set"}
          valueClassName={portfolio?.red_threshold_pct == null ? "text-muted-foreground" : GRAD_RED}
          // The design's static "Stop trading" chip names what Red does. Once the portfolio is
          // actually halted it says so instead, since that's the state an admin needs to see.
          badge={
            portfolio?.halted ? (
              <Pill label="Halted" bg="rgba(229,17,82,0.2)" text={GRAD_RED} />
            ) : (
              <Pill label="Stop trading" bg="rgba(229,17,82,0.2)" text={GRAD_RED} />
            )
          }
          action={<EditButton label="Edit portfolio Red threshold" onClick={() => setPortfolioOpen(true)} />}
          title={portfolio?.halted ? portfolio.halted_reason ?? undefined : undefined}
        />
        <KpiCard label="Accounts currently alerting" value={String(alerting)} />
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_4px_12px_0_rgba(0,0,0,0.05)]">
        <header className="flex shrink-0 items-center gap-2 border-b border-border bg-secondary px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">All accounts</h2>
          <span className="text-sm font-medium text-foreground">&bull; {accounts.length}</span>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isError ? (
            <p className="p-4 text-sm text-destructive">{resourceErrorMessage(error, "risk status")}</p>
          ) : isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
          ) : accounts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No accounts are being monitored.</p>
          ) : (
            <Table className="table-fixed min-w-[1100px]">
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
                {accounts.map((a) => {
                  const capital = capitalOf.get(a.account_id) ?? null;
                  const strategies = strategiesOf.get(a.account_id) ?? [];
                  const ladder = a.yellow_threshold_pct != null && !THRESHOLD_LADDER.includes(a.yellow_threshold_pct)
                    ? [...THRESHOLD_LADDER, a.yellow_threshold_pct].sort((x, y) => x - y)
                    : THRESHOLD_LADDER;
                  return (
                    <TableRow key={a.account_id}>
                      <TableCell className="truncate text-sm text-white" title={a.account_name}>
                        {a.account_name}
                      </TableCell>
                      <TableCell className="truncate text-sm text-white">
                        {moneyLabel(capital) ?? (
                          <span
                            className="text-muted-foreground"
                            title="Capital comes from the admin-only risk thresholds endpoint."
                          >
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {strategies.length === 0 ? (
                          <span
                            className="text-muted-foreground"
                            title="No API field — derived from this account's currently running runs, and it has none."
                          >
                            —
                          </span>
                        ) : (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-white underline" title={strategies.join(", ")}>
                              {strategies[0]}
                            </span>
                            {strategies.length > 1 && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                +{strategies.length - 1}
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={cn("text-sm", a.drawdown_pct ? GRAD_RED : "text-white")}>
                        {pctLabel(a.drawdown_pct) ?? DASH}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={a.yellow_threshold_pct == null ? "" : String(a.yellow_threshold_pct)}
                          onValueChange={(v) => v && quickSetThreshold(a, Number(v))}
                          disabled={capital == null}
                        >
                          <SelectTrigger
                            className="h-8 w-[88px] rounded-lg border-border bg-background px-2 text-xs text-white"
                            title={
                              capital == null
                                ? "Set this account's capital first — use the pencil."
                                : undefined
                            }
                          >
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                          <SelectContent>
                            {ladder.map((p) => (
                              <SelectItem key={p} value={String(p)}>
                                {pctLabel(p, 0)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <AccountLevelPill level={a.level} />
                      </TableCell>
                      <TableCell className="text-right">
                        <EditButton
                          label={`Edit ${a.account_name} risk threshold`}
                          onClick={() => setEditingAccount(a)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <ThresholdDialog
        open={portfolioOpen}
        onOpenChange={setPortfolioOpen}
        title="Portfolio Red threshold"
        description="Breaching this stops and flattens every running strategy and halts new launches."
        thresholdLabel="Red drawdown threshold"
        initialPct={thresholds?.portfolio?.red_drawdown_pct ?? portfolio?.red_threshold_pct ?? null}
        initialCapital={portfolioCapital}
        pending={setPortfolio.isPending}
        error={setPortfolio.error}
        onSubmit={({ pct, capital }) =>
          setPortfolio.mutate(
            { red_drawdown_pct: pct, baseline_equity: capital },
            { onSuccess: () => setPortfolioOpen(false) },
          )
        }
      />

      <ThresholdDialog
        open={!!editingAccount}
        onOpenChange={(open) => !open && setEditingAccount(null)}
        title={editingAccount ? `${editingAccount.account_name} — Yellow threshold` : "Yellow threshold"}
        description="Breaching this raises a warning only. It takes no automatic action on the account's runs."
        thresholdLabel="Yellow drawdown threshold"
        initialPct={editingAccount?.yellow_threshold_pct ?? null}
        initialCapital={editingAccount ? capitalOf.get(editingAccount.account_id) ?? null : null}
        pending={setAccount.isPending}
        error={setAccount.error}
        onSubmit={saveAccount}
      />
    </div>
  );
}
