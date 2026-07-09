import { MOCK_VENUES } from "./venues";
import { MOCK_ACCOUNTS } from "./accounts";
import { MOCK_PORTFOLIOS } from "./portfolios";
import { liveRunMocks } from "./live-runs";
import { strategyMocks } from "./strategies";
import { paperRunMocks } from "./paper-runs";
import type { Venue, Account, Portfolio } from "@/types/domain";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const mockApi = {
  async listVenues(): Promise<Venue[]> {
    await delay();
    // Return a fresh copy, NOT the module array by reference: mutations (create/delete)
    // edit MOCK_VENUES in place, and if list returned the same reference React Query's
    // structural sharing would see no change and never re-render the list.
    return [...MOCK_VENUES];
  },
  async createVenue(input: { name: string; venue_type: Venue["venue_type"] }): Promise<Venue> {
    await delay();
    const now = new Date().toISOString();
    const venue: Venue = { id: crypto.randomUUID(), name: input.name, venue_type: input.venue_type, created_at: now, updated_at: now };
    MOCK_VENUES.push(venue);
    return venue;
  },
  async updateVenue(id: string, input: { name: string; venue_type: Venue["venue_type"] }): Promise<Venue> {
    await delay();
    const venue = MOCK_VENUES.find((v) => v.id === id);
    if (!venue) throw new Error("Venue not found");
    venue.name = input.name;
    venue.venue_type = input.venue_type;
    venue.updated_at = new Date().toISOString();
    return venue;
  },
  async deleteVenue(id: string): Promise<void> {
    await delay();
    const idx = MOCK_VENUES.findIndex((v) => v.id === id);
    if (idx !== -1) MOCK_VENUES.splice(idx, 1);
  },
  async listAccounts(): Promise<Account[]> {
    await delay();
    // Fresh copy — see listVenues comment above.
    return [...MOCK_ACCOUNTS];
  },
  async createAccount(input: {
    name: string;
    venue_id: string;
    account_type: Account["account_type"];
    api_key: string;
    secret_key: string;
  }): Promise<Account> {
    await delay();
    const now = new Date().toISOString();
    const account: Account = {
      id: crypto.randomUUID(),
      name: input.name,
      venue_id: input.venue_id,
      account_type: input.account_type,
      fee: { type: "rate", maker_rate: 0.001, taker_rate: 0.001 },
      risk: { type: "none" },
      created_at: now,
      updated_at: now,
    };
    MOCK_ACCOUNTS.push(account);
    return account;
  },
  async updateAccount(
    id: string,
    input: { name: string; venue_id: string; account_type: Account["account_type"] },
  ): Promise<Account> {
    await delay();
    const account = MOCK_ACCOUNTS.find((a) => a.id === id);
    if (!account) throw new Error("Account not found");
    account.name = input.name;
    account.venue_id = input.venue_id;
    account.account_type = input.account_type;
    account.updated_at = new Date().toISOString();
    return account;
  },
  async deleteAccount(id: string): Promise<void> {
    await delay();
    const idx = MOCK_ACCOUNTS.findIndex((a) => a.id === id);
    if (idx !== -1) MOCK_ACCOUNTS.splice(idx, 1);
  },
  async listPortfolios(): Promise<Portfolio[]> {
    await delay();
    // Fresh copy — see listVenues comment above.
    return [...MOCK_PORTFOLIOS];
  },
  async createPortfolio(input: { name: string; sources: { account_id: string; amount: number }[] }): Promise<Portfolio> {
    await delay();
    const sources = input.sources.map((s) => ({
      account_id: s.account_id,
      account_name: MOCK_ACCOUNTS.find((a) => a.id === s.account_id)?.name ?? s.account_id,
      amount: s.amount,
    }));
    const portfolio: Portfolio = {
      id: crypto.randomUUID(),
      name: input.name,
      status: "running",
      total_allocation: sources.reduce((sum, s) => sum + s.amount, 0),
      sources,
    };
    MOCK_PORTFOLIOS.push(portfolio);
    return portfolio;
  },
  async deletePortfolio(id: string): Promise<void> {
    await delay();
    const idx = MOCK_PORTFOLIOS.findIndex((p) => p.id === id);
    if (idx !== -1) MOCK_PORTFOLIOS.splice(idx, 1);
  },
  // Per-screen mock methods live in their own module (owned by each page agent)
  // and are spread in here so `mockApi.*` stays the single call surface for hooks.
  ...liveRunMocks,
  ...strategyMocks,
  ...paperRunMocks,
};
