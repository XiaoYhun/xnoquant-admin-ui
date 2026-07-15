// Static curated content for the Create Strategy (HFT) "Samples" tab (Figma 14562:20367).
// There is no HFT samples API endpoint — this data is UI-only, not fetched.

export type HftSample = {
  id: string;
  name: string;
  description: string;
  code: string;
};

export const HFT_SAMPLES: Record<"taker" | "maker" | "arbitrage", HftSample[]> = {
  taker: [
    {
      id: "hft-taker-template",
      name: "Taker Template",
      description: "Marketable-order starter scaffold with a NaN feature guard",
      code: `// Taker strategy — runs once per tick.
//
// Function:
//   target_pos_intent(symbol: int, qty: float, style: string)
//     symbol  engine SymbolId — pass the \`symbol\` variable below
//     qty     signed target position (+long / -short / 0.0 = flatten)
//     style   "market" (sweep now) | "cross" (marketable at touch)
//           | "join" (passive at touch) | "mid" (passive at mid)
//
// Scope:
//   features        this strategy's feature values, in the order defined
//                   below — features[0], features[1], … (NaN until warmed up)
//   symbol          this run's SymbolId, pass straight to target_pos_intent
//   positions       signed position per symbol, indexed by SymbolId
//   asset_features  features[] per symbol — asset_features[sym_id][feature_idx]
//
// Call \`return target_pos_intent(...)\` to act this tick; fall through (no
// return) to hold.

let f0 = features[0];
if f0 != f0 { return; } // NaN guard — feature not warmed up yet

// your logic here
`,
    },
  ],
  maker: [
    {
      id: "hft-maker-template",
      name: "Maker Template",
      description: "Passive-quote starter scaffold with a NaN feature guard",
      code: `// Maker strategy — runs once per tick.
//
// Function:
//   target_pos_intent(symbol: int, qty: float, style: string)
//     symbol  engine SymbolId — pass the \`symbol\` variable below
//     qty     signed target position (+long / -short / 0.0 = flatten)
//     style   "market" (sweep now) | "cross" (marketable at touch)
//           | "join" (passive at touch) | "mid" (passive at mid)
//
// Scope:
//   features        this strategy's feature values, in the order defined
//                   below — features[0], features[1], … (NaN until warmed up)
//   symbol          this run's SymbolId, pass straight to target_pos_intent
//   positions       signed position per symbol, indexed by SymbolId
//   asset_features  features[] per symbol — asset_features[sym_id][feature_idx]
//
// Call \`return target_pos_intent(...)\` to act this tick; fall through (no
// return) to hold.

let f0 = features[0];
if f0 != f0 { return; } // NaN guard — feature not warmed up yet

// your logic here
`,
    },
  ],
  arbitrage: [
    {
      id: "hft-arbitrage-template",
      name: "Arbitrage Template",
      description: "Two-leg starter scaffold using arbitrage_intent + arb_ctx",
      code: `// Arbitrage strategy — runs once per tick when both legs' order books are fresh.
//
// Function:
//   arbitrage_intent(qty: float, buy_leg1: bool, price_leg2: float)
//     qty         leg1 base-asset amount for this clip
//     buy_leg1    true = buy leg1 / sell leg2, false = sell leg1 / buy leg2
//     price_leg2  limit price to post on leg2
//
// Scope:
//   arb_ctx.ask_vwap_leg1 / arb_ctx.bid_vwap_leg1     leg1 VWAP-sweep price
//   arb_ctx.best_bid_leg2 / arb_ctx.best_ask_leg2     leg2 L1 quote
//   arb_ctx.taker_fee_leg1 / arb_ctx.maker_fee_leg2   fee rates
//   arb_ctx.pos_leg1 / arb_ctx.pos_leg2               current signed positions
//   arb_ctx.symbol_id_leg1 / arb_ctx.symbol_id_leg2   leg symbol ids
//   arb_ctx.locked_prices_a / arb_ctx.locked_prices_b leg2 prices already
//     locked by an in-flight intent — check .contains(price) to avoid duplicates
//   <param name>  strategy params (defined at launch) are in scope as plain
//     variables, e.g. threshold, order_size_value, max_position
//
// Call \`return arbitrage_intent(...)\` to act this tick; fall through (no
// return) to hold.

let fee_rate = arb_ctx.taker_fee_leg1 + arb_ctx.maker_fee_leg2;

// your logic here
`,
    },
  ],
};

// Script API Reference (Figma 14562:20713) — static Rhai API doc text.
// index 0 documents the `target_pos_intent` function; indices 1-4 document scope variables.
export const HFT_SCRIPT_API_REFERENCE: { name: string; doc: string }[] = [
  {
    name: "target_pos_intent(symbol: int, qty: float, style: string)",
    doc: 'symbol = engine SymbolId (pass the symbol variable below). qty = signed target position: positive long, negative short, 0.0 flattens. style = "market" (sweep now), "cross" (marketable at touch), or "mid" (passive at mid).',
  },
  {
    name: "features",
    doc: "this strategy's feature values, in the order defined above — features[0], features[1], … NaN until that feature's window warms up.",
  },
  {
    name: "symbol",
    doc: "this run's SymbolId — pass straight to target_pos_intent.",
  },
  {
    name: "positions",
    doc: "signed position per symbol, indexed by SymbolId.",
  },
  {
    name: "asset_features",
    doc: "features[] per symbol — cross-sectional access via asset_features[sym_id][feature_idx].",
  },
];
