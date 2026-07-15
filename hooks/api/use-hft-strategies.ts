import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { EditorTab } from "@/lib/mock/strategy-builder";
import { HFT_SAMPLES } from "@/lib/mock/hft-strategy-samples";
import type { components } from "@/types/api/hft";

// HFT strategies (`GET/POST /api/strategies`, raw — no envelope) surfaced as editor tabs
// alongside the XALPHA/MFT editors (see use-strategy-builder.ts's useEditors).
// NOTE: `validate` (whole-code) is not wired yet. `validate-features`/`feature-catalog` are wired
// in use-hft-features.ts (used by the Features tab). The Settings save below uses
// `PUT /api/strategies/{id}` and independently updates `strategy_type`/`code`/`features`, re-sending
// the current value of whichever field isn't passed in so it isn't wiped.
type Strategy = components["schemas"]["Strategy"];
export type HftStrategyType = components["schemas"]["StrategyType"];
export type FeatureDef = components["schemas"]["FeatureDef"];

function toEditorTab(s: Strategy): EditorTab {
  return { id: s.id, name: s.name, code: s.code, type: "hft", created_at: s.created_at };
}

// Merged into the Create Strategy editors list (page.tsx). Tolerate any failure (401, empty list,
// network error) by falling back to `[]` so a broken HFT backend never blocks the page.
export function useHftStrategies() {
  return useQuery({
    queryKey: ["hft-strategies"],
    queryFn: async (): Promise<EditorTab[]> => {
      if (USE_MOCK) return [];
      try {
        const data = await apiGet<Strategy[]>(`${HFT_API_URL}/api/strategies`);
        return (data ?? []).map(toEditorTab);
      } catch {
        return [];
      }
    },
  });
}

export function useCreateHftStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, strategyType }: { name: string; strategyType: HftStrategyType }): Promise<EditorTab> => {
      // Seed a new HFT strategy with the first sample template matching its type.
      const code = HFT_SAMPLES[strategyType]?.[0]?.code ?? "";
      if (USE_MOCK) {
        return { id: crypto.randomUUID(), name, code, type: "hft" };
      }
      const strategy = await apiPost<Strategy>(`${HFT_API_URL}/api/strategies`, {
        name,
        strategy_type: strategyType,
        code,
      });
      return toEditorTab(strategy);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hft-strategies"] }),
  });
}

// Single HFT strategy (`GET /api/strategies/{id}`) — used to seed the Settings popover with the
// strategy's current `strategy_type` (the merged editor list drops it in `toEditorTab`).
export function useHftStrategy(id?: string) {
  return useQuery({
    queryKey: ["hft-strategy", id],
    queryFn: () => apiGet<Strategy>(`${HFT_API_URL}/api/strategies/${id}`),
    enabled: !USE_MOCK && !!id,
  });
}

// Save the HFT Settings/Features — `strategy_type`, `code`, and `features` are each independently
// optional. We GET the current strategy first and PUT the full object with just the given fields
// changed, so anything not passed in isn't wiped (the PUT body is a full `StrategyInput`, not a
// partial patch).
export function useUpdateHftStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      strategyType,
      code,
      features,
    }: {
      id: string;
      strategyType?: HftStrategyType;
      code?: string;
      features?: FeatureDef[];
    }): Promise<void> => {
      if (USE_MOCK) return;
      const current = await apiGet<Strategy>(`${HFT_API_URL}/api/strategies/${id}`);
      await apiPut<Strategy>(`${HFT_API_URL}/api/strategies/${id}`, {
        name: current.name,
        description: current.description ?? undefined,
        strategy_type: strategyType ?? current.strategy_type,
        code: code ?? current.code,
        features: features ?? current.features,
      });
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["hft-strategies"] });
      qc.invalidateQueries({ queryKey: ["hft-strategy", id] });
    },
  });
}

// Called from the Editors "×" confirm (mirrors useDeleteEditor for MFT) — deletes the HFT
// strategy server-side, then revalidates the list.
export function useDeleteHftStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (USE_MOCK) return;
      await apiDelete(`${HFT_API_URL}/api/strategies/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hft-strategies"] }),
  });
}
