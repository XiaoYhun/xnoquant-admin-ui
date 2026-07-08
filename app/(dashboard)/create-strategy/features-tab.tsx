"use client";
import { useMemo, useState } from "react";
import { Code2, MinimalisticMagnifer } from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";
import { FEATURES } from "@/lib/mock/strategy-builder";

// Figma 13964:56232 — every feature is exposed as `self.feat.*` in the Python DSL. The shared
// mock only carries name/desc, so the code signature + return type are derived here.
const RETURNS_OVERRIDES: Record<string, string> = {
  macd: "Tuple[SeriesT, SeriesT, SeriesT]",
  bollinger: "Tuple[SeriesT, SeriesT]",
  stoch: "Tuple[SeriesT, SeriesT]",
};

const FEATURE_CARDS = FEATURES.map((f) => {
  const shortName = f.name.split("(")[0];
  return {
    shortName,
    signature: `self.feat.${f.name}`,
    returns: RETURNS_OVERRIDES[shortName] ?? "SeriesT",
    desc: f.desc,
  };
});

export function FeaturesTab() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FEATURE_CARDS;
    return FEATURE_CARDS.filter(
      (f) => f.shortName.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex h-8 items-center gap-2 rounded-[20px] border border-border px-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search features..."
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
        <MinimalisticMagnifer size={20} weight="Outline" className="shrink-0 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-2">
        {filtered.map((f) => (
          <div
            key={f.shortName}
            className="group flex items-center gap-3 rounded-xl border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:bg-secondary/40"
          >
            <span className="flex shrink-0 items-center justify-center rounded-lg bg-[#d5d4ff] p-1.5">
              <Code2 weight="Bold" className="size-4 text-[#151a24]" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="flex-1 truncate text-sm font-medium text-white">{f.shortName}</span>
                <Badge
                  variant="outline"
                  className="shrink-0 rounded-lg border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                >
                  Returns: {f.returns}
                </Badge>
              </div>
              <p className="truncate font-mono text-sm text-[#66d9ef]">{f.signature}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">No features match &quot;{query}&quot;.</p>
        )}
      </div>
    </div>
  );
}
