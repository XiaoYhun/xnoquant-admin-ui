"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logout, AltArrowDown, DoubleAltArrowLeft } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav-config";
import { Logo } from "./logo";

// Active nav item = green gradient pill with near-black text (from Figma).
const ACTIVE_GRADIENT = "linear-gradient(168.465deg, #CFF8EA 0%, #67E1C1 100%)";
const LOGOUT_GRADIENT = "linear-gradient(174.289deg, #FFCCE2 0%, #FF135B 100%)";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-dvh flex-col border-r border-border bg-background transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[220px]",
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "justify-between pr-2 pl-4",
        )}
      >
        {!collapsed && <Logo />}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((c) => !c)}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <DoubleAltArrowLeft weight="Outline" className={cn("size-5 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto border-b border-border px-3 py-4">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className="flex flex-col gap-2">
            {group.heading && !collapsed && (
              <div className="flex h-6 items-center justify-between px-1">
                <span className="text-xs uppercase text-[var(--text-sub)]">{group.heading}</span>
                <AltArrowDown size={16} weight="Outline" className="text-[var(--text-sub)]" />
              </div>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  style={active ? { backgroundImage: ACTIVE_GRADIENT } : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 p-3 text-sm transition-colors",
                    collapsed && "justify-center",
                    active
                      ? "rounded-[20px] font-medium text-[#0d0d0d]"
                      : "rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  <item.icon size={20} weight="Outline" color={active ? "#0d0d0d" : "currentColor"} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="shrink-0 px-3 py-4">
        <button
          type="button"
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "flex h-10 w-full cursor-pointer items-center gap-2 rounded-md p-3 text-sm hover:bg-white/5",
            collapsed && "justify-center",
          )}
        >
          <Logout size={20} weight="Outline" color="#ff135b" />
          {!collapsed && (
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: LOGOUT_GRADIENT }}>
              Logout
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
