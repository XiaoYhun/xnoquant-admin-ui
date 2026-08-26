"use client";
// OWNED BY: Create Strategy "HFT Samples tab" agent — Figma node 14562:20367.
// Taker/Maker/Arbitrage sub-tabs + static curated sample cards ("View source" expands the code
// inline, "Use template" loads it into the editor) + Script API Reference from
// `GET /api/strategies/script-api` (filtered to the selected strategy type).
import { useMemo, useState } from "react";
import { CheckCircle, Code, Database, NotebookBookmark } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { resourceErrorMessage } from "@/lib/api-client";
import { HFT_SAMPLES, type HftSample } from "@/lib/mock/hft-strategy-samples";
import {
  paramSummary,
  useScriptApi,
  withApiHeader,
  type StrategyScriptApi,
} from "@/hooks/api/use-hft-script-api";

const STRATEGY_TYPES = ["taker", "maker", "arbitrage"] as const;
type StrategyType = (typeof STRATEGY_TYPES)[number];
const TYPE_LABEL: Record<StrategyType, string> = { taker: "Taker", maker: "Maker", arbitrage: "Arbitrage" };

// Script API Reference — Figma 14562:20713. Flat 12px/18px stack: muted prose, white identifiers.
function ScriptApiReference({ type }: { type: StrategyType }) {
  const { data: apis, isPending, isError, error } = useScriptApi();
  const api = apis?.find((a) => a.strategy_type === type);

  return (
    <div className="flex w-full flex-col items-start">
      <div className="flex h-10 w-full items-center gap-2 overflow-hidden rounded py-3">
        <NotebookBookmark weight="Outline" className="size-6 shrink-0 text-white" />
        <span className="min-w-0 flex-1 truncate text-sm text-white">Script API Reference</span>
      </div>
      <div className="flex w-full items-center gap-3 rounded-xl border border-[#1d2939] px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {isPending ? (
            <p className="text-xs leading-[18px] text-[#9db2ce]">Loading script API reference…</p>
          ) : isError ? (
            <p className="text-xs leading-[18px] text-destructive">
              {resourceErrorMessage(error, "the script API reference")}
            </p>
          ) : !api ? (
            <p className="text-xs leading-[18px] text-[#9db2ce]">No script API reference for this type.</p>
          ) : (
            <ScriptApiBody api={api} />
          )}
        </div>
      </div>
    </div>
  );
}

function ScriptApiBody({ api }: { api: StrategyScriptApi }) {
  const mainFn = api.functions[0]?.name ?? "";
  return (
    <>
      <p className="text-xs leading-[18px] text-[#9db2ce]">
        {api.intro}
        {mainFn ? (
          <>
            {" "}
            Call return {mainFn}(...) to act this tick; falling through holds (no order).
          </>
        ) : null}
      </p>
      {api.functions.length > 0 && (
        <>
          <p className="text-xs leading-[18px] text-[#9db2ce]">Function</p>
          {api.functions.map((fn) => {
            const widest = fn.overloads[fn.overloads.length - 1];
            const sig = widest?.params.map((p) => `${p.name}: ${p.ty}`).join(", ") ?? "";
            return (
              <div key={fn.name}>
                <p className="text-xs leading-[18px] text-white">
                  {fn.name}({sig})
                </p>
                <p className="text-xs leading-[18px] text-[#9db2ce]">{paramSummary(fn)}</p>
              </div>
            );
          })}
        </>
      )}
      {api.scope.length > 0 && (
        <>
          <p className="text-xs leading-[18px] text-[#9db2ce]">Scope</p>
          {api.scope.map((s) => (
            <div key={s.name}>
              <p className="text-xs leading-[18px] text-white">{s.name}</p>
              <p className="text-xs leading-[18px] text-[#9db2ce]">{s.description}</p>
            </div>
          ))}
        </>
      )}
    </>
  );
}

export function HftSamplesTab({ onUseTemplate }: { onUseTemplate?: (code: string, features: HftSample["features"]) => void }) {
  const [type, setType] = useState<StrategyType>("taker");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Same cache entry the reference below reads. The scaffold ([0]) is the one sample whose body IS
  // the instruction header, so it gets the live one — the same code a new strategy is seeded with.
  // The curated templates after it are hand-written strategies and stay as transcribed.
  const { data: apis } = useScriptApi();
  const samples: HftSample[] = useMemo(() => {
    const api = apis?.find((a) => a.strategy_type === type);
    if (!api) return HFT_SAMPLES[type];
    return HFT_SAMPLES[type].map((s, i) => (i === 0 ? { ...s, code: withApiHeader(s.code, api) } : s));
  }, [apis, type]);

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

      <ScriptApiReference type={type} />
    </div>
  );
}
