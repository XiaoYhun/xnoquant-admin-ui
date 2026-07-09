import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mockApi } from "@/lib/mock";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { USE_MOCK, HFT_API_URL } from "@/lib/constant";
import type { Venue } from "@/types/domain";

export function useVenues() {
  return useQuery({
    queryKey: ["venues"],
    queryFn: () => (USE_MOCK ? mockApi.listVenues() : apiGet<Venue[]>(`${HFT_API_URL}/api/venues`)),
  });
}

export function useCreateVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; venue_type: Venue["venue_type"] }) =>
      USE_MOCK ? mockApi.createVenue(input) : apiPost<Venue>(`${HFT_API_URL}/api/venues`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues"] }),
  });
}

export function useUpdateVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name: string; venue_type: Venue["venue_type"] }) =>
      USE_MOCK ? mockApi.updateVenue(id, input) : apiPut<Venue>(`${HFT_API_URL}/api/venues/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues"] }),
  });
}

export function useDeleteVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (USE_MOCK ? mockApi.deleteVenue(id) : apiDelete(`${HFT_API_URL}/api/venues/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues"] }),
  });
}
