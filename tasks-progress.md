# Tasks progress

Mirrors `user-tasks.md`. Status: ✅ done · 🔄 in progress · ⬜ todo
NOTE: re-read `user-tasks.md` at the START of every task AND before stopping (user edits it live, adds tasks mid-work). Remove items the user removes.

## Tasks
_(none queued in `user-tasks.md`)_

## API-integration completion pass (2026-07-14)
Closed the two functional gaps that were fixable without external input; both verified in Chrome against the real dev API (USE_MOCK=false), tsc + eslint clean, no console errors.

- ✅ **T9** Start Live Trading launch — threaded `strategyId`/`symbolIds`/`executionType` from the raw `Run` → `PaperRunRow` (`lib/mock/paper-runs.ts` type + 16 mock rows, `lib/transform/runs.ts` `toPaperRunRow`) and into `start-live-trading-dialog.tsx` (reads `run.strategyId`/`run.symbolIds`, execution type pre-fills from `run.executionType`; removed the "not wired for this run yet" block). **Verified:** dialog on the real "VWAP-deviation breakout" paper run pre-fills Taker, loads real accounts, and the "Start live trading" button ENABLES once an account is picked (was permanently disabled). Did NOT submit — that places real live orders.
- ✅ **Editor editable** — Monaco had no `onChange`, so keystrokes were never captured. Added `onChange` (`code-editor.tsx`), threaded to `editors` state (`page.tsx` `handleCodeChange`), and extended `useUpdateHftStrategy` to accept `code` so HFT tabs persist edited code on Simulate (MFT path unchanged; already saved-before-simulate). **Verified:** typed `# edit-check-xyz`, switched tabs and back — edit persisted (proves it's in React state, not just Monaco's local model).

## Global HFT/MFT lab switch (2026-07-15) — DONE + verified in Chrome
Big task: a global HFT⇄MFT toggle in the sidebar that scopes each page's content; redesigned HFT Create Strategy (3 tabs) with new Samples + Features tabs. tsc + eslint clean, browser-verified against real dev API, no console errors.
- ✅ **Foundation** — `store/mode-store.ts` (zustand persisted, default `hft`), `nav-config` gained `modes?: Mode[]` per item (extensibility hook for future HFT-only/MFT-only pages), `sidebar.tsx` `ModeToggle` (HFT LAB / MFT LAB segmented pill, compact when collapsed) + nav filtering. **Verified:** toggle flips mode, persists.
- ✅ **Create Strategy mode-scoped** — `page.tsx` shows only the active mode's strategies (HFT→`useHftStrategies`, MFT→`useEditors`), remounts per mode (`key={mode}`), empty-state when a mode has none; create modal locked to the mode (`create-strategy-modal.tsx` `mode` prop hides the MFT/HFT picker). `results-panel.tsx` tab set by variant: **HFT = Samples/Features/Results**, MFT = full 5. **Verified:** HFT mode → only HFT strategies + 3 tabs; MFT mode → only MFT editors + 5 tabs.
- ✅ **HFT Samples tab** (`hft-samples-tab.tsx` + `lib/mock/hft-strategy-samples.ts`) — Taker/Maker/Arbitrage pills, curated Rhai sample cards (View source / Use template), Script API Reference. Matches Figma 14562-20367. **Verified.**
- ✅ **HFT Features tab** (`hft-features-tab.tsx` + `hooks/api/use-hft-features.ts`) — variable builder bound to `Strategy.features`, insert-primitive grid from `GET /api/strategies/feature-catalog`, Validate (`/validate-features`), Save (extended `useUpdateHftStrategy` with `features`). Both untyped responses parsed defensively. **Verified with REAL data:** catalog returned live FIELD/FN primitives (object shape: fields/functions arrays); strategy's real features loaded. Matches Figma 14567-26137.
- ✅ **Strategy List** (`strategies/page.tsx`) — removed in-header MFT/HFT toggle; filters by `useMode()`. **Verified:** MFT shows strategies; HFT shows none (XALPHA list has no `group==="HFT"` — GAP-6; HFT strategies live in the HFT backend, out of current scope).
- NOTE: two implementer subagents first stalled on hung Figma-MCP calls (600s watchdog) → re-ran with inline design specs. `feature-catalog`/`validate-features` bodies remain untyped in `hft.ts`; parser is defensive and confirmed working on live data.

### Follow-ups (2026-07-15)
- ✅ **Nav** — "Create strategy" moved from a standalone top item into the **Quant Lab** group (first item) per design. `nav-config.ts`. Verified in Chrome.
- ✅ **Sidebar toggle color** — container now `bg-background` (#0a0e14) + border so the lighter `#1d2939` selected pill pops (was flat `bg-surface`, no border). Matches Figma 13964-56847. Verified in Chrome.
- ✅ **HFT Features tab UI match** (`hft-features-tab.tsx`) — re-done against the real `get_design_context` for node 14567-26137 (not eyeballed). Feature inputs are `rounded-[20px]` pills, name input `w-[200px]`, 12px text, xs shadow (were flat `rounded-lg` slots). Primitive cards are transparent border-only `rounded-xl`; **Add button inline on the name row**; **Returns is a `#0d0d0d` pill badge with a green-gradient FN/FIELD** (`cff8ea→67e1c1`); icon square `bg-secondary` no border. Kept the **Validate/Save footer** (user asked to keep buttons for functioning — the design omits it, but functionality wins). Arity suffix `abs (1)` not shown — the catalog API returns name+return only, no arg count. **Verified in Chrome** (side-by-side vs Figma).
- ✅ **Features: focus-aware primitive Add** — clicking Add on a primitive inserts it at the caret of the focused feature input (function → `name()` with caret inside parens; field → bare `name`); if no feature input is focused it drops into a fresh feature row. Button uses `onMouseDown preventDefault` so the focused input doesn't blur. **Verified in Chrome:** `close` inserted into the focused row-2 expression input, staying focused. (No-focus→new-row path is code-verified; browser session viewport froze before that sub-case could be re-shot.)

- ✅ **Symbol select → search + dropdown** (`simulate-modal.tsx`) — the symbol picker is a typeahead: text input filters the symbol list live (`filtered`), selections render as removable chips, input stays focused after pick. Code-verified; not separately browser-reverified this session.

## Genuinely blocked (external dependency — cannot complete in-code)
- **Start Paper Trading** (Strategies list) — no paper-trade backend for XALPHA strategies + no XALPHA→HFT bridge (DEC-2 / Q1). Dialog stays a no-op close by design.
- **Start Bot** (Live Trading) — no backend start/resume endpoint (GAP-7); button stays disabled with tooltip.
- **HFT Results (Overview/Perf/Risk)** — user-deferred; backend must compute the missing run metrics first. Views remain static mock.
- **Risk/Fee account config UI** — schema (`NewAccount.risk`/`.fee`) supports it, but no Figma. Awaiting user: build a functional version without a design, or supply a Figma.
- **Portfolios** — no backend at all (GAP-1); 3 hooks stay mock-only and are currently unmounted.
- Data-shape gaps (`lib/transform/runs.ts`): trade `role`/`fee`/`equity` per-fill, run `market` label, PnL %-vs-absolute — backend fields missing; best-effort/placeholder.
