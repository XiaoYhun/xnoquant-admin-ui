import type { Portfolio } from "@/types/domain";

export const MOCK_PORTFOLIOS: Portfolio[] = [
  {
    id: "portfolio-1",
    name: "High Frequency Arbitrage",
    status: "running",
    total_allocation: 3_000_000_000,
    sources: [
      { account_id: "acc-a", account_name: "Account A", amount: 1_000_000_000 },
      { account_id: "acc-b", account_name: "Account B", amount: 2_000_000_000 },
    ],
  },
  {
    id: "portfolio-2",
    name: "Quantitative Value Investing",
    status: "running",
    total_allocation: 2_200_000_000,
    sources: [
      { account_id: "acc-e", account_name: "Account E", amount: 1_200_000_000 },
      { account_id: "acc-f", account_name: "Account F", amount: 1_000_000_000 },
    ],
  },
];
