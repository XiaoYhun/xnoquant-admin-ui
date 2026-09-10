"use client";
import { Suspense, useState } from "react";
import { PageSizeSelect } from "@/components/page-size-select";
import { TablePagination } from "@/components/table-pagination";
import { MinimalisticMagnifer } from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePaperRuns } from "@/hooks/api/use-paper-runs";
import { useSelectedRunRow } from "@/hooks/api/use-runs";
import { useDebounced } from "@/hooks/use-debounced";
import { runSearchQuery } from "@/lib/utils";
import { usePageSize } from "@/hooks/use-page-size";
import { useUrlParam } from "@/hooks/use-url-param";
import {
  DEFAULT_MARKET,
  MarketTabs,
  assetKindOf,
  marketOf,
  matchesMarket,
  type Market,
} from "@/components/market-tabs";
import { ALL_SYMBOLS, SymbolFilter } from "@/components/symbol-filter";
import { resourceErrorMessage } from "@/lib/api-client";
import {
  EMPTY_METRIC_RANGES,
  MetricRangeFilters,
  metricRangeParams,
  type MetricRanges,
} from "@/components/metric-range-filters";
import { PaperRunsTable } from "./paper-runs-table";
import { RunDetailPanel } from "./run-detail-panel";


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
  const [symbol, setSymbol] = useState(ALL_SYMBOLS);
  const [status, setStatus] = useState("all");
  const [ranges, setRanges] = useState<MetricRanges>(EMPTY_METRIC_RANGES);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  // The open panel is in the URL (`?run=<id>`) so the view can be linked and survives reload.
  const [selectedId, setSelectedId] = useUrlParam("run");

  // Every control on this toolbar is served by `GET /api/runs` — search, status, market tab,
  // symbol, the three metric bounds and the page itself. Nothing is narrowed in the browser, so
  // the row count below is the real one and page 2 holds the rows page 1 didn't.
  // The two free-typed groups are debounced: otherwise each keystroke is a request.
  const debouncedSearch = useDebounced(search);
  const debouncedRanges = useDebounced(ranges);
  const { data, isLoading, isError, error } = usePaperRuns({
    q: runSearchQuery(debouncedSearch),
    status: status === "all" ? undefined : status,
    asset_kind: assetKindOf(market),
    symbol: symbol === ALL_SYMBOLS ? undefined : symbol,
    ...metricRangeParams(debouncedRanges),
    page: page - 1, // the API counts pages from 0
    size: pageSize,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const selectedRun = useSelectedRunRow(rows, selectedId);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // A refetch can shrink the result set under a reader who is already past its new end — a run
  // stopped or removed elsewhere. Corrected during render rather than in an effect, same as the
  // `alignedRunId` sync below.
  if (page > pageCount) setPage(pageCount);

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
        <SymbolFilter
          market={market}
          value={symbol}
          onChange={(v) => {
            setSymbol(v);
            setPage(1);
          }}
        />
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
        <PageSizeSelect
          className="ml-auto"
          value={pageSize}
          onChange={(size) => {
            setPageSize(size);
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
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No paper strategies found.</p>
          ) : (
            <PaperRunsTable rows={rows} selectedId={selectedId ?? undefined} onSelect={setSelectedId} />
          )}
        </div>
        {pageCount > 1 && (
          <div className="border-t border-border px-4 py-3">
            <TablePagination currentPage={page} pageCount={pageCount} onPageChange={setPage} />
          </div>
        )}
      </section>

      <RunDetailPanel open={!!selectedRun} onOpenChange={(o) => !o && setSelectedId(null)} run={selectedRun} />
    </main>
  );
}
