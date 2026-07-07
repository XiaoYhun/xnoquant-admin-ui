"use client";
import { useMemo, useState } from "react";
import { MinimalisticMagnifer } from "@solar-icons/react";
import { usePortfolios } from "@/hooks/api/use-portfolios";
import { NewPortfolioForm } from "./new-portfolio-form";
import { PortfolioList } from "./portfolio-list";

export default function Page() {
  const { data: portfolios = [], isLoading } = usePortfolios();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return portfolios.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [portfolios, search]);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 bg-surface">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-60 items-center gap-2 rounded-[20px] border border-border px-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search portfolios..."
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <MinimalisticMagnifer size={20} weight="Outline" className="shrink-0 text-muted-foreground" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        <NewPortfolioForm />
        <PortfolioList portfolios={filtered} total={filtered.length} isLoading={isLoading} />
      </div>
    </main>
  );
}
