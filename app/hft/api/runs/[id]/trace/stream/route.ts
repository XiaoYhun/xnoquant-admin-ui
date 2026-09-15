// SSE passthrough for `GET /api/runs/{id}/trace/stream`.
//
// Every other HFT call goes through the blanket `/hft/:path*` rewrite in next.config.ts, but that
// rewrite buffers the response — a long-lived text/event-stream connection dies there with a 503
// (a status the endpoint itself never documents: it only returns 200/401/403/404). Route handlers
// are filesystem routes, which resolve BEFORE `afterFiles` rewrites, so this one claims the stream
// path and hands the upstream body back unbuffered. See `lib/sse-proxy.ts` for the grace-path/
// give-up logic shared by every SSE route.
import { proxySseStream } from "@/lib/sse-proxy";

const HFT_UPSTREAM = process.env.NEXT_PUBLIC_HFT_URL ?? "https://hft-dev.xnoquant.io";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxySseStream(req, `${HFT_UPSTREAM}/api/runs/${id}/trace/stream`);
}
