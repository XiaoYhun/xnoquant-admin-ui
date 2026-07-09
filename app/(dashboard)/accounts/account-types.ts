import type { Account } from "@/types/domain";

export const ACCOUNT_TYPES: { value: Account["account_type"]; label: string }[] = [
  { value: "spot", label: "Spot" },
  { value: "cross_margin", label: "Cross margin" },
  { value: "isolated_margin", label: "Isolated margin" },
  { value: "linear_futures", label: "Linear futures" },
  { value: "inverse_futures", label: "Inverse futures" },
];

export function accountTypeLabel(type: Account["account_type"]): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;
}
