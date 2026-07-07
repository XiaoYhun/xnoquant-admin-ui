// Mock auth store for MVP — NOT real authentication.
// This app has no login flow; every session is a static, pre-authenticated
// "Admin" identity by design (per Task 3 brief / Slice 0 scope). There are no
// credentials, tokens, or secrets here — just placeholder display data for a
// single fixed local admin user, to be replaced by real auth in a later slice.
import { create } from "zustand";

export type AuthUser = { name: string; email: string; avatarUrl?: string };

type AuthState = { user: AuthUser | null };

export const useAuthStore = create<AuthState>(() => ({
  user: { name: "Admin", email: "admin@gmail.com" },
}));
