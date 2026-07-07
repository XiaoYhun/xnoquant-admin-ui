import type { Account } from "@/types/domain";

const fee: Account["fee"] = { type: "rate", maker_rate: 0.001, taker_rate: 0.001 };
const risk: Account["risk"] = { type: "none" };
const timestamps = { created_at: "2026-02-15T00:00:00Z", updated_at: "2026-02-15T00:00:00Z" };

export const MOCK_ACCOUNTS: Account[] = ["A", "B", "C", "D", "E", "F"].map((letter) => ({
  id: `acc-${letter.toLowerCase()}`,
  name: `Account ${letter}`,
  account_type: "spot",
  venue_id: "1",
  fee,
  risk,
  ...timestamps,
}));
