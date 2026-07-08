"use client";
import { useState } from "react";
import { Settings, SidebarCode, Copy, MenuDots, Play } from "@solar-icons/react";
import type { ComponentType } from "react";
import type { IconProps } from "@solar-icons/react";

// Toolbar row above the code editor — Figma node 13964:52172 (inside 13964:50200).
// Self-contained: strategy name is local state, all buttons are no-ops (page-level
// wiring lands with the shell owner).

function IconButton({ icon: Icon, label }: { icon: ComponentType<IconProps>; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:text-white"
    >
      <Icon className="size-5" />
    </button>
  );
}

export function Toolbar() {
  const [name, setName] = useState("Test bot AI");

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4 bg-surface">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Strategy name"
          size={Math.max(name.length, 4)}
          className="-mx-1 min-w-0 shrink-0 rounded px-1 text-xl font-semibold text-white outline-none hover:bg-white/5 focus:bg-white/5"
        />
        <span className="flex shrink-0 items-center gap-1">
          <span className="size-2 shrink-0 rounded-full bg-[#7b61ff] shadow-[0_0_6px_1px_rgba(123,97,255,0.5)]" />
          <span
            className="bg-clip-text text-xs font-medium text-transparent"
            style={{ backgroundImage: "linear-gradient(148deg, #e9e8ff 0%, #b7b1ff 148%)" }}
          >
            MFT
          </span>
        </span>
        <button
          type="button"
          aria-label="More options"
          className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-white"
        >
          <MenuDots weight="Bold" className="size-5" />
        </button>

        <div className="h-5 w-px shrink-0 bg-[#344054]" />

        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-2 py-1">
          <span className="size-2 shrink-0 rounded-full bg-muted-foreground" />
          <span className="text-xs text-muted-foreground">In sample</span>
        </span>

        <span className="inline-flex shrink-0 items-center gap-3 rounded-3xl border border-white/50 bg-gradient-to-b from-[rgba(123,97,255,0.8)] to-[rgba(123,97,255,0.2)] py-1 pl-2 pr-2 text-xs text-white backdrop-blur-[2px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 shrink-0 rounded-full bg-white" />
            Crypto
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 shrink-0 rounded-full bg-white" />
            BTC
          </span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <IconButton icon={Settings} label="Settings" />
        <IconButton icon={SidebarCode} label="Toggle console" />
        <IconButton icon={Copy} label="Duplicate" />
        <button
          type="button"
          className="inline-flex h-[34px] shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[linear-gradient(164deg,#cff8ea_0%,var(--primary)_100%)] px-3 text-xs font-medium text-black transition-opacity hover:opacity-90"
        >
          <Play weight="Bold" className="size-3.5" />
          Simulate
        </button>
      </div>
    </div>
  );
}
