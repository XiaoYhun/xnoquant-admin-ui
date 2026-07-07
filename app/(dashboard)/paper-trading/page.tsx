"use client";
import { useMemo, useState } from "react";
import { MinimalisticMagnifer } from "@solar-icons/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { PaperRunsTable } from "./paper-runs-table";
import { RunDetailPanel } from "./run-detail-panel";
import type { PaperRunRow } from "@/lib/mock/paper-runs";
import { useLiveTicks } from "@/hooks/use-live-ticks";

const PAGE_SIZE = 9;
const GROUP_TABS: { value: PaperRunRow["strategyType"]; label: string }[] = [
  { value: "MFT", label: "MFT Strategies" },
  { value: "HFT", label: "HFT Strategies" },
];

export default function Page() {
  const { data: runs = [], isLoading } = usePaperRuns();
  useLiveTicks<PaperRunRow>(["paper-runs"]);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<PaperRunRow["strategyType"]>("MFT");
  const [symbol, setSymbol] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const symbolOptions = useMemo(
    () => Array.from(new Set(runs.flatMap((r) => r.symbols.map((s) => s.symbol)))).sort(),
    [runs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return runs.filter((r) => {
      const matchesSearch = !q || r.id.toLowerCase().includes(q) || r.strategyName.toLowerCase().includes(q);
      const matchesGroup = r.strategyType === group;
      const matchesSymbol = symbol === "all" || r.symbols.some((s) => s.symbol === symbol);
      const matchesStatus = status === "all" || r.status === status;
      return matchesSearch && matchesGroup && matchesSymbol && matchesStatus;
    });
  }, [runs, search, group, symbol, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedRun = runs.find((r) => r.id === selectedId) ?? null;

  return (
    <main className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-64 items-center gap-2 rounded-[20px] border border-border px-3">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by ID or strategy..."
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
        <Tabs
          value={group}
          onValueChange={(v) => {
            setGroup((v as PaperRunRow["strategyType"]) ?? "MFT");
            setPage(1);
          }}
        >
          <TabsList>
            {GROUP_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <section className="flex flex-col overflow-hidden">
        <div>
          {isLoading ? (
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

      {selectedRun && (
        <>
          <div className="absolute inset-0 z-10 bg-black/60" onClick={() => setSelectedId(null)} />
          <div className="absolute inset-y-0 right-0 z-20 w-full max-w-[520px] overflow-y-auto border-l border-border bg-background shadow-2xl">
            <RunDetailPanel run={selectedRun} onClose={() => setSelectedId(null)} />
          </div>
        </>
      )}
    </main>
  );
}
