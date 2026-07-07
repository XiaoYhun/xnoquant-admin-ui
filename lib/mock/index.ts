import { MOCK_VENUES } from "./venues";
import type { Venue } from "@/types/domain";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const mockApi = {
  async listVenues(): Promise<Venue[]> {
    await delay();
    return MOCK_VENUES;
  },
};
