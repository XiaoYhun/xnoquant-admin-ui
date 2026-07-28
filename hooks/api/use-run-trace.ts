import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";

// Trade-cycle console log for a run: `GET /api/runs/{id}/trace/history` (replay) and
// `/trace/stream` (SSE, running paper/live runs only). BOTH responses are UNTYPED in the OpenAPI
// spec (`content?: never`), so events are normalized defensively from whatever field names the
// server uses. Backtests never journal a trace — the history is simply empty for them.

export type TraceEvent = {
  /** Raw ISO/epoch timestamp as sent; formatting is the view's job. */
  at?: string;
  /** Lifecycle stage, e.g. "Entry", "Order submitted", "Filled". */
  stage: string;
  /** Human-readable detail line, e.g. "BUY 0.01 @ 63,212.97". */
  detail?: string;
  symbol?: string;
  side?: string;
  qty?: number;
  price?: number;
  /** Groups events into one trade cycle when the server provides it. */
  cycleId?: string;
};

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function toTraceEvent(raw: unknown): TraceEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const stage = str(r.stage) ?? str(r.event) ?? str(r.kind) ?? str(r.status) ?? str(r.type) ?? str(r.message);
  if (!stage) return null;
  return {
    at: str(r.at) ?? str(r.ts) ?? str(r.time) ?? str(r.timestamp) ?? str(r.created_at),
    stage,
    detail: str(r.detail) ?? str(r.message) ?? str(r.description) ?? str(r.text),
    symbol: str(r.symbol) ?? str(r.symbol_name) ?? str(r.instrument),
    side: str(r.side) ?? str(r.direction),
    qty: num(r.qty) ?? num(r.quantity) ?? num(r.size),
    price: num(r.price) ?? num(r.fill_price) ?? num(r.avg_price),
    cycleId: str(r.cycle_id) ?? str(r.cycleId) ?? str(r.trade_id) ?? str(r.cycle),
  };
}

export function normalizeTrace(raw: unknown): TraceEvent[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { events?: unknown[] }).events)
      ? (raw as { events: unknown[] }).events
      : [];
  return list.map(toTraceEvent).filter((e): e is TraceEvent => e !== null);
}

export function useRunTraceHistory(runId: string | undefined) {
  return useQuery({
    queryKey: ["run-trace", runId],
    queryFn: async (): Promise<TraceEvent[]> => {
      if (USE_MOCK) return [];
      const raw = await apiGet<unknown>(`${HFT_API_URL}/api/runs/${runId}/trace/history`);
      return normalizeTrace(raw);
    },
    enabled: !!runId,
  });
}

/**
 * Tails `/trace/stream` while the run is live. `EventSource` can't send an Authorization header,
 * so the SSE frames are read off a fetch body and parsed by hand.
 */
export function useRunTraceStream(runId: string | undefined, enabled: boolean) {
  const [live, setLive] = useState<TraceEvent[]>([]);
  // Reset during render (not in the effect) when the tailed run changes, so events from a
  // previously-open run never bleed into the next one.
  const streamKey = runId && enabled && !USE_MOCK ? runId : undefined;
  const [prevKey, setPrevKey] = useState(streamKey);
  if (prevKey !== streamKey) {
    setPrevKey(streamKey);
    setLive([]);
  }

  useEffect(() => {
    if (!streamKey) return;
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const token = useAuthStore.getState().accessToken;
        const res = await fetch(`${HFT_API_URL}/api/runs/${runId}/trace/stream`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE frames are separated by a blank line; each `data:` line carries one JSON event.
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data:")) continue;
              try {
                const ev = toTraceEvent(JSON.parse(line.slice(5).trim()));
                if (ev) setLive((prev) => [...prev, ev]);
              } catch {
                // A malformed frame shouldn't kill the tail.
              }
            }
          }
        }
      } catch {
        // Aborted on unmount, or the stream dropped — the replayed history still stands.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [runId, streamKey]);

  return live;
}
