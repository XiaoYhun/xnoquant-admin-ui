import { createHash } from "node:crypto";
import { readTraceJournal, type TraceHistory } from "@/lib/trace-journal";

// Cached parse of `GET /api/runs/{id}/trace/history`.
//
// The blanket `/hft/:path*` rewrite in next.config.ts would forward this straight to the browser,
// which meant every visit re-downloaded the run's ENTIRE journal — 27 MB / ~97k events for run
// 01a00f11, with no paging offered by the endpoint — and re-parsed it on the main thread. Route
// handlers are filesystem routes, which resolve BEFORE `fallback` rewrites, so this one claims the
// path and does that work once, on the server:
//
//   • the multi-megabyte upstream transfer happens server→server, off the browser's budget;
//   • the journal is normalized to `TraceEvent[]`, which drops `run_id` (a 36-char UUID repeated
//     once per event), `account_id` and `order_id` — most of the bytes on the wire;
//   • the result is held in memory, so a repeat load costs nothing upstream;
//   • an ETag lets the browser skip the transfer entirely and revalidate on load instead.
//
// The cache is process-local and lost on restart (and per-instance if this is ever deployed to
// more than one). That is fine — it is a read-through cache for an immutable artifact, not a
// store: a terminal run's journal never changes, and a running one gets its tail from the SSE
// stream, not from here.

const HFT_UPSTREAM = process.env.NEXT_PUBLIC_HFT_URL ?? "https://hft-dev.xnoquant.io";

/** Long enough to cover a session's worth of panel opening; short enough to pick up a re-run. */
const TTL_MS = 5 * 60_000;
/** A journal can be tens of MB parsed, so hold only a handful of runs. Oldest read is evicted. */
const MAX_ENTRIES = 6;

type Entry = { body: string; etag: string; truncated: boolean; storedAt: number };

const cache = new Map<string, Entry>();

/**
 * Cache key includes the caller's token, never the run id alone.
 *
 * Serving a cached journal on run id alone would hand it to anyone who asked, skipping the
 * upstream authorization that is the only thing gating this data. Keying by token means a hit can
 * only ever be replayed to the caller who already proved access. Tokens rotate, so a refresh costs
 * one re-fetch — the right side to err on.
 */
function cacheKey(id: string, auth: string | null): string {
  return `${id}:${createHash("sha256").update(auth ?? "").digest("hex").slice(0, 16)}`;
}

function readCache(key: string): Entry | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.storedAt > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  // Re-insert so `MAX_ENTRIES` eviction drops the least recently READ, not the oldest written.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function writeCache(key: string, entry: Entry): void {
  cache.set(key, entry);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/** `private` keeps shared caches out of it; `no-cache` means "store it, but revalidate on load". */
function respond(entry: Entry, req: Request, cached: boolean): Response {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-cache",
    ETag: entry.etag,
    "X-Trace-Cache": cached ? "hit" : "miss",
    // The body stays a plain `TraceEvent[]` so the client can stream-parse it; completeness rides
    // alongside in a header rather than wrapping the array in an envelope.
    "X-Trace-Truncated": entry.truncated ? "1" : "0",
  };
  if (req.headers.get("if-none-match") === entry.etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(entry.body, { status: 200, headers });
}

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = req.headers.get("authorization");
  const key = cacheKey(id, auth);

  const hit = readCache(key);
  if (hit) return respond(hit, req, true);

  let upstream: Response;
  try {
    upstream = await fetch(`${HFT_UPSTREAM}/api/runs/${id}/trace/history`, {
      headers: {
        Accept: "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    // Upstream refused or hung up (it intermittently does on big journals). 503 is the honest
    // answer and the client retries it; anything cached stays cached for the next attempt.
    return Response.json({ error: "trace history upstream unavailable" }, { status: 503 });
  }

  // Pass auth/not-found through verbatim so the client can tell them apart.
  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: upstream.status });
  }

  let history: TraceHistory;
  try {
    history = await readTraceJournal(upstream.body);
  } catch {
    return Response.json({ error: "trace history could not be parsed" }, { status: 502 });
  }

  const body = JSON.stringify(history.events);
  const entry: Entry = {
    body,
    // Weak: derived from the journal's shape, not a byte hash of it — enough to tell a grown or
    // re-run journal from an unchanged one without hashing megabytes on every request.
    etag: `W/"${history.events.length}-${history.events[history.events.length - 1]?.at ?? 0}-${history.truncated ? "t" : "f"}"`,
    truncated: history.truncated,
    storedAt: Date.now(),
  };
  // A cut-short journal is a partial answer; caching it would pin the truncation for the whole TTL.
  if (!history.truncated) writeCache(key, entry);
  return respond(entry, req, false);
}
