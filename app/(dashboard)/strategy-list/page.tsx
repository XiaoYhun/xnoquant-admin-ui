"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MinimalisticMagnifer, SkipNext } from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHftStrategies } from "@/hooks/api/use-hft-strategies";
import { useStrategyRuns } from "@/hooks/api/use-strategy-runs";
import { useUserRoster, userLabelMap } from "@/hooks/api/use-users";
import { useDebounced } from "@/hooks/use-debounced";
import { resourceErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { cn, idQueryNeedle, isIdQuery } from "@/lib/utils";
import { StrategyStageBadge, strategyStage } from "@/components/strategy-stage";
import { PromoteStageDialog } from "../create-strategy/promote-stage-dialog";
import { SimulateModal } from "../create-strategy/simulate-modal";
import type { PromotionStage, Strategy } from "@/types/domain";

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
  { key: "name", label: "Strategy", w: "24%", align: "left" },
  { key: "owner", label: "Owner", w: "16%", align: "left" },
  { key: "type", label: "Type", w: "10%", align: "left" },
  { key: "stage", label: "Stage", w: "18%", align: "left" },
  { key: "version", label: "Version", w: "8%", align: "right" },
  { key: "promoted", label: "Promoted", w: "12%", align: "left" },
  { key: "actions", label: "", w: "12%", align: "right" },
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

/** The rung above the strategy's current one, or null once it's live. */
function nextStageOf(s: Strategy): PromotionStage | null {
  const { stage } = strategyStage(s);
  if (stage === "live") return null;
  return stage === "paper" ? "live" : "paper";
}

// Whether promoting to paper is legal yet: the server wants a COMPLETED backtest at this exact
// version. Its own row-scoped query, so the check is per strategy rather than one giant fetch.
function PromoteCell({ strategy, onPromote }: { strategy: Strategy; onPromote: () => void }) {
  const next = nextStageOf(strategy);
  const { data: runs = [] } = useStrategyRuns(next === "paper" ? strategy.id : undefined);
  if (!next) return null;
  const qualified =
    next !== "paper" ||
    runs.some(
      (r) => r.mode === "backtest" && r.status === "completed" && r.manifest?.strategy?.version === strategy.version,
    );
  const reason = qualified ? undefined : `No completed backtest at v${strategy.version}.`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onPromote}
          disabled={!qualified}
          className="inline-flex h-7 shrink-0 cursor-pointer items-center rounded-[32px] border border-[#f1c617]/40 bg-[rgba(241,198,23,0.12)] px-2.5 text-xs font-medium text-[#f1c617] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Promote
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
  const owners = useMemo(() => userLabelMap(roster), [roster]);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const debouncedSearch = useDebounced(search.trim());

  const [promoting, setPromoting] = useState<Strategy | null>(null);
  const [running, setRunning] = useState<Strategy | null>(null);
  // SimulateModal owns neither of these; they're launch-time choices its caller holds.
  const [hftMarket, setHftMarket] = useState("tick-l2");
  const [hftInterval, setHftInterval] = useState("1m");

  const rows = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const needle = idQueryNeedle(debouncedSearch);
    return strategies.filter((s) => {
      // An id-looking entry matches the strategy id; anything else is a name search.
      const matchesSearch = !q || (isIdQuery(debouncedSearch) ? s.id.toLowerCase().includes(needle) : s.name.toLowerCase().includes(q));
      const matchesStage = stageFilter === "all" || strategyStage(s).stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [strategies, debouncedSearch, stageFilter]);

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
            <Table className="table-fixed min-w-[900px]">
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
                  const stage = strategyStage(s);
                  // Whichever promotion is current is the one worth dating.
                  const promotedAt = stage.stage === "live" ? s.live_promoted_at : stage.stage === "paper" ? s.paper_promoted_at : null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="truncate text-sm font-semibold text-white" title={s.name}>
                        {s.name}
                      </TableCell>
                      <TableCell className="truncate text-xs text-white" title={s.owner_id}>
                        {owners.get(s.owner_id) ?? <span className="text-muted-foreground">{s.owner_id.slice(0, 8)}…</span>}
                      </TableCell>
                      <TableCell className="text-xs text-white">{s.strategy_type}</TableCell>
                      <TableCell>
                        <StrategyStageBadge strategy={s} showVersion={false} />
                      </TableCell>
                      <TableCell className="text-right text-xs text-white">v{s.version}</TableCell>
                      <TableCell className={cn("text-xs", promotedAt ? "text-white" : "text-muted-foreground")}>
                        {formatWhen(promotedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          <PromoteCell strategy={s} onPromote={() => setPromoting(s)} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => setRunning(s)}
                                aria-label={`Run ${s.name}`}
                                className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[32px] bg-[linear-gradient(161deg,#cff8ea_0%,#67e1c1_100%)] px-2.5 text-xs font-medium text-black transition-opacity hover:opacity-90"
                              >
                                <SkipNext weight="Outline" className="size-3.5" />
                                Run
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

      {promoting && nextStageOf(promoting) && (
        <PromoteStageDialog
          open={!!promoting}
          onOpenChange={(open) => !open && setPromoting(null)}
          strategyId={promoting.id}
          strategyName={promoting.name}
          version={promoting.version}
          stage={nextStageOf(promoting) as PromotionStage}
          onPromoted={() => setPromoting(null)}
        />
      )}

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
