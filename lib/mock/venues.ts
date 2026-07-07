import type { Venue } from "@/types/domain";

export const MOCK_VENUES: Venue[] = [
  {
    id: "1",
    name: "Venue Binance",
    venue_type: "binance_spot",
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
  },
  {
    id: "2",
    name: "Venue Binance Futures",
    venue_type: "binance_futures",
    created_at: "2026-01-20T00:00:00Z",
    updated_at: "2026-01-20T00:00:00Z",
  },
  {
    id: "3",
    name: "Venue TCBS",
    venue_type: "tcbs",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  },
  {
    id: "4",
    name: "Venue DNSE",
    venue_type: "dnse",
    created_at: "2026-02-10T00:00:00Z",
    updated_at: "2026-02-10T00:00:00Z",
  },
];
