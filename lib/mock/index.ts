import { MOCK_VENUES } from "./venues";
import type { Venue } from "@/types/domain";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const mockApi = {
  async listVenues(): Promise<Venue[]> {
    await delay();
    return MOCK_VENUES;
  },
  async createVenue(input: { name: string; venue_type: Venue["venue_type"] }): Promise<Venue> {
    await delay();
    const now = new Date().toISOString();
    const venue: Venue = { id: crypto.randomUUID(), name: input.name, venue_type: input.venue_type, created_at: now, updated_at: now };
    MOCK_VENUES.push(venue);
    return venue;
  },
  async deleteVenue(id: string): Promise<void> {
    await delay();
    const idx = MOCK_VENUES.findIndex((v) => v.id === id);
    if (idx !== -1) MOCK_VENUES.splice(idx, 1);
  },
};
