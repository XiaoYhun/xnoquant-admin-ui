import { useCallback } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { revokeToken } from "@/lib/auth-api";
import { useAuthStore } from "@/store/auth-store";

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

  return {
    user,
    status,
    error,
    isAuthenticated: status === "authenticated" && !!user?.email_verified,
    login,
    logout,
  };
}
