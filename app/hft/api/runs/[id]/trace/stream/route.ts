// SSE passthrough for `GET /api/runs/{id}/trace/stream`.
//
// Every other HFT call goes through the blanket `/hft/:path*` rewrite in next.config.ts, but that
// rewrite buffers the response — a long-lived text/event-stream connection dies there with a 503
// (a status the endpoint itself never documents: it only returns 200/401/403/404). Route handlers
// are filesystem routes, which resolve BEFORE `afterFiles` rewrites, so this one claims the stream
// path and hands the upstream body back unbuffered.

const HFT_UPSTREAM = process.env.NEXT_PUBLIC_HFT_URL ?? "https://hft-dev.xnoquant.io";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = req.headers.get("authorization");

  let upstream: Response;
  try {
    upstream = await fetch(`${HFT_UPSTREAM}/api/runs/${id}/trace/stream`, {
      headers: {
        Accept: "text/event-stream",
        ...(auth ? { Authorization: auth } : {}),
      },
      cache: "no-store",
      // Propagate client disconnects so the upstream stream is torn down with the browser tab.
      signal: req.signal,
    });
  } catch {
    // The browser navigating away aborts req.signal mid-connect. That is ordinary teardown, not a
    // failure worth surfacing (or logging as an unhandled ResponseAborted).
    return new Response(null, { status: 204 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform stops any intermediary from buffering/compressing the frames.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
