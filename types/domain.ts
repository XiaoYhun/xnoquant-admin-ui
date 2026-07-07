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
