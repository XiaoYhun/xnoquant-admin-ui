"use client";
import { useMemo, useState } from "react";
import { Database, MinimalisticMagnifer } from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";

// Figma's Data tab-state frame (section 14294:101743) was unreachable — the MCP hit its rate
// limit before it could be located. This follows the same search + card list pattern as
// Features/Operators: datasets and universes available to a strategy via `self.data.*`.
type Dataset = { name: string; category: string; desc: string };

const DATASETS: Dataset[] = [
  { name: "OHLCV", category: "Market", desc: "Open, high, low, close, volume bars for the active symbol and timeframe." },
  { name: "Order Book L2", category: "Market", desc: "Level-2 order book depth snapshots." },
  { name: "Trades", category: "Market", desc: "Raw executed trade tape." },
  { name: "Funding Rate", category: "Derivatives", desc: "Perpetual futures funding rate." },
  { name: "Open Interest", category: "Derivatives", desc: "Aggregated open interest across venues." },
  { name: "VN30 Universe", category: "Universe", desc: "Constituent list of the VN30 index." },
  { name: "Crypto Top 100", category: "Universe", desc: "Top 100 crypto assets by market cap." },
  { name: "Macro Calendar", category: "Reference", desc: "Scheduled macroeconomic events and releases." },
];

export function DataTab() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DATASETS;
    return DATASETS.filter(
      (d) => d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q),
    );
  }, [query]);

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
    </div>
  );
}
