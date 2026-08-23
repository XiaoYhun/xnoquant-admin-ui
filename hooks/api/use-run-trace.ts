import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import { readTraceJournal, toTraceEvent, TraceHttpError, type TraceEvent } from "@/lib/trace-journal";

// Trade-cycle console log for a run: `/api/runs/{id}/trace/history` (replay) and `/trace/stream`
// (SSE, running paper/live runs only). Parsing lives in lib/trace-journal.ts because the route
// handler shares it — see there for why the journal is streamed rather than JSON.parse'd.
export {
  toTraceEvent,
  normalizeTrace,
  JsonArrayScanner,
  readTraceJournal,
  TraceHttpError,
  TRACE_HISTORY_MAX_BYTES,
} from "@/lib/trace-journal";
export type { TraceEvent, TraceHistory } from "@/lib/trace-journal";

export function useRunTraceHistory(runId: string | undefined) {
  return useQuery({
    queryKey: ["run-trace", runId],
    queryFn: async () => {
      if (USE_MOCK) return { events: [], truncated: false };
      const token = useAuthStore.getState().accessToken;
      // The route handler (not the blanket `/hft/:path*` rewrite) answers this path: it holds the
      // parsed journal in the Next server's memory, so a repeat load skips both the multi-megabyte
      // upstream transfer and the parse. Default `cache` — NOT "no-store" — so the browser keeps
      // its copy and revalidates with `If-None-Match`, which is what makes a reload cheap.
      const res = await fetch(`${HFT_API_URL}/api/runs/${runId}/trace/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new TraceHttpError(res.status);
      if (!res.body) throw new Error("Trade-cycle log unavailable (no response body)");
      const history = await readTraceJournal(res.body);
      // The handler already applied the size ceiling; its verdict wins over this hop's, which
      // only ever sees the compact reply.
      return { ...history, truncated: history.truncated || res.headers.get("X-Trace-Truncated") === "1" };
    },
    enabled: !!runId,
    // Long enough that flipping between the panel's tabs is instant, short enough that opening the
    // panel afresh re-checks. The refetch is cheap: the handler serves from its cache, and an
    // unchanged journal comes back as a 304 the browser fills from its own.
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    // `/trace/history` intermittently 503s on big journals (observed twice in a row on run
    // 01a00f11 before the identical request succeeded). One blip used to leave the panel reading
    // "unavailable" for the rest of the session, so retry the transient class — and only that:
    // a 404 (a backtest, which never journals) is a real answer, not a blip.
    retry: (count, err) => err instanceof TraceHttpError && err.status >= 500 && count < 2,
    retryDelay: (count) => 500 * 2 ** count,
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
