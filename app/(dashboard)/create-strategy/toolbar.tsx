"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings, Copy, SkipNext, AltArrowDown } from "@solar-icons/react";
import type { ComponentType } from "react";
import type { IconProps } from "@solar-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SimulateModal, HFT_MARKET_LABEL, HFT_TYPE_LABEL } from "./simulate-modal";
import { USE_MOCK } from "@/lib/constant";
import { cn } from "@/lib/utils";
import { resourceErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { canMutate } from "@/lib/rbac";
import { useMarkets } from "@/hooks/api/use-markets";
import { useUpdateEditor } from "@/hooks/api/use-strategy-builder";
import { useStrategyRuns } from "@/hooks/api/use-strategy-runs";
import { useHftStrategy, useUpdateHftStrategy, type HftStrategyType } from "@/hooks/api/use-hft-strategies";
import { useConsoleLog } from "@/store/console-log-store";
import { StrategyStageBadge, strategyStage } from "@/components/strategy-stage";
import { PromoteStageDialog } from "./promote-stage-dialog";
import type { PromotionStage } from "@/types/domain";
import type { Run } from "@/types/domain";

// Toolbar row above the code editor — Figma node 13964:52172 (inside 13964:50200).
// Self-contained: strategy name is local state, all buttons are no-ops (page-level
// wiring lands with the shell owner).

// HFT market — no strategy field maps to it; it's a launch-time choice passed to SimulateModal,
// which turns it into the run's `data_kind` (tick-l2 -> tick, bar-ohlc -> bar + interval).
// `HFT_MARKET_LABEL`/`HFT_TYPE_LABEL` are defined in ./simulate-modal so both sides share one
// definition.

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

// Figma node 14256:148355 — the cog opens this Settings popover. For HFT it holds only Type
// (`strategy_type`), saved via `useUpdateHftStrategy` (PUT /api/strategies/{id}) — the one field
// backed by the API. Market/interval are launch-time choices with no strategy field behind them,
// so they live in SimulateModal instead. Keyed by `id` so switching editors remounts with the new
// strategy's values.
function HftSettingsFields({
  id,
  ownerId,
  onClose,
}: {
  id: string;
  ownerId?: string;
  onClose: () => void;
}) {
  const { data: strategy } = useHftStrategy(id);
  const updateStrategy = useUpdateHftStrategy();
  const addLog = useConsoleLog((s) => s.addLog);
  const { userId, isAdmin } = useAuth();

  // Derive Type from the fetched strategy until the user overrides it (avoids seeding via an
  // effect — the strategy loads async, so `typeOverride ?? loaded ?? default`).
  const [typeOverride, setTypeOverride] = useState<HftStrategyType | null>(null);
  const draftType: HftStrategyType = typeOverride ?? strategy?.strategy_type ?? "taker";

  const hasChanges = !!strategy && draftType !== strategy.strategy_type;
  // PUT /api/strategies/{id} 404s for a strategy the caller doesn't own — hide Save for those.
  const canSave = !ownerId || canMutate({ owner_id: ownerId }, { userId, isAdmin });

  const handleSave = async () => {
    if (!hasChanges || !id || updateStrategy.isPending) return;
    try {
      await updateStrategy.mutateAsync({ id, strategyType: draftType });
      addLog("success", "Strategy settings saved");
      onClose();
    } catch (err) {
      addLog("error", `Failed to save settings: ${resourceErrorMessage(err, "this strategy")}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-white">Settings</p>
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
      {canSave && (
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
      )}
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
  ownerId,
  market,
  universe,
  trainRatio,
  pillItems,
  onSettingsSaved,
}: {
  type: "mft" | "hft";
  id: string;
  ownerId?: string;
  market?: string;
  universe?: string;
  trainRatio?: number;
  /** Market/type labels shown on the trigger — these are what the popover edits. */
  pillItems: string[];
  onSettingsSaved?: (changes: { market?: string; universe?: string; train_ratio?: number }) => void;
  onRenamed?: (name: string) => void;
  /** Bubbles the launched run up so the page can show it in Results. */
  onLaunched?: (run: Run) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* The market/type pill is the Settings trigger — it displays exactly the fields the
            popover edits. Flat border/background.
            Falls back to the cog before the strategy's values have loaded. */}
        <button
          type="button"
          aria-label="Settings"
          className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-3 rounded-[40px] border border-border bg-background px-3 text-xs text-white transition-opacity hover:opacity-90"
        >
          {pillItems.length > 0 ? (
            pillItems.map((label) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-white" />
                {label}
              </span>
            ))
          ) : (
            <Settings className="size-4" />
          )}
          <AltArrowDown weight="Outline" className="size-4" />
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
          <HftSettingsFields key={id} id={id} ownerId={ownerId} onClose={() => setOpen(false)} />
        )}
      </PopoverContent>
    </Popover>
  );
}

export function Toolbar({
  name,
  type,
  id,
  ownerId,
  market,
  universe,
  trainRatio,
  canWrite = true,
  isDirty = false,
  onSave,
  onSimulate,
  onSettingsSaved,
  onRenamed,
  onLaunched,
}: {
  name: string;
  type: "mft" | "hft";
  id: string;
  ownerId?: string;
  market?: string;
  universe?: string;
  trainRatio?: number;
  canWrite?: boolean;
  isDirty?: boolean;
  onSave?: () => Promise<void>;
  onSimulate?: (editorId: string) => Promise<void>;
  onSettingsSaved?: (changes: { market?: string; universe?: string; train_ratio?: number }) => void;
  onRenamed?: (name: string) => void;
  /** Bubbles the launched run up so the page can show it in Results. */
  onLaunched?: (run: Run) => void;
}) {
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const updateStrategy = useUpdateHftStrategy();
  const [mftSimStatus, setMftSimStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const addLog = useConsoleLog((s) => s.addLog);
  // HFT Market/Type pill: Market is UI-only (default tick/L2, shared with the Settings popover);
  // Type comes from the strategy's `strategy_type`.
  const [hftMarket, setHftMarket] = useState("tick-l2");
  // Bar size for bar-ohlc runs. Owned here (not in SimulateModal) so the Settings popover and the
  // modal's Timeframe row edit one value rather than drifting apart.
  const [hftInterval, setHftInterval] = useState("5m");
  const { data: hftStrategy } = useHftStrategy(type === "hft" ? id : undefined);
  const hftType = hftStrategy?.strategy_type;

  // Inline rename, like the MFT platform's title field: click the name, edit, Enter/blur commits.
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const commitRename = async () => {
    const next = draftName.trim();
    setRenaming(false);
    if (!next || next === name) return;
    if (type !== "hft") {
      onRenamed?.(next);
      return;
    }
    try {
      await updateStrategy.mutateAsync({ id, name: next });
      onRenamed?.(next);
      addLog("success", `Renamed to "${next}"`);
    } catch (err) {
      setDraftName(name);
      addLog("error", `Rename failed: ${resourceErrorMessage(err, "this strategy")}`);
    }
  };

  const handleSaveClick = async () => {
    setSaving(true);
    try {
      await onSave?.();
    } catch (err) {
      addLog("error", `Save failed: ${resourceErrorMessage(err, "this strategy")}`);
    } finally {
      setSaving(false);
    }
  };

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

  // The launch button says what it will actually start. Mode isn't a choice any more — it follows
  // the promotion stage — so "Simulate" was vague about whether this backtests or trades.
  const stage = hftStrategy ? strategyStage(hftStrategy) : null;
  const runVerb =
    stage?.stage === "live" ? "Run live" : stage?.stage === "paper" ? "Run paper" : "Run backtest";
  const simulateLabel =
    mftSimStatus === "running"
      ? "Simulating…"
      : mftSimStatus === "done"
        ? "Simulated"
        : mftSimStatus === "error"
          ? "Failed"
          : type === "hft"
            ? runVerb
            : "Simulate";

  // The rung above the current one. Nothing to offer once a strategy is already live.
  const nextStage: PromotionStage | null =
    !stage || stage.stage === "live" ? null : stage.stage === "paper" ? "live" : "paper";
  const [promoteOpen, setPromoteOpen] = useState(false);
  const { isAdmin } = useAuth();

  // Mirror the server's precondition for the paper rung: a COMPLETED backtest of this exact
  // version. Without it the POST 422s, so offering an enabled button would just produce an error.
  // Fetched only when it could matter — an admin looking at an HFT strategy that isn't yet paper.
  const needsBacktestCheck = isAdmin && type === "hft" && nextStage === "paper";
  const { data: strategyRuns = [] } = useStrategyRuns(needsBacktestCheck ? id : undefined);
  const hasQualifyingBacktest =
    !!hftStrategy &&
    strategyRuns.some(
      (r) =>
        r.mode === "backtest" &&
        r.status === "completed" &&
        r.manifest?.strategy?.version === hftStrategy.version,
    );
  // The live rung needs a version-matching paper promotion, which is exactly what puts the
  // strategy on the paper stage — so reaching here already satisfies it.
  const promoteBlockedReason =
    nextStage === "paper" && !hasQualifyingBacktest
      ? `No completed backtest at v${hftStrategy?.version ?? "?"} — run one at this version before promoting.`
      : undefined;

  // Shown on the Settings trigger: HFT reads market + strategy type, MFT market + universe.
  const pillItems =
    type === "hft"
      ? [HFT_MARKET_LABEL[hftMarket] ?? hftMarket, ...(hftType ? [HFT_TYPE_LABEL[hftType]] : [])]
      : [market, universe].filter((v): v is string => !!v);

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4 bg-surface">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {renaming && canWrite ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraftName(name);
                setRenaming(false);
              }
            }}
            aria-label="Strategy name"
            className="min-w-0 shrink rounded-md border border-border bg-background px-2 py-0.5 text-xl font-semibold text-white outline-none focus:border-primary"
          />
        ) : (
          <span
            className={cn(
              "min-w-0 shrink truncate text-xl font-semibold text-white",
              canWrite && "cursor-text hover:opacity-80",
            )}
            title={canWrite ? `${name} — click to rename` : name}
            onClick={() => {
              if (!canWrite) return;
              setDraftName(name);
              setRenaming(true);
            }}
          >
            {name}
          </span>
        )}
        {/* The HFT/MFT badge that lived here is gone — the lab is already obvious from the
            sidebar toggle. Its place shows where the strategy sits on the promotion ladder and
            which version that refers to, which is what governs whether it can launch. */}
        {hftStrategy && <StrategyStageBadge strategy={hftStrategy} />}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SettingsMenu
          type={type}
          id={id}
          ownerId={ownerId}
          market={market}
          universe={universe}
          trainRatio={trainRatio}
          pillItems={pillItems}
          onSettingsSaved={onSettingsSaved}
        />
        <IconButton icon={Copy} label="Duplicate" />
        {/* Save/Simulate both PUT the strategy, which 404s for a lab-mate's share — hide them there. */}
        {canWrite && (
          <>
            {/* Save appears only when there is something to save — a disabled button that is
                greyed out for the entire life of a clean editor is just noise. */}
            {(isDirty || saving) && (
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={saving}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-[32px] border border-border bg-background px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
            {/* Promotion is admin-only (POST /api/promotions/{stage}/{strategy_id}) and only
                meaningful for HFT strategies, which are the ones the ladder governs. */}
            {isAdmin && type === "hft" && nextStage && (
              <button
                type="button"
                onClick={() => setPromoteOpen(true)}
                disabled={!!promoteBlockedReason}
                title={promoteBlockedReason}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-[32px] border border-[#f1c617]/40 bg-[rgba(241,198,23,0.1)] px-3 text-xs font-medium text-[#f1c617] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Promote to {nextStage}
              </button>
            )}
            <button
              type="button"
              onClick={handleSimulateClick}
              disabled={mftSimStatus === "running"}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-[32px] bg-[linear-gradient(161deg,#cff8ea_0%,#67e1c1_100%)] px-3 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SkipNext weight="Outline" className="size-3.5" />
              {simulateLabel}
            </button>
          </>
        )}
      </div>

      <SimulateModal
        open={simulateOpen}
        onOpenChange={setSimulateOpen}
        strategyName={name}
        strategyId={id}
        hftType={hftType}
        hftMarket={hftMarket}
        onHftMarketChange={setHftMarket}
        hftInterval={hftInterval}
        onHftIntervalChange={setHftInterval}
        onLaunched={onLaunched}
      />

      {hftStrategy && nextStage && (
        <PromoteStageDialog
          open={promoteOpen}
          onOpenChange={setPromoteOpen}
          strategyId={id}
          strategyName={name}
          version={hftStrategy.version}
          stage={nextStage}
          onPromoted={(promoted) => addLog("success", `Promoted “${name}” to ${promoted}`)}
        />
      )}
    </div>
  );
}
