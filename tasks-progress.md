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
- **HFT Results — leftover metrics only.** Overview + Performance are now wired to the real endpoints (see below); what stays blocked is the handful of fields the API has no source for: Max Capacity, MDD Duration, Avg Latency, Fill Rate. They render "—" instead of placeholder numbers.

## Results charts wired to the HFT results API (2026-08-10) — browser-verified, one gap found
Ported the endpoint usage from the `hft-platform` reference UI (`web/src/features/runs/result-queries.ts`, `equity-chart.tsx`, `routes/run-detail.tsx`) into our two remaining mock Results views. tsc + eslint clean, 61/61 vitest pass, `/create-strategy` compiles 200.
- ✅ **`lib/transform/results.ts`** — added `toDailyPnlPoints`, `toMonthlyPnl`, `equityStats`, `toReturnHistogram`, `startingCapital`, `annualizedReturn`, `curveSpanMs`. 15 unit tests.
- ✅ **Performance view** (was 100% mock) — summary card, Monthly Return heatmap, PnL By Day/By Month, Daily Return Distribution, all from `/summary` + `/equity-curve`. Now takes `runId` (passed from `results-tab.tsx`).
- ✅ **Overview view** — 6 metric cards, stats strip and Equity Curve from `/summary` + `/equity-curve` + `/cost-curve` (Gross = Net + cumulative fees). Range tabs now filter, measured from the curve's last point so backtests aren't blanked by a wall-clock cutoff.
- ✅ **Browser-verified (2026-08-10, second pass)** — Chrome extension was available this session. Verified on strategy `test-binance`, run `#3ec9b6deb1` (2026-07-10, Stopped — the only run in that history with non-zero data). Overview renders REAL API data: Net PnL -5 USDT, Sharpe -9179.04, Max Drawdown -0.00%, Return/Turnover -3.78 bp, Cost Drag 888.52% / 5 USDT, a real equity curve + drawdown line, and 9 real BTCUSDT fills in Trading history. Performance renders real Gross +1 / Fees -6 / Net -5 USDT — internally consistent with Overview. No console errors.
- ⚠️ **GAP found — single-calendar-day runs render an empty Performance tab.** `toDailyPnlPoints` does `dailyCloses(points).slice(1)` (drops day 1, which has no prior close). Run `#3ec9b6deb1` ran 05:28–05:29 on ONE calendar day, so `dailyCloses` has length 1 and the slice yields `[]`; `toMonthlyPnl`, `equityStats` and `toReturnHistogram` all then go empty/null. Result: Monthly Return ("No monthly returns for this run"), PnL By Day/By Month, Daily Return Distribution, Avg Daily PnL, Best day, Worst day, plus Overview's Profit Days / Trading Days all show "—" even though the run has real PnL. Intraday runs are the norm for HFT, so this hits the common case, not an edge case. Candidate fix (consistent with `toDrawdown`, which seeds peak at 0 because equity IS cumulative realized PnL): seed the first day's prior close at 0 instead of dropping the day. AWAITING USER DECISION — it also changes multi-day semantics (Trading Days N-1 → N) and touches the 15 existing unit tests.
- NOTE: run `019fea06-a203-74ee-a723-9434e4ebf001` (= display `#34e4ebf001`, strategy `dochian-BO`), named in the previous session's note, is NOT usable for verification — the backend itself fails on it: `open parquet "data/runs/019fea06-.../fills-20260810.parquet": Parquet error: Invalid Parquet file. Corrupt footer`. Also learned: the display run id is the uuid's LAST 10 chars, not a prefix.
- NOTE (pre-existing, unrelated to these changes): on first load the strategies list finishes fetching and auto-switches the selected strategy tab (test-binance → dochian-BO), resetting the chosen run. A stale Trading-history error also persisted across a strategy switch. Not investigated — outside this task's scope.
- NOTE: `return_pct` is null for live runs by design, so % framing falls back to absolute PnL with a header note. Currency label stays hardcoded "USDT" — matches the existing convention in `cost-capacity-view.tsx`, not fixed here.
- **Risk/Fee account config UI** — schema (`NewAccount.risk`/`.fee`) supports it, but no Figma. Awaiting user: build a functional version without a design, or supply a Figma.
- **Portfolios** — no backend at all (GAP-1); 3 hooks stay mock-only and are currently unmounted.
- Data-shape gaps (`lib/transform/runs.ts`): trade `role`/`fee`/`equity` per-fill, run `market` label, PnL %-vs-absolute — backend fields missing; best-effort/placeholder.

## Live-run parity check vs hft-dev (2026-08-10, session 2) — browser-verified, NOT yet fixed
Compared our Results charts against the deployed reference UI at `https://hft-dev.xnoquant.io` on the
same live run: `dochian-BO` / `019fea06-a203-74ee-a723-9434e4ebf001` (= `#34e4ebf001`, status `running`).
Captured the real `/api/runs/{id}/live/stream` frame in DevTools. NOTE: the local `hft-platform`
checkout is BEHIND the deployed build (no PnL-by-day/weekday, Rolling Sharpe or Fill-rate charts in it) —
port from the deployed behaviour, not from the local repo.

**Reference network profile for a running run: `/api/runs/{id}` + `/live/stream` + `/trace/stream` and
NOTHING else.** Every result endpoint 500s while a run is live (`pnl-<date>.parquet: Invalid Parquet
file. Corrupt footer` — the artifact is mid-write), so all its charts come from the stream frame.

Real frame keys: `run_id net_pnl total_fee total_trades sharpe sharpe_annualized max_drawdown
max_drawdown_pct return_pct win_rate equity[{ts,equity,pnl}] symbols[{symbol_id,signal_pnl,
spread_capture,adverse_selection,total_fee,net_pnl}] recent_trades[200] positions orderbooks
alpha_timing updated_at_ms`.

- ✅ **Our SSE plumbing works** — proxy route, frame parser and `LiveSnapshotProvider` are fine.
  Latency renders real live timings (Rhai AVG 25.9µs / MAX 8.6ms) and Risk renders live Sharpe
  (-45,679) + a live Rolling Sharpe, matching the reference. `alpha_timing`, `recent_trades`,
  `positions` field names all match the real payload exactly.
- ✅ **`max_drawdown_pct` IS a fraction** — run manifest `balances.USDT = 100000`, `max_drawdown`
  702,559 → 7.03 = 702.6%. Our `* 100` (-708%) is correct; no unit bug.
- ⚠️ **BUG-1 wrong run after a strategy switch.** `results-tab.tsx` keeps `selectedRun` in state and
  `run-history-picker.tsx` only auto-selects when `!selectedRunId`. Switching strategy tabs leaves the
  previous strategy's run in state: the picker LABEL shows the new strategy's newest run while every
  view (and the live stream) still queries the old run id. Verified: with `dochian-BO` selected the app
  fetched `/runs/019fc6f8-…ab8de35fa5/summary` (a test-binance run). Fix: reset on `strategyId` change.
- ⚠️ **BUG-2 `mergeLiveSummary` drops the snapshot when REST `/summary` is missing.** It early-returns
  `summary` when `summary` is undefined, and `/summary` 500s for every running run — so Overview,
  Performance and Cost & Capacity render all "—" while a healthy stream is delivering the numbers.
  Reference shows Net PnL -702,110.92 / Sharpe -1.00 / Trades 2,382,798 for the same run.
- ⚠️ **BUG-3 charts never read `snapshot.equity`.** The frame carries a 151-point equity series
  spanning the whole run; we only ever read REST `/equity-curve` (500 while live). Result: "Equity
  unavailable" / "No equity points" / "No cost points" on Overview, Performance, Risk and
  Cost & Capacity, where the reference draws Equity curve, Drawdown, Net PnL by day and by weekday.
- ⚠️ **BUG-4 `symbols` ignored** — per-symbol PnL attribution (signal / spread capture / adverse
  selection / fees / net) is on every frame; the reference renders it as a table, we drop it.
- ⚠️ **BUG-5 `orderbooks` ignored** — new field not in the local checkout's types; reference has a live
  Order book panel.
- ⚠️ **BUG-6 no reconnect.** Reference retries the stream every 2s forever; ours sets `state = "error"`
  once and never retries, so one drop kills live updates until remount.
- ⚠️ **BUG-7 symbol ids not resolved.** Frames carry `symbol_id: 0`, never a name; reference maps it via
  `manifest.symbols` → `BTCUSDT`, we render `#0`.
- ⚠️ **BUG-8 proxy grace path hides upstream failures.** `app/hft/api/runs/[id]/live/stream/route.ts`
  returns 200 + `": connected"` when upstream headers take >1500ms, then closes silently if upstream
  errored — the client sits in `state === "open"` with no data and no error forever.
- NOTE: Risk's Sortino / Calmar / Omega / VaR / CVaR / Max DD Duration are still mock and sit next to
  live values (Calmar and Omega both 8.34 gives it away) — misleading; reference shows none of them.

### Fixes applied (2026-08-10, same session) — tsc + eslint clean, 81/81 vitest, browser-verified
Scope chosen by the user: stream-first for live runs (BUG-1/2/3/6/7) + seed day one at 0.
- ✅ **BUG-1** `results-tab.tsx` drops `selectedRun` when `strategyId` changes, so the picker
  re-announces the new strategy's newest run instead of the views querying the previous one.
- ✅ **BUG-2** `mergeLiveSummary` now returns the frame's fields on their own when `/summary` is
  missing (the normal live case), instead of `undefined`. The four REST-only fields
  (`artifact_root`, `cost_bps`, `edge_gross_bps`, `edge_net_bps`) are simply absent — call sites in
  `overview-view.tsx` that assumed "summary non-null ⇒ field present" were made null-safe. One of
  them (`edge_net_bps.toFixed`) crashed the page on the first browser run and is now covered.
- ✅ **BUG-3** frame `equity` parsed into `EquityPoint[]` and preferred over `/equity-curve` via
  `preferLiveEquity`, used by Overview / Performance / Risk. Empty-state notes reordered so a REST
  error never labels a chart that is drawing live data. `symbols` is parsed too (`LiveSymbolPnl`),
  not yet rendered — the PnL-attribution table is BUG-4, still open.
- ✅ **BUG-6** the stream reconnects on a 2s fixed backoff (as the reference does); 401/403/404 are
  treated as terminal and stop the loop rather than hammering.
- ✅ **BUG-7** new `useRun` + `symbolNamesOf` read the run manifest (200 even mid-run) and the map
  is threaded through `LiveSnapshotProvider`, so live fills read `BTCUSDT`, not `#0`. Live fills
  now also show up in Trading history / CSV export via `mergeLiveTrades` (dedupes by the shared id).
- ✅ **Day-one seeding** `toDailyPnlPoints` measures day one from a 0 prior close instead of
  dropping it (equity IS cumulative realized PnL, so 0 is the true prior close — same convention as
  `toDrawdown`). `toWeekdayPnl` now derives from it so both agree. Tests updated: `equityStats`
  counts N days rather than N-1, a single-day curve is no longer empty.
- **Verified in Chrome on the live run `#34e4ebf001`** (was 100% blank before): Net PnL -736,904
  USDT / -736.90%, Sharpe -44,815.32, Cost Drag 737,128 USDT, a real equity + drawdown curve,
  Trading Days 1, Total Trades 2,501,884, Trading history listing BTCUSDT fills. Performance renders
  Gross +226 / Net -737,131 with a populated Aug-2026 Monthly Return cell, PnL By Month and the
  Daily Return Distribution. Risk renders the Drawdown chart and a live Rolling Sharpe. No console
  errors.
- STILL OPEN: BUG-4 (PnL attribution table), BUG-5 (`orderbooks`), BUG-8 (proxy grace path masks
  upstream errors as an empty 200 stream — now papered over by the reconnect, so a permanently
  failing upstream retries every 2s instead of surfacing). Risk's Sortino / Calmar / Omega / VaR /
  CVaR / Max DD Duration are still mock next to live numbers.
- NOTE (pre-existing, untouched): `risk-view.tsx` trips `react-hooks/purity` on a `Date.now()` call
  inside a `useMemo` (confirmed present before these changes). Risk's Drawdown chart in "%" mode
  reads flat at 0% for an all-underwater run because `toDrawdown` seeds its peak at 0 — that's the
  documented backend-aligned behaviour; the "$" toggle shows the real shape.
