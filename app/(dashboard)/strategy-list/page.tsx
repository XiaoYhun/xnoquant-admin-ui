"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MinimalisticMagnifer, SkipNext } from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHftStrategies } from "@/hooks/api/use-hft-strategies";
import { useDemoteStrategy, usePromotions } from "@/hooks/api/use-promotions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRunsByStrategy } from "@/hooks/api/use-strategy-runs";
import { useUserRoster, userLabelMap } from "@/hooks/api/use-users";
import { useDebounced } from "@/hooks/use-debounced";
import { resourceErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { cn, idQueryNeedle, isIdQuery } from "@/lib/utils";
import { StrategyStageBadge, strategyStage, nextPromotionStage, launchMode, PROMOTE_PILL, PAPER_RUN_SUCCEEDED } from "@/components/strategy-stage";
import { PromoteStageDialog } from "../create-strategy/promote-stage-dialog";
import { SimulateModal, HFT_TYPE_LABEL } from "../create-strategy/simulate-modal";
import type { PromotionStage, Run, Strategy, StrategyPromotion } from "@/types/domain";

// Admin console for the promotion ladder — every strategy in one table with its owner, version and
// stage, plus the two actions an admin needs: move it up a rung, or launch it at the stage it has
// reached. The per-strategy editor (Create Strategy) shows the same controls but only for whatever
// tab you happen to be on, which is no way to run a review.
const STAGE_FILTERS = [
  { value: "all", label: "All stages" },
  { value: "backtest", label: "Backtesting" },
  { value: "paper", label: "Paper running" },
  { value: "live", label: "Live trading" },
];

const COLS = [
  { key: "name", label: "Strategy", w: "17%", align: "left" },
  { key: "owner", label: "Owner", w: "11%", align: "left" },
  { key: "type", label: "Type", w: "7%", align: "left" },
  // Stage and Version read as one fact, so Stage is only as wide as "Backtesting (stale)" needs
  // and Version is left-aligned against it rather than pushed to the far edge of its own column.
  { key: "stage", label: "Stage", w: "13%", align: "left" },
  { key: "version", label: "Version", w: "6%", align: "left" },
  { key: "promoted", label: "Promoted", w: "11%", align: "left" },
  { key: "note", label: "Promote note", w: "14%", align: "left" },
  { key: "actions", label: "", w: "27%", align: "right" },
] as const;

// Each mode has its own list screen; `?run=` opens that run's side panel on arrival (see
// hooks/use-url-param.ts). Launching from here would otherwise leave the admin on a table that
// never shows the run they just started.
const LIST_PAGE: Record<string, string> = {
  backtest: "/strategies",
  paper: "/paper-trading",
  live: "/live-trading/live-trade",
};

const pad = (n: number) => String(n).padStart(2, "0");
function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The promotion this strategy still holds, if any — live first, since that's the one to unwind
 * before paper. Includes STALE approvals: an approval stranded at an older version is still a row
 * in the basket, and deleting it is how it gets cleared.
 */
function demotableStage(s: Strategy): PromotionStage | null {
  if (s.live_approved_version != null) return "live";
  if (s.paper_approved_version != null) return "paper";
  return null;
}

// Whether the next rung is reachable yet.
//
// Paper needs a COMPLETED backtest at this exact version — the server's own precondition.
//
// Live needs more than the server asks for. The API only wants a version-matching paper
// promotion, but approval to paper-trade is not evidence of having paper-traded, so a successful
// paper run at this version is required too. "Successful" means `stopped` or `completed`, NOT
// `completed` alone: a paper run tails a live feed and never completes on its own — every paper
// run on dev is `stopped` or `running` — so demanding `completed` would disable this forever.
// `running` is excluded on purpose: stop it, review the result, then promote.
function PromoteCell({
  strategy,
  runs,
  onPromote,
}: {
  strategy: Strategy;
  runs: Run[];
  onPromote: () => void;
}) {
  const next = nextPromotionStage(strategy);
  if (!next) return null;

  const atThisVersion = (r: (typeof runs)[number]) => r.manifest?.strategy?.version === strategy.version;
  const reason =
    next === "paper"
      ? runs.some((r) => r.mode === "backtest" && r.status === "completed" && atThisVersion(r))
        ? undefined
        : `No completed backtest at v${strategy.version}.`
      : runs.some((r) => r.mode === "paper" && PAPER_RUN_SUCCEEDED.has(r.status) && atThisVersion(r))
        ? undefined
        : `No finished paper run at v${strategy.version}.`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onPromote}
          disabled={!!reason}
          className={cn(
            "inline-flex h-7 shrink-0 cursor-pointer items-center rounded-[32px] border px-2.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
            PROMOTE_PILL[next],
          )}
        >
          Promote to {next}
        </button>
      </TooltipTrigger>
      <TooltipContent>{reason ?? `Promote to ${next}`}</TooltipContent>
    </Tooltip>
  );
}

export default function Page() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { data: strategies = [], isPending, isError, error } = useHftStrategies();
  const { data: roster = [] } = useUserRoster();
  const { data: runsOf = new Map<string, Run[]>() } = useRunsByStrategy();
  // The note an admin typed when promoting lives on the promotion record, not on Strategy, so
  // both baskets are read and keyed by strategy. This is also the only place the PAPER basket is
  // consumed — Alpha pool only ever shows live.
  const { data: paperPromotions = [] } = usePromotions("paper");
  const { data: livePromotions = [] } = usePromotions("live");
  const promotionOf = useMemo(() => {
    const m = new Map<string, StrategyPromotion>();
    // Live wins where a strategy holds both — it's the rung it's actually on.
    for (const p of paperPromotions) m.set(p.strategy_id, p);
    for (const p of livePromotions) m.set(p.strategy_id, p);
    return m;
  }, [paperPromotions, livePromotions]);
  const owners = useMemo(() => userLabelMap(roster), [roster]);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const debouncedSearch = useDebounced(search.trim());

  const [promoting, setPromoting] = useState<Strategy | null>(null);
  const [running, setRunning] = useState<Strategy | null>(null);
  const [demoting, setDemoting] = useState<Strategy | null>(null);
  const demote = useDemoteStrategy();
  // SimulateModal owns neither of these; they're launch-time choices its caller holds.
  const [hftMarket, setHftMarket] = useState("tick-l2");
  const [hftInterval, setHftInterval] = useState("1m");

  const rows = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const needle = idQueryNeedle(debouncedSearch);
    return strategies.filter((s) => {
      // An id-looking entry matches the strategy id; anything else is a name search.
      const matchesSearch = !q || (isIdQuery(debouncedSearch) ? s.id.toLowerCase().includes(needle) : s.name.toLowerCase().includes(q));
      const matchesStage = stageFilter === "all" || strategyStage(s, runsOf.get(s.id)).rung === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [strategies, debouncedSearch, stageFilter, runsOf]);

  // The whole page is admin-only: /api/users 403s for anyone else, and promotion is the point.
  if (!isAdmin) {
    return (
      <main className="flex min-h-0 flex-1 flex-col bg-surface p-4">
        <p className="text-sm text-muted-foreground">Strategy List is available to admins only.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden bg-surface p-4">
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex h-8 w-64 items-center gap-2 rounded-[20px] border border-border px-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <MinimalisticMagnifer size={20} weight="Outline" className="shrink-0 text-muted-foreground" />
        </div>
        <Select value={stageFilter} onValueChange={(v) => setStageFilter(v ?? "all")}>
          <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGE_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          {isError ? (
            <p className="p-4 text-sm text-destructive">{resourceErrorMessage(error, "strategies")}</p>
          ) : isPending ? (
            <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No strategies match these filters.</p>
          ) : (
            <Table className="table-fixed min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  {COLS.map((c) => (
                    <TableHead
                      key={c.key}
                      style={{ width: c.w }}
                      className={c.align === "right" ? "text-right" : undefined}
                    >
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const stage = strategyStage(s, runsOf.get(s.id));
                  // Whichever promotion is current is the one worth dating.
                  const promotedAt = stage.rung === "live" ? s.live_promoted_at : stage.rung === "paper" ? s.paper_promoted_at : null;
                  const promotion = promotionOf.get(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="truncate text-sm font-semibold text-white" title={s.name}>
                        {s.name}
                      </TableCell>
                      <TableCell className="truncate text-xs text-white" title={s.owner_id}>
                        {owners.get(s.owner_id) ?? <span className="text-muted-foreground">{s.owner_id.slice(0, 8)}…</span>}
                      </TableCell>
                      {/* Reuse the same labels the Simulate modal shows, rather than a CSS capitalize. */}
                      <TableCell className="text-xs text-white">{HFT_TYPE_LABEL[s.strategy_type] ?? s.strategy_type}</TableCell>
                      <TableCell>
                        <StrategyStageBadge strategy={s} runs={runsOf.get(s.id)} showVersion={false} />
                      </TableCell>
                      <TableCell className="text-xs text-white">v{s.version}</TableCell>
                      <TableCell className={cn("text-xs", promotedAt ? "text-white" : "text-muted-foreground")}>
                        {formatWhen(promotedAt)}
                      </TableCell>
                      <TableCell
                        className={cn("truncate text-xs", promotion?.note ? "text-white" : "text-muted-foreground")}
                        // Who approved it is the other half of the audit trail, but it's a raw
                        // user id — keep it on hover rather than spending a column on it.
                        title={
                          promotion
                            ? [promotion.note, `by ${owners.get(promotion.promoted_by) ?? promotion.promoted_by}`]
                                .filter(Boolean)
                                .join(" — ")
                            : undefined
                        }
                      >
                        {promotion?.note || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                          {demotableStage(s) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => setDemoting(s)}
                                  className="inline-flex h-7 shrink-0 cursor-pointer items-center rounded-[32px] border border-destructive/40 bg-destructive/10 px-2.5 text-xs font-medium text-destructive transition-opacity hover:opacity-90"
                                >
                                  Demote {demotableStage(s)}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Remove the {demotableStage(s)} promotion</TooltipContent>
                            </Tooltip>
                          )}
                          <PromoteCell strategy={s} runs={runsOf.get(s.id) ?? []} onPromote={() => setPromoting(s)} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => setRunning(s)}
                                aria-label={`Run ${s.name}`}
                                className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[32px] bg-[linear-gradient(161deg,#cff8ea_0%,#67e1c1_100%)] px-2.5 text-xs font-medium text-black transition-opacity hover:opacity-90"
                              >
                                <SkipNext weight="Outline" className="size-3.5" />
                                Run {launchMode(s)}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Launch at its current stage ({stage.label.toLowerCase()})</TooltipContent>
                          </Tooltip>
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {promoting && nextPromotionStage(promoting) && (
        <PromoteStageDialog
          open={!!promoting}
          onOpenChange={(open) => !open && setPromoting(null)}
          strategyId={promoting.id}
          strategyName={promoting.name}
          version={promoting.version}
          stage={nextPromotionStage(promoting) as PromotionStage}
          onPromoted={() => setPromoting(null)}
        />
      )}

      <Dialog open={!!demoting} onOpenChange={(open) => { if (!open) { setDemoting(null); demote.reset(); } }}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Remove promotion</DialogTitle>
            <DialogDescription>
              Deletes the {demoting ? demotableStage(demoting) : ""} promotion for &ldquo;
              {demoting?.name}&rdquo;. It stops being launchable at that stage until an admin
              promotes it again.
            </DialogDescription>
          </DialogHeader>
          {!!demote.error && (
            <p className="text-xs text-destructive">{resourceErrorMessage(demote.error, "this promotion")}</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDemoting(null)} disabled={demote.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={demote.isPending}
              onClick={() => {
                const stage = demoting && demotableStage(demoting);
                if (!demoting || !stage) return;
                demote.mutate(
                  { stage, strategyId: demoting.id },
                  { onSuccess: () => setDemoting(null) },
                );
              }}
            >
              {demote.isPending ? "Removing…" : "Remove promotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {running && (
        <SimulateModal
          open={!!running}
          onOpenChange={(open) => !open && setRunning(null)}
          strategyName={running.name}
          strategyId={running.id}
          hftType={running.strategy_type}
          hftMarket={hftMarket}
          onHftMarketChange={setHftMarket}
          hftInterval={hftInterval}
          onHftIntervalChange={setHftInterval}
          onLaunched={(run) => {
            setRunning(null);
            const page = LIST_PAGE[run.mode];
            if (page) router.push(`${page}?run=${run.id}`);
          }}
        />
      )}
    </main>
  );
}
