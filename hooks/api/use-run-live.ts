import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
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

/** One live-snapshot sample used by the Risk "Rolling Sharpe" chart. */
export type LiveSharpeSample = {
  /** `updated_at_ms` from the snapshot, else receive time. */
  ts: number;
  /** Prefer `sharpe_annualized`, fall back to `sharpe`. */
  sharpe: number;
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

/** Pull a sharpe sample out of a live-snapshot SSE frame / GET /live body. */
export function toLiveSharpeSample(raw: unknown): LiveSharpeSample | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sharpe = num(r.sharpe_annualized) ?? num(r.sharpe);
  if (sharpe === undefined) return null;
  const ts = num(r.updated_at_ms) ?? num(r.ts) ?? num(r.ts_ms) ?? Date.now();
  return { ts, sharpe };
}

export function useRunOpenPositions(runId: string | undefined) {
  return useQuery({
    queryKey: ["run-live-positions", runId],
    queryFn: async (): Promise<OpenPosition[]> => {
      if (USE_MOCK) return [];
      const raw = await apiGet<unknown>(`${HFT_API_URL}/api/runs/${runId}/live`);
      const list = raw && typeof raw === "object" ? (raw as { positions?: unknown }).positions : undefined;
      return Array.isArray(list) ? list.map(toPosition).filter((p): p is OpenPosition => p !== null) : [];
    },
    enabled: !!runId,
    // The snapshot is a live value — keep it fresh while the panel is open.
    refetchInterval: 5000,
    // 404 just means "no snapshot for this run"; don't hammer it.
    retry: false,
  });
}

export type LiveStreamState = "off" | "connecting" | "open" | "error";

/**
 * Tails `/api/runs/{id}/live/stream`, appending each snapshot's sharpe into a growing series.
 * Same fetch/SSE framing approach as `useRunTraceStream` (EventSource can't send Authorization).
 * Only useful for running paper/live runs — the endpoint 404s otherwise.
 */
export function useRunLiveSharpeStream(runId: string | undefined, enabled: boolean) {
  const accessToken = useAuthStore((st) => st.accessToken);
  const streamKey = runId && enabled && !USE_MOCK && accessToken ? runId : undefined;
  const [samples, setSamples] = useState<LiveSharpeSample[]>([]);
  const [state, setState] = useState<LiveStreamState>(() => (streamKey ? "connecting" : "off"));
  const [prevKey, setPrevKey] = useState(streamKey);
  if (prevKey !== streamKey) {
    setPrevKey(streamKey);
    setSamples([]);
    setState(streamKey ? "connecting" : "off");
  }

  useEffect(() => {
    if (!streamKey) return;
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${HFT_API_URL}/api/runs/${runId}/live/stream`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          setState("error");
          return;
        }
        setState("open");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data:")) continue;
              try {
                const sample = toLiveSharpeSample(JSON.parse(line.slice(5).trim()));
                if (sample) setSamples((prev) => [...prev, sample]);
              } catch {
                // Malformed frame — skip.
              }
            }
          }
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [runId, streamKey, accessToken]);

  return { samples, state };
}
