import type { components as HftComponents } from "./api/hft";

/**
 * App-facing domain aliases re-exported from the generated HFT OpenAPI types.
 * `types/api/hft.ts` is the source of truth; keep names here 1:1 with the
 * corresponding `components["schemas"]` entry when a clean schema exists.
 */

// HFT spec has a clean `Venue` schema ({ id, name, venue_type, created_at, updated_at }) — re-export directly.
export type Venue = HftComponents["schemas"]["Venue"];

// HFT spec has a clean `Account` schema — re-export directly.
export type Account = HftComponents["schemas"]["Account"];

// NOTE: The HFT spec has no distinct "Portfolio" schema (Account / Run /
// RunSummary are the closest concepts). Not re-exporting a Portfolio alias
// here — add one once phase-3 wiring clarifies which schema maps to the
// UI's "portfolio" concept.
// TODO(phase3): reconcile with real API — this is a UI-only shape until the
// backend exposes a proper portfolio resource.
export type Portfolio = {
  id: string;
  name: string;
  status: "running" | "stopped";
  total_allocation: number;
  sources: { account_id: string; account_name: string; amount: number }[];
};

// --- Slices 3–5 (Live Trading, Strategy List, Paper Trading) ---
// Clean HFT schemas re-exported 1:1, same convention as Venue/Account above
// (source of truth: types/api/hft.ts). `Instrument` aliases the HFT `Symbol`
// schema to avoid shadowing the global `Symbol` type.
export type Run = HftComponents["schemas"]["Run"];
export type RunSummary = HftComponents["schemas"]["RunSummary"];
export type RunStatus = HftComponents["schemas"]["RunStatus"];
export type RunMode = HftComponents["schemas"]["RunMode"];
export type Strategy = HftComponents["schemas"]["Strategy"];
export type StrategyType = HftComponents["schemas"]["StrategyType"];
export type Instrument = HftComponents["schemas"]["Symbol"];
export type InstrumentClass = HftComponents["schemas"]["InstrumentClass"];
export type SymbolPnlSummary = HftComponents["schemas"]["SymbolPnlSummary"];
export type TradeRow = HftComponents["schemas"]["TradeRow"];
export type TradePage = HftComponents["schemas"]["TradePage"];
export type EquityPoint = HftComponents["schemas"]["EquityPoint"];
