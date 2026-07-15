"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings, SidebarCode, Copy, MenuDots, SkipNext } from "@solar-icons/react";
import type { ComponentType } from "react";
import type { IconProps } from "@solar-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SimulateModal } from "./simulate-modal";
import { USE_MOCK } from "@/lib/constant";
import { useMarkets } from "@/hooks/api/use-markets";
import { useUpdateEditor } from "@/hooks/api/use-strategy-builder";
import { useHftStrategy, useUpdateHftStrategy, type HftStrategyType } from "@/hooks/api/use-hft-strategies";
import { useConsoleLog } from "@/store/console-log-store";

// Toolbar row above the code editor — Figma node 13964:52172 (inside 13964:50200).
// Self-contained: strategy name is local state, all buttons are no-ops (page-level
// wiring lands with the shell owner).

// HFT market (run-time data_kind) is UI-only — no strategy field maps to it.
const HFT_MARKET_LABEL: Record<string, string> = { "tick-l2": "Tick / L2", "bar-ohlc": "Bar / OHLC" };
const HFT_TYPE_LABEL: Record<HftStrategyType, string> = { taker: "Taker", maker: "Maker", arbitrage: "Arbitrage" };

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

// Figma node 14256:148355 — the cog opens this Settings popover. For HFT, Market (Tick/L2 vs
// Bar/OHLC) is display-only (no strategy field maps to it — it's a run-time data_kind), while Type
// (strategy_type) is saved via `useUpdateHftStrategy` (PUT /api/strategies/{id}). Keyed by `id` so
// switching editors remounts with the new strategy's values.
function HftSettingsFields({
  id,
  market,
  onMarketChange,
  onClose,
}: {
  id: string;
  market: string;
  onMarketChange: (market: string) => void;
  onClose: () => void;
}) {
  const { data: strategy } = useHftStrategy(id);
  const updateStrategy = useUpdateHftStrategy();
  const addLog = useConsoleLog((s) => s.addLog);

  // Derive Type from the fetched strategy until the user overrides it (avoids seeding via an
  // effect — the strategy loads async, so `typeOverride ?? loaded ?? default`). Market has no
  // backend field to seed from.
  const [typeOverride, setTypeOverride] = useState<HftStrategyType | null>(null);
  const draftType: HftStrategyType = typeOverride ?? strategy?.strategy_type ?? "taker";

  const hasChanges = !!strategy && draftType !== strategy.strategy_type;

  const handleSave = async () => {
    if (!hasChanges || !id || updateStrategy.isPending) return;
    try {
      await updateStrategy.mutateAsync({ id, strategyType: draftType });
      addLog("success", "Strategy settings saved");
      onClose();
    } catch (err) {
      addLog("error", `Failed to save settings: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-white">Settings</p>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-white">Market</span>
        <Select value={market} onValueChange={onMarketChange}>
          <SelectTrigger className="h-8 w-full rounded-full border-border bg-background! px-3 text-xs text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background!">
            <SelectItem value="tick-l2" className="text-xs">Tick / L2</SelectItem>
            <SelectItem value="bar-ohlc" className="text-xs">Bar / OHLC</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-white">Type</span>
        <Select value={draftType} onValueChange={(v) => v && setTypeOverride(v as HftStrategyType)}>
          <SelectTrigger className="h-8 w-full rounded-full border-border bg-background! px-3 text-xs text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background!">
            <SelectItem value="taker" className="text-xs">Taker</SelectItem>
            <SelectItem value="maker" className="text-xs">Maker</SelectItem>
            <SelectItem value="arbitrage" className="text-xs">Arbitrage</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || updateStrategy.isPending}
          className="cursor-pointer rounded-full bg-[linear-gradient(171deg,#cff8ea_0%,#67e1c1_100%)] px-3 py-1.5 text-xs font-medium text-[#0d0d0d] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updateStrategy.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// MFT Settings body (xno-builder parity) — Market -> Universe cascade + Train ratio, saved via
// `useUpdateEditor`. Keyed by `id` from the parent so switching editors remounts with fresh
// defaults instead of carrying over another editor's in-progress edits.
function MftSettingsFields({
  id,
  market,
  universe,
  trainRatio,
  onSaved,
  onClose,
}: {
  id: string;
  market?: string;
  universe?: string;
  trainRatio?: number;
  onSaved?: (changes: { market?: string; universe?: string; train_ratio?: number }) => void;
  onClose: () => void;
}) {
  const { data: markets } = useMarkets();
  const updateEditor = useUpdateEditor();
  const qc = useQueryClient();
  const addLog = useConsoleLog((s) => s.addLog);

  const [draftMarket, setDraftMarket] = useState(market ?? markets?.[0]?.name);
  const [draftUniverse, setDraftUniverse] = useState(universe ?? "VN30");
  const [draftTrainRatio, setDraftTrainRatio] = useState(trainRatio ?? 0.7);

  const universeOptions = markets?.find((m) => m.name === draftMarket)?.universes ?? [];
  const hasChanges = draftMarket !== market || draftUniverse !== universe || draftTrainRatio !== trainRatio;

  const handleMarketChange = (value: string) => {
    const firstUniverse = markets?.find((m) => m.name === value)?.universes[0]?.name;
    setDraftMarket(value);
    if (firstUniverse) setDraftUniverse(firstUniverse);
  };

  const handleSave = async () => {
    if (!hasChanges || !id || updateEditor.isPending) return;
    try {
      await updateEditor.mutateAsync({ id, market: draftMarket, universe: draftUniverse, train_ratio: draftTrainRatio });
      await qc.invalidateQueries({ queryKey: ["strategy-builder", "editors"] });
      onSaved?.({ market: draftMarket, universe: draftUniverse, train_ratio: draftTrainRatio });
      addLog("success", "Editor settings saved");
      onClose();
    } catch (err) {
      addLog("error", `Failed to save settings: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-white">Settings</p>
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[10px] font-medium text-white">Market</span>
          <Select value={draftMarket} onValueChange={handleMarketChange}>
            <SelectTrigger className="h-8 w-full rounded-full border-border bg-background! px-3 text-xs text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background!">
              {(markets ?? []).map((m) => (
                <SelectItem key={m.name} value={m.name} className="text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[10px] font-medium text-white">Universe</span>
          <Select value={draftUniverse} onValueChange={setDraftUniverse}>
            <SelectTrigger className="h-8 w-full rounded-full border-border bg-background! px-3 text-xs text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background!">
              {universeOptions.map((u) => (
                <SelectItem key={u.name} value={u.name} className="text-xs">
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-white">Train ratio</span>
        <Input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={draftTrainRatio}
          onChange={(e) => setDraftTrainRatio(Number(e.target.value))}
          className="h-8 rounded-full border-border bg-background! px-3 text-xs text-white"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || updateEditor.isPending}
          className="cursor-pointer rounded-full bg-[linear-gradient(171deg,#cff8ea_0%,#67e1c1_100%)] px-3 py-1.5 text-xs font-medium text-[#0d0d0d] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updateEditor.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function SettingsMenu({
  type,
  id,
  market,
  universe,
  trainRatio,
  hftMarket,
  onHftMarketChange,
  onSettingsSaved,
}: {
  type: "mft" | "hft";
  id: string;
  market?: string;
  universe?: string;
  trainRatio?: number;
  hftMarket: string;
  onHftMarketChange: (market: string) => void;
  onSettingsSaved?: (changes: { market?: string; universe?: string; train_ratio?: number }) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Settings"
          className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:text-white data-[state=open]:text-white"
        >
          <Settings className="size-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[300px] rounded-lg border-border bg-surface p-4">
        {type === "mft" ? (
          <MftSettingsFields
            key={id}
            id={id}
            market={market}
            universe={universe}
            trainRatio={trainRatio}
            onSaved={onSettingsSaved}
            onClose={() => setOpen(false)}
          />
        ) : (
          <HftSettingsFields
            key={id}
            id={id}
            market={hftMarket}
            onMarketChange={onHftMarketChange}
            onClose={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

export function Toolbar({
  name,
  type,
  id,
  market,
  universe,
  trainRatio,
  onToggleConsole,
  onSimulate,
  onSettingsSaved,
}: {
  name: string;
  type: "mft" | "hft";
  id: string;
  market?: string;
  universe?: string;
  trainRatio?: number;
  onToggleConsole?: () => void;
  onSimulate?: (editorId: string) => Promise<void>;
  onSettingsSaved?: (changes: { market?: string; universe?: string; train_ratio?: number }) => void;
}) {
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [mftSimStatus, setMftSimStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const addLog = useConsoleLog((s) => s.addLog);
  // HFT Market/Type pill: Market is UI-only (default tick/L2, shared with the Settings popover);
  // Type comes from the strategy's `strategy_type`.
  const [hftMarket, setHftMarket] = useState("tick-l2");
  const { data: hftStrategy } = useHftStrategy(type === "hft" ? id : undefined);
  const hftType = hftStrategy?.strategy_type;

  const handleSimulateClick = async () => {
    if (type === "hft") {
      setSimulateOpen(true);
      return;
    }
    // MFT: no modal — simulate the editor directly (`POST /v2/editors/{id}/simulate`, no body).
    if (USE_MOCK) {
      addLog("info", `Simulating "${name}" (mock)`);
      return;
    }
    setMftSimStatus("running");
    addLog("info", `Simulating "${name}"…`);
    try {
      await onSimulate?.(id);
      addLog("success", `Simulation submitted for "${name}"`);
      setMftSimStatus("done");
    } catch (err) {
      addLog("error", `Simulate failed: ${err instanceof Error ? err.message : "unknown error"}`);
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
          <span
            className={
              type === "hft"
                ? "size-2 shrink-0 rounded-full bg-[#67e1c1] shadow-[0_0_6px_1px_rgba(103,225,193,0.5)]"
                : "size-2 shrink-0 rounded-full bg-[#7b61ff] shadow-[0_0_6px_1px_rgba(123,97,255,0.5)]"
            }
          />
          <span
            className="bg-clip-text text-xs font-medium text-transparent"
            style={{
              backgroundImage:
                type === "hft"
                  ? "linear-gradient(148deg, #cff8ea 0%, #67e1c1 148%)"
                  : "linear-gradient(148deg, #e9e8ff 0%, #b7b1ff 148%)",
            }}
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

        {type === "mft" && (market || universe) && (
          <span className="inline-flex shrink-0 items-center gap-3 rounded-3xl border border-white/50 bg-gradient-to-b from-[rgba(123,97,255,0.8)] to-[rgba(123,97,255,0.2)] py-1 pl-2 pr-2 text-xs text-white backdrop-blur-[2px]">
            {market && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-white" />
                {market}
              </span>
            )}
            {universe && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-white" />
                {universe}
              </span>
            )}
          </span>
        )}

        {type === "hft" && (
          <span className="inline-flex shrink-0 items-center gap-3 rounded-3xl border border-white/50 bg-gradient-to-b from-[rgba(103,225,193,0.8)] to-[rgba(103,225,193,0.2)] py-1 pr-2 pl-2 text-xs text-white backdrop-blur-[2px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-white" />
              {HFT_MARKET_LABEL[hftMarket] ?? hftMarket}
            </span>
            {hftType && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-white" />
                {HFT_TYPE_LABEL[hftType]}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SettingsMenu
          type={type}
          id={id}
          market={market}
          universe={universe}
          trainRatio={trainRatio}
          hftMarket={hftMarket}
          onHftMarketChange={setHftMarket}
          onSettingsSaved={onSettingsSaved}
        />
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

      <SimulateModal open={simulateOpen} onOpenChange={setSimulateOpen} strategyName={name} strategyId={id} />
    </div>
  );
}
