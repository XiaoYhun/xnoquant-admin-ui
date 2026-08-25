import { useCallback } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { revokeToken } from "@/lib/auth-api";
import { useAuthStore } from "@/store/auth-store";
import { useMe } from "@/hooks/api/use-me";
import { resourceScope } from "@/lib/rbac";

function loginErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | undefined)?.code ?? "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code)) {
    return "Incorrect email or password.";
  }
  return "Something went wrong. Please try again.";
}

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);

  // Signs in with Firebase; the AuthProvider's onIdTokenChanged listener does
  // the token exchange + fills the store once Firebase fires the new session.
  const login = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      throw new Error(loginErrorMessage(err));
    }
  }, []);

  const logout = useCallback(async () => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      await revokeToken(accessToken).catch(() => {}); // best-effort
    }
    await signOut(auth).catch(() => {});
    useAuthStore.getState().clear();
  }, []);

  // GET /api/auth/me is the authoritative source for roles + user_id, NOT the session user: the
  // token-exchange payload may omit them, and it is re-issued on every Firebase token refresh
  // (~hourly, plus cross-tab syncs). Reading them off the session copy meant a refresh replaced
  // the user wholesale and silently dropped them — admin-only surfaces (Strategy List, Risk
  // management) disappeared mid-session for a real admin. The query is the one place they live.
  // The session copy is still the fallback for the window before /me resolves.
  const { data: me } = useMe();
  const roles = me?.roles ?? user?.roles ?? [];
  const scope = resourceScope(roles);

  return {
    user,
    status,
    error,
    isAuthenticated: status === "authenticated" && !!user?.email_verified,
    // RBAC identity — see lib/rbac.ts. `userId` is compared against a resource's owner_id.
    userId: me?.user_id ?? user?.user_id,
    roles,
    scope,
    isAdmin: scope === "all",
    login,
    logout,
  };
}
