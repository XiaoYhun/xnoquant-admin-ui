import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { HftStrategyType } from "@/hooks/api/use-hft-strategies";

// `GET /api/strategies/script-api` — the Rhai scripting surface (functions + scope vars) for
// every strategy type. Same table the backend "Check" validator is generated from, so the UI
// reference can't drift from what compiles. Response is UNTYPED in OpenAPI (`content?: never`);
// shape confirmed against hft-platform `common::strategy_script_api`.

export type RhaiChoiceDoc = { value: string; description: string };
export type RhaiParamDoc = {
  name: string;
  ty: string;
  description: string;
  choices: RhaiChoiceDoc[];
};
export type RhaiOverload = { params: RhaiParamDoc[] };
export type RhaiFunctionDoc = {
  name: string;
  summary: string;
  overloads: RhaiOverload[];
};
export type ScopeVarDoc = { name: string; description: string };
export type StrategyScriptApi = {
  strategy_type: HftStrategyType;
  intro: string;
  functions: RhaiFunctionDoc[];
  scope: ScopeVarDoc[];
};

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function normalizeChoice(raw: unknown): RhaiChoiceDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const value = asString(rec.value);
  const description = asString(rec.description);
  if (!value || !description) return null;
  return { value, description };
}

function normalizeParam(raw: unknown): RhaiParamDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const name = asString(rec.name);
  const ty = asString(rec.ty) ?? asString(rec.type) ?? "any";
  const description = asString(rec.description) ?? "";
  if (!name) return null;
  const choices = Array.isArray(rec.choices)
    ? rec.choices.map(normalizeChoice).filter((c): c is RhaiChoiceDoc => c !== null)
    : [];
  return { name, ty, description, choices };
}

function normalizeFunction(raw: unknown): RhaiFunctionDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const name = asString(rec.name);
  if (!name) return null;
  const overloads = Array.isArray(rec.overloads)
    ? rec.overloads
        .map((o): RhaiOverload | null => {
          if (!o || typeof o !== "object") return null;
          const paramsRaw = (o as Record<string, unknown>).params;
          if (!Array.isArray(paramsRaw)) return null;
          return {
            params: paramsRaw.map(normalizeParam).filter((p): p is RhaiParamDoc => p !== null),
          };
        })
        .filter((o): o is RhaiOverload => o !== null)
    : [];
  return {
    name,
    summary: asString(rec.summary) ?? "",
    overloads,
  };
}

function normalizeScope(raw: unknown): ScopeVarDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const name = asString(rec.name);
  const description = asString(rec.description);
  if (!name || !description) return null;
  return { name, description };
}

function normalizeEntry(raw: unknown): StrategyScriptApi | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const strategyType = asString(rec.strategy_type) as HftStrategyType | undefined;
  if (!strategyType || !["taker", "maker", "arbitrage"].includes(strategyType)) return null;
  const functions = Array.isArray(rec.functions)
    ? rec.functions.map(normalizeFunction).filter((f): f is RhaiFunctionDoc => f !== null)
    : [];
  const scope = Array.isArray(rec.scope)
    ? rec.scope.map(normalizeScope).filter((s): s is ScopeVarDoc => s !== null)
    : [];
  return {
    strategy_type: strategyType,
    intro: asString(rec.intro) ?? "",
    functions,
    scope,
  };
}

function normalizeScriptApis(raw: unknown): StrategyScriptApi[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEntry).filter((e): e is StrategyScriptApi => e !== null);
}

/** Params once each, first-appearance order across overloads (later overloads only add params). */
export function dedupedParams(fn: RhaiFunctionDoc): RhaiParamDoc[] {
  const seen = new Set<string>();
  return fn.overloads.flatMap((o) => o.params).filter((p) => {
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });
}

export function paramSummary(fn: RhaiFunctionDoc): string {
  return dedupedParams(fn)
    .map((p) => {
      const choices =
        p.choices.length > 0
          ? ": " + p.choices.map((c) => `"${c.value}" (${c.description})`).join(", ")
          : "";
      return `${p.name} = ${p.description}${choices}.`;
    })
    .join(" ");
}

// Mirrors `common::strategy_script_api` so mock mode still shows a useful reference.
const TARGET_POS_API = {
  intro: "Runs once per tick.",
  functions: [
    {
      name: "target_pos_intent",
      summary: "Set this symbol's target position for this tick.",
      overloads: [
        {
          params: [
            {
              name: "symbol",
              ty: "int",
              description: "engine SymbolId — pass the `symbol` scope variable straight through",
              choices: [],
            },
            {
              name: "qty",
              ty: "float",
              description: "signed target position: positive long, negative short, 0.0 flattens",
              choices: [],
            },
            {
              name: "style",
              ty: "string",
              description: "how the order crosses or rests",
              choices: [
                { value: "market", description: "sweep now (taker)" },
                { value: "cross", description: "marketable at the touch" },
                { value: "join", description: "passive at the touch" },
                { value: "mid", description: "passive at the mid" },
              ],
            },
          ],
        },
      ],
    },
  ],
  scope: [
    {
      name: "features",
      description:
        "this strategy's feature values, in the order defined above — features[0], features[1], … NaN until that feature's window warms up",
    },
    { name: "symbol", description: "this run's SymbolId — pass straight to target_pos_intent" },
    { name: "positions", description: "signed position per symbol, indexed by SymbolId" },
    {
      name: "asset_features",
      description: "features[] per symbol — cross-sectional access via asset_features[sym_id][feature_idx]",
    },
  ],
} satisfies Omit<StrategyScriptApi, "strategy_type">;

const MOCK_SCRIPT_APIS: StrategyScriptApi[] = [
  { strategy_type: "taker", ...TARGET_POS_API },
  { strategy_type: "maker", ...TARGET_POS_API },
  {
    strategy_type: "arbitrage",
    intro: "Runs once per tick when both legs' order books are fresh.",
    functions: [
      {
        name: "arbitrage_intent",
        summary: "Fire a two-leg arbitrage clip: leg1 taker, leg2 maker.",
        overloads: [
          {
            params: [
              { name: "qty", ty: "float", description: "leg1 base-asset amount for this clip", choices: [] },
              {
                name: "buy_leg1",
                ty: "bool",
                description: "true = buy leg1 / sell leg2, false = sell leg1 / buy leg2",
                choices: [],
              },
              { name: "price_leg2", ty: "float", description: "limit price to post on leg2", choices: [] },
            ],
          },
        ],
      },
    ],
    scope: [
      {
        name: "arb_ctx.ask_vwap_leg1 / arb_ctx.bid_vwap_leg1",
        description: "leg1 VWAP-sweep price at the configured order size",
      },
      { name: "arb_ctx.best_bid_leg2 / arb_ctx.best_ask_leg2", description: "leg2 L1 quote" },
      {
        name: "arb_ctx.taker_fee_leg1 / arb_ctx.maker_fee_leg2",
        description: "fee rates for the net-edge calc",
      },
      { name: "arb_ctx.pos_leg1 / arb_ctx.pos_leg2", description: "current signed positions on each leg" },
    ],
  },
];

export function useScriptApi() {
  return useQuery({
    queryKey: ["hft-script-api"],
    queryFn: async (): Promise<StrategyScriptApi[]> => {
      if (USE_MOCK) return MOCK_SCRIPT_APIS;
      const raw = await apiGet<unknown>(`${HFT_API_URL}/api/strategies/script-api`);
      return normalizeScriptApis(raw);
    },
    staleTime: Infinity,
  });
}
