"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useLiveBasket } from "@/hooks/api/use-live-basket";
import { useRuns } from "@/hooks/api/use-runs";
import { toPaperRunRow } from "@/lib/transform/runs";
import { resourceErrorMessage } from "@/lib/api-client";
import { AlphaPoolTable } from "./alpha-pool-table";
import { MarketTabs, matchesMarket, marketFromParam, marketOf, type Market } from "@/components/market-tabs";
import { RunDetailPanel } from "../../paper-trading/run-detail-panel";
import type { PaperRunRow } from "@/lib/mock/paper-runs";
import type { LiveBasketMember } from "@/types/domain";

// Alpha pool = the live basket (Figma 14756:46805). Each member is a strategy an admin approved
// for live trading; `based_on_run_id` points at the paper/backtest run whose results justified it,
// which is where the row's status/account/symbol/metric columns come from.
export type AlphaPoolRow = { member: LiveBasketMember; run: PaperRunRow | null };

const PAGE_SIZE = 9;
const STATUS_FILTERS = [
  { value: "all", label: "All status" },
  { value: "running", label: "Running" },
  { value: "paused", label: "Paused" },
  { value: "stopped", label: "Stopped" },
  { value: "failed", label: "Failed" },
  { value: "completed", label: "Completed" },
];

// `useSearchParams` needs a Suspense boundary in the App Router.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <AlphaPool />
    </Suspense>
  );
}

function AlphaPool() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: members = [], isLoading, isError, error } = useLiveBasket();
  const { data: runs = [] } = useRuns();

  // Promotion links here with `?market=` so the promoted run's tab opens selected.
  const [market, setMarket] = useState<Market>(() => marketFromParam(searchParams.get("market")));
  const [search, setSearch] = useState("");
  const [symbolFilter, setSymbolFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedRun, setSelectedRun] = useState<PaperRunRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const rows = useMemo<AlphaPoolRow[]>(() => {
    const byId = new Map(runs.map((r) => [r.id, toPaperRunRow(r)]));
    return members.map((member) => ({
      member,
      run: member.based_on_run_id ? (byId.get(member.based_on_run_id) ?? null) : null,
    }));
  }, [members, runs]);

  // Symbol options come from what's actually in the pool for the selected market.
  const symbolOptions = useMemo(() => {
    const set = new Set<string>();
    for (const { run } of rows) {
      if (run && matchesMarket(run, market)) for (const s of run.symbols) set.add(s.symbol);
    }
    return [...set].sort();
  }, [rows, market]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(({ member, run }) => {
      const matchesSearch =
        !q || member.strategy_name.toLowerCase().includes(q) || (run?.id.toLowerCase().includes(q) ?? false);
      const matchesStatus = statusFilter === "all" || run?.status === statusFilter;
      const matchesSymbol = symbolFilter === "all" || (run?.symbols.some((s) => s.symbol === symbolFilter) ?? false);
      // A member promoted without a source run has no market to attribute it to — keep it
      // visible on every tab rather than hiding it everywhere.
      const inMarket = !run || matchesMarket(run, market);
      return matchesSearch && matchesStatus && matchesSymbol && inMarket;
    });
  }, [rows, search, statusFilter, symbolFilter, market]);

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
            placeholder="Search by ID or strategy..."
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <MinimalisticMagnifer size={20} weight="Outline" className="shrink-0 text-muted-foreground" />
        </div>
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
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v ?? "all");
            resetPage();
          }}
        >
          <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3 text-xs text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
        <div className="overflow-x-auto">
          {isError ? (
            <p className="p-4 text-sm text-destructive">{resourceErrorMessage(error, "the live basket")}</p>
          ) : isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
          ) : pageRows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Nothing in the alpha pool yet. Promote a strategy from Paper Trading to add it here.
            </p>
          ) : (
            <AlphaPoolTable
              rows={pageRows}
              onOpenDetail={({ run }) => {
                if (!run) return;
                setSelectedRun(run);
                setDetailOpen(true);
              }}
              onStarted={(run) => {
                const started = marketOf(run);
                router.push(`/live-trading/live-trade${started ? `?market=${started}` : ""}`);
              }}
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
      </section>

      <RunDetailPanel open={detailOpen} onOpenChange={setDetailOpen} run={selectedRun} />
    </main>
  );
}
