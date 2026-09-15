// SSE passthrough for `GET /api/market-data/orderbook/stream`.
//
// Same rationale as `…/runs/[id]/live/stream/route.ts`: the blanket `/hft/:path*` rewrite buffers,
// so a long-lived text/event-stream dies with a 503. This filesystem route claims the path first
// and hands the upstream body back unbuffered. See `lib/sse-proxy.ts` for the grace-path/give-up
// logic shared by every SSE route.
import { proxySseStream } from "@/lib/sse-proxy";

const HFT_UPSTREAM = process.env.NEXT_PUBLIC_HFT_URL ?? "https://hft-dev.xnoquant.io";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // `venue_id`, `symbol` and the optional `account_id` all live in the query string — forward it
  // whole rather than re-listing the params, so a new one needs no change here.
  const query = new URL(req.url).search;
  return proxySseStream(req, `${HFT_UPSTREAM}/api/market-data/orderbook/stream${query}`);
}
