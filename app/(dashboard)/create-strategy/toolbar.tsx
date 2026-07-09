"use client";
import { useState } from "react";
import { Settings, SidebarCode, Copy, MenuDots, SkipNext } from "@solar-icons/react";
import type { ComponentType } from "react";
import type { IconProps } from "@solar-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimulateModal } from "./simulate-modal";
import { USE_MOCK } from "@/lib/constant";

// Toolbar row above the code editor — Figma node 13964:52172 (inside 13964:50200).
// Self-contained: strategy name is local state, all buttons are no-ops (page-level
// wiring lands with the shell owner).

function IconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:text-white"
    >
      <Icon className="size-5" />
    </button>
  );
}

// Figma node 14256:148355 — the cog opens this Settings popover (Market + Type dropdowns).
function SettingField({
  label,
  defaultValue,
  options,
}: {
  label: string;
  defaultValue: string;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-white">{label}</span>
      <Select defaultValue={defaultValue}>
        <SelectTrigger className="h-8 w-full rounded-full border-border bg-background! px-3 text-xs text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-background!">
          {options.map(([value, text]) => (
            <SelectItem key={value} value={value} className="text-xs">
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SettingsMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Settings"
          className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:text-white data-[state=open]:text-white"
        >
          <Settings className="size-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[240px] rounded-lg border-border bg-surface p-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-white">Settings</p>
          <SettingField
            label="Market"
            defaultValue="tick-l2"
            options={[
              ["tick-l2", "Tick / L2"],
              ["bar-ohlc", "Bar / OHLC"],
            ]}
          />
          <SettingField
            label="Type"
            defaultValue="taker"
            options={[
              ["taker", "Taker"],
              ["maker", "Maker"],
              ["arbitrage", "Arbitrage"],
            ]}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Toolbar({
  name,
  type,
  id,
  onToggleConsole,
  onSimulate,
}: {
  name: string;
  type: "mft" | "hft";
  id: string;
  onToggleConsole?: () => void;
  onSimulate?: (editorId: string) => Promise<void>;
}) {
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [mftSimStatus, setMftSimStatus] = useState<"idle" | "running" | "done" | "error">("idle");

  const handleSimulateClick = async () => {
    if (type === "hft") {
      setSimulateOpen(true);
      return;
    }
    // MFT: no modal — simulate the editor directly (`POST /v2/editors/{id}/simulate`, no body).
    if (USE_MOCK) {
      console.log(`Simulate "${name}" (mock, editor ${id})`);
      return;
    }
    setMftSimStatus("running");
    try {
      await onSimulate?.(id);
      console.log(`Simulate started for "${name}"`);
      setMftSimStatus("done");
    } catch (err) {
      console.error(`Simulate failed for "${name}"`, err);
      setMftSimStatus("error");
    } finally {
      setTimeout(() => setMftSimStatus("idle"), 2000);
    }
  };

  const simulateLabel =
    mftSimStatus === "running" ? "Simulating…" : mftSimStatus === "done" ? "Simulated" : mftSimStatus === "error" ? "Failed" : "Simulate";

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4 bg-surface">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="min-w-0 shrink truncate text-xl font-semibold text-white" title={name}>
          {name}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="size-2 shrink-0 rounded-full bg-[#7b61ff] shadow-[0_0_6px_1px_rgba(123,97,255,0.5)]" />
          <span
            className="bg-clip-text text-xs font-medium text-transparent"
            style={{ backgroundImage: "linear-gradient(148deg, #e9e8ff 0%, #b7b1ff 148%)" }}
          >
            {type.toUpperCase()}
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
        <SettingsMenu />
        <IconButton icon={SidebarCode} label="Toggle console" onClick={onToggleConsole} />
        <IconButton icon={Copy} label="Duplicate" />
        <button
          type="button"
          onClick={handleSimulateClick}
          disabled={mftSimStatus === "running"}
          className="inline-flex h-[34px] shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[linear-gradient(164deg,#cff8ea_0%,var(--primary)_100%)] px-3 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <SkipNext weight="Outline" className="size-3.5" />
          {simulateLabel}
        </button>
      </div>

      <SimulateModal open={simulateOpen} onOpenChange={setSimulateOpen} strategyName={name} />
    </div>
  );
}
