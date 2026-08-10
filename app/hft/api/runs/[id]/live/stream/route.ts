// SSE passthrough for `GET /api/runs/{id}/live/stream`.
//
// Same rationale as `…/trace/stream/route.ts`: the blanket `/hft/:path*` rewrite buffers, so a
// long-lived text/event-stream dies with a 503. This filesystem route claims the path first and
// hands the upstream body back unbuffered. Upstream may hold headers until the first event — race
// a short grace period so the browser can still classify "connected" vs auth failures.
const HFT_UPSTREAM = process.env.NEXT_PUBLIC_HFT_URL ?? "https://hft-dev.xnoquant.io";

const HEADER_GRACE_MS = 1500;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = req.headers.get("authorization");

  const upstreamPromise = fetch(`${HFT_UPSTREAM}/api/runs/${id}/live/stream`, {
    headers: {
      Accept: "text/event-stream",
      ...(auth ? { Authorization: auth } : {}),
    },
    cache: "no-store",
    signal: req.signal,
  });
  upstreamPromise.catch(() => {});

  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), HEADER_GRACE_MS));

  let settled: Response | "timeout";
  try {
    settled = await Promise.race([upstreamPromise, timeout]);
  } catch {
    return new Response(null, { status: 204 });
  }

  if (settled !== "timeout") {
    if (!settled.ok || !settled.body) return new Response(null, { status: settled.status });
    return new Response(settled.body, { status: 200, headers: SSE_HEADERS });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
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
        // Client disconnect or upstream drop.
      }
      controller.close();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
