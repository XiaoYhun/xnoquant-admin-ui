import { useAuthStore } from "@/store/auth-store";
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  return { user };
}
