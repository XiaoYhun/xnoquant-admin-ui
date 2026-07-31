// Order-book depth for the Live trade right rail (Figma 14779:27408). HFT exposes no order-book
// endpoint — `DataSourceType: "orderbook"` in types/api/hft.ts is the only trace of one — so the
// panel renders mock depth until it lands. Values are derived deterministically from the symbol
// (no Math.random) so the server and client render the same markup.

export type OrderbookLevel = {
  amountBuy: number;
  priceBuy: number;
  priceSell: number;
  amountSell: number;
};

export type OrderbookQuote = {
  symbol: string;
  last: number;
  change: number;
  changePct: number;
  ceiling: number;
  reference: number;
  floor: number;
  /** Matched volume ("KL") and turnover ("GT") as the design renders them. */
  volume: string;
  turnover: string;
  levels: OrderbookLevel[];
};

// Symbols offered per market tab. The first entry is the default the panel opens on — the
// "1 symbol per market type before you search" behaviour.
export const SYMBOLS_BY_MARKET: Record<string, string[]> = {
  Vietnam: ["TPB", "VCB", "HPG", "SSI", "MBB"],
  VNFuture: ["41I1G7000", "VN30F1M", "VN30F2M"],
  Crypto: ["BTCUSD", "ETHUSD", "SOLUSD"],
};

export function defaultSymbolFor(market: string): string {
  return SYMBOLS_BY_MARKET[market]?.[0] ?? "TPB";
}

const BASE_PRICE: Record<string, number> = {
  TPB: 17.85,
  VCB: 92.4,
  HPG: 27.6,
  SSI: 33.15,
  MBB: 24.8,
  "41I1G7000": 1927.5,
  VN30F1M: 1341.2,
  VN30F2M: 1345.8,
  BTCUSD: 67420,
  ETHUSD: 3512,
  SOLUSD: 184.3,
};

// FNV-1a over (symbol, index) → a stable number in [0, 1).
function noise(seed: string, index: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h = Math.imul(h ^ index, 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

const LEVELS = 15;

export function orderbookFor(symbol: string): OrderbookQuote {
  const reference = BASE_PRICE[symbol] ?? 100;
  // Floor the tick at one display unit (prices render to 2dp) so adjacent levels stay distinct
  // — on a low-priced symbol like TPB a raw 0.05% tick rounds several levels to the same price.
  const tick = Math.max(0.01, Number((reference * 0.0005).toPrecision(2)));
  const changePct = Number(((noise(symbol, 0) - 0.35) * 2).toFixed(2));
  const last = Number((reference * (1 + changePct / 100)).toFixed(2));

  const levels: OrderbookLevel[] = Array.from({ length: LEVELS }, (_, i) => ({
    amountBuy: 20 + Math.round(noise(symbol, i + 1) * 25),
    priceBuy: Number((last - tick * (i + 1)).toFixed(2)),
    priceSell: Number((last + tick * (i + 1)).toFixed(2)),
    amountSell: 2 + Math.round(noise(symbol, i + 100) * 4),
  }));

  return {
    symbol,
    last,
    change: Number((last - reference).toFixed(2)),
    changePct,
    // Vietnamese boards quote a ±7% daily band around the reference price.
    ceiling: Number((reference * 1.07).toFixed(2)),
    reference,
    floor: Number((reference * 0.93).toFixed(2)),
    volume: `${(1 + noise(symbol, 7) * 3).toFixed(3)} tr`,
    turnover: `${(20 + noise(symbol, 8) * 20).toFixed(3)} tỷ`,
    levels,
  };
}
