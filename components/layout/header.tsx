"use client";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ROUTE_TITLES: Record<string, string> = {
  "/strategies": "Strategy List",
  "/paper-trading": "Paper Trading",
  "/create-strategy": "Create Strategy",
  "/venues": "Venue List",
  "/accounts": "Live accounts",
  "/live-trading": "Live trading",
};

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const title = ROUTE_TITLES[pathname] ?? "";
  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        <div className="text-right text-sm">
          <p className="font-medium">{user?.name}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <Avatar className="size-8"><AvatarFallback>A</AvatarFallback></Avatar>
      </div>
    </header>
  );
}
