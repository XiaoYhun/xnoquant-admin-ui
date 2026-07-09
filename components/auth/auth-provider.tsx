"use client";
import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { exchangeToken } from "@/lib/auth-api";
import { useAuthStore } from "@/store/auth-store";
import { useMe } from "@/hooks/api/use-me";

/**
 * Re-derives our session from the live Firebase session on mount and whenever
 * Firebase refreshes/clears the ID token (sign-in, sign-out, ~hourly refresh).
 * On each fire: mint a fresh Firebase JWT → exchange it for the backend
 * xq_ access_token → fill the store. No UI — mount once near the root.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        useAuthStore.getState().clear();
        return;
      }
      try {
        const firebaseJWT = await firebaseUser.getIdToken();
        const tokenData = await exchangeToken(firebaseJWT);
        if (!tokenData.access_token || !tokenData.user) {
          throw new Error("Could not obtain session.");
        }
        useAuthStore.getState().setSession(tokenData.user, tokenData.access_token);
      } catch {
        await auth.signOut().catch(() => {});
        useAuthStore.getState().clear("Access denied. Could not obtain session.");
      }
    });
    return () => unsubscribe();
  }, []);

  const { data: me } = useMe();
  useEffect(() => {
    if (!me) return;
    console.log("[auth/me]", me);
    (window as unknown as Record<string, unknown>).__me = me;
  }, [me]);

  return <>{children}</>;
}
