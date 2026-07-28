"use client";
// OWNED BY: Create Strategy "HFT Samples tab" agent — Figma node 14562:20367.
// Taker/Maker/Arbitrage sub-tabs + static curated sample cards ("View source" expands the code
// inline, "Use template" loads it into the editor) + a static Script API Reference block.
import { useState } from "react";
import { CheckCircle, Code, Database, NotebookBookmark } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { HFT_SAMPLES, type HftSample } from "@/lib/mock/hft-strategy-samples";

const STRATEGY_TYPES = ["taker", "maker", "arbitrage"] as const;
type StrategyType = (typeof STRATEGY_TYPES)[number];
const TYPE_LABEL: Record<StrategyType, string> = { taker: "Taker", maker: "Maker", arbitrage: "Arbitrage" };


// Script API Reference — Figma 14562:20713. Each entry is either a heading or a white identifier,
// followed by the muted prose describing it; rendered as one 12px/18px stack.
const API_REFERENCE: { text: string; strong?: boolean }[] = [
  { text: "Runs once per tick. Call return target_pos_intent(...) to act this tick; falling through holds (no order)." },
  { text: "Function" },
  { text: "target_pos_intent(symbol: int, qty: float, style: string)", strong: true },
  {
    text: 'symbol = engine SymbolId (pass the symbol variable below). qty = signed target position: positive long, negative short, 0.0 flattens. style = "market" (sweep now), "cross" (marketable at touch), "join" (passive at touch), or "mid" (passive at mid).',
  },
  { text: "Scope" },
  { text: "features", strong: true },
  { text: "this strategy\u2019s feature values, in the order defined above \u2014 features[0], features[1], \u2026 NaN until that feature\u2019s window warms up." },
  { text: "symbol", strong: true },
  { text: "this run\u2019s SymbolId \u2014 pass straight to target_pos_intent." },
  { text: "positions", strong: true },
  { text: "signed position per symbol, indexed by SymbolId." },
  { text: "asset_features", strong: true },
  { text: "features[] per symbol \u2014 cross-sectional access via asset_features[sym_id][feature_idx]." },
];

function ScriptApiReference() {
  return (
    <div className="flex w-full flex-col items-start">
      <div className="flex h-10 w-full items-center gap-2 rounded overflow-hidden py-3">
        <NotebookBookmark weight="Outline" className="size-6 shrink-0 text-white" />
        <span className="min-w-0 flex-1 truncate text-sm text-white">Script API Reference</span>
      </div>
      <div className="flex w-full items-center gap-3 rounded-xl border border-[#1d2939] px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {API_REFERENCE.map((line, i) => (
            <p key={i} className={`text-xs leading-[18px] ${line.strong ? "text-white" : "text-[#9db2ce]"}`}>
              {line.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HftSamplesTab({ onUseTemplate }: { onUseTemplate?: (code: string, features: HftSample["features"]) => void }) {
  const [type, setType] = useState<StrategyType>("taker");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const samples: HftSample[] = HFT_SAMPLES[type];

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
                  onClick={() => onUseTemplate?.(s.code, s.features)}
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

      <ScriptApiReference />
    </div>
  );
}
