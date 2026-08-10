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
  /** Epoch millis. The API sends `ts_ms` as a NUMBER — formatting is the view's job. */
  at?: number;
  /** Raw lifecycle stage as sent, e.g. "cycle_opened" / "order_submitted" / "order_filled". */
  stage: string;
  /** Server's own message, used as a fallback when a line can't be composed from the fields. */
  detail?: string;
  symbol?: string;
  /** Index into the run manifest's ordered symbol list; the name is resolved by the view. */
  symbolId?: number;
  side?: string;
  qty?: number;
  price?: number;
  /** Why the cycle opened, e.g. "signal" — rendered as the "(Signal)" suffix. */
  reason?: string;
  /** Groups events into one trade cycle. Sent as a NUMBER (`cycle_id`). */
  cycleId?: string;
  /** Correlates submit ↔ fill(s) for qty-weighted fill rate (`client_order_id`). */
  clientOrderId?: string;
};

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Timestamps arrive as epoch millis (`ts_ms`); tolerate an ISO string too. */
function toEpochMs(r: Record<string, unknown>): number | undefined {
  const n = num(r.ts_ms) ?? num(r.ts) ?? num(r.at) ?? num(r.timestamp);
  if (n !== undefined) return n;
  const iso = str(r.at) ?? str(r.ts) ?? str(r.time) ?? str(r.timestamp) ?? str(r.created_at);
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** `cycle_id` is a number (often 0), so it can't go through the string helper. */
function toIdString(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return str(v);
}

export function toTraceEvent(raw: unknown): TraceEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const stage = str(r.kind) ?? str(r.stage) ?? str(r.event) ?? str(r.status) ?? str(r.type) ?? str(r.message);
  if (!stage) return null;
  return {
    at: toEpochMs(r),
    stage,
    detail: str(r.message) ?? str(r.detail) ?? str(r.description) ?? str(r.text),
    symbol: str(r.symbol) ?? str(r.symbol_name) ?? str(r.instrument),
    symbolId: num(r.symbol_id) ?? num(r.symbolId),
    side: str(r.side) ?? str(r.direction),
    qty: num(r.qty) ?? num(r.quantity) ?? num(r.size),
    price: num(r.price) ?? num(r.fill_price) ?? num(r.avg_price),
    reason: str(r.reason),
    cycleId: toIdString(r.cycle_id) ?? toIdString(r.cycleId) ?? toIdString(r.trade_id) ?? toIdString(r.cycle),
    clientOrderId:
      str(r.client_order_id) ?? str(r.clientOrderId) ?? toIdString(r.client_order_id) ?? toIdString(r.clientOrderId),
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

/** Connection state of the SSE tail, so the UI can tell "connected but idle" from "broken". */
export type TraceStreamState = "off" | "connecting" | "open" | "error";

/**
 * Tails `/trace/stream` while the run is live. `EventSource` can't send an Authorization header,
 * so the SSE frames are read off a fetch body and parsed by hand.
 */
export function useRunTraceStream(runId: string | undefined, enabled: boolean) {
  // SUBSCRIBE to the token rather than reading it once inside the effect. On a fresh page load the
  // panel mounts before AuthProvider has exchanged the Firebase session for an access token, so a
  // one-shot read sent NO Authorization header and upstream answered 401 — with nothing to
  // re-trigger the effect, the tail stayed dead for the life of the panel. Subscribing also
  // reconnects the stream when the token is refreshed mid-session.
  const accessToken = useAuthStore((st) => st.accessToken);
  // No token yet means "not ready", not "off" — don't burn a connection on a guaranteed 401.
  const streamKey = runId && enabled && !USE_MOCK && accessToken ? runId : undefined;
  const [live, setLive] = useState<TraceEvent[]>([]);
  // Seeded from streamKey, NOT a flat "off": on first mount prevKey is initialised equal to
  // streamKey, so the reset branch below never runs and the state would stay "off" for the whole
  // life of the panel — the socket would be genuinely open while the UI showed nothing.
  const [state, setState] = useState<TraceStreamState>(() => (streamKey ? "connecting" : "off"));
  // Reset during render (not in the effect) when the tailed run changes, so events from a
  // previously-open run never bleed into the next one.
  const [prevKey, setPrevKey] = useState(streamKey);
  if (prevKey !== streamKey) {
    setPrevKey(streamKey);
    setLive([]);
    setState(streamKey ? "connecting" : "off");
  }

  useEffect(() => {
    if (!streamKey) return;
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${HFT_API_URL}/api/runs/${runId}/trace/stream`, {
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
          // SSE frames are separated by a blank line. Split on CRLF *or* LF: an \r\n\r\n
          // separator contains no "\n\n", so splitting on LF alone would never yield a frame and
          // every event would sit in the buffer unparsed.
          const frames = buffer.split(/\r?\n\r?\n/);
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
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [runId, streamKey, accessToken]);

  return { events: live, state };
}
