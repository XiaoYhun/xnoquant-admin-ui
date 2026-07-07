import type { Venue } from "@/types/domain";

export const VENUE_TYPES: { value: Venue["venue_type"]; label: string }[] = [
  { value: "binance_spot", label: "Binance Spot" },
  { value: "binance_futures", label: "Binance Futures" },
  { value: "tcbs", label: "TCBS" },
  { value: "dnse", label: "DNSE" },
];

export function venueTypeLabel(type: Venue["venue_type"]): string {
  return VENUE_TYPES.find((t) => t.value === type)?.label ?? type;
}
