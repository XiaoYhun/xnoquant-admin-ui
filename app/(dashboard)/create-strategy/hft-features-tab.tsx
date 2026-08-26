"use client";
// OWNED BY: Create Strategy "HFT Features tab".
// Built to match Figma node 14567-26592 (Features variable card) + 14567-26860/26952 (Insert
// primitive). Editable ordered name/expression rows bound to the strategy's `features`, an
// "Insert primitive" catalog browser, and validate/save actions.
import { useMemo, useRef, useState } from "react";
import { Code2 } from "@solar-icons/react";
import { PlusIcon } from "@/components/icons/plus";
import { CloseIcon } from "@/components/icons/close";
import { useHftStrategy, useUpdateHftStrategy, type FeatureDef } from "@/hooks/api/use-hft-strategies";
import { useFeatureCatalog, useValidateFeatures, type FeatureCatalogItem } from "@/hooks/api/use-hft-features";
import { resourceErrorMessage } from "@/lib/api-client";
import { useConsoleLog } from "@/store/console-log-store";

type DraftRow = { name: string; expression: string };
type RowField = "name" | "expression";

const emptyRow = (): DraftRow => ({ name: "", expression: "" });

function withTrailingEmptyRow(rows: DraftRow[]): DraftRow[] {
  const last = rows[rows.length - 1];
  if (!last || last.name.trim() !== "" || last.expression.trim() !== "") return [...rows, emptyRow()];
  return rows;
}

function primitiveToken(item: FeatureCatalogItem): string {
  return item.returns === "FIELD" ? item.name : `${item.name}()`;
}

// Feature row inputs (Figma I14562:18548;17:43371): #0a0e14 fill, #1d2939 border, pill radius,
// 12px text, #475467 placeholder, xs shadow.
const INPUT_CLS =
  "rounded-[20px] border border-border bg-background px-3 py-1.5 text-xs text-white shadow-xs outline-none transition-colors placeholder:text-[#475467] focus:border-primary/60";

export function HftFeaturesTab({ strategyId }: { strategyId?: string }) {
  const { data: strategy } = useHftStrategy(strategyId);
  const updateStrategy = useUpdateHftStrategy();
  const { data: catalog = [], isPending: catalogPending } = useFeatureCatalog();
  const validateFeatures = useValidateFeatures();
  const addLog = useConsoleLog((s) => s.addLog);

  const [rows, setRows] = useState<DraftRow[]>([emptyRow()]);
  const [seededFor, setSeededFor] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const focusedRef = useRef<{ el: HTMLInputElement; index: number; field: RowField } | null>(null);
  const exprRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Keyed on the server-side features too, so applying a template re-seeds the rows. Local edits
  // do not change this key, so typing is never clobbered.
  const seedKey = strategy ? `${strategy.id}:${JSON.stringify(strategy.features ?? [])}` : undefined;
  if (strategy && seededFor !== seedKey) {
    setSeededFor(seedKey);
    setRows(withTrailingEmptyRow((strategy.features ?? []).map((f) => ({ name: f.name, expression: f.expression }))));
  }

  const nonEmptyRows = useMemo(
    () =>
      rows
        .map((row, rowIndex) => ({ row, rowIndex }))
        .filter(({ row }) => row.name.trim() !== "" && row.expression.trim() !== ""),
    [rows],
  );

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    // Match the signature too — the card shows `ema(field, window)`, so typing any of that (or an
    // argument name, to find what takes a `window`) has to find it.
    return catalog.filter((c) => `${c.name} ${c.usage ?? ""}`.toLowerCase().includes(q));
  }, [catalog, query]);

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRowErrors({});
    validateFeatures.reset(); // the last verdict described code that no longer exists
    setRows((prev) => withTrailingEmptyRow(prev.map((r, i) => (i === index ? { ...r, ...patch } : r))));
  }

  function removeRow(index: number) {
    setRowErrors({});
    validateFeatures.reset(); // the last verdict described code that no longer exists
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return withTrailingEmptyRow(next.length > 0 ? next : []);
    });
  }

  function addCustomFeatureRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function addPrimitive(item: FeatureCatalogItem) {
    setRowErrors({});
    validateFeatures.reset(); // the last verdict described code that no longer exists
    const token = primitiveToken(item);
    const focus = focusedRef.current;

    if (focus) {
      const { el, index, field } = focus;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      setRows((prev) =>
        withTrailingEmptyRow(
          prev.map((r, i) => (i === index ? { ...r, [field]: r[field].slice(0, start) + token + r[field].slice(end) } : r)),
        ),
      );
      const caret = item.returns === "FIELD" ? start + token.length : start + item.name.length + 1;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
      });
      return;
    }

    const lastIndex = rows.length - 1;
    const last = rows[lastIndex];
    const targetIndex = last.name.trim() === "" && last.expression.trim() === "" ? lastIndex : rows.length;
    setRows((prev) => {
      const next = [...prev];
      if (next[targetIndex]) next[targetIndex] = { ...next[targetIndex], expression: token };
      else next.push({ name: "", expression: token });
      return withTrailingEmptyRow(next);
    });
    if (item.returns !== "FIELD") {
      const caret = item.name.length + 1; // between the parens of `name()`
      requestAnimationFrame(() => {
        const el = exprRefs.current[targetIndex];
        if (el) {
          el.focus();
          el.setSelectionRange(caret, caret);
        }
      });
    }
  }

  function toFeatureDefs(): FeatureDef[] {
    return nonEmptyRows.map(({ row }) => ({ name: row.name.trim(), expression: row.expression.trim() }));
  }

  function handleSave() {
    if (!strategyId) return;
    updateStrategy.mutate({ id: strategyId, features: toFeatureDefs() });
  }

  // Validate has to answer out loud. Marking the bad rows says nothing when every row is fine, so
  // a passing check used to read exactly like a click that did nothing — and an error the server
  // reports against no row we can match (or a request that never lands) vanished entirely. The
  // verdict goes to the footer, the per-error detail to the console.
  function handleValidate() {
    validateFeatures.mutate(toFeatureDefs(), {
      onSuccess: (errors) => {
        const map: Record<number, string> = {};
        errors.forEach((e) => {
          const match =
            (typeof e.index === "number" ? nonEmptyRows[e.index] : undefined) ??
            nonEmptyRows.find(({ row }) => row.name === e.name);
          if (match) map[match.rowIndex] = e.error;
        });
        setRowErrors(map);
        if (errors.length === 0) {
          addLog("success", `All ${nonEmptyRows.length} features compiled — no errors`);
          return;
        }
        errors.forEach((e) => addLog("error", `Feature error${e.name ? ` (${e.name})` : ""}: ${e.error}`));
      },
      onError: (err) => addLog("error", `Validate failed: ${resourceErrorMessage(err, "these features")}`),
    });
  }

  const variableCount = nonEmptyRows.length;
  const failedCount = validateFeatures.data?.length ?? 0;
  // One status slot for the footer, so Validate and Save can't both claim the same space. Validate
  // wins while its result stands — it is the one the user is waiting on.
  const status: { tone: "ok" | "error"; text: string } | null = validateFeatures.isError
    ? { tone: "error", text: `Validate failed: ${resourceErrorMessage(validateFeatures.error, "these features")}` }
    : validateFeatures.isSuccess
      ? failedCount === 0
        ? { tone: "ok", text: `All ${variableCount} features valid.` }
        : { tone: "error", text: `${failedCount} of ${variableCount} features failed to compile.` }
      : updateStrategy.isError
        ? { tone: "error", text: resourceErrorMessage(updateStrategy.error, "this strategy") }
        : updateStrategy.isSuccess && !updateStrategy.isPending
          ? { tone: "ok", text: "Saved." }
          : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Features variable card — Figma 14567:26592 */}
      <div className="rounded-lg border border-border bg-surface">
        {/* Info bar (14567:26593): border-b, 8px padding */}
        <div className="flex items-center justify-between gap-2 border-b border-border p-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Features</h3>
            <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
              {variableCount} {variableCount === 1 ? "variable" : "variables"}
            </span>
          </div>
          <button
            type="button"
            onClick={addCustomFeatureRow}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs text-[#9ff0d7] hover:opacity-80"
          >
            <PlusIcon className="size-[18px]" />
            Add custom feature
          </button>
        </div>

        {/* Balances (14567:26599): 8px padding, 6px row gap */}
        <div className="flex flex-col gap-1.5 p-2">
          {rows.map((row, i) => {
            const error = rowErrors[i];
            return (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="flex w-6 shrink-0 items-center justify-center text-xs text-muted-foreground">{i}</span>
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    onFocus={(e) => (focusedRef.current = { el: e.currentTarget, index: i, field: "name" })}
                    onBlur={() => (focusedRef.current = null)}
                    placeholder="Variable name"
                    className={`${INPUT_CLS} w-[200px] shrink-0`}
                  />
                  <span className="flex w-6 shrink-0 items-center justify-center text-xs text-muted-foreground">=</span>
                  <input
                    ref={(el) => {
                      exprRefs.current[i] = el;
                    }}
                    value={row.expression}
                    onChange={(e) => updateRow(i, { expression: e.target.value })}
                    onFocus={(e) => (focusedRef.current = { el: e.currentTarget, index: i, field: "expression" })}
                    onBlur={() => (focusedRef.current = null)}
                    placeholder="Expression (e.g. sma(close, 200))"
                    className={`${INPUT_CLS} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="flex size-5 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Remove feature"
                  >
                    <CloseIcon className="size-5" />
                  </button>
                </div>
                {error && <p className="pl-8 text-[11px] text-destructive">{error}</p>}
              </div>
            );
          })}
        </div>

        {/* Validate/Save kept for functionality (per request; not in the design node) */}
        <div className="flex items-center justify-end gap-2 border-t border-border p-2">
          {status && (
            <p className={`mr-auto text-xs ${status.tone === "ok" ? "text-primary" : "text-destructive"}`}>
              {status.text}
            </p>
          )}
          <button
            type="button"
            onClick={handleValidate}
            disabled={validateFeatures.isPending || variableCount === 0}
            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-border px-3.5 text-xs text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {validateFeatures.isPending ? "Validating…" : "Validate"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateStrategy.isPending || !strategyId}
            className="inline-flex h-8 cursor-pointer items-center rounded-full bg-[linear-gradient(163deg,#cff8ea_0%,#67e1c1_100%)] px-4 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateStrategy.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Insert primitive card — Figma 14567:26860 */}
      <div className="rounded-lg border border-border">
        <div className="border-b border-border p-2 bg-surface">
          <h3 className="text-sm font-semibold text-muted-foreground">Insert primitive</h3>
        </div>
        <div className="flex flex-col gap-2 p-2">
          {/* Search field (14567:26946): transparent, border-only, no icon */}
          <div className="flex items-center rounded-[20px] border border-border py-2 pr-3 pl-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search features..."
              className="min-w-0 flex-1 bg-transparent text-xs font-medium text-white outline-none placeholder:text-muted-foreground"
            />
          </div>

          {catalogPending && <p className="py-4 text-center text-xs text-muted-foreground">Loading…</p>}
          {!catalogPending && (
            <div className="grid grid-cols-2 gap-2">
              {filteredCatalog.map((c, idx) => (
                // Item_feature — Figma 14567:26952
                // Top-aligned, not centred: the description makes the card height vary, and a
                // centred icon/Add drifts away from the name it belongs to.
                <div key={`${c.name}-${idx}`} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2">
                  <span className="mt-0.5 flex shrink-0 items-center justify-center rounded-lg bg-secondary px-1.5 py-1">
                    <Code2 weight="Bold" className="size-4 text-[#9db2ce]" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-3">
                      {/* The signature, not the bare name: Add inserts `ema()` with the caret
                          between the parens, and the name alone never said what goes there.
                          Fields have no `usage` — their name IS the whole token. */}
                      <p
                        title={c.usage ?? c.name}
                        className="min-w-0 flex-1 truncate font-mono text-sm font-medium text-white"
                      >
                        {c.usage ?? c.name}
                      </p>
                    </div>
                    {/* Clamped to two lines — some registry descriptions run to a paragraph, and the
                        grid is two narrow columns. `title` keeps the full text reachable. */}
                    {c.description && (
                      <p
                        title={c.description}
                        className="line-clamp-2 text-[11px] leading-[15px] text-muted-foreground"
                      >
                        {c.description}
                      </p>
                    )}
                  </div>
                  {/* Add on top, kind badge directly beneath it — the right column reads as one
                      unit, and the badge no longer pushes the description around. */}
                  <div className="mt-0.5 flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addPrimitive(c)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#344054] bg-secondary py-0.5 pr-2 pl-1.5 text-xs text-[#d0d5dd] transition-colors hover:brightness-125"
                    >
                      <PlusIcon className="size-[18px]" />
                      Add
                    </button>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-[#0d0d0d] px-2 py-0.5 text-[11px]">
                      <span className="bg-[linear-gradient(133deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text font-semibold text-transparent">
                        {c.returns}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
              {filteredCatalog.length === 0 && (
                <p className="col-span-2 py-4 text-center text-xs text-muted-foreground">
                  No primitives match &quot;{query}&quot;.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
