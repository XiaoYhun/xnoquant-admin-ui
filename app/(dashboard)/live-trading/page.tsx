"use client";
import { useMemo, useState } from "react";
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
import { LiveRunsTable } from "./live-runs-table";
import { LiveRunDetailPanel } from "./live-run-detail-panel";
import type { LiveRunRow } from "@/lib/mock/live-runs";

const PAGE_SIZE = 9;
const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "running", label: "Running" },
  { value: "paused", label: "Paused" },
  { value: "stopped", label: "Stopped" },
  { value: "failed", label: "Failed" },
  { value: "completed", label: "Completed" },
];

export default function Page() {
  const { data: runs = [], isLoading } = useLiveRuns();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedRun, setSelectedRun] = useState<LiveRunRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return runs.filter((r) => {
      const matchesSearch =
        !q || r.id.toLowerCase().includes(q) || r.strategyName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [runs, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 bg-surface">
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
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v ?? "all");
            setPage(1);
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

      <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
        <div>
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading&hellip;</p>
          ) : pageRows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No live strategies found.</p>
          ) : (
            <LiveRunsTable
              rows={pageRows}
              onOpenDetail={(run) => {
                setSelectedRun(run);
                setDetailOpen(true);
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

      <LiveRunDetailPanel open={detailOpen} onOpenChange={setDetailOpen} run={selectedRun} />
    </main>
  );
}
