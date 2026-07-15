"use client";
// OWNED BY: Create Strategy "HFT Samples tab" agent — Figma node 14562:20367.
// Taker/Maker/Arbitrage sub-tabs + static curated sample cards ("View source" expands the code
// inline, "Use template" loads it into the editor) + a static Script API Reference block.
import { useState } from "react";
import { CheckCircle, Code, Database, NotebookBookmark } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { HFT_SAMPLES, HFT_SCRIPT_API_REFERENCE, type HftSample } from "@/lib/mock/hft-strategy-samples";

const STRATEGY_TYPES = ["taker", "maker", "arbitrage"] as const;
type StrategyType = (typeof STRATEGY_TYPES)[number];
const TYPE_LABEL: Record<StrategyType, string> = { taker: "Taker", maker: "Maker", arbitrage: "Arbitrage" };

export function HftSamplesTab({ onUseTemplate }: { onUseTemplate?: (code: string) => void }) {
  const [type, setType] = useState<StrategyType>("taker");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const samples: HftSample[] = HFT_SAMPLES[type];
  const ref = HFT_SCRIPT_API_REFERENCE[type];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex h-9 items-center gap-1 rounded-full border border-border p-1">
        {STRATEGY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "flex-1 cursor-pointer rounded-full py-1.5 text-xs transition-colors",
              t === type ? "bg-secondary font-semibold text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {samples.map((s) => {
          const isExpanded = s.id === expandedId;
          return (
            <div key={s.id} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-start gap-3">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "#D5D4FF" }}
                >
                  <Database weight="Outline" className="size-4 text-black/70" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{s.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-border bg-black px-3 text-xs text-white"
                >
                  <Code weight="Bold" className="size-4" />
                  View source
                </button>
                <button
                  type="button"
                  onClick={() => onUseTemplate?.(s.code)}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-[linear-gradient(163deg,#cff8ea_0%,#67e1c1_100%)] px-3 text-xs text-black"
                >
                  <CheckCircle weight="Outline" className="size-4" />
                  Use template
                </button>
              </div>
              {isExpanded && (
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre rounded-lg border border-border bg-black p-3 font-mono text-xs leading-relaxed text-[#e1e4e8]">
                  {s.code.trim()}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <NotebookBookmark weight="Outline" className="size-5 text-muted-foreground" />
          <h3 className="text-sm font-medium text-white">Script API Reference</h3>
        </div>
        <div className="rounded-xl border border-border p-3 text-xs leading-relaxed text-muted-foreground">
          <p>{ref.intro}</p>

          <p className="mt-3 font-semibold text-white">Function</p>
          <p className="mt-2 font-mono text-xs font-semibold text-white">{ref.functionSig}</p>
          <p className="mt-0.5">{ref.functionDoc}</p>

          <p className="mt-3 font-semibold text-white">Scope</p>
          {ref.scope.map((entry) => (
            <div key={entry.name} className="mt-2">
              <p className="font-mono text-xs font-semibold text-white">{entry.name}</p>
              <p className="mt-0.5">{entry.doc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
