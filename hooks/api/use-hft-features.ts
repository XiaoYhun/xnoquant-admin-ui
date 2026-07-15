import { useMutation, useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { FeatureDef } from "@/hooks/api/use-hft-strategies";

// Insert-primitive catalog (`GET /api/strategies/feature-catalog`) and feature-expression
// validation (`POST /api/strategies/validate-features`) for the HFT "Features" tab
// (hft-features-tab.tsx). Both responses are UNTYPED in the OpenAPI spec (`content?: never`), so
// we fetch as `unknown` and defensively normalize.

export type FeatureCatalogItem = { name: string; returns: string };
export type FeatureValidationError = { index?: number; name?: string; error: string };

function toCatalogItem(entry: unknown, fallbackReturns: "FN" | "FIELD"): FeatureCatalogItem | null {
  if (typeof entry === "string") return { name: entry, returns: fallbackReturns };
  if (!entry || typeof entry !== "object") return null;
  const rec = entry as Record<string, unknown>;
  const name = typeof rec.name === "string" ? rec.name : undefined;
  if (!name) return null;
  const kind = rec.kind ?? rec.returns ?? rec.type;
  const returns = typeof kind === "string" && kind.length > 0 ? kind : fallbackReturns;
  return { name, returns };
}

// Tolerates: (a) a bare array of `{name, ...}` entries, (b) an object with `fields`/`functions`
// arrays. Falls back to `[]` if neither shape is recognized.
function normalizeCatalog(raw: unknown): FeatureCatalogItem[] {
  console.debug("[feature-catalog] raw", raw);
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
  { name: "sma", returns: "FN" },
  { name: "vwap", returns: "FN" },
  { name: "close", returns: "FIELD" },
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

// Tolerates an array of `{index?, name?, error?|message?}` entries; anything else yields no errors.
function normalizeValidationErrors(raw: unknown): FeatureValidationError[] {
  if (!Array.isArray(raw)) return [];
  return raw
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
