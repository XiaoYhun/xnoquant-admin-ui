"use client";
import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logout, AltArrowDown, DoubleAltArrowLeft, DoubleAltArrowRight } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useModeStore, type Mode } from "@/store/mode-store";
import { NAV_GROUPS, type NavItem } from "./nav-config";

// Active nav item = green gradient pill with near-black text (from Figma).
const ACTIVE_GRADIENT = "linear-gradient(168deg, #CFF8EA 0%, #67E1C0 100%)";
const LOGOUT_GRADIENT = "linear-gradient(174deg, #FFCCE2 0%, #FF135B 100%)";
const TRANSITION = "transition-all duration-300 ease-in-out";
// Collapsing text: width + opacity animate to nothing.
const LABEL = cn("overflow-hidden whitespace-nowrap", TRANSITION);

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) if (g.heading) init[g.heading] = true;
    return init;
  });

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const toggleSection = (heading: string) => setOpenSections((s) => ({ ...s, [heading]: !s[heading] }));

  return (
    <aside
      className={cn(
        "flex h-dvh shrink-0 flex-col border-r border-border bg-background",
        TRANSITION,
        collapsed ? "w-[88px]" : "w-[240px]",
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center justify-between border-y border-border pl-3",
          TRANSITION,
          collapsed ? "pr-1" : "pr-3",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-symbol.svg" alt="XNOQuant" className="h-7 w-auto shrink-0" />
          <span
            className={cn(
              "text-xl font-bold tracking-tight text-white",
              LABEL,
              collapsed ? "max-w-0 opacity-0" : "max-w-[130px] opacity-100",
            )}
          >
            XNOQuant
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-white"
        >
          {collapsed ? (
            <DoubleAltArrowRight weight="Outline" size={20} />
          ) : (
            <DoubleAltArrowLeft weight="Outline" size={20} />
          )}
        </button>
      </div>

      {/* HFT/MFT lab toggle (Figma 13964-56847) */}
      <div className="shrink-0 px-3 pt-4">
        <ModeToggle mode={mode} onChange={setMode} collapsed={collapsed} />
      </div>

      {/* Menu */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto border-b border-border px-3 py-4">
        {NAV_GROUPS.map((group, i) => {
          // Filter items by the current lab mode; drop groups that become empty.
          const items = group.items.filter((item) => !item.modes || item.modes.includes(mode));
          if (items.length === 0) return null;
          if (!group.heading) {
            return (
              <Fragment key={`group-${i}`}>
                {items.map((item) => (
                  <NavRow key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
                ))}
              </Fragment>
            );
          }
          const heading = group.heading;
          return (
            <Section
              key={heading}
              title={heading}
              open={openSections[heading] ?? true}
              onToggle={() => toggleSection(heading)}
              collapsed={collapsed}
            >
              {items.map((item) => (
                <NavRow key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
              ))}
            </Section>
          );
        })}
      </div>

      {/* Logout */}
      <div className="shrink-0 px-3 py-4">
        <button
          type="button"
          onClick={() => void logout()}
          title="Logout"
          className="relative flex h-10 w-full cursor-pointer items-center rounded-[20px] transition-colors hover:bg-secondary"
        >
          <span
            className={cn("flex size-6 shrink-0 items-center justify-center", TRANSITION, collapsed ? "ml-5" : "ml-3")}
            style={{ color: "#FF135B" }}
          >
            <Logout weight="Outline" size={24} color="currentColor" />
          </span>
          <span
            className={cn(
              "bg-clip-text text-sm text-transparent",
              LABEL,
              collapsed ? "ml-0 max-w-0 opacity-0" : "ml-2 max-w-[160px] opacity-100",
            )}
            style={{ backgroundImage: LOGOUT_GRADIENT }}
          >
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}

const MODES: { value: Mode; label: string }[] = [
  { value: "hft", label: "HFT LAB" },
  { value: "mft", label: "MFT LAB" },
];

// Segmented HFT/MFT toggle (Figma 13964-56847). Collapsed: a single pill showing the current
// mode that flips to the other on click.
function ModeToggle({ mode, onChange, collapsed }: { mode: Mode; onChange: (m: Mode) => void; collapsed: boolean }) {
  if (collapsed) {
    const other: Mode = mode === "hft" ? "mft" : "hft";
    return (
      <button
        type="button"
        onClick={() => onChange(other)}
        aria-label={`Switch to ${other.toUpperCase()} lab`}
        title={`${mode.toUpperCase()} lab — click to switch`}
        className="flex h-8 w-full cursor-pointer items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-white shadow-sm"
      >
        {mode.toUpperCase()}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
      {MODES.map((m) => {
        const on = mode === m.value;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={cn(
              "flex-1 cursor-pointer rounded-full px-2 py-1.5 text-center text-xs font-semibold transition-colors whitespace-nowrap overflow-hidden",
              on ? "bg-secondary text-white shadow-sm" : "text-muted-foreground hover:text-white",
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  collapsed,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Header: text title (expanded) cross-fades with a divider + chevron circle (collapsed) */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
        className="relative flex h-6 w-full cursor-pointer items-center"
      >
        {/* Expanded: title + chevron on the right */}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-between text-[#475467]",
            TRANSITION,
            collapsed ? "opacity-0" : "opacity-100",
          )}
        >
          <span className="text-xs uppercase tracking-wide">{title}</span>
          <AltArrowDown
            weight="Outline"
            size={16}
            color="currentColor"
            className={cn("transition-transform", !open && "-rotate-90")}
          />
        </span>
        {/* Collapsed: full-width divider line with a centered chevron circle */}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            TRANSITION,
            collapsed ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
          <span className="relative flex size-8 items-center justify-center rounded-2xl border border-border bg-surface text-muted-foreground">
            <AltArrowDown
              weight="Outline"
              size={14}
              color="currentColor"
              className={cn("transition-transform", open && "rotate-180")}
            />
          </span>
        </span>
      </button>
      {open && <div className="flex flex-col gap-2">{children}</div>}
    </div>
  );
}

function NavRow({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  const inner = (
    <div className="group relative flex h-10 w-full items-center rounded-[20px]">
        {/* Active pill — full row when expanded, fades out when collapsed (design shows a bare icon) */}
        {active && (
          <span
            className={cn("absolute inset-0 rounded-[20px]", TRANSITION, collapsed ? "opacity-0" : "opacity-100")}
            style={{ backgroundImage: ACTIVE_GRADIENT }}
          />
        )}
        {/* Hover background for non-active items */}
        {!active && (
          <span className="absolute inset-0 rounded-[20px] bg-secondary opacity-0 transition-opacity group-hover:opacity-100" />
        )}
        <span
          className={cn(
            "relative z-10 flex size-6 shrink-0 items-center justify-center",
            TRANSITION,
            collapsed ? "ml-5" : "ml-3",
            active ? (collapsed ? "text-[#67E1C0]" : "text-[#0d0d0d]") : "text-muted-foreground group-hover:text-white",
          )}
        >
          <Icon size={24} weight="Outline" color="currentColor" />
        </span>
        <span
          className={cn(
            "relative z-10 flex-1 text-left text-sm",
            LABEL,
            collapsed ? "ml-0 max-w-0 opacity-0" : "ml-2 max-w-[160px] opacity-100",
            active ? "text-[#0d0d0d]" : "text-muted-foreground group-hover:text-white",
          )}
        >
          {item.label}
        </span>
      </div>
  );
  return onClick ? (
    <button type="button" onClick={onClick} title={item.label} className="w-full cursor-pointer">
      {inner}
    </button>
  ) : (
    <Link href={item.href} title={item.label}>
      {inner}
    </Link>
  );
}
