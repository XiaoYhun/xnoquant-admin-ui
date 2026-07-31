"use client";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { AltArrowRight } from "@solar-icons/react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const ROUTE_TITLES: Record<string, string> = {
  "/strategies": "Backtesting",
  "/paper-trading": "Paper Trading",
  "/create-strategy": "Create Strategy",
  "/venues": "Venue List",
  "/accounts": "Live accounts",
  "/live-trading": "Live trading",
  "/live-trading/alpha-pool": "Alpha pool",
  "/live-trading/live-trade": "Live trade",
};

// Nested routes read as a breadcrumb ("Live trading › Alpha pool", Figma 14756:46805) — walk the
// path segment by segment and keep the ones that have a title.
function crumbsFor(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  const titles: string[] = [];
  let href = "";
  for (const segment of segments) {
    href += `/${segment}`;
    const title = ROUTE_TITLES[href];
    if (title) titles.push(title);
  }
  return titles;
}

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const crumbs = crumbsFor(pathname);
  const displayName = user?.fullname || user?.username || user?.email || "";
  const initial = displayName ? displayName[0].toUpperCase() : "?";
  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-6 shrink-0">
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        {crumbs.map((crumb, i) => (
          <Fragment key={crumb}>
            {i > 0 && <AltArrowRight weight="Outline" size={18} className="text-muted-foreground" />}
            <span className={i === crumbs.length - 1 ? "text-white" : "text-muted-foreground"}>{crumb}</span>
          </Fragment>
        ))}
      </h1>
      <div className="flex items-center gap-2">
        <div className="text-right text-sm">
          <p className="font-medium">{displayName}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <Avatar className="size-8">
          {user?.avatars?.small && <AvatarImage src={user.avatars.small} alt={displayName} />}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
