"use client";
import { useMemo, useState } from "react";
import { RestartCircle } from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resourceErrorMessage } from "@/lib/api-client";
import { useRiskAuditLog, useRiskStatus, useRiskThresholds } from "@/hooks/api/use-risk";
import { useRunningRuns, strategiesByAccount } from "@/hooks/api/use-runs";
import { DASH, GRAD_RED, Pill, TimeCell, pctLabel } from "./risk-bits";
import { formatAmount } from "@/lib/utils";
import { ResetRiskDialog } from "./reset-risk-dialog";
import type { RiskAuditEntry } from "@/types/domain";

// Alert & Action log tab — Figma 14975:44103.
//
// The audit log records exactly two kinds, `breach` and `reset`; the design's third pill,
// "Config change" (`-10% → -8%`, "Re-confirmed yellow threshold"), has no counterpart — threshold
// edits are not audited and no before/after pair is stored — so no such row is fabricated here.
// `reset` has no pill in the design either, so it gets one in the same family.
//
// "System action" is likewise derived rather than fetched: the entry carries `stopped_run_ids`,
// `level` and `new_baseline_equity`, and the sentence is built from those.
const COLS = [
  { key: "time", label: "Time", w: "10.4%", align: "left" },
  { key: "type", label: "Type", w: "12.5%", align: "left" },
  { key: "account", label: "Account", w: "18.1%", align: "left" },
  { key: "strategy", label: "Strategy", w: "18.1%", align: "left" },
  { key: "drawdown", label: "Drawdown", w: "8.7%", align: "left" },
  { key: "threshold", label: "Threshold", w: "8.7%", align: "left" },
  { key: "action", label: "System action", w: "18%", align: "left" },
  { key: "restart", label: "", w: "5.5%", align: "right" },
] as const;

type TypeFilter = "all" | "red" | "yellow" | "recovered" | "reset";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "red", label: "Stop trading" },
  { value: "yellow", label: "Yellow alert" },
  { value: "recovered", label: "Recovered" },
  { value: "reset", label: "Reset" },
];

/** Which filter bucket — and which pill — an entry belongs to. */
function entryType(e: RiskAuditEntry): TypeFilter {
  if (e.kind === "reset") return "reset";
  if (e.level === "red") return "red";
  if (e.level === "yellow") return "yellow";
  return "recovered";
}

function TypePill({ entry }: { entry: RiskAuditEntry }) {
  switch (entryType(entry)) {
    case "red":
      return <Pill label="Stop trading" bg="rgba(229,17,82,0.2)" text={GRAD_RED} />;
    case "yellow":
      return (
        <Pill
          label="Yellow alert"
          bg="rgba(241,198,23,0.2)"
          text="bg-[linear-gradient(158deg,#fffbd6_0%,#f1c617_100%)] bg-clip-text text-transparent"
        />
      );
    case "reset":
      return <Pill label="Reset" bg="rgba(157,178,206,0.15)" text="text-[#9db2ce]" />;
    default:
      return (
        <Pill
          label="Recovered"
          bg="rgba(103,225,193,0.1)"
          text="bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent"
        />
      );
  }
}

/** The sentence in the "System action" column, built from what the entry actually carries. */
function systemAction(e: RiskAuditEntry): string {
  if (e.kind === "reset") {
    const base = e.new_baseline_equity;
    return base == null
      ? "Halt lifted, baseline re-confirmed"
      : `Halt lifted, re-baselined to ${formatAmount(base)} ₫`;
  }
  if (e.level === "red") {
    const n = e.stopped_run_ids?.length ?? 0;
    return n > 0 ? `Stopped all trading (${n} run${n === 1 ? "" : "s"})` : "Stopped all trading";
  }
  if (e.level === "yellow") return "Raised yellow alert";
  return "Recovered below threshold";
}

export function AlertLogTab() {
  const { data: entries = [], isLoading, isError, error } = useRiskAuditLog();
  const { data: status } = useRiskStatus();
  const { data: thresholds } = useRiskThresholds();
  const { data: runningRuns = [] } = useRunningRuns();
  const [accountFilter, setAccountFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [resetOpen, setResetOpen] = useState(false);

  const strategiesOf = useMemo(() => strategiesByAccount(runningRuns), [runningRuns]);

  // Account options come from the log itself, so the filter can only ever offer values that
  // actually appear in it.
  const accountOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const e of entries) {
      if (e.account_id && e.account_name) byId.set(e.account_id, e.account_name);
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const rows = useMemo(
    () =>
      entries.filter(
        (e) =>
          (accountFilter === "all" || e.account_id === accountFilter) &&
          (typeFilter === "all" || entryType(e) === typeFilter),
      ),
    [entries, accountFilter, typeFilter],
  );

  const halted = status?.portfolio.halted ?? false;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <Select value={accountFilter} onValueChange={(v) => setAccountFilter(v ?? "all")}>
          <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accountOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter((v as TypeFilter) ?? "all")}>
          <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTERS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_4px_12px_0_rgba(0,0,0,0.05)]">
        <header className="flex shrink-0 items-center gap-2 border-b border-border bg-secondary px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Alert &amp; Action history</h2>
          <span className="text-sm font-medium text-foreground">&bull; {rows.length}</span>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isError ? (
            <p className="p-4 text-sm text-destructive">{resourceErrorMessage(error, "the risk audit log")}</p>
          ) : isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {entries.length === 0 ? "No risk events recorded yet." : "No events match these filters."}
            </p>
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
                {rows.map((e) => {
                  const strategies = e.account_id ? strategiesOf.get(e.account_id) ?? [] : [];
                  const isRedBreach = entryType(e) === "red";
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">
                        <TimeCell iso={e.created_at} />
                      </TableCell>
                      <TableCell>
                        <TypePill entry={e} />
                      </TableCell>
                      <TableCell className="truncate text-sm text-white">
                        {e.scope === "portfolio" ? "Portfolio (All accounts)" : e.account_name ?? DASH}
                      </TableCell>
                      <TableCell className="truncate text-sm">
                        {strategies.length === 0 ? (
                          <span
                            className="text-muted-foreground"
                            title="No API field — derived from what this account is running now, which need not be what it ran when the event fired."
                          >
                            —
                          </span>
                        ) : (
                          <span className="truncate text-white underline" title={strategies.join(", ")}>
                            {strategies[0]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-white">{pctLabel(e.drawdown_pct) ?? DASH}</TableCell>
                      <TableCell className="text-sm text-white">{pctLabel(e.threshold_pct) ?? DASH}</TableCell>
                      <TableCell className="truncate text-sm text-white" title={systemAction(e)}>
                        {systemAction(e)}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Only a Red breach can be reset, and only while the halt it caused is
                            still in force — the API answers 422 once the platform is unhalted. */}
                        {isRedBreach && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label="Restart trading"
                                disabled={!halted}
                                onClick={() => setResetOpen(true)}
                                className="inline-flex cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <RestartCircle weight="Outline" className="size-5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {halted ? "Restart" : "Already restarted — the platform is not halted"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <ResetRiskDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        portfolioBaseline={thresholds?.portfolio?.baseline_equity ?? null}
        accounts={thresholds?.accounts ?? []}
      />
    </div>
  );
}
