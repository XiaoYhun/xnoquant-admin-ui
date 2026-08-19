"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MinimalisticMagnifer } from "@solar-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useLiveRuns } from "@/hooks/api/use-live-runs";
import { useDebounced } from "@/hooks/use-debounced";
import { useUrlParam } from "@/hooks/use-url-param";
import { resourceErrorMessage } from "@/lib/api-client";
import { cn, formatPercent } from "@/lib/utils";
import { LiveRunsTable } from "./live-runs-table";
import { OrderbookPanel } from "./orderbook-panel";
import { MarketTabs, marketFromParam, marketOf, matchesMarket, type Market } from "@/components/market-tabs";
import { useOrderbookSymbols } from "@/hooks/api/use-orderbook-symbols";
import { RunDetailInline } from "../../paper-trading/run-detail-panel";

const PAGE_SIZE = 9;

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });

// KPI strip above the table (Figma 14773:24424). Two of the four cards the design shows can't
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
  const [symbolFilter, setSymbolFilter] = useState<string>("all");
  const [onlyRunning, setOnlyRunning] = useState(false);

  // Search and "Only Running" are served by `GET /api/runs` (`q`, `status`); market, symbol and
  // paging stay client-side — the API filters on neither market/symbol nor run mode.
  const debouncedSearch = useDebounced(search.trim());
  const { data: runs = [], isLoading, isError, error } = useLiveRuns({
    q: debouncedSearch || undefined,
    status: onlyRunning ? "running" : undefined,
  });
  const [page, setPage] = useState(1);
  // The open panel is in the URL (`?run=<id>`) so the view can be linked and survives reload.
  // Derived from the loaded rows rather than held separately: one source of truth, and a link to
  // a run that has since gone simply opens no panel.
  const [selectedId, setSelectedId] = useUrlParam("run");
  // The orderbook rail's symbol. Separate from `symbolFilter` above: that one narrows the table
  // and carries an "all" option, whereas the rail always shows exactly one book. `null` until the
  // user picks — the panel defaults to the first active symbol. Not tied to the market tab: the
  // options are whatever is actually running, which the tab filter would often reduce to nothing.
  const [bookSymbol, setBookSymbol] = useState<string | null>(null);
  const { data: orderbookSymbols = [] } = useOrderbookSymbols();

  // Symbol options come from the live runs in the selected market.
  const symbolOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of runs) if (matchesMarket(r, market)) for (const s of r.symbols) set.add(s.symbol);
    return [...set].sort();
  }, [runs, market]);

  const selectedRun = runs.find((r) => r.id === selectedId) ?? null;

  // A deep link should land on its own tab: `?run=` alone would otherwise open the panel over
  // whichever market happens to be default, with the row invisible in the table behind it.
  // Compared during render (not synced in an effect, per react-hooks/set-state-in-effect) and
  // keyed on the run id, so it aligns once — the user can still switch tabs with the panel open.
  const [alignedRunId, setAlignedRunId] = useState<string | null>(null);
  if (selectedRun && alignedRunId !== selectedRun.id) {
    setAlignedRunId(selectedRun.id);
    const runMarket = marketOf(selectedRun);
    if (runMarket && runMarket !== market) {
      setMarket(runMarket);
      setPage(1);
    }
  }

  const filtered = useMemo(
    () =>
      runs.filter(
        (r) =>
          (symbolFilter === "all" || r.symbols.some((s) => s.symbol === symbolFilter)) &&
          matchesMarket(r, market),
      ),
    [runs, symbolFilter, market],
  );

  // Headline numbers describe the current market tab, not the search/status narrowing.
  const kpis = useMemo(() => {
    const inMarket = runs.filter((r) => matchesMarket(r, market));
    const running = inMarket.filter((r) => r.status === "running").length;
    const paused = inMarket.filter((r) => r.status === "paused").length;
    const cumulative = inMarket.reduce((sum, r) => sum + (r.startingEquity * (r.returnPct ?? 0)) / 100, 0);
    const equity = inMarket.reduce((sum, r) => sum + r.startingEquity, 0);
    return {
      running,
      paused,
      total: inMarket.length,
      cumulative,
      returnPct: equity ? (cumulative / equity) * 100 : null,
    };
  }, [runs, market]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

      <div className="flex items-center gap-3">
        <div className="flex h-8 w-64 items-center gap-2 rounded-[20px] border border-border px-3">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="Search by strategy name..."
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
        <Select
          value={symbolFilter}
          onValueChange={(v) => {
            setSymbolFilter(v ?? "all");
            resetPage();
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
      </div>

      <div className="flex shrink-0 gap-4">
        <KpiCard
          label="Active Strategies"
          value={`${kpis.running}/${kpis.total}`}
          sub={kpis.paused ? `(${kpis.paused} paused)` : undefined}
        />
        <KpiCard
          label="Daily PnL"
          value="—"
          unavailable="HFT /api/runs doesn't expose a per-day PnL breakdown yet."
        />
        <KpiCard
          label="Cumulative PnL"
          value={kpis.cumulative ? compact.format(kpis.cumulative) : "—"}
          sub={kpis.returnPct == null ? undefined : `(${formatPercent(kpis.returnPct)})`}
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
            ) : pageRows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No live strategies found.</p>
            ) : (
              <LiveRunsTable
                rows={pageRows}
                onOpenDetail={(run) => setSelectedId(run.id)}
              />
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
            </>
          )}
        </section>

        <OrderbookPanel options={orderbookSymbols} symbol={bookSymbol} onSymbolChange={setBookSymbol} />
      </div>
    </main>
  );
}
