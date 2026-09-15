// SSE passthrough for `GET /api/runs/{id}/live/stream`.
//
// Same rationale as `…/trace/stream/route.ts`: the blanket `/hft/:path*` rewrite buffers, so a
// long-lived text/event-stream dies with a 503. This filesystem route claims the path first and
// hands the upstream body back unbuffered. See `lib/sse-proxy.ts` for the grace-path/give-up
// logic shared by every SSE route.
import { proxySseStream } from "@/lib/sse-proxy";

const HFT_UPSTREAM = process.env.NEXT_PUBLIC_HFT_URL ?? "https://hft-dev.xnoquant.io";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxySseStream(req, `${HFT_UPSTREAM}/api/runs/${id}/live/stream`);
}
