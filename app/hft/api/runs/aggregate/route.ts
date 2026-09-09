// TEMPORARY — a wider server-assembled window over `GET /api/runs`, not real pagination.
//
// Upstream clamps `size` to 200 (`q.size.clamp(1, 200)` in crates/api/src/routes/runs/crud.rs)
// and exposes no `mode` filter, so every list screen — Paper, Live, Backtesting — has to pull a
// page of runs and narrow it to one mode in the browser (GAP-2). At 200 rows that truncated
// silently: past 200 runs the older ones simply never appeared, and each per-mode list saw fewer
// still, with no edge the user could see.
//
// Until the API grows a `mode` filter — at which point each screen pages server-side properly and
// this route should be DELETED — assemble the window here rather than in the browser: walk the
// upstream pages 200 at a time, server→server, and hand the client one list. The filtering and
// paging the screens do stay client-side; this only widens what they have to work with.
//
// Route handlers are filesystem routes, so this resolves before the blanket `/hft/:path*` fallback
// rewrite in next.config.ts. It sits on its own path rather than claiming `/hft/api/runs`, which
// would also have to proxy the `POST` that launches runs.

const HFT_UPSTREAM = process.env.NEXT_PUBLIC_HFT_URL ?? "https://hft-dev.xnoquant.io";

/** Upstream hard cap. Asking for more is not an error — it just returns 200 rows. */
const UPSTREAM_PAGE_SIZE = 200;
/** How wide a window to assemble: five upstream calls at the cap above. */
const MAX_RUNS = 1000;

type RunPage = { runs: unknown[]; total: number; page: number; size: number };

/** Paging is this route's to drive, so the caller's `page`/`size` are dropped, not forwarded. */
function upstreamUrl(filters: URLSearchParams, page: number): string {
  const p = new URLSearchParams(filters);
  p.set("size", String(UPSTREAM_PAGE_SIZE));
  p.set("page", String(page));
  return `${HFT_UPSTREAM}/api/runs?${p}`;
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const filters = new URLSearchParams(new URL(req.url).search);
  filters.delete("page");
  filters.delete("size");

  const headers = { Accept: "application/json", ...(auth ? { Authorization: auth } : {}) };
  const getPage = (page: number) =>
    fetch(upstreamUrl(filters, page), { headers, cache: "no-store", signal: req.signal });

  let head: Response;
  try {
    head = await getPage(0);
  } catch {
    return Response.json({ error: "runs upstream unavailable" }, { status: 503 });
  }
  // Pass 401/403/404 through verbatim so the client can tell them apart — apiGet turns the status
  // into an ApiError and retryUnlessForbidden reads it.
  if (!head.ok) return new Response(null, { status: head.status });

  const first = (await head.json()) as RunPage;
  const runs = Array.isArray(first?.runs) ? [...first.runs] : [];
  // `total` is the filtered COUNT(*), so it says how many pages actually exist — without it this
  // would fetch all five every time, four of them empty for the common case of a short list.
  const total = typeof first?.total === "number" ? first.total : runs.length;
  const pages = Math.ceil(Math.min(total, MAX_RUNS) / UPSTREAM_PAGE_SIZE);

  if (pages > 1) {
    let rest: Response[];
    try {
      rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => getPage(i + 1)));
    } catch {
      return Response.json({ error: "runs upstream unavailable" }, { status: 503 });
    }
    // One failed page means a list that is short by up to 200 runs with nothing to show for it.
    // The dev API 500s intermittently, so this will happen; failing is the honest answer and the
    // client already retries. Returning the partial list would look exactly like a complete one.
    const failed = rest.find((r) => !r.ok);
    if (failed) return new Response(null, { status: failed.status });
    for (const res of rest) {
      const body = (await res.json()) as RunPage;
      if (Array.isArray(body?.runs)) runs.push(...body.runs);
    }
  }

  // Runs are inserted while this walks, which shifts every later page's offset and can repeat a
  // row across two of them. `fetchRuns` already dedupes by id for the same reason upstream can
  // serve one twice, so the fix stays in one place rather than being half-applied here.
  const windowed = runs.slice(0, MAX_RUNS);
  return Response.json(
    { runs: windowed, total, page: 0, size: windowed.length } satisfies RunPage,
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
