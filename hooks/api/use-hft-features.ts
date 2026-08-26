import { useMutation, useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { FeatureDef } from "@/hooks/api/use-hft-strategies";

// Insert-primitive catalog (`GET /api/strategies/feature-catalog`) and feature-expression
// validation (`POST /api/strategies/validate-features`) for the HFT "Features" tab
// (hft-features-tab.tsx). Both responses are UNTYPED in the OpenAPI spec (`content?: never`), so
// we fetch as `unknown` and defensively normalize.
//
// Observed live shape of the catalog (hft-dev, 2026-08-26):
//   { fields:    [{ name, description }]                            — 59 entries
//     functions: [{ name, min_args, max_args, description, usage }] — 22 entries }
// Every entry carries a description. `min_args`/`max_args`/`usage` (e.g. "ema(field, window)")
// are NOT parsed yet — they are what the Figma arity suffix (`abs (1)`) would need. Nothing here
// may ASSUME those keys: the spec promises no schema, so the normalizer stays tolerant of the
// older name-only shape.

export type FeatureCatalogItem = {
  name: string;
  returns: string;
  /** One-line explanation from the engine registry; absent on older payloads. */
  description?: string;
};
export type FeatureValidationError = { index?: number; name?: string; error: string };

function toCatalogItem(entry: unknown, fallbackReturns: "FN" | "FIELD"): FeatureCatalogItem | null {
  if (typeof entry === "string") return { name: entry, returns: fallbackReturns };
  if (!entry || typeof entry !== "object") return null;
  const rec = entry as Record<string, unknown>;
  const name = typeof rec.name === "string" ? rec.name : undefined;
  if (!name) return null;
  const kind = rec.kind ?? rec.returns ?? rec.type;
  const returns = typeof kind === "string" && kind.length > 0 ? kind : fallbackReturns;
  const description = typeof rec.description === "string" && rec.description.length > 0 ? rec.description : undefined;
  return { name, returns, description };
}

// Tolerates: (a) a bare array of `{name, ...}` entries, (b) an object with `fields`/`functions`
// arrays. Falls back to `[]` if neither shape is recognized.
function normalizeCatalog(raw: unknown): FeatureCatalogItem[] {
  if (Array.isArray(raw)) {
    return raw.map((e) => toCatalogItem(e, "FN")).filter((x): x is FeatureCatalogItem => x !== null);
  }
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    const fields = Array.isArray(rec.fields) ? rec.fields.map((e) => toCatalogItem(e, "FIELD")) : [];
    const functions = Array.isArray(rec.functions) ? rec.functions.map((e) => toCatalogItem(e, "FN")) : [];
    const combined = [...fields, ...functions].filter((x): x is FeatureCatalogItem => x !== null);
    if (combined.length > 0) return combined;
  }
  return [];
}

const MOCK_CATALOG: FeatureCatalogItem[] = [
  { name: "sma", returns: "FN", description: "Simple moving average over the last `window` samples." },
  { name: "vwap", returns: "FN", description: "Volume-weighted average price over the last `window` samples." },
  { name: "close", returns: "FIELD", description: "Close price of the current bar." },
];

export function useFeatureCatalog() {
  return useQuery({
    queryKey: ["hft-feature-catalog"],
    // Mirrors useHftStrategies: the real GET only fires when !USE_MOCK (no `enabled` gate needed
    // since USE_MOCK short-circuits before any fetch), so mock mode still surfaces MOCK_CATALOG.
    queryFn: async (): Promise<FeatureCatalogItem[]> => {
      if (USE_MOCK) return MOCK_CATALOG;
      const raw = await apiGet<unknown>(`${HFT_API_URL}/api/strategies/feature-catalog`);
      return normalizeCatalog(raw);
    },
  });
}

// Tolerates a bare array of `{index?, name?, error?|message?}` entries AND the envelope
// `{ok, errors: [...]}` that `/validate` actually answers with (observed on hft-dev, 2026-08-26:
// `{"ok":false,"errors":[{"message":"Unexpected ';' (line 29, position 14)","line":29,"column":14}]}`).
// Reading only the bare array made every compile failure look like a pass, since an unrecognized
// payload yields no errors — the shape is unpromised by the spec, so both are accepted.
function normalizeValidationErrors(raw: unknown): FeatureValidationError[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).errors)
      ? ((raw as Record<string, unknown>).errors as unknown[])
      : [];
  return list
    .map((entry): FeatureValidationError | null => {
      if (!entry || typeof entry !== "object") return null;
      const rec = entry as Record<string, unknown>;
      const error = typeof rec.error === "string" ? rec.error : typeof rec.message === "string" ? rec.message : undefined;
      if (!error) return null;
      return {
        index: typeof rec.index === "number" ? rec.index : undefined,
        name: typeof rec.name === "string" ? rec.name : undefined,
        error,
      };
    })
    .filter((x): x is FeatureValidationError => x !== null);
}

export function useValidateFeatures() {
  return useMutation({
    mutationFn: async (features: FeatureDef[]): Promise<FeatureValidationError[]> => {
      if (USE_MOCK) return [];
      const raw = await apiPost<unknown>(`${HFT_API_URL}/api/strategies/validate-features`, { features });
      return normalizeValidationErrors(raw);
    },
  });
}

/**
 * Whole-script validation (`POST /api/strategies/validate`). Response is UNTYPED in the spec
 * (`content?: never`), so normalize defensively: an empty error list means the script compiled.
 * `features` is sent because the server sizes the `features` array from its length, so valid index
 * accesses don't halt the test-eval early.
 */
export function useValidateScript() {
  return useMutation({
    mutationFn: async ({
      code,
      features,
      strategyType,
    }: {
      code: string;
      features: FeatureDef[];
      strategyType?: string;
    }): Promise<FeatureValidationError[]> => {
      if (USE_MOCK) return [];
      const raw = await apiPost<unknown>(`${HFT_API_URL}/api/strategies/validate`, {
        code,
        features,
        ...(strategyType ? { strategy_type: strategyType } : {}),
      });
      return normalizeValidationErrors(raw);
    },
  });
}
