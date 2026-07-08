// Real auth store — backed by Firebase session + backend access_token exchange.
// In-memory only (no persist): Firebase already persists the session locally,
// so on reload `AuthProvider` re-derives this state via onIdTokenChanged.
import { create } from "zustand";
import type { components } from "@/types/api/auth";

export type User = components["schemas"]["models.User"];
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  status: AuthStatus;
  /** Last session/login error surfaced from AuthProvider (e.g. token-exchange failure). */
  error: string | null;
  setSession: (user: User, accessToken: string) => void;
  clear: (error?: string | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "loading",
  error: null,
  setSession: (user, accessToken) => set({ user, accessToken, status: "authenticated", error: null }),
  clear: (error = null) => set({ user: null, accessToken: null, status: "unauthenticated", error }),
}));
