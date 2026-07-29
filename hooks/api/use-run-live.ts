import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";

// `GET /api/runs/{id}/live` — the Redis live snapshot for a running paper/live run. The response is
// UNTYPED in the OpenAPI spec, so it's normalized defensively; the shape below was read off the
// real dev API. 404s when Redis isn't configured or nothing has been published for this run yet.
//
// Note this is a *different* source from the persisted artifacts: `/trades` and `/summary` read
// parquet/JSON sidecars that may still be empty while the live snapshot already shows fills.

export type OpenPosition = {
  symbolId?: number;
  side?: string;
  qty?: number;
  avgPrice?: number;
  markPrice?: number;
  unrealizedPnl?: number;
};

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

function toPosition(raw: unknown): OpenPosition | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const qty = num(r.qty) ?? num(r.quantity) ?? num(r.size);
  // A flat position isn't an open one.
  if (qty === undefined || qty === 0) return null;
  return {
    symbolId: num(r.symbol_id) ?? num(r.symbolId),
    side: str(r.side) ?? str(r.direction),
    qty,
    avgPrice: num(r.avg_price) ?? num(r.avgPrice) ?? num(r.entry_price),
    markPrice: num(r.mark_price) ?? num(r.markPrice) ?? num(r.mark),
    unrealizedPnl: num(r.unrealized_pnl) ?? num(r.unrealizedPnl),
  };
}

export function useRunOpenPositions(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["run-live-positions", runId],
    queryFn: async (): Promise<OpenPosition[]> => {
      if (USE_MOCK) return [];
      const raw = await apiGet<unknown>(`${HFT_API_URL}/api/runs/${runId}/live`);
      const list = raw && typeof raw === "object" ? (raw as { positions?: unknown }).positions : undefined;
      return Array.isArray(list) ? list.map(toPosition).filter((p): p is OpenPosition => p !== null) : [];
    },
    enabled: !!runId && enabled,
    // The snapshot is a live value — keep it fresh while the panel is open.
    refetchInterval: 5000,
    // 404 just means "no snapshot for this run"; don't hammer it.
    retry: false,
  });
}
