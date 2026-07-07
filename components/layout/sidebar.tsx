"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav-config";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-dvh w-[220px] flex-col border-r border-border bg-surface">
      <div className="flex h-16 items-center gap-2 px-4 font-semibold text-foreground">XNOQuant</div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className="space-y-1">
            {group.heading && (
              <p className="px-2 pt-2 text-[11px] uppercase tracking-wide text-[var(--text-sub)]">{group.heading}</p>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    active && "bg-primary/15 text-primary",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <button className="m-3 flex items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground">
        <LogOut className="size-4" /> Logout
      </button>
    </aside>
  );
}
