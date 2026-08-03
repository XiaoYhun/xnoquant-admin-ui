"use client";
import { useMemo, useState } from "react";
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
import { resourceErrorMessage } from "@/lib/api-client";
import { PaperRunsTable } from "./paper-runs-table";
import { RunDetailPanel } from "./run-detail-panel";

const PAGE_SIZE = 9;

export default function Page() {
  const [search, setSearch] = useState("");
  const [symbol, setSymbol] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Search and status are served by `GET /api/runs` (`q`, `status`); symbol and paging stay
  // client-side — the API offers no symbol filter, and no `mode` filter to page paper runs by.
  const debouncedSearch = useDebounced(search.trim());
  const { data: runs = [], isLoading, isError, error } = usePaperRuns({
    q: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
  });

  const symbolOptions = useMemo(
    () => Array.from(new Set(runs.flatMap((r) => r.symbols.map((s) => s.symbol)))).sort(),
    [runs],
  );

  const filtered = useMemo(
    () => runs.filter((r) => symbol === "all" || r.symbols.some((s) => s.symbol === symbol)),
    [runs, symbol],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedRun = runs.find((r) => r.id === selectedId) ?? null;

  return (
    <main className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 bg-surface">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-64 items-center gap-2 rounded-[20px] border border-border px-3">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by strategy name..."
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
