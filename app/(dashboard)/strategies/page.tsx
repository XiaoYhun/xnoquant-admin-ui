"use client";
import { useMemo, useState } from "react";
import { MinimalisticMagnifer } from "@solar-icons/react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useStrategies } from "@/hooks/api/use-strategies";
import { useMode } from "@/store/mode-store";
import { StrategyAnalyticsHeader } from "./strategy-analytics";
import { StrategiesTable } from "./strategies-table";

const PAGE_SIZE = 10;

export default function Page() {
  const { data: strategies = [], isLoading } = useStrategies();
  const mode = useMode();
  // The MFT/HFT split is driven by the global lab mode (Figma 13964-56847) — the old
  // in-header toggle was removed. StrategyRow.group is "MFT"/"HFT" (uppercase).
  const group = mode === "hft" ? "HFT" : "MFT";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Reset to the first page whenever the mode switches (row set changes) — React's
  // adjust-state-during-render pattern, avoiding a setState-in-effect.
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return strategies.filter((s) => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q);
      const matchesGroup = s.group === group;
      return matchesSearch && matchesGroup;
    });
  }, [strategies, search, group]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 bg-surface">
      <StrategyAnalyticsHeader />

      <div className="flex items-center justify-between gap-3">
        <div className="flex h-8 w-60 items-center gap-2 rounded-[20px] border border-border px-3">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search strategies..."
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <MinimalisticMagnifer size={20} weight="Outline" className="shrink-0 text-muted-foreground" />
        </div>
      </div>

      <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
        <div>
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
          ) : pageRows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No strategies found.</p>
          ) : (
            <StrategiesTable rows={pageRows} />
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
    </main>
  );
}
