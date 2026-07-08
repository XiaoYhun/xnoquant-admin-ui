import { useQuery } from "@tanstack/react-query";
import { apiGetData } from "@/lib/api-client";
import { USE_MOCK, XALPHA_API_URL, XALPHA_API_URL_V2 } from "@/lib/constant";
import { FEATURES, OPERATORS, INITIAL_EDITORS, type EditorTab } from "@/lib/mock/strategy-builder";
import type { components } from "@/types/api/xalpha";

// Create Strategy catalog tabs (docs/plans/api-integration.md §5.C) — XALPHA envelope, unwrap
// `.data` via apiGetData. Each hook returns the exact card shape its tab already renders.
type FeatureFunctionItem = components["schemas"]["models.FeatureFunctionItem"];
type OperatorFunctionItem = components["schemas"]["models.OperatorFunctionItem"];
type DataFunctionItem = components["schemas"]["models.DataFunctionItem"];
type CodeExample = components["schemas"]["models.CodeExample"];
type StrategyEditorInfo = components["schemas"]["models.StrategyEditorInfo"];

export type FeatureCard = { shortName: string; signature: string; returns: string; desc: string };
export type OperatorCard = { name: string; desc: string; signature: string; returns: string };
export type DatasetCard = { name: string; category: string; desc: string };
export type Sample = { id: string; name: string; description: string; code: string };
export type SampleCategory = { id: string; name: string; badgeColor: string; samples: Sample[] };

// Figma 13964:56232 — every feature is exposed as `self.feat.*` in the Python DSL. The shared
// mock only carries name/desc, so the code signature + return type are derived here (moved from
// features-tab.tsx).
const RETURNS_OVERRIDES: Record<string, string> = {
  macd: "Tuple[SeriesT, SeriesT, SeriesT]",
  bollinger: "Tuple[SeriesT, SeriesT]",
  stoch: "Tuple[SeriesT, SeriesT]",
};

export function useFeatures() {
  return useQuery({
    queryKey: ["strategy-builder", "features"],
    queryFn: async (): Promise<FeatureCard[]> => {
      if (USE_MOCK) {
        return FEATURES.map((f) => {
          const shortName = f.name.split("(")[0];
          return {
            shortName,
            signature: `self.feat.${f.name}`,
            returns: RETURNS_OVERRIDES[shortName] ?? "SeriesT",
            desc: f.desc,
          };
        });
      }
      const data = await apiGetData<FeatureFunctionItem[]>(`${XALPHA_API_URL}/documents/features`);
      return (data ?? []).map((f) => {
        const name = f.name ?? "";
        const shortName = name.split("(")[0];
        return {
          shortName,
          signature: f.prototype ?? `self.feat.${name}`,
          returns: f.returns ?? "SeriesT",
          desc: f.docs ?? "",
        };
      });
    },
  });
}

// Same card pattern as Features, for `self.op.*` operators (moved from operators-tab.tsx). The
// shared mock only carries name/desc; signature + return type are curated here per operator.
const OPERATOR_META: Record<string, { signature: string; returns: string }> = {
  "if / else": { signature: "self.op.If(cond, then, otherwise)", returns: "SeriesT" },
  "&& · ||": { signature: "self.op.And(a, b) · self.op.Or(a, b)", returns: "SeriesT[bool]" },
  "> · < · >= · <=": {
    signature: "self.op.gt(a, b) · self.op.lt(a, b) · self.op.gte(a, b) · self.op.lte(a, b)",
    returns: "SeriesT[bool]",
  },
  "+ · - · * · /": {
    signature: "self.op.add(a, b) · self.op.sub(a, b) · self.op.mul(a, b) · self.op.div(a, b)",
    returns: "SeriesT",
  },
  "crossover(a, b)": { signature: "self.op.crossover(a: SeriesT, b: SeriesT)", returns: "SeriesT[bool]" },
  "crossunder(a, b)": { signature: "self.op.crossunder(a: SeriesT, b: SeriesT)", returns: "SeriesT[bool]" },
  "abs(x)": { signature: "self.op.abs(x: SeriesT)", returns: "SeriesT" },
  "min(a, b) · max(a, b)": { signature: "self.op.min(a, b) · self.op.max(a, b)", returns: "SeriesT" },
};

export function useOperators() {
  return useQuery({
    queryKey: ["strategy-builder", "operators"],
    queryFn: async (): Promise<OperatorCard[]> => {
      if (USE_MOCK) {
        return OPERATORS.map((o) => ({
          name: o.name,
          desc: o.desc,
          signature: OPERATOR_META[o.name]?.signature ?? `self.op.${o.name}`,
          returns: OPERATOR_META[o.name]?.returns ?? "SeriesT",
        }));
      }
      const data = await apiGetData<OperatorFunctionItem[]>(`${XALPHA_API_URL}/documents/operators`);
      return (data ?? []).map((o) => {
        const name = o.name ?? "";
        return {
          name,
          desc: o.docs ?? "",
          signature: o.prototype ?? `self.op.${name}`,
          returns: o.returns ?? "SeriesT",
        };
      });
    },
  });
}

// Datasets/universes available to a strategy via `self.data.*` (moved from data-tab.tsx — Figma's
// Data tab-state frame 14294:101743 was unreachable, so this mock is curated, not Figma-sourced).
const DATASETS: DatasetCard[] = [
  { name: "OHLCV", category: "Market", desc: "Open, high, low, close, volume bars for the active symbol and timeframe." },
  { name: "Order Book L2", category: "Market", desc: "Level-2 order book depth snapshots." },
  { name: "Trades", category: "Market", desc: "Raw executed trade tape." },
  { name: "Funding Rate", category: "Derivatives", desc: "Perpetual futures funding rate." },
  { name: "Open Interest", category: "Derivatives", desc: "Aggregated open interest across venues." },
  { name: "VN30 Universe", category: "Universe", desc: "Constituent list of the VN30 index." },
  { name: "Crypto Top 100", category: "Universe", desc: "Top 100 crypto assets by market cap." },
  { name: "Macro Calendar", category: "Reference", desc: "Scheduled macroeconomic events and releases." },
];

export function useDataFunctions() {
  return useQuery({
    queryKey: ["strategy-builder", "data"],
    queryFn: async (): Promise<DatasetCard[]> => {
      if (USE_MOCK) return DATASETS;
      const data = await apiGetData<DataFunctionItem[]>(`${XALPHA_API_URL}/documents/datas`);
      return (data ?? []).map((d) => ({
        name: d.name ?? "",
        category: d.group ?? "",
        desc: d.docs ?? "",
      }));
    },
  });
}

// Self-contained mock data — richer than the shared `SAMPLES` in lib/mock/strategy-builder (moved
// from samples-tab.tsx). Mock samples have no source `code`, unlike the real API.
const CATEGORIES: SampleCategory[] = [
  {
    id: "trend-momentum",
    name: "Trend Confirmation / Momentum",
    badgeColor: "#f1c617",
    samples: [
      {
        id: "macd-adx-trend-confirmation",
        name: "MACD-ADX Trend Confirmation",
        description:
          "A trend-following strategy that combines MACD crossovers with ADX strength filtering. The strategy enters a long position when MACD crosses above its signal line while ADX indicates a strong trend, and exits when momentum weakens or trend strength drops, helping to avoid trades during low-trend or choppy market conditions.",
        code: "",
      },
      {
        id: "bollinger-bands-squeeze",
        name: "Bollinger Bands Squeeze",
        description:
          "This strategy focuses on periods of low volatility, identified by a Bollinger Bands squeeze. Traders look for price breakouts once the bands narrow, entering positions in the direction of the breakout with the expectation of a significant price movement.",
        code: "",
      },
      {
        id: "rsi-divergence",
        name: "RSI Divergence",
        description:
          "This strategy utilizes the Relative Strength Index (RSI) to identify potential reversals. By spotting divergences between price action and RSI readings, traders can anticipate trend changes.",
        code: "",
      },
      {
        id: "fibonacci-retracement-levels",
        name: "Fibonacci Retracement Levels",
        description:
          "Traders use Fibonacci retracement levels to identify potential reversal points during market pullbacks, entering positions when the price approaches key retracement levels.",
        code: "",
      },
    ],
  },
  {
    id: "technical-indicators",
    name: "Technical Indicators",
    badgeColor: "#d5d4ff",
    samples: [
      {
        id: "bollinger-bands-breakout-strategy",
        name: "Bollinger Bands Breakout Strategy",
        description:
          "Traders monitor the contraction and expansion of Bollinger Bands to identify potential breakout opportunities, entering positions while placing stop-loss orders to manage risk.",
        code: "",
      },
      {
        id: "stochastic-oscillator-divergence",
        name: "Stochastic Oscillator Divergence",
        description:
          "Divergence between the Stochastic Oscillator and price action can indicate potential reversals, giving traders entry points in the opposite direction with stop-loss orders to limit losses.",
        code: "",
      },
      {
        id: "rsi-overbought-oversold-conditions",
        name: "RSI Overbought/Oversold Conditions",
        description:
          "Traders utilize the RSI to identify overbought or oversold conditions in the market, looking for reversal signals at these extremes with stop-loss orders to protect their trades.",
        code: "",
      },
      {
        id: "volume-profile-analysis",
        name: "Volume Profile Analysis",
        description:
          "Analyzing volume profiles helps traders identify key support and resistance levels based on traded volume at different price levels, with stop-loss orders set to minimize risk.",
        code: "",
      },
    ],
  },
  {
    id: "volatility-breakout",
    name: "Volatility / Breakout",
    badgeColor: "#a7f3d0",
    samples: [
      {
        id: "support-and-resistance-breakouts",
        name: "Support and Resistance Breakouts",
        description:
          "Traders watch for price to break through established support and resistance levels, entering trades upon breakout confirmation with stop-loss orders to manage potential losses.",
        code: "",
      },
      {
        id: "ichimoku-cloud-trading",
        name: "Ichimoku Cloud Trading",
        description:
          "The Ichimoku Cloud provides a comprehensive view of market trends, support, and resistance levels, entering positions when price interacts with the cloud and using stop-loss orders to control risk.",
        code: "",
      },
      {
        id: "atr-volatility-breakout",
        name: "ATR Volatility Breakout",
        description:
          "This strategy uses the Average True Range (ATR) to size breakout thresholds relative to recent volatility, entering trades once price moves beyond an ATR-scaled band from its recent range.",
        code: "",
      },
    ],
  },
];

// Real branch has no badge-color field on `CodeExample` — cycle the same palette used by mock
// categories, keyed by category order of first appearance.
const BADGE_COLORS = ["#f1c617", "#d5d4ff", "#a7f3d0"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function useCodeSamples() {
  return useQuery({
    queryKey: ["strategy-builder", "samples"],
    queryFn: async (): Promise<SampleCategory[]> => {
      if (USE_MOCK) return CATEGORIES;
      const data = await apiGetData<CodeExample[]>(`${XALPHA_API_URL_V2}/codes/examples`);
      const byCategory = new Map<string, CodeExample[]>();
      for (const example of data ?? []) {
        const category = example.category ?? "";
        const bucket = byCategory.get(category);
        if (bucket) bucket.push(example);
        else byCategory.set(category, [example]);
      }
      // Ids must be unique + non-empty: category names can repeat-slugify (e.g. "A B"/"A-B") and
      // sample names can be outright duplicated by the API, which both crash the UI — a blank
      // SelectItem value throws in Base UI Select, and duplicate React keys warn/misrender. Suffix
      // with the index to guarantee uniqueness.
      return Array.from(byCategory.entries()).map(([category, examples], index) => ({
        id: `${slugify(category) || "category"}-${index}`,
        name: category || "Uncategorized",
        badgeColor: BADGE_COLORS[index % BADGE_COLORS.length],
        samples: examples.map((example, i) => ({
          id: `${slugify(example.name ?? "") || "sample"}-${index}-${i}`,
          name: example.name ?? "",
          description: example.summary ?? "",
          code: example.code ?? "",
        })),
      }));
    },
  });
}

// T1 — the Create-Strategy editor tabs come from the XALPHA editors list (`GET /v2/editors`).
// `StrategyEditorInfo` → the UI's `EditorTab {id,name,code}`; mock falls back to INITIAL_EDITORS.
export function useEditors() {
  return useQuery({
    queryKey: ["strategy-builder", "editors"],
    queryFn: async (): Promise<EditorTab[]> => {
      if (USE_MOCK) return INITIAL_EDITORS;
      try {
        const data = await apiGetData<StrategyEditorInfo[]>(`${XALPHA_API_URL_V2}/editors`);
        const tabs = (data ?? []).map((e) => ({
          id: e.id ?? "",
          name: e.name ?? "Untitled",
          code: e.code ?? "",
        }));
        // Never leave the builder with zero tabs (the UI derives the active editor from index 0).
        return tabs.length > 0 ? tabs : INITIAL_EDITORS;
      } catch {
        // The builder needs at least one editor to render — fall back to the mock on any failure.
        return INITIAL_EDITORS;
      }
    },
  });
}
