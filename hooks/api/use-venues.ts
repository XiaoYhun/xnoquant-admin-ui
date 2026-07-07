import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";

export function useVenues() {
  return useQuery({ queryKey: ["venues"], queryFn: () => mockApi.listVenues() });
}
