// Shared SSE passthrough logic for the HFT stream routes (`runs/[id]/live/stream`,
// `runs/[id]/trace/stream`, `market-data/orderbook/stream`). See any of those route.ts files for
// why a filesystem route is needed at all (the blanket `/hft/:path*` rewrite buffers and kills a
// long-lived text/event-stream with a 503).
//
// Upstream may hold response headers for a while before its first event — a run with nothing new
// to publish can legitimately sit silent past axum's own 15s keep-alive — so we race a short
// grace period and open our own 200 early, then pump upstream bytes in as they arrive. But an
// upstream that never responds at all (a hung auth/DB/Redis call, a dead connection) must not be
// allowed to hold that "connected" 200 open forever: the client would sit in `state === "open"`
// with no data and no signal to reconnect. UPSTREAM_TIMEOUT_MS bounds that wait — past it we
// abort the upstream fetch and close the stream so the client's reconnect loop runs instead.

/** How long to wait for upstream headers before assuming it's an idle-but-healthy stream. */
const HEADER_GRACE_MS = 1500;

/** Hard cap on how long the fake-200 branch waits for upstream to ever produce a response. */
const UPSTREAM_TIMEOUT_MS = 20_000;

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  // no-transform stops any intermediary from buffering/compressing the frames.
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/**
 * Proxies one SSE `GET` to `upstreamUrl`, forwarding `Authorization` from `req`. Mirrors the
 * client's disconnect onto the upstream fetch via the returned stream's `cancel()` — `req.signal`
 * alone does not reliably fire in Next dev — so a dropped browser tab always tears down the
 * upstream connection instead of leaking it.
 */
export async function proxySseStream(req: Request, upstreamUrl: string): Promise<Response> {
  const auth = req.headers.get("authorization");
  const upstreamAbort = new AbortController();
  const onClientAbort = () => upstreamAbort.abort();
  req.signal.addEventListener("abort", onClientAbort);

  const upstreamPromise = fetch(upstreamUrl, {
    headers: {
      Accept: "text/event-stream",
      ...(auth ? { Authorization: auth } : {}),
    },
    cache: "no-store",
    signal: upstreamAbort.signal,
  });
  // Nothing else awaits this promise on the timeout path, so swallow late rejections here to keep
  // them from surfacing as unhandled.
  upstreamPromise.catch(() => {});

  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), HEADER_GRACE_MS));

  let settled: Response | "timeout";
  try {
    settled = await Promise.race([upstreamPromise, timeout]);
  } catch {
    // The browser navigating away aborts req.signal mid-connect. Ordinary teardown, not a failure.
    req.signal.removeEventListener("abort", onClientAbort);
    return new Response(null, { status: 204 });
  }

  // Headers arrived in time — pass the real status through so auth/not-found stay accurate.
  if (settled !== "timeout") {
    req.signal.removeEventListener("abort", onClientAbort);
    if (!settled.ok || !settled.body) return new Response(null, { status: settled.status });
    return new Response(settled.body, { status: 200, headers: SSE_HEADERS });
  }

  // Upstream is holding the connection without headers. Open ours now so the client knows it's
  // attached, then forward whatever eventually comes — but give up if NOTHING ever comes, rather
  // than holding a "healthy" 200 open on a connection that will never carry data.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // An SSE comment keeps the connection from looking idle to intermediaries and gives the
      // browser its first bytes immediately.
      controller.enqueue(new TextEncoder().encode(": connected\n\n"));
      const giveUp = setTimeout(() => upstreamAbort.abort(), UPSTREAM_TIMEOUT_MS);
      try {
        const upstream = await upstreamPromise;
        if (upstream.ok && upstream.body) {
          const reader = upstream.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        }
      } catch {
        // Client disconnect, upstream drop, or the give-up abort above.
      } finally {
        clearTimeout(giveUp);
        req.signal.removeEventListener("abort", onClientAbort);
      }
      try {
        controller.close();
      } catch {
        // Already closed via cancel() below — nothing left to do.
      }
    },
    cancel() {
      // Downstream (browser) gave up — tear down the upstream connection instead of leaking it.
      upstreamAbort.abort();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
