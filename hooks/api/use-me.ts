import { useQuery } from "@tanstack/react-query";
import { fetchMe, type User } from "@/lib/auth-api";
import { useAuthStore } from "@/store/auth-store";

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<User>({
    queryKey: ["auth", "me"],
    queryFn: () => fetchMe(accessToken as string),
    enabled: !!accessToken,
  });
}
