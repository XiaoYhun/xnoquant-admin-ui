"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

/**
 * Wraps (dashboard) children. Client-side gate (middleware can't read the
 * Firebase session — no auth cookie). Access = a live authenticated() session
 * AND email_verified on the backend user record.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const isAuthorized = status === "authenticated" && !!user?.email_verified;

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthorized) router.replace("/login");
  }, [status, isAuthorized, router]);

  if (!isAuthorized) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
