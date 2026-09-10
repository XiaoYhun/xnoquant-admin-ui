"use client";
import { Suspense, useMemo, useState } from "react";
import { PageSizeSelect } from "@/components/page-size-select";
import { TablePagination } from "@/components/table-pagination";
import { useSearchParams } from "next/navigation";
import { MinimalisticMagnifer } from "@solar-icons/react";
import { useLiveRunCounts, useLiveRuns } from "@/hooks/api/use-live-runs";
import { useSelectedRunRow } from "@/hooks/api/use-runs";
import { useDebounced } from "@/hooks/use-debounced";
import { usePageSize } from "@/hooks/use-page-size";
import { useUrlParam } from "@/hooks/use-url-param";
import { resourceErrorMessage } from "@/lib/api-client";
import {
  EMPTY_METRIC_RANGES,
  MetricRangeFilters,
  metricRangeParams,
  type MetricRanges,
} from "@/components/metric-range-filters";
import { cn, runSearchQuery } from "@/lib/utils";
import { LiveRunsTable } from "./live-runs-table";
import { OrderbookPanel } from "./orderbook-panel";
import {
  ALL_MARKETS,
  MarketTabs,
  assetKindOf,
  marketFromParam,
  marketOf,
  matchesMarket,
  type Market,
} from "@/components/market-tabs";
import { ALL_SYMBOLS, SymbolFilter } from "@/components/symbol-filter";
import { useOrderbookSymbols } from "@/hooks/api/use-orderbook-symbols";
import { RunDetailInline } from "../../paper-trading/run-detail-panel";


// KPI strip above the table (Figma 14773:24424). Three of the four cards the design shows can't
// be computed from what `/api/runs` returns — see the `unavailable` note at each call site.
function KpiCard({
  label,
  value,
  sub,
  unavailable,
}: {
  label: string;
  value: string;
  sub?: string;
  unavailable?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-border bg-background px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2" title={unavailable}>
        <span className={cn("truncate text-lg font-semibold", unavailable ? "text-muted-foreground" : "text-white")}>
          {value}
        </span>
        {sub && <span className="shrink-0 text-xs text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}

// "Only Running" label + switch (Figma 14777:26405) — borderless, unlike the pill selects
// beside it. No switch primitive exists in components/ui yet.
function OnlyRunningToggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex h-8 cursor-pointer items-center gap-2 text-xs text-foreground"
    >
      Only Running
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          on ? "bg-[#67e1c1]" : "bg-secondary",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3 rounded-full bg-white transition-all",
            on ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

// `useSearchParams` needs a Suspense boundary in the App Router.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <LiveTrade />
    </Suspense>
  );
}

function LiveTrade() {
  const searchParams = useSearchParams();
  // Starting a run from Alpha pool links here with `?market=` so its tab opens selected.
  const [market, setMarket] = useState<Market>(() => marketFromParam(searchParams.get("market")));
  const [search, setSearch] = useState("");
  const [symbolFilter, setSymbolFilter] = useState(ALL_SYMBOLS);
  const [onlyRunning, setOnlyRunning] = useState(false);
  const [ranges, setRanges] = useState<MetricRanges>(EMPTY_METRIC_RANGES);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();

  // Every control on this toolbar is served by `GET /api/runs` — search, Only Running, market
  // tab, symbol, the three metric bounds and the page itself. Nothing is narrowed in the browser,
  // so the row count below is the real one and page 2 holds the rows page 1 didn't.
  // The two free-typed groups are debounced: otherwise each keystroke is a request.
  const debouncedSearch = useDebounced(search);
  const debouncedRanges = useDebounced(ranges);
  const { data, isLoading, isError, error } = useLiveRuns({
    q: runSearchQuery(debouncedSearch),
    status: onlyRunning ? "running" : undefined,
    asset_kind: assetKindOf(market),
    symbol: symbolFilter === ALL_SYMBOLS ? undefined : symbolFilter,
    ...metricRangeParams(debouncedRanges),
    page: page - 1, // the API counts pages from 0
    size: pageSize,
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  // The open panel is in the URL (`?run=<id>`) so the view can be linked and survives reload.
  const [selectedId, setSelectedId] = useUrlParam("run");
  // The orderbook rail's symbol. Separate from `symbolFilter` above: that one narrows the table
  // and carries an "all" option, whereas the rail always shows exactly one book. `null` until the
  // user picks — the panel defaults to the first symbol of the market tab.
  const [bookSymbol, setBookSymbol] = useState<string | null>(null);
  const allOrderbookSymbols = useOrderbookSymbols();
  // The rail follows the market tab: the catalog spans every venue, so without this the picker
  // opens on an unrelated market's instrument. A symbol picked under one tab simply isn't in the
  // next tab's options, and the panel falls back to that market's first symbol. On All the whole
  // catalog is offered — an empty rail would be the alternative, since no symbol is tagged "all".
  const orderbookSymbols = useMemo(
    () => (market === ALL_MARKETS ? allOrderbookSymbols : allOrderbookSymbols.filter((o) => o.market === market)),
    [allOrderbookSymbols, market],
  );

  const selectedRun = useSelectedRunRow(rows, selectedId);

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

  // Counted by the server, not summed over the rows: the table holds one page now, so a headline
  // added up from it would describe that page rather than the market.
  const { data: counts } = useLiveRunCounts(assetKindOf(market));

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // A refetch can shrink the result set under a reader who is already past its new end — a bot
  // stopped elsewhere. Corrected during render rather than in an effect, same as the
  // `alignedRunId` sync above.
  if (page > pageCount) setPage(pageCount);

  const resetPage = () => setPage(1);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 bg-surface">
      <MarketTabs
        value={market}
        onChange={(m) => {
          setMarket(m);
          resetPage();
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-8 w-64 items-center gap-2 rounded-[20px] border border-border px-3">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="Search by name or ID..."
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <MinimalisticMagnifer size={20} weight="Outline" className="shrink-0 text-muted-foreground" />
        </div>
        <OnlyRunningToggle
          on={onlyRunning}
          onChange={(next) => {
            setOnlyRunning(next);
            resetPage();
          }}
        />
        <SymbolFilter
          market={market}
          value={symbolFilter}
          onChange={(v) => {
            setSymbolFilter(v);
            resetPage();
          }}
        />
        <MetricRangeFilters
          value={ranges}
          onChange={(next) => {
            setRanges(next);
            resetPage();
          }}
        />
        <PageSizeSelect
          className="ml-auto"
          value={pageSize}
          onChange={(size) => {
            setPageSize(size);
            resetPage();
          }}
        />
      </div>

      <div className="flex shrink-0 gap-4">
        <KpiCard
          label="Active Strategies"
          value={counts ? `${counts.running}/${counts.total}` : "—"}
          sub={counts?.paused ? `(${counts.paused} paused)` : undefined}
        />
        <KpiCard
          label="Daily PnL"
          value="—"
          unavailable="HFT /api/runs doesn't expose a per-day PnL breakdown yet."
        />
        <KpiCard
          label="Cumulative PnL"
          value="—"
          unavailable="Summing PnL needs every live run; /api/runs pages them and totals none of them."
        />
        <KpiCard
          label="Net Exposure"
          value="—"
          unavailable="HFT /api/runs doesn't expose open positions yet."
        />
      </div>

      <div className="flex min-h-0 gap-4">
        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 shrink-0 flex-col rounded-xl border border-border bg-background",
            // The table needs clipping for its rounded corners; the detail panel must not clip,
            // or its corner close button gets cut off.
            selectedRun ? "overflow-visible" : "overflow-hidden",
          )}
        >
          {/* The run detail takes over this box rather than sliding in over the viewport (as it
              does on Paper Trading / Backtesting), so the orderbook rail stays visible beside it.
              Mounted only while open — unmounting drops the run's `/live/stream` subscription. */}
          {selectedRun ? (
            <RunDetailInline run={selectedRun} onClose={() => setSelectedId(null)} />
          ) : (
            <>
          <div className="min-w-0 overflow-x-auto">
            {isError ? (
              <p className="p-4 text-sm text-destructive">{resourceErrorMessage(error)}</p>
            ) : isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No live strategies found.</p>
            ) : (
              <LiveRunsTable rows={rows} onOpenDetail={(run) => setSelectedId(run.id)} />
            )}
          </div>
          {pageCount > 1 && (
            <div className="border-t border-border px-4 py-3">
              <TablePagination currentPage={page} pageCount={pageCount} onPageChange={setPage} />
            </div>
          )}
            </>
          )}
        </section>

        <OrderbookPanel options={orderbookSymbols} symbol={bookSymbol} onSymbolChange={setBookSymbol} />
      </div>
    </main>
  );
}
