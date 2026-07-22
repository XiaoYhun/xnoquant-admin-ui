// Static curated content for the Create Strategy (HFT) "Samples" tab (Figma 14562:20367).
// There is no HFT samples API endpoint — this data is UI-only, not fetched.
// Each type leads with a blank annotated scaffold, followed by the concrete starter
// strategies mirrored from the HFT control plane's "Start from a template" dropdown.

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
    {
      id: "hft-taker-ema-crossover",
      name: "EMA crossover",
      description: "Trend-following: long while the fast EMA is above the slow EMA, short on the flip, with a points-based stop-loss/take-profit.",
      code: `// Features (add these in the Features tab, in order):
//   features[0]  fast_ema = ema(last_price, 10)
//   features[1]  slow_ema = ema(last_price, 50)
//
// EMA crossover — long while the fast EMA is above the slow EMA, short on
// the flip. Manages the position with a points-based stop-loss / take-profit.
let QTY = 1.0;
let SL = 5.0;
let TP = 10.0;

let fast = features[0];
let slow = features[1];
if fast != fast || slow != slow { return; } // warm-up guard

let pos = positions[symbol];
if pos != 0.0 {
    let pnl = pnl_points[symbol];
    if pnl <= -SL || pnl >= TP {
        return target_pos_intent(symbol, 0.0, "cross");
    }
}

if fast > slow && pos <= 0.0 {
    return target_pos_intent(symbol, QTY, "cross");
} else if fast < slow && pos >= 0.0 {
    return target_pos_intent(symbol, -QTY, "cross");
}
`,
    },
    {
      id: "hft-taker-mean-reversion",
      name: "Mean reversion (z-score)",
      description: "Buy when price is far below its rolling mean, sell when far above, flatten once it reverts.",
      code: `// Features (add these in the Features tab, in order):
//   features[0]  z = zscore(last_price, 50)
//
// Mean reversion — enter when price is far from its rolling mean, exit once
// it reverts back toward it.
let QTY = 1.0;
let ENTRY_Z = 2.0;
let EXIT_Z = 0.5;

let z = features[0];
if z != z { return; } // warm-up guard

let pos = positions[symbol];
if z <= -ENTRY_Z && pos <= 0.0 {
    return target_pos_intent(symbol, QTY, "cross"); // far below mean -> buy
} else if z >= ENTRY_Z && pos >= 0.0 {
    return target_pos_intent(symbol, -QTY, "cross"); // far above mean -> sell
} else if pos != 0.0 && z.abs() < EXIT_Z {
    return target_pos_intent(symbol, 0.0, "cross"); // reverted -> flatten
}
`,
    },
    {
      id: "hft-taker-donchian-breakout",
      name: "Donchian breakout",
      description: "Buy on a close above the recent high channel, sell on a close below the recent low channel.",
      code: `// Features (add these in the Features tab, in order):
//   features[0]  price = last_price
//   features[1]  upper = rolling_quantile(high, 20, 1.0)
//   features[2]  lower = rolling_quantile(low, 20, 0.0)
//
// Donchian breakout — buy on a close above the recent high channel, sell on
// a close below the recent low channel.
let QTY = 1.0;

let price = features[0];
let upper = features[1];
let lower = features[2];
if price != price || upper != upper || lower != lower { return; } // warm-up guard

let pos = positions[symbol];
if price >= upper && pos <= 0.0 {
    return target_pos_intent(symbol, QTY, "cross"); // breakout -> buy
} else if price <= lower && pos >= 0.0 {
    return target_pos_intent(symbol, -QTY, "cross"); // breakdown -> sell
}
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
    {
      id: "hft-arb-cross-venue-spread",
      name: "Cross-venue spread capture",
      description: "Arb leg1 vs leg2 once the spread clears fees plus a safety margin.",
      code: `// Cross-venue spread capture — arb leg1 vs leg2 once the spread clears fees
// plus a safety margin.
let THRESHOLD = 0.001; // extra edge required beyond fees, as a fraction of price
let QTY = 1.0;
let SLIPPAGE = 0.0005; // price cushion added when posting the leg2 limit

let fee_rate = arb_ctx.taker_fee_leg1 + arb_ctx.maker_fee_leg2;
let spread = (arb_ctx.bid_vwap_leg1 - arb_ctx.best_ask_leg2) / arb_ctx.best_ask_leg2;

if spread > fee_rate + THRESHOLD {
    let price = arb_ctx.best_ask_leg2 * (1.0 + SLIPPAGE);
    if !arb_ctx.locked_prices_b.contains(price) {
        return arbitrage_intent(QTY, true, price);
    }
}
`,
    },
  ],
};
