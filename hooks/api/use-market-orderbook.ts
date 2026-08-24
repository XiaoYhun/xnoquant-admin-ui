"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import { toLiveOrderbookLevel, type LiveOrderbookLevel, type LiveStreamState } from "./use-run-live-snapshot";
import type { OrderbookSymbol } from "./use-orderbook-symbols";

// `GET /api/market-data/orderbook/stream?venue_id=&symbol=[&account_id=]` — the venue's live book
// for ANY symbol, independent of a running paper/live run. Frames carry only the book:
// `{"symbol":"BTCUSDT","bids":[{price,qty}],"asks":[{price,qty}],"updated_at_ms":…}` — no
// `symbol_id`, no run wrapper, so this is a separate tail from `LiveSnapshotProvider`'s.
//
// Same framing as the run streams: `EventSource` can't send an Authorization header, so the SSE
// frames are read off a fetch body and parsed by hand.

export type MarketOrderbook = {
  symbol: string;
  bids: LiveOrderbookLevel[];
  asks: LiveOrderbookLevel[];
  /** `updated_at_ms` from the frame, else receive time. */
  ts: number;
};

export function toMarketOrderbook(raw: unknown, receivedAt: number): MarketOrderbook | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const symbol = typeof r.symbol === "string" ? r.symbol : undefined;
  if (!symbol) return null;
  const levels = (side: unknown) =>
    Array.isArray(side) ? side.map(toLiveOrderbookLevel).filter((l): l is LiveOrderbookLevel => l !== null) : [];
  return {
    symbol,
    bids: levels(r.bids),
    asks: levels(r.asks),
    ts: typeof r.updated_at_ms === "number" ? r.updated_at_ms : receivedAt,
  };
}

/** Reconnect backoff after a dropped stream — the same fixed delay the run streams use. */
const RETRY_MS = 2000;

/**
 * The upstream error text, when it sent one. The venue gateway answers e.g.
 * `422 {"error":"live orderbook viewing is not supported for venue Dnse"}` — only some venue types
 * publish a book at all — and that reason is worth showing rather than waiting forever.
 */
async function errorMessage(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // Not JSON — fall through to the raw body.
  }
  return body.trim() || `Order book stream failed (${res.status}).`;
}

export function useMarketOrderbook(target: OrderbookSymbol | undefined): {
  book?: MarketOrderbook;
  state: LiveStreamState;
  /** Why the stream is dead, when it failed terminally. */
  error?: string;
} {
  // SUBSCRIBE to the token rather than reading it once: the panel mounts before AuthProvider has
  // exchanged the Firebase session, and a one-shot read would send no header and 401.
  const accessToken = useAuthStore((st) => st.accessToken);
  const url = target && !USE_MOCK && accessToken ? streamUrl(target) : undefined;
  const [book, setBook] = useState<MarketOrderbook | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [state, setState] = useState<LiveStreamState>(() => (url ? "connecting" : "off"));
  // Reset during render (not in the effect) when the tailed symbol changes, so one book's ladder
  // never lingers under another symbol's name.
  const [prevUrl, setPrevUrl] = useState(url);
  if (prevUrl !== url) {
    setPrevUrl(url);
    setBook(undefined);
    setError(undefined);
    setState(url ? "connecting" : "off");
  }

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function connect() {
      let terminal = false;
      try {
        const res = await fetch(url!, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        // Every 4xx is the request itself being refused — an unsupported venue (422), a missing
        // account_id, auth or visibility — and no amount of retrying changes the answer. Only a
        // dropped connection or a 5xx is worth reconnecting for.
        terminal = res.status >= 400 && res.status < 500;
        if (!res.ok || !res.body) {
          if (terminal) setError(await errorMessage(res));
          throw new Error(`orderbook stream ${res.status}`);
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
                const next = toMarketOrderbook(JSON.parse(line.slice(5).trim()), Date.now());
                if (next) setBook(next);
              } catch {
                // A malformed frame shouldn't kill the tail.
              }
            }
          }
        }
      } catch {
        // Aborted on unmount, or the stream dropped / never opened.
      }
      if (cancelled) return;
      setState(terminal ? "error" : "connecting");
      if (!terminal) retry = setTimeout(connect, RETRY_MS);
    }
    connect();

    return () => {
      cancelled = true;
      controller.abort();
      if (retry) clearTimeout(retry);
    };
  }, [url, accessToken]);

  return { book, state, error };
}

function streamUrl({ symbol, venueId, accountId }: OrderbookSymbol) {
  const params = new URLSearchParams({ venue_id: venueId, symbol });
  if (accountId) params.set("account_id", accountId);
  return `${HFT_API_URL}/api/market-data/orderbook/stream?${params}`;
}
