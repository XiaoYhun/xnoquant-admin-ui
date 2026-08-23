// Parsing for a run's trade-cycle journal (`GET /api/runs/{id}/trace/history`).
//
// Lives in lib/ rather than beside the hook because BOTH sides use it: the route handler at
// app/hft/api/runs/[id]/trace/history parses and caches the journal on the Next server, and the
// browser parses the compact array that handler returns. The response is UNTYPED in the OpenAPI
// spec (`content?: never`), so events are normalized defensively from whatever field names the
// server uses. Backtests never journal a trace — the history is simply empty for them.

export type TraceEvent = {
  /** Epoch millis. The API sends `ts_ms` as a NUMBER — formatting is the view's job. */
  at?: number;
  /** Raw lifecycle stage as sent, e.g. "cycle_opened" / "order_submitted" / "order_filled". */
  stage: string;
  /** Server's own message, used as a fallback when a line can't be composed from the fields. */
  detail?: string;
  symbol?: string;
  /** Index into the run manifest's ordered symbol list; the name is resolved by the view. */
  symbolId?: number;
  side?: string;
  qty?: number;
  price?: number;
  /** Why the cycle opened, e.g. "signal" — rendered as the "(Signal)" suffix. */
  reason?: string;
  /** Groups events into one trade cycle. Sent as a NUMBER (`cycle_id`). */
  cycleId?: string;
  /** Correlates submit ↔ fill(s) for qty-weighted fill rate (`client_order_id`). */
  clientOrderId?: string;
};

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Timestamps arrive as epoch millis (`ts_ms`); tolerate an ISO string too. */
function toEpochMs(r: Record<string, unknown>): number | undefined {
  const n = num(r.ts_ms) ?? num(r.ts) ?? num(r.at) ?? num(r.timestamp);
  if (n !== undefined) return n;
  const iso = str(r.at) ?? str(r.ts) ?? str(r.time) ?? str(r.timestamp) ?? str(r.created_at);
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** `cycle_id` is a number (often 0), so it can't go through the string helper. */
function toIdString(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return str(v);
}

export function toTraceEvent(raw: unknown): TraceEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const stage = str(r.kind) ?? str(r.stage) ?? str(r.event) ?? str(r.status) ?? str(r.type) ?? str(r.message);
  if (!stage) return null;
  return {
    at: toEpochMs(r),
    stage,
    detail: str(r.message) ?? str(r.detail) ?? str(r.description) ?? str(r.text),
    symbol: str(r.symbol) ?? str(r.symbol_name) ?? str(r.instrument),
    symbolId: num(r.symbol_id) ?? num(r.symbolId),
    side: str(r.side) ?? str(r.direction),
    qty: num(r.qty) ?? num(r.quantity) ?? num(r.size),
    price: num(r.price) ?? num(r.fill_price) ?? num(r.avg_price),
    reason: str(r.reason),
    cycleId: toIdString(r.cycle_id) ?? toIdString(r.cycleId) ?? toIdString(r.trade_id) ?? toIdString(r.cycle),
    clientOrderId:
      str(r.client_order_id) ?? str(r.clientOrderId) ?? toIdString(r.client_order_id) ?? toIdString(r.clientOrderId),
  };
}

export function normalizeTrace(raw: unknown): TraceEvent[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { events?: unknown[] }).events)
      ? (raw as { events: unknown[] }).events
      : [];
  return list.map(toTraceEvent).filter((e): e is TraceEvent => e !== null);
}
/**
 * Backstop for a runaway `trace/history` body, in DECOMPRESSED bytes (the wire is gzipped and
 * roughly 20× smaller).
 *
 * The endpoint takes no `page`/`limit` and always returns the run's ENTIRE journal as one JSON
 * array. A busy HFT run makes that enormous — a 12-minute dev run measured 201 MB / 696,078
 * events, and a 2-minute one 27 MB / 97,255 (run 01a00f11). `res.json()` on that blocks the main
 * thread long enough that the whole tab stops responding.
 *
 * The journal is no longer refused for being big: it is scanned as the bytes arrive, so the
 * parsing cost is spread across chunks instead of landing in one `JSON.parse`, and the views
 * reveal it a page at a time rather than mounting every cycle at once. This ceiling only exists
 * so a pathological body can't exhaust memory; passing it stops the transfer and is reported via
 * `truncated`, never silently.
 */
export const TRACE_HISTORY_MAX_BYTES = 64 * 1024 * 1024;

/** Carries the status so only transient (5xx) failures are retried. */
export class TraceHttpError extends Error {
  constructor(public status: number) {
    super(`Trade-cycle log unavailable (${status})`);
    this.name = "TraceHttpError";
  }
}

export type TraceHistory = {
  events: TraceEvent[];
  /** True when the backstop cut the journal short, so the views can say the tail is missing. */
  truncated: boolean;
};

/**
 * Pulls whole top-level objects out of a `[{…},{…},…]` body as its bytes arrive, so the journal is
 * parsed in chunk-sized pieces between `reader.read()` awaits instead of one main-thread-blocking
 * `JSON.parse` over the entire 27 MB.
 *
 * Scanning is string-aware (a brace inside `"message"` must not count) and keeps its position
 * across chunks, so each byte is examined once. Consumed text is dropped from the buffer as soon
 * as its object is parsed, which is what keeps memory flat over a long journal.
 */
export class JsonArrayScanner {
  private buf = "";
  private cursor = 0;
  private depth = 0;
  /** Index in `buf` where the object currently being scanned began; -1 when between objects. */
  private start = -1;
  /** End of the last fully-parsed element; the buffer is compacted up to here once per chunk. */
  private consumed = 0;
  private inString = false;
  private escaped = false;

  /** Appends a chunk and pushes whatever objects it completes onto `out`. */
  push(chunk: string, out: unknown[]): void {
    this.buf += chunk;
    while (this.cursor < this.buf.length) {
      const c = this.buf[this.cursor];
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (c === "\\") this.escaped = true;
        else if (c === '"') this.inString = false;
      } else if (c === '"') {
        this.inString = true;
      } else if (c === "{" || c === "[") {
        // The array's own opening bracket sits at depth 0 with no object started — ignore it.
        if (this.depth === 0 && c === "{") this.start = this.cursor;
        if (this.start >= 0) this.depth++;
      } else if ((c === "}" || c === "]") && this.start >= 0) {
        this.depth--;
        if (this.depth === 0) {
          try {
            out.push(JSON.parse(this.buf.slice(this.start, this.cursor + 1)));
          } catch {
            // One malformed element shouldn't lose the rest of the journal.
          }
          this.start = -1;
          this.consumed = this.cursor + 1;
        }
      }
      this.cursor++;
    }
    // Compacting per element instead would re-copy the chunk's whole remaining text on every one
    // of its thousands of objects — quadratic, and enough to freeze the tab on a 27 MB journal.
    if (this.consumed > 0) {
      this.buf = this.buf.slice(this.consumed);
      this.cursor -= this.consumed;
      if (this.start >= 0) this.start -= this.consumed;
      this.consumed = 0;
    }
  }
}

/**
 * Reads a whole `[{…},{…},…]` journal off a response body, parsing it incrementally.
 *
 * Used by the route handler (upstream body) and by the browser (the handler's compact reply).
 * `content-length` is NOT usable on either hop — upstream answers `transfer-encoding: chunked`
 * with `content-encoding: gzip`, so no length is advertised and `res.text()` would buffer the
 * whole body before any ceiling could apply. A stream reader yields already-decompressed bytes,
 * which is exactly the cost that matters, and cancelling it stops the transfer.
 */
export async function readTraceJournal(body: ReadableStream<Uint8Array>): Promise<TraceHistory> {
  const reader = body.getReader();
  const scanner = new JsonArrayScanner();
  const decoder = new TextDecoder();
  // One chunk's worth of raw objects at a time, converted and discarded before the next arrives.
  // Collecting the whole journal raw and normalizing at the end held ~100k parsed objects TWICE,
  // which is a few hundred MB of peak heap on a 27 MB journal — enough to matter in the Next
  // server process that now does this parse.
  const batch: unknown[] = [];
  const events: TraceEvent[] = [];
  let received = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    scanner.push(decoder.decode(value, { stream: true }), batch);
    for (const raw of batch) {
      const event = toTraceEvent(raw);
      if (event) events.push(event);
    }
    batch.length = 0;
    if (received > TRACE_HISTORY_MAX_BYTES) {
      truncated = true;
      await reader.cancel();
      break;
    }
  }
  return { events, truncated };
}
