"use client";
import { useMemo, useState } from "react";
import { PageSizeSelect } from "@/components/page-size-select";
import { PageJump, pageItems } from "@/components/table-pagination";
import { useRouter } from "next/navigation";
import {
  AltArrowDown,
  AltArrowLeft,
  AltArrowRight,
  AltArrowUp,
  CloseCircle,
  MinimalisticMagnifer,
} from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useHftStrategies, type HftStrategyType } from "@/hooks/api/use-hft-strategies";
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
import { usePageSize } from "@/hooks/use-page-size";
import { resourceErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { cn, idQueryNeedle, isIdQuery } from "@/lib/utils";
import { strategyStage, nextPromotionStage, STAGE_ORDER, PAPER_RUN_SUCCEEDED } from "@/components/strategy-stage";
import { DEMOTE_TARGET, RowActions, StageCell } from "./row-actions";
import { PromoteStageDialog } from "../create-strategy/promote-stage-dialog";
import { SimulateModal, HFT_TYPE_LABEL } from "../create-strategy/simulate-modal";
import type { PromotionStage, Run, Strategy, StrategyPromotion } from "@/types/domain";

// Admin console for the promotion ladder — every strategy in one table with its owner, version and
// stage, plus the two actions an admin needs: move it up a rung, or launch it at the stage it has
// reached. The per-strategy editor (Create Strategy) shows the same controls but only for whatever
// tab you happen to be on, which is no way to run a review.
//
// Layout follows Figma 15277:35245: a filter row over a paged table whose only inline action is
// the gradient Run button; promote and demote live behind the row's ⋮ menu.
const STAGE_FILTERS = [
  { value: "all", label: "All status" },
  { value: "backtest", label: "Backtesting" },
  { value: "paper", label: "Paper running" },
  { value: "live", label: "Live trading" },
];

// Widths are the Figma column widths as percentages of the 1188px table: three flexible columns
// at 254.67 and three fixed at 120/120/184. `sortable` marks the columns whose ordering says
// something an admin reviews by; the action column has no value to sort at all.
const COLS = [
  { key: "name", label: "Strategy", w: "21.5%", sortable: true },
  { key: "version", label: "Version", w: "10%", sortable: true },
  { key: "owner", label: "Owner", w: "21.5%", sortable: true },
  { key: "type", label: "Type", w: "10%", sortable: true },
  { key: "stage", label: "Stage", w: "21.5%", sortable: true },
  { key: "actions", label: "Action", w: "15.5%", sortable: false },
] as const;

// Each mode has its own list screen; `?run=` opens that run's side panel on arrival (see
// hooks/use-url-param.ts). Launching from here would otherwise leave the admin on a table that
// never shows the run they just started.
const LIST_PAGE: Record<string, string> = {
  backtest: "/strategies",
  paper: "/paper-trading",
  live: "/live-trading/live-trade",
};

// The filter pills, the search field and the Run button, spelled out once — every one of them is
// a fixed 32px tall control off the same Figma row.
const FILTER_PILL =
  "h-8 w-auto gap-2 rounded-[40px] border-border bg-background py-0 pr-2 pl-3 text-xs font-medium text-white";

type SortKey = (typeof COLS)[number]["key"];
type Sort = { key: SortKey; dir: "asc" | "desc" };

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
function blockedReason(strategy: Strategy, next: PromotionStage, runs: Run[]): string | undefined {
  const atThisVersion = (r: Run) => r.manifest?.strategy?.version === strategy.version;
  if (next === "paper") {
    return runs.some((r) => r.mode === "backtest" && r.status === "completed" && atThisVersion(r))
      ? undefined
      : `No completed backtest at v${strategy.version}.`;
  }
  return runs.some((r) => r.mode === "paper" && PAPER_RUN_SUCCEEDED.has(r.status) && atThisVersion(r))
    ? undefined
    : `No finished paper run at v${strategy.version}.`;
}

export default function Page() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [ownerFilter, setOwnerFilter] = useState("all");
  // Two reads of the same endpoint. The rows are narrowed server-side by `?owner=`; the dropdowns
  // read the unfiltered list so their options stay the full cast — options derived from an
  // owner-filtered list would collapse to the owner already selected, leaving no way back to
  // anyone else. With no owner picked both share a cache entry, so this is one request.
  const { data: allStrategies = [] } = useHftStrategies();
  const {
    data: strategies = [],
    isPending,
    isError,
    error,
  } = useHftStrategies(ownerFilter === "all" ? undefined : ownerFilter);
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
  // The owner cell stacks name over email, and `owners` only carries whichever of the two exists.
  const emailOf = useMemo(() => new Map(roster.map((u) => [u.user_id, u.email?.trim() ?? ""])), [roster]);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  // No default sort: the list arrives in the API order, and clicking a header is what departs
  // from it. Sorting by nothing is a state you can be in, not one you have to sort your way out of.
  const [sort, setSort] = useState<Sort | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const debouncedSearch = useDebounced(search.trim());

  const [promoting, setPromoting] = useState<Strategy | null>(null);
  const [running, setRunning] = useState<Strategy | null>(null);
  const [demoting, setDemoting] = useState<Strategy | null>(null);
  const demote = useDemoteStrategy();
  // SimulateModal owns neither of these; they're launch-time choices its caller holds.
  const [hftMarket, setHftMarket] = useState("tick-l2");
  const [hftInterval, setHftInterval] = useState("1m");

  // Both dropdowns offer only who and what the strategy list actually holds — a roster of every
  // user who ever signed in would be mostly owners with no strategies. Read off the UNFILTERED
  // list for the reason given at the queries above.
  const ownerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of allStrategies) {
      if (!seen.has(s.owner_id)) seen.set(s.owner_id, owners.get(s.owner_id) ?? `${s.owner_id.slice(0, 8)}…`);
    }
    return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allStrategies, owners]);

  const typeOptions = useMemo(() => {
    const seen = new Set<HftStrategyType>();
    for (const s of allStrategies) seen.add(s.strategy_type);
    return [...seen]
      .map((value) => ({ value, label: HFT_TYPE_LABEL[value] ?? value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allStrategies]);

  // Search counts as a filter here — it sits in the same row and narrows the same table, and the
  // empty state blames "these filters" for it either way. Sort is deliberately left alone: it is
  // an ordering, not a narrowing, and clearing it would hide nothing the admin is looking for.
  const filtersActive = !!search || stageFilter !== "all" || ownerFilter !== "all" || typeFilter !== "all";
  const resetFilters = () => {
    setSearch("");
    setStageFilter("all");
    setOwnerFilter("all");
    setTypeFilter("all");
  };

  // First click on a column sorts it ascending; clicking the one already sorted flips it.
  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const rows = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const needle = idQueryNeedle(debouncedSearch);
    const filtered = strategies.filter((s) => {
      // An id-looking entry matches the strategy id; anything else is a name search.
      const matchesSearch = !q || (isIdQuery(debouncedSearch) ? s.id.toLowerCase().includes(needle) : s.name.toLowerCase().includes(q));
      const matchesStage = stageFilter === "all" || strategyStage(s, runsOf.get(s.id)).rung === stageFilter;
      const matchesType = typeFilter === "all" || s.strategy_type === typeFilter;
      // No owner check: `strategies` is already the owner's, narrowed by the API.
      return matchesSearch && matchesStage && matchesType;
    });
    if (!sort) return filtered;

    // The label is what the column shows, so the label is what it sorts by — sorting Owner by raw
    // uuid would order a column of names by something invisible.
    const ownerLabel = (s: Strategy) => owners.get(s.owner_id) ?? s.owner_id;
    const stageRank = (s: Strategy) => STAGE_ORDER.indexOf(strategyStage(s, runsOf.get(s.id)).stage);

    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "owner":
          return dir * ownerLabel(a).localeCompare(ownerLabel(b));
        case "type":
          return dir * (HFT_TYPE_LABEL[a.strategy_type] ?? a.strategy_type).localeCompare(HFT_TYPE_LABEL[b.strategy_type] ?? b.strategy_type);
        case "stage":
          return dir * (stageRank(a) - stageRank(b));
        case "version":
          return dir * (a.version - b.version);
        default:
          return dir * a.name.localeCompare(b.name);
      }
    });
  }, [strategies, debouncedSearch, stageFilter, typeFilter, sort, owners, runsOf]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  // Clamped on read rather than written back: narrowing the list can strand the pager past the
  // end, and page 6 of a two-page list should show page 2, not an empty table.
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
        <div className="flex h-8 w-60 items-center gap-2 rounded-[20px] border border-border py-1.5 pr-3 pl-4">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search strategies..."
            className="min-w-0 flex-1 bg-transparent text-xs font-medium text-white outline-none placeholder:text-muted-foreground"
          />
          <MinimalisticMagnifer size={20} weight="Outline" className="shrink-0 text-muted-foreground" />
        </div>
        <Select
          value={ownerFilter}
          onValueChange={(v) => {
            setOwnerFilter(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className={FILTER_PILL}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {ownerOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className={FILTER_PILL}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {typeOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={stageFilter}
          onValueChange={(v) => {
            setStageFilter(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className={FILTER_PILL}>
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
        {/* Only once there is something to clear: a permanently visible Reset on an unfiltered
            table is a control that does nothing, and it reads as one more filter to understand. */}
        {filtersActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:text-white"
          >
            <CloseCircle weight="Outline" className="size-3.5" />
            Reset filters
          </button>
        )}
        <PageSizeSelect
          className={cn(FILTER_PILL, "ml-auto")}
          value={pageSize}
          onChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
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
            <Table className="min-w-[1000px] table-fixed">
              <TableHeader>
                <TableRow>
                  {COLS.map((c) => {
                    const active = sort?.key === c.key;
                    return (
                      <TableHead
                        key={c.key}
                        style={{ width: c.w }}
                        className={cn("px-3 font-normal", c.key === "actions" && "text-right")}
                        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                      >
                        {c.sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            // The arrow is hidden until the column is sorted or hovered — Figma's
                            // header is a plain label, and a column of permanent grey arrows reads
                            // as chrome rather than as a control.
                            className="group inline-flex items-center gap-1"
                          >
                            {c.label}
                            {active && sort.dir === "desc" ? (
                              <AltArrowDown weight="Outline" className="size-3.5" />
                            ) : (
                              <AltArrowUp
                                weight="Outline"
                                className={cn("size-3.5", !active && "opacity-0 transition-opacity group-hover:opacity-40")}
                              />
                            )}
                          </button>
                        ) : (
                          c.label
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((s) => {
                  const promotion = promotionOf.get(s.id);
                  const next = nextPromotionStage(s);
                  const blocked = next ? blockedReason(s, next, runsOf.get(s.id) ?? []) : undefined;
                  const ownerName = owners.get(s.owner_id) ?? `${s.owner_id.slice(0, 8)}…`;
                  const email = emailOf.get(s.owner_id);
                  return (
                    <TableRow key={s.id} className="h-[52px]">
                      <TableCell className="truncate px-3 py-2.5 text-sm text-white" title={s.name}>
                        {s.name}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">v{s.version}</TableCell>
                      {/* Name over email, both truncating. `owners` already falls back to the
                          email when a user has no username, so the second line is dropped rather
                          than printing the same address twice. */}
                      <TableCell className="px-4 py-2.5" title={s.owner_id}>
                        <span className="block truncate text-sm text-white">{ownerName}</span>
                        {email && email !== ownerName && (
                          <span className="block truncate text-sm text-muted-foreground">{email}</span>
                        )}
                      </TableCell>
                      {/* Reuse the same labels the Simulate modal shows, rather than a CSS capitalize. */}
                      <TableCell className="px-3 py-2.5 text-xs text-white">{HFT_TYPE_LABEL[s.strategy_type] ?? s.strategy_type}</TableCell>
                      {/* The promotion's date and note lost their own columns to the Figma
                          layout; the badge's ⓘ opens them instead. */}
                      <TableCell className="px-3 py-2.5">
                        <StageCell strategy={s} runs={runsOf.get(s.id)} promotion={promotion} />
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <RowActions
                          strategy={s}
                          runs={runsOf.get(s.id) ?? []}
                          blocked={blocked}
                          onRun={() => setRunning(s)}
                          onPromote={() => setPromoting(s)}
                          onDemote={() => setDemoting(s)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        {pageCount > 1 && (
          <nav
            aria-label="pagination"
            className="flex shrink-0 items-center justify-between border-t border-border px-4 py-5"
          >
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <AltArrowLeft weight="Outline" className="size-5" />
              Previous
            </button>
            <div className="flex items-center gap-0.5">
              {pageItems(currentPage, pageCount).map((item, i) =>
                item === "…" ? (
                  <PageJump key={`gap-${i}`} pageCount={pageCount} onJump={setPage} />
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-current={item === currentPage ? "page" : undefined}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-[20px] text-sm font-medium transition-colors",
                      item === currentPage ? "bg-[#f9fafb] text-[#1d2939]" : "text-muted-foreground hover:bg-secondary hover:text-white",
                    )}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage === pageCount}
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <AltArrowRight weight="Outline" className="size-5" />
            </button>
          </nav>
        )}
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
            <DialogTitle>Demote to {demoting ? DEMOTE_TARGET[demotableStage(demoting)!] : ""}</DialogTitle>
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
              {demote.isPending ? "Demoting…" : "Demote"}
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
