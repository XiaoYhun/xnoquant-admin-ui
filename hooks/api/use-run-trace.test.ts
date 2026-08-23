import { describe, it, expect } from "vitest";
import { JsonArrayScanner, normalizeTrace } from "@/hooks/api/use-run-trace";

/** Feeds a whole body through the scanner one slice at a time, as the network would. */
function scan(body: string, chunkSize: number): unknown[] {
  const out: unknown[] = [];
  const scanner = new JsonArrayScanner();
  for (let i = 0; i < body.length; i += chunkSize) {
    scanner.push(body.slice(i, i + chunkSize), out);
  }
  return out;
}

describe("JsonArrayScanner", () => {
  const body = JSON.stringify([
    { kind: "cycle_opened", cycle_id: 0, qty: 0.01, ts_ms: 1 },
    { kind: "order_submitted", cycle_id: 0, client_order_id: "0-0-1", ts_ms: 2 },
    { kind: "order_filled", cycle_id: 0, price: 63212.97, ts_ms: 3 },
  ]);

  it("yields every element when the body arrives in one chunk", () => {
    expect(scan(body, body.length)).toHaveLength(3);
  });

  it("yields the same elements no matter where the chunk boundaries fall", () => {
    const whole = scan(body, body.length);
    for (const size of [1, 2, 3, 7, 13, 64]) {
      expect(scan(body, size)).toEqual(whole);
    }
  });

  it("does not treat braces or brackets inside strings as structure", () => {
    // The real journal's `message` carries text like `fill: BUY 1 @ 1959.1` — and a run can name a
    // symbol with a brace. A byte-counting scanner would end the object early on these.
    const tricky = JSON.stringify([
      { kind: "order_filled", message: 'fill {BUY} [1] @ "1959.1"' },
      { kind: "cycle_closed", message: "closed \ }] done" },
    ]);
    expect(scan(tricky, 5)).toEqual(JSON.parse(tricky));
  });

  it("keeps nested objects and arrays intact", () => {
    const nested = JSON.stringify([{ kind: "x", meta: { a: [1, { b: 2 }] } }, { kind: "y" }]);
    expect(scan(nested, 3)).toEqual(JSON.parse(nested));
  });

  it("emits nothing until an element is complete, so a cut-off tail is dropped", () => {
    const partial = body.slice(0, body.indexOf("order_filled"));
    expect(scan(partial, 8)).toHaveLength(2);
  });

  it("skips a malformed element rather than losing the rest of the journal", () => {
    const broken = '[{"kind":"a"},{"kind":,},{"kind":"c"}]';
    expect(scan(broken, 4)).toEqual([{ kind: "a" }, { kind: "c" }]);
  });

  it("stays linear on a journal-sized body", () => {
    // Run 01a00f11 is 27 MB / ~97k events. Compacting the buffer per element instead of per chunk
    // made this quadratic and froze the tab, so pin the shape: 20k elements arriving in realistic
    // ~64 KB chunks must finish well inside a budget a quadratic scan could never meet.
    const many = JSON.stringify(
      Array.from({ length: 20_000 }, (_, i) => ({ kind: "order_submitted", cycle_id: i, ts_ms: i })),
    );
    const started = performance.now();
    const out = scan(many, 64 * 1024);
    expect(out).toHaveLength(20_000);
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it("feeds normalizeTrace the same events a whole-body JSON.parse would", () => {
    expect(normalizeTrace(scan(body, 9))).toEqual(normalizeTrace(JSON.parse(body)));
  });

  it("survives the second normalize the route handler forces", () => {
    // The handler parses the raw snake_case journal and sends back normalized camelCase events,
    // which the browser then parses again. That round trip has to be a no-op or the panel would
    // silently lose fields the server already resolved.
    const once = normalizeTrace(JSON.parse(body));
    const overTheWire = scan(JSON.stringify(once), 11);
    expect(normalizeTrace(overTheWire)).toEqual(once);
  });
});
