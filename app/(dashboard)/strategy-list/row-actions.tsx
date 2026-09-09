"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightDown, ArrowRightUp, History, MenuDots, Pen2, SkipNext } from "@solar-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CloseIcon } from "@/components/icons/close";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RunId } from "@/components/run-id";
import { StrategyStageBadge, launchMode, nextPromotionStage, strategyStage } from "@/components/strategy-stage";
import { useActiveEditorStore } from "@/store/active-editor-store";
import { cn, formatAmount } from "@/lib/utils";
import type { PromotionStage, Run, Strategy, StrategyPromotion } from "@/types/domain";

// Everything hanging off a Strategy List row: the ⋮ menu (Figma 15277:36828 / 36912 / 37042 /
// 36856), the run history it opens, and the promote history behind the stage cell's ⓘ
// (15277:36995). Kept out of page.tsx, which is already the table, the filters and two dialogs.

// Gradient text, not a flat colour — the design system spells a status or a directional action
// this way everywhere (see strategy-stage.tsx).
const GRAD_GREEN = "bg-[linear-gradient(146deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";
const GRAD_RED = "bg-[linear-gradient(146deg,#ffcce2_0%,#ff135b_100%)] bg-clip-text text-transparent";

/**
 * Demotion names the rung the strategy lands ON, not the promotion being deleted — "Demote to
 * backtested" reads as a direction, where "Demote paper" reads as an argument.
 */
export const DEMOTE_TARGET: Record<PromotionStage, string> = {
  paper: "backtested",
  live: "paper trading",
};

const pad = (n: number) => String(n).padStart(2, "0");
function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MODE_LABEL: Record<string, string> = { backtest: "Backtest", paper: "Paper", live: "Live" };

/** Runs sort newest-first here rather than in the caller — `useRunsByStrategy` groups, it doesn't order. */
function newestFirst(runs: Run[]): Run[] {
  return [...runs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/**
 * `● Live trade promoted ⓘ` — the stage badge, made a button when there's a promotion to explain.
 *
 * The ⓘ the badge already draws is the affordance; the whole badge is the hit target because a
 * 12px icon inside a table row is not one. Rows on the backtest rung have nothing to show and
 * stay inert text.
 */
export function StageCell({
  strategy,
  runs,
  promotion,
}: {
  strategy: Strategy;
  runs?: Run[];
  promotion?: StrategyPromotion;
}) {
  const stage = strategyStage(strategy, runs);
  const badge = <StrategyStageBadge strategy={strategy} runs={runs} showVersion={false} />;
  if (stage.rung === "backtest") return badge;

  const promotedAt = stage.rung === "live" ? strategy.live_promoted_at : strategy.paper_promoted_at;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Promote history for ${strategy.name}`}>
          {badge}
        </button>
      </PopoverTrigger>
      {/* Surface-coloured, unlike the menus: this one sits over the table as a card, not as a
          list of choices. */}
      <PopoverContent
        align="start"
        className="relative w-[260px] rounded-lg border-border bg-surface p-4 shadow-[0_5px_15px_0_rgba(0,0,0,0.12),0_15px_35px_0_rgba(103,110,118,0.08)]"
      >
        <PopoverClose
          aria-label="Close"
          className="absolute top-1.5 right-1.5 text-muted-foreground transition-colors hover:text-white"
        >
          <CloseIcon className="size-3" />
        </PopoverClose>
        <p className="text-sm font-semibold text-white">Promote history</p>
        <div className="mt-2 flex flex-col gap-0.5">
          <span className="text-[10px] leading-[14px] text-muted-foreground">Promote at</span>
          <span className="text-xs text-white">{formatWhen(promotedAt)}</span>
        </div>
        <div className="mt-2 flex flex-col gap-0.5">
          <span className="text-[10px] leading-[14px] text-muted-foreground">Note</span>
          <span className="text-xs break-words text-white">{promotion?.note || "—"}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The row's Run button and ⋮ menu.
 *
 * Which promotion entries the menu offers is the whole point of the four Figma variants: a
 * never-simulated strategy gets neither, and each rung above it gets the step it can actually
 * take. `blocked` is a promotion the ladder allows but the evidence doesn't yet — it stays
 * visible and disabled, carrying the reason, because the strategy IS on the rung below and the
 * admin is entitled to know what's missing.
 */
export function RowActions({
  strategy,
  runs,
  blocked,
  onRun,
  onPromote,
  onDemote,
}: {
  strategy: Strategy;
  runs: Run[];
  blocked?: string;
  onRun: () => void;
  onPromote: () => void;
  onDemote: () => void;
}) {
  const router = useRouter();
  const setRememberedEditor = useActiveEditorStore((s) => s.setActiveEditor);
  const [historyOpen, setHistoryOpen] = useState(false);

  const stage = strategyStage(strategy, runs);
  const next = nextPromotionStage(strategy);
  // Hidden on the bottom rung, per Figma 15277:36828: a strategy that has never produced a
  // simulation has no promotion to reason about, only a backtest to run.
  const promotable = next && stage.stage !== "none";
  const demotable = strategy.live_approved_version != null ? "live" : strategy.paper_approved_version != null ? "paper" : null;

  // Create Strategy restores its tab from this store on mount, so setting it is the whole
  // handoff — no route param to thread through a page that doesn't read one.
  const openInEditor = () => {
    setRememberedEditor("hft", strategy.id);
    router.push("/create-strategy");
  };

  return (
    <span className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onRun}
            aria-label={`Run ${strategy.name}`}
            className="inline-flex h-8 w-[120px] shrink-0 items-center justify-center gap-1 rounded-[32px] bg-[linear-gradient(165deg,#cff8ea_0%,#67e1c1_100%)] px-3 text-xs text-black transition-opacity hover:opacity-90"
          >
            <SkipNext weight="Outline" className="size-3.5" />
            Run {launchMode(strategy)}
          </button>
        </TooltipTrigger>
        <TooltipContent>Launch at its current stage ({stage.label.toLowerCase()})</TooltipContent>
      </Tooltip>

      {/* The run history opens against the kebab rather than as a dialog, so the row it belongs
          to stays visible behind it. */}
      <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
        <DropdownMenu>
          {/* The anchor has to be the trigger BUTTON, not the DropdownMenu around it: Root
              renders no DOM node, so `asChild` had nothing to clone onto and the kebab never
              made it into the tree. */}
          <PopoverAnchor asChild>
            <DropdownMenuTrigger
              aria-label={`Actions for ${strategy.name}`}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-[20px] text-white transition-colors hover:bg-secondary"
            >
              <MenuDots weight="Bold" className="size-5 rotate-90" />
            </DropdownMenuTrigger>
          </PopoverAnchor>
          <DropdownMenuContent>
            {promotable && (
              <DropdownMenuItem
                disabled={!!blocked}
                onSelect={onPromote}
                // Radix drops pointer events on a disabled item, so the reason has to ride on
                // the row itself rather than in a tooltip.
                title={blocked}
              >
                <ArrowRightUp weight="Outline" className="text-[#67e1c1]" />
                <span className={GRAD_GREEN}>Promote to {next}</span>
              </DropdownMenuItem>
            )}
            {demotable && (
              <DropdownMenuItem onSelect={onDemote}>
                <ArrowRightDown weight="Outline" className="text-destructive" />
                <span className={GRAD_RED}>Demote to {DEMOTE_TARGET[demotable]}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
              <History weight="Outline" />
              View run history
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={openInEditor}>
              <Pen2 weight="Bold" />
              Edit strategy (New version)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <PopoverContent align="end" className="w-[320px] p-0">
          <RunHistory runs={runs} onClose={() => setHistoryOpen(false)} />
        </PopoverContent>
      </Popover>
    </span>
  );
}

/**
 * This strategy's runs, newest first. Picking one hands off to that mode's list page, which
 * opens the run's detail panel from `?run=` — the same deep link a launch from here uses.
 */
function RunHistory({ runs, onClose }: { runs: Run[]; onClose: () => void }) {
  const router = useRouter();
  if (runs.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">This strategy has no runs yet.</p>;
  }
  return (
    <div className="max-h-72 overflow-y-auto">
      {newestFirst(runs).map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => {
            onClose();
            router.push(`${LIST_PAGE[r.mode] ?? "/strategies"}?run=${r.id}`);
          }}
          className="flex w-full items-start justify-between gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface"
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <RunId id={r.id} className="truncate text-xs text-white" />
              <span className="shrink-0 rounded-[20px] bg-secondary px-1.5 py-0.5 text-[10px] leading-4 text-muted-foreground">
                {MODE_LABEL[r.mode] ?? r.mode}
              </span>
            </span>
            <span className="truncate text-xs text-muted-foreground">{formatWhen(r.created_at)}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className={cn("text-xs", RUN_STATUS_TEXT[r.status] ?? "text-muted-foreground")}>
              {r.status}
            </span>
            <span className="text-xs text-muted-foreground">
              Sharpe: {r.sharpe_annualized == null ? "—" : formatAmount(r.sharpe_annualized, 2)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

// Same destinations the launch handoff uses; a run only ever reads on its own mode's list.
const LIST_PAGE: Record<string, string> = {
  backtest: "/strategies",
  paper: "/paper-trading",
  live: "/live-trading/live-trade",
};

const RUN_STATUS_TEXT: Record<string, string> = {
  completed: "text-[#67e1c1]",
  running: "text-[#7fb2ff]",
  failed: "text-destructive",
};
