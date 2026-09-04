"use client";
import { Suspense, useMemo, useState } from "react";
import { MinimalisticMagnifer } from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { usePaperRuns } from "@/hooks/api/use-paper-runs";
import { useDebounced } from "@/hooks/use-debounced";
import { idQueryNeedle, isIdQuery } from "@/lib/utils";
import { useUrlParam } from "@/hooks/use-url-param";
import { DEFAULT_MARKET, MarketTabs, marketOf, matchesMarket, type Market } from "@/components/market-tabs";
import { resourceErrorMessage } from "@/lib/api-client";
import {
  EMPTY_METRIC_RANGES,
  MetricRangeFilters,
  matchesMetricRanges,
  type MetricRanges,
} from "@/components/metric-range-filters";
import { PaperRunsTable } from "./paper-runs-table";
import { RunDetailPanel } from "./run-detail-panel";

const PAGE_SIZE = 9;

// `useSearchParams` (via useUrlParam) needs a Suspense boundary in the App Router.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PaperTrading />
    </Suspense>
  );
}

function PaperTrading() {
  const [market, setMarket] = useState<Market>(DEFAULT_MARKET);
  const [search, setSearch] = useState("");
  const [symbol, setSymbol] = useState("all");
  const [status, setStatus] = useState("all");
  // Sharpe / Return % / Max DD % bounds — client-side, like symbol and paging: `GET /api/runs`
  // has no metric filter.
  const [ranges, setRanges] = useState<MetricRanges>(EMPTY_METRIC_RANGES);
  const [page, setPage] = useState(1);
  // The open panel is in the URL (`?run=<id>`) so the view can be linked and survives reload.
  const [selectedId, setSelectedId] = useUrlParam("run");

  // Search and status are served by `GET /api/runs` (`q`, `status`); symbol and paging stay
  // client-side — the API offers no symbol filter, and no `mode` filter to page paper runs by.
  const debouncedSearch = useDebounced(search.trim());
  const idSearch = isIdQuery(debouncedSearch);
  const idNeedle = idQueryNeedle(debouncedSearch);
  const { data: runs = [], isLoading, isError, error } = usePaperRuns({
    // `q` is a strategy-NAME search server-side, so an id would return nothing — it is
    // withheld here and matched against run ids client-side below.
    q: idSearch ? undefined : debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
  });

  // Symbol options follow the selected market tab, like Alpha pool.
  const symbolOptions = useMemo(
    () =>
      Array.from(
        new Set(runs.filter((r) => matchesMarket(r, market)).flatMap((r) => r.symbols.map((s) => s.symbol))),
      ).sort(),
    [runs, market],
  );

  const filtered = useMemo(
    () =>
      runs.filter(
        (r) =>
          (!idSearch || r.id.toLowerCase().includes(idNeedle)) &&
          (symbol === "all" || r.symbols.some((s) => s.symbol === symbol)) &&
          matchesMarket(r, market) &&
          matchesMetricRanges(r, ranges),
      ),
    [runs, symbol, market, idSearch, idNeedle, ranges],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedRun = runs.find((r) => r.id === selectedId) ?? null;

  // A deep link should land on its own tab: `?run=` alone would otherwise open the panel over
  // whichever market happens to be default, with the row invisible in the table behind it.
  // Compared during render (not synced in an effect, per react-hooks/set-state-in-effect) and
  // keyed on the run id, so it aligns once — the user can still switch tabs with the panel open.
  const [alignedRunId, setAlignedRunId] = useState<string | null>(null);
  if (selectedRun && alignedRunId !== selectedRun.id) {
    setAlignedRunId(selectedRun.id);
    const runMarket = marketOf(selectedRun);
    // Realign only when the current tab actually HIDES the run — comparing the run's market to
    // the tab would drag the reader off All, which was already showing the row.
    if (runMarket && !matchesMarket(selectedRun, market)) {
      setMarket(runMarket);
      setPage(1);
    }
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 bg-surface">
      <MarketTabs
        value={market}
        onChange={(m) => {
          setMarket(m);
          setPage(1);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-8 w-64 items-center gap-2 rounded-[20px] border border-border px-3">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or ID..."
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <MinimalisticMagnifer size={20} weight="Outline" className="shrink-0 text-muted-foreground" />
        </div>
        <Select
          value={symbol}
          onValueChange={(v) => {
            setSymbol(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All symbols</SelectItem>
            {symbolOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <MetricRangeFilters
          value={ranges}
          onChange={(next) => {
            setRanges(next);
            setPage(1);
          }}
        />
      </div>

      <section className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
        <div>
          {isError ? (
            <p className="p-4 text-sm text-destructive">{resourceErrorMessage(error)}</p>
          ) : isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
          ) : pageRows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No paper strategies found.</p>
          ) : (
            <PaperRunsTable rows={pageRows} selectedId={selectedId ?? undefined} onSelect={setSelectedId} />
          )}
        </div>
        {pageCount > 1 && (
          <div className="border-t border-border px-4 py-3">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      isActive={p === currentPage}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(p);
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(pageCount, p + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </section>

      <RunDetailPanel open={!!selectedRun} onOpenChange={(o) => !o && setSelectedId(null)} run={selectedRun} />
    </main>
  );
}
