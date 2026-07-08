"use client";
import { useMemo, useState } from "react";
import { Database, MinimalisticMagnifer } from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";
import { useDataFunctions } from "@/hooks/api/use-strategy-builder";

export function DataTab() {
  const [query, setQuery] = useState("");
  const { data, isPending, isError } = useDataFunctions();

  const filtered = useMemo(() => {
    const datasets = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return datasets;
    return datasets.filter(
      (d) => d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex h-8 items-center gap-2 rounded-[20px] border border-border px-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search datasets..."
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
        <MinimalisticMagnifer size={20} weight="Outline" className="shrink-0 text-muted-foreground" />
      </div>
      {isPending && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Loading…</p>}
      {isError && <p className="px-1 py-4 text-center text-xs text-destructive">Couldn&apos;t load datasets.</p>}
      {!isPending && !isError && (
        <div className="flex flex-col gap-2">
          {filtered.map((d) => (
            <div
              key={d.name}
              className="group flex items-center gap-3 rounded-xl border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:bg-secondary/40"
            >
              <span className="flex shrink-0 items-center justify-center rounded-lg bg-[#d5d4ff] p-1.5">
                <Database weight="Bold" className="size-4 text-[#151a24]" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="flex-1 truncate text-sm font-medium text-white">{d.name}</span>
                  <Badge variant="outline" className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold">
                    {d.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{d.desc}</p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-1 py-4 text-center text-xs text-muted-foreground">No datasets match &quot;{query}&quot;.</p>
          )}
        </div>
      )}
    </div>
  );
}
