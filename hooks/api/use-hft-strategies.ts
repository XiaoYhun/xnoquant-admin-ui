import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { EditorTab } from "@/lib/mock/strategy-builder";
import type { components } from "@/types/api/hft";

// HFT strategies (`GET/POST /api/strategies`, raw — no envelope) surfaced as editor tabs
// alongside the XALPHA/MFT editors (see use-strategy-builder.ts's useEditors).
// NOTE: save-code (`PUT /api/strategies/{id}`) and validate/feature-catalog
// (`POST /api/strategies/validate(-features)`, `GET /api/strategies/feature-catalog`) are not
// wired up yet — the HFT code editor is currently read-only, so there's nothing to save/validate.
type Strategy = components["schemas"]["Strategy"];
export type HftStrategyType = components["schemas"]["StrategyType"];

function toEditorTab(s: Strategy): EditorTab {
  return { id: s.id, name: s.name, code: s.code, type: "hft" };
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
      if (USE_MOCK) {
        return { id: crypto.randomUUID(), name, code: "", type: "hft" };
      }
      const strategy = await apiPost<Strategy>(`${HFT_API_URL}/api/strategies`, {
        name,
        strategy_type: strategyType,
        code: "",
      });
      return toEditorTab(strategy);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hft-strategies"] }),
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
