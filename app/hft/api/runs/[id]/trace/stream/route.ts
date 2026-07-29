// SSE passthrough for `GET /api/runs/{id}/trace/stream`.
//
// Every other HFT call goes through the blanket `/hft/:path*` rewrite in next.config.ts, but that
// rewrite buffers the response — a long-lived text/event-stream connection dies there with a 503
// (a status the endpoint itself never documents: it only returns 200/401/403/404). Route handlers
// are filesystem routes, which resolve BEFORE `afterFiles` rewrites, so this one claims the stream
// path and hands the upstream body back unbuffered.
//
// Upstream does NOT flush SSE response headers on connect — an authenticated stream sits open with
// no headers until it has an event to write (verified: unauthenticated is rejected in ~30ms, but an
// authenticated connection produced no headers after 20s). Awaiting that fetch outright meant the
// browser's request hung too, so the client could never tell "connected" from "broken". Instead we
// wait a bounded moment for real headers — long enough that 401/403/404 still propagate accurately
// — and otherwise open the stream to the browser immediately and pump frames in as they arrive.

const HFT_UPSTREAM = process.env.NEXT_PUBLIC_HFT_URL ?? "https://hft-dev.xnoquant.io";

/** How long to wait for upstream headers before assuming it's an idle-but-healthy stream. */
const HEADER_GRACE_MS = 1500;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  // no-transform stops any intermediary from buffering/compressing the frames.
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = req.headers.get("authorization");

  const upstreamPromise = fetch(`${HFT_UPSTREAM}/api/runs/${id}/trace/stream`, {
    headers: {
      Accept: "text/event-stream",
      ...(auth ? { Authorization: auth } : {}),
    },
    cache: "no-store",
    // Propagate client disconnects so the upstream stream is torn down with the browser tab.
    signal: req.signal,
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
    return new Response(null, { status: 204 });
  }

  // Headers arrived in time — pass the real status through so auth/not-found stay accurate.
  if (settled !== "timeout") {
    if (!settled.ok || !settled.body) return new Response(null, { status: settled.status });
    return new Response(settled.body, { status: 200, headers: SSE_HEADERS });
  }

  // Upstream is holding the connection without headers. Open ours now so the client knows it's
  // attached, then forward whatever eventually comes.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // An SSE comment keeps the connection from looking idle to intermediaries and gives the
      // browser its first bytes immediately.
      controller.enqueue(new TextEncoder().encode(": connected\n\n"));
      try {
        const upstream = await upstreamPromise;
        if (!upstream.ok || !upstream.body) {
          controller.close();
          return;
        }
        const reader = upstream.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch {
        // Client disconnect or upstream drop — just end the stream.
      }
      controller.close();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
