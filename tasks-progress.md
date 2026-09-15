# Tasks progress

Mirrors `user-tasks.md`. Status: ✅ done · 🔄 in progress · ⬜ todo
NOTE: re-read `user-tasks.md` at the START of every task AND before stopping (user edits it live, adds tasks mid-work). Remove items the user removes.

## Tasks
All four items currently in `user-tasks.md` are DONE — see the sections below:
- ✅ Big task: global HFT/MFT switch + HFT Create Strategy 3-tab redesign (Samples / Features / Results) → "Global HFT/MFT lab switch (2026-07-15)"
- ✅ Features tab UI match vs Figma 14567-26137 → "Follow-ups (2026-07-15)"
- ✅ Features: focus-aware primitive Add → "Follow-ups (2026-07-15)"
- ✅ Symbol select → search input with dropdown → "Follow-ups (2026-07-15)"

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

## Pending-backtest poll + Max Position (2026-09-03) — tsc + eslint clean, 157/157 vitest, browser-verified
Two tasks handed over as screenshots (not in `user-tasks.md`).
- ✅ **Poll a queued backtest** (`hooks/api/use-runs.ts`, `create-strategy/results-tab.tsx`) — `useRun` re-reads `GET /api/runs/{id}` every 5s (`PENDING_RUN_POLL_MS`) while the record is `status: "pending"` AND `mode: "backtest"` (`isPendingBacktest`); paper/live runs are excluded, they publish `/live/stream`. The Results tab enables the query for a pending backtest, adopts the fresher record over the picker's snapshot (render-phase sync), keys the view container on `id:status` so the six views refetch when the run finishes, and writes the new status into the `["strategy-runs"]` cache so the picker row stops badging "Pending". **Verified in Chrome** with the API doubled at `window.fetch` (no pending backtest existed to observe, and launching one writes to the dev API): 6 polls at ~6s spacing while pending → exactly ONE more request after the record flipped, then silence; picker row went Pending → Success and the KPI/summary block populated. Note React Query pauses interval refetches while the tab is hidden — correct, but it means the poll only runs on a visible tab.
- ⚠️ **Scope note:** the user chose "poll strictly while `pending`". The Backtesting list shows backtest runs sitting in `running` (e.g. `#01a06817-34c0`), so a backtest that goes pending → running → completed stops being polled at `running`. Widening `isPendingBacktest` to also cover `running` is a one-line change if that turns out to be the common path.
- ✅ **Max Position in Results** (`create-strategy/overview-view.tsx`) — `RunSummary.max_position` added to the Equity Curve stats strip (10th cell, after Fill Rate). Rendered as a quantity (`fmtQty`: 4 decimals under 1, else 2) with no currency suffix. Needed `npm run gen:types`: the checked-in HFT spec predated `max_position`, `avg_holding_time_secs`, `longest_recovery_days` and the `max_consecutive_*` fields. **Verified in Chrome** on completed backtest `#01a0680f-32b8` → "Max Position 1.00".
- NOTE (pre-existing, untouched): `GET /api/runs` returns duplicate run rows (`01a06656-7ccf` three times), so the Backtesting table logs a React duplicate-key warning. Also, the regenerated spec no longer documents `GET /api/runs/{id}/live` (the non-stream cached snapshot) that `hooks/api/use-run-live.ts` still calls.

## Sharpe / Return % / Max DD % range filters on the run lists (2026-09-04) — tsc + eslint clean, 164/164 vitest, browser-verified
- ✅ **Shared control** (`components/metric-range-filters.tsx` + 7 unit tests) — `MetricRangeFilters` renders the three label + Min–Max pairs from the design; `matchesMetricRanges` is the predicate. Bounds are held as strings so a half-typed "-" doesn't collapse to 0. A row whose metric is still null drops out as soon as that metric is bounded. Max DD compares by MAGNITUDE ("0 – 5" = drew down at most 5%, since the column always renders negative) and accepts the bounds in either sign/order.
- ✅ **Wired into all four run lists** — Backtesting (`strategies/page.tsx`), Paper Trading, Live trade, Alpha pool. Client-side, like the symbol filter: `GET /api/runs` has no metric filter. Each filter row got `flex-wrap` so the added controls wrap instead of overflowing; changing a bound resets to page 1. Alpha pool reads the member's source run, so a member promoted without one drops as soon as any bound is set.
- ✅ **Duplicate rows fixed at the source** (`hooks/api/use-runs.ts` `fetchRuns`) — `GET /api/runs` returns the same run several times (dev: one id three times), which collided React's row keys; with colliding keys React left GHOST ROWS behind after a re-render, so filtered lists showed rows that didn't match the bounds. `fetchRuns` now keeps the first copy of each id. This also removes the duplicate-key console error noted last session.
- **Verified in Chrome** against the real dev API: Backtesting Sharpe ≥ 1 → only rows ≥ 1.16 (≥ 1000 → empty state); Return % ≥ 0.5 → only rows ≥ +0.65%; Max DD % ≤ 0.3 → only |MDD| ≤ 0.30% and no "—" rows. Paper Trading Sharpe ≥ 0 → 119.25 / 0.00 / 0.00 (negatives and the null row gone). Alpha pool's run-less member disappears once a bound is set. No console errors.
- **NOT applied to Strategy List** — its columns are Stage/Version/Promoted; it carries no Sharpe/Return/Max DD, so the filters would have nothing to read there.
- Live trade renders the controls but the dev API currently has no live runs, so its filtering is covered by the shared unit tests rather than observed on that page.
- ✅ **Backtesting list polls only while a pending run is loaded** (`hooks/api/use-backtest-runs.ts`) — `refetchInterval` returns 5s only when the query's own rows contain `status === "pending"`, else `false`. The gate reads the whole loaded list for that query key (server-side `q`/`status` narrowing included), not just the visible page — paging is client-side over the same data. **Verified in Chrome:** no pending row → 0 requests in 10s; one row forced pending → 4 requests at ~6s spacing; pending removed → exactly ONE more request, then silence for 18s. (`document.visibilityState` had to be spoofed for the check: React Query pauses interval refetches on a hidden tab, which is the behaviour we want in production.)

## Pagination: ellipsis window + jump-to-page popup (2026-09-09) — tsc + eslint clean, 206/206 vitest, browser-verified
Handed over as a screenshot (not in `user-tasks.md`): a 17-page list was rendering all 17 numbers.
- ✅ **Shared `components/table-pagination.tsx`** — `pageItems(current, count)` (moved out of `strategy-list/page.tsx`, unchanged: seven slots, `1 2 3 … 8 9 10` at the ends, `1 … 4 5 6 … 10` in the middle), `PageJump` (the `…` is now a button opening a Popover with a number input + Go; Enter submits, Go is disabled until the value is an integer in `1–pageCount`, the input is held as a string and cleared on close), and `TablePagination` — the Previous / numbers / Next block that was duplicated verbatim in four pages.
- ✅ **Four run lists collapsed to one line each** — Backtesting (`strategies/page.tsx`), Paper Trading, Live trade, Alpha pool each dropped their ~35-line `<Pagination>` block for `<TablePagination currentPage pageCount onPageChange={setPage} />`. They all listed every page before, which is what the screenshot showed.
- ✅ **Strategy List** keeps its own bespoke markup (white active pill, `justify-between`) and now imports the shared `pageItems`; its inert `<span>…</span>` became `<PageJump>`.
- **Verified in Chrome** against the real dev API: Backtesting (17 pages) renders `Previous 1 2 3 … 15 16 17 Next`; clicking `…` → "Go to page (1–17)" popover → typed 9 + Enter → page 9 loaded, pager became `1 … 8 9 10 … 17`, rows changed. Strategy List (8 pages) → `…` → "Go to page (1–8)" (popover flips above the pager near the viewport bottom) → typed 5 + Go button → page 5, pager `1 … 4 5 6 … 8`. No console errors.
- NOTE (pre-existing, untouched): `PaginationEllipsis` in `components/ui/pagination.tsx` is shadcn boilerplate and is not used by any page — left in place.

## HFT/MFT filter on every runs list (2026-09-09) — tsc + eslint clean, 206/206 vitest, browser-verified
- ✅ **Shared `components/strategy-type-filter.tsx`** — `StrategyTypeFilter` is a Select with **All types / HFT / MFT** (`StrategyTypeFilterValue`), styled like the neighbouring symbol/status pills. The all-option is labelled "All types" rather than bare "All" to read with "All symbols" / "All status" beside it. No new data was needed: rows already carry `PaperRunRow.strategyType`, which is what the `StrategyTypeBadge` in each table renders.
- ✅ **Wired into all four run lists** — Backtesting (`strategies/page.tsx`), Paper Trading, Live trade, Alpha pool. Client-side like the symbol and metric filters; `GET /api/runs` has no engine filter. Placed before `MetricRangeFilters` in each filter row; changing it resets to page 1.
- ✅ **Alpha pool run-less members** — an explicit HFT/MFT pick is a positive claim about the engine, so a member promoted without a source run drops out of it (the metric-bounds rule), unlike the market tab which keeps such members visible everywhere.
- **Verified in Chrome** against the real dev API: Backtesting All = 17 pages of mixed rows → MFT = 11 pages, every row MFT-badged → HFT = 7 pages, every row HFT-badged. Paper Trading MFT → "No paper strategies found." (the dev API's paper runs are all HFT — correct empty state). Alpha pool's single run-less member ("Diep Test") disappears on HFT. No console errors.
- Live trade renders the control but the dev API still has no live runs, so its predicate (identical one-liner to the other three) is code-verified rather than observed on that page — same gap noted for the metric range filters.
- NOTE: this is independent of the sidebar's global HFT/MFT lab toggle, which scopes Create Strategy and Strategy List only; the run lists have never read `useMode()`. If the two should agree, that's a separate decision.

## Server-side filtering + pagination on the run lists (2026-09-10) — tsc + eslint clean, 218/218 vitest, browser-verified
Handed over in chat: `/api/runs` grew a `mode` filter; move paging to the backend and stop pulling one
wide window into the browser. Confirmed against the live spec and `hft-platform@origin/develop`
(`4ad5858 add filter mode`): `GET /api/runs` now takes `page`/`size`/`status`/`q`/`asset_kind`/**`mode`**/
`symbol`/`sort_by`/`sort_dir` and inclusive `min|max_sharpe`, `min|max_return_pct`, `min|max_drawdown_pct`.
- ✅ **`gen:types` re-run** — the checked-in spec predated `mode`.
- ✅ **`RunsQuery` is now the API's own parameter set** (`hooks/api/use-runs.ts`) and `fetchRunsPage`
  serializes it without a mapping table. New `fetchRunRowPage` returns `{ rows, total }` — `total` is
  the filtered COUNT(*), which is what each pager measures itself against.
- ✅ **All three run lists page server-side** — Backtesting (`strategies/page.tsx`), Paper Trading, Live
  trade. Every toolbar control now goes to the server: search → `q`, status / Only Running → `status`,
  market tab → `asset_kind` (`assetKindOf` in `components/market-tabs.tsx`), symbol → `symbol`, the three
  metric bounds → `min|max_*`, page/rows-per-page → `page`/`size`. Nothing is narrowed in the browser.
  The search box and the metric boxes are debounced so a keystroke isn't a request.
- ✅ **Percent → fraction conversion** (`metricRangeParams`, `components/metric-range-filters.tsx` + 5 new
  tests) — the server stores `return_pct` and `max_drawdown_pct` as FRACTIONS (`net_pnl / starting_capital`)
  and `max_drawdown_pct` as a positive magnitude, so the percent boxes are divided by 100 and Max DD is
  taken by magnitude and reordered. Sharpe is a bare ratio and passes through.
- ✅ **Id search moved to the server** — `q` now matches strategy name OR run id, so the `isIdQuery`
  client-side split is gone from the run lists; `runSearchQuery` (`lib/utils.ts` + 3 tests) only strips the
  leading `#` the tables print. `isIdQuery` stays for Strategy List, which still filters in the browser.
- ✅ **Deep links survive paging** — `useSelectedRunRow` fetches `?run=<id>` by id when that row isn't on the
  loaded page (it used to be found by scanning the whole window). No fetch while the row is on screen.
- ✅ **Live trade KPIs counted by the server** (`useLiveRunCounts`) — three `size=1` calls read `total` for
  all/running/paused in the current market tab. Cumulative PnL joins Daily PnL and Net Exposure as an
  explicit "—": summing PnL needs every live run and `/api/runs` totals none of them.
- ✅ **HFT/MFT filter dropped from the three run lists** (user's call) — the API has no engine/data_kind
  parameter, so applying it after a server page would give short pages and a wrong total. The HFT/MFT badge
  stays on every row, and Alpha pool keeps the control (it pages over promotions, not runs).
- ✅ **Symbol filter is now catalog-backed** (`components/symbol-filter.tsx`) — a searchable popover over the
  instrument catalog, scoped to the market tab, capped at 100 rendered matches. Options derived from the
  loaded rows would only ever describe the current page.
- ✅ **The aggregate route survives, narrowed in purpose** — `app/hft/api/runs/aggregate/route.ts` is no
  longer on any list's path; it serves the two readers that consume runs as a SET (Alpha pool's
  promotion→run join, the Risk screen's running-run lookup), which would otherwise miss anything past row 200.
- **Verified in Chrome against the real dev API:** Backtesting went from 17 client-side pages to **120**
  server pages (`total` 1200 vs the ~170 the 1000-row window could reach — most of the list was invisible
  before). Crypto tab → `asset_kind=crypto`, 16 rows, every row BTCUSDT/Crypto. Symbol popover filters the
  catalog live (`BTCUSD` → BTCUSD/BTCUSD1/BTCUSDC/…) and picking BTCUSDT narrows the table to 2 pages.
  `#01a08980-7a66` in the search box returns exactly that one run. Sharpe ≥ 1 → 30 pages, all ≥ 1.00.
  Return % ≥ 10 → 31 pages, all ≥ +10.01% (proves the /100). Max DD % ≤ 8 → 24 pages, all |MDD| ≤ 8 and no
  "—" rows. Paper Trading 7 pages. Live trade: 8 live runs on dev now, Active Strategies reads 0/8 from the
  count queries and Only Running correctly empties the table while the card keeps describing the tab.
  Alpha pool unchanged. No console errors, no duplicate-key warnings.

### ⚠️ UPSTREAM BUG found while verifying — `GET /api/runs` fans out per sample_scope
The long-known "duplicate run rows" (one id three times) now has a root cause, and server-side paging is
what makes it visible. `crates/api/src/routes/runs/crud.rs:96` joins
`LEFT JOIN run_summary rs ON rs.run_id = sr.id` with no scope predicate, but migration
`0034_run_result_sample_scope.sql` changed `run_summary`'s primary key from `(run_id)` to
`(run_id, sample_scope)` — up to three rows per run (`in_sample` / `out_of_sample` / `all`). So a run whose
split backtest has been materialized is emitted up to 3× in both the page and its paired `COUNT(*)`.
The doc comment above the function still calls it a "cheap PK-indexed join", which was true before 0034.
Observed: Backtesting page 1 renders 7 of 10 rows after our id-dedupe, and `01a0892c-2871` is both the last
row of page 1 and the first row of page 2. Live trade reports 8 live runs and renders 5.
Three consequences: short pages, an inflated `total` (so page counts and Live trade's "0/8" denominator
overstate), and metric filters that can match on a scope other than the one displayed —
`attach_summary_metrics` fills the row's Sharpe/Return/MaxDD from `SampleScope::InSample`, while the filter
compares against every scope's row.
Fix is one predicate on the join, in the HFT repo: `AND rs.sample_scope = 'in_sample'` (matching what the
list displays). NOT applied here — different repo, not asked for.
Our client-side dedupe-by-id stays either way: React needs unique row keys.

### Not carried over
- **`sort_by`/`sort_dir` are unused.** The API sorts by `created_at desc` by default, which is what the
  tables showed before; no column header on these lists is clickable, so nothing asked for it.
- **Strategy List** still filters and pages in the browser — it lists XALPHA strategies, not runs.

## Mock chart data removed + /summary and /volatility-regime wired everywhere (2026-09-10) — tsc + eslint clean, 230/230 vitest, browser-verified
Two asks in one pass: stop drawing invented data on the unwired charts, then re-audit
`GET /api/runs/{id}/summary` and `GET /api/runs/{id}/volatility-regime` field by field and wire
everything they actually serve. Audit method: enumerate the schema fields from `types/api/hft.ts`
and grep the whole app for each one — 23 of RunSummary's 44 fields were unread, and 6 of the
volatility-regime fields.

### Invented data removed
- ✅ **Capacity Curve** (`cost-capacity-view.tsx`) — a hand-written Sharpe-decay formula
  (`3.5 - 2.9x³ + sin`) over fake `1M…60M` capital buckets. Now an explained empty state; the
  inert metric pill that "controlled" it went with it.
- ✅ **Slippage Distribution + Latency Distribution** (`execution-view.tsx`) — a fabricated bell
  curve and a fabricated right-skewed one. Both are empty states now, and their inert All/Maker/
  Taker pills are gone.
- ✅ **Four invented Execution metrics** — `Avg Latency 1.82 ms`, `Slippage (Avg) -0.38 bp`,
  `Slippage (Std) 0.72 bp`, `Market Impact -0.64 bp` were hardcoded constants sitting beside the
  real trace-derived fill-rate figures and reading exactly like them.
- ✅ **Six invented Risk ratios** — `Sortino 4.56`, `Calmar 8.34`, `Omega 8.34`,
  `Max DD Duration 2d18h`, `VaR -6,530`, `CVaR -9,350`. Worse than recorded: `Sharpe 3.12` and
  `Max Drawdown -4.10%` were ALSO constants, overwritten only when a live snapshot existed — so a
  finished run showed eight invented numbers, not six.
- A metric with no source now renders muted with the reason on hover (`unavailable`), rather than a
  bare dash that looks like a loading state.

### Newly wired from `/summary`
- ✅ **HFT Risk ratio card** — Sharpe, Sortino, Calmar, Max Drawdown, Max DD Duration, VaR, CVaR all
  read the summary (`sortino_annualized ?? sortino`, `calmar`, `max_drawdown_duration_days`,
  `var_95`, `cvar_95`), merged with the live frame for the two fields it publishes. **Omega is the
  one ratio the API does not compute** and is the only dash left. VaR/CVaR also picked up the run's
  own settlement currency — the card had `USDT` hardcoded and was printing it against VND runs.
- ✅ **HFT Overview strip** — `MDD Duration` (was permanently dashed).
- ✅ **HFT Execution** — `Slippage (Avg)` from `slippage_bps`; `Fill Rate` falls back to
  `summary.fill_rate` when the run journaled no trace (every backtest).
- ✅ **MFT Overview strip** — `MDD Duration`, `Fill Rate`.
- ✅ **MFT Execution** — `Avg Holding Time` (`avg_holding_time_secs`), `Trades < 6h`,
  `Overnight Trades`, `Fill Rate`, `Slippage (Avg)`. NOTE both `*_trades*_pct` fields are FRACTIONS
  in [0,1] despite the `_pct` suffix.
- ✅ **MFT Risk** — `Max DD Duration`, `Max Consecutive Days` (+ the streak's PnL as its sub-label).
- ✅ **`useMftResultsSource` now returns the raw `summary`** — `StrategyPerformanceDetail` (the XALPHA
  shape both feeds converge on) has no slot for these run-only fields, so the panels read them
  directly. Undefined on the XALPHA path, where they genuinely do not exist.

### Newly wired from `/volatility-regime`
- ✅ **Regime breakdown table** — the `Win rate` column was hardcoded `EMPTY` and `Trades` was
  showing `days_traded` under a comment saying no trade count existed. Both `win_rate` and `trades`
  are on `VolRegimeBucket` now (added upstream with `#[serde(default)]`), and both are wired.
  **Verified:** 82 + 665 = 747 trades against the summary's `total_trades` 753 — the 6 missing fall
  on ATR-warmup days the endpoint drops (`days_dropped_no_atr`).

### `oversized` — the API's own placeholder flag, now honoured
- ✅ `RunSummary.oversized` marks a run whose parquet artifacts were too large for the result
  service to load. The API still answers **200**, but every other field on the body is a
  zeroed/`None` PLACEHOLDER, not a computed value — so rendering it prints a confident `0.00`
  Sharpe and `0` drawdown for a run that may have done anything. `realSummary()`
  (`hooks/api/use-runs.ts`, 4 unit tests) drops such a summary, and every panel falls back to its
  ordinary "no data" state. Applied in HFT Risk, HFT Execution and the whole MFT feed.

### ⚠️ UPSTREAM BUG — `longest_recovery_days` returns an epoch-day, not a span
Found while wiring MFT Risk. On run `01a08924-c639` (spans Jan 2020 → Aug 2026, ~2,420 days),
`/summary` returns `longest_recovery_days: 18291.17`. That is 50 years inside a 6.6-year run, and
18,291 days after the unix epoch lands in Jan 2020 — the run's own start date. The field carries an
absolute epoch-day rather than a difference. Wiring it rendered "18291d4h", so **Longest Recovery
was left on its local derivation** with a comment; wire it once upstream returns a span.
`max_drawdown_duration_days` from the same payload IS a real difference (1685.88d inside that run,
6.13d on the HFT run) and is wired.

### Still unsourced — stated in the UI, not invented
Omega Ratio · Avg Latency (engine telemetry, live-only, on the Latency tab) · Slippage (Std) ·
Market Impact · Max Capacity · Return/Turnover · Top-3 Hours · Profit/Tick Ratio · After-Fee Buffer ·
Slippage + Latency + Holding-time + Exit-reason distributions (all per-fill; no endpoint returns
individual fills) · PnL by session hour. `days_dropped_no_atr` / `total_pnl_pct` /
`mean_daily_pct` / `std_daily_pct` / `pnl_pct` on the regime payload have no slot in the design.

### Verified in Chrome against the real dev API
- HFT run `#01a08980-7a66` (VND, 9,272 trades) → Risk reads **Sharpe 56.43 · Sortino 119.74 ·
  Calmar 424.58 · Omega — · Max DD -42.82% · Max DD Duration 6d3h · VaR 101,100 ₫ · CVaR 129,009 ₫**,
  all previously invented constants. Overview strip MDD Duration 6d3h agrees with the Risk tab.
  Cost & Capacity draws its three real panels and states the Capacity Curve.
- HFT run `#01a0892c-2871` → Execution shows Slippage (Avg) 0.00 bp, Avg Latency/Slippage (Std)/
  Market Impact muted dashes, and both distributions as explained empty states.
- MFT run `#01a08924-c639` → Execution: Avg Holding Time 35m (2073.7s), Fill Rate 100.0%,
  Slippage 0.00 bp, Trades<6h and Overnight dashed (the API returns null for both on this run).
  Risk: Max DD Duration 1685d21h, Max Consecutive Days 20 (-2.16% total). Regime: Win rate
  25.6%/28.3%, Trades 82/665. No console errors on any of them.
- Payload cross-checked directly by intercepting `/summary` in the page, so every figure above was
  matched against the raw JSON rather than eyeballed.

### Notes
- `pctFromRatio` signs its output (`+100.0%`), which is wrong for a share of a whole. Added
  `shareFromRatio` for fill rate / win rate / trade-share, and used it in all four places.
- `formatDurationDays` lives in `lib/utils.ts` — three screens needed the same `2.75 → 2d18h`.
- `ChartCard.children` is now optional: a panel whose source does not exist has only a state.
- `execution-mft`'s standing "nothing here has a source" note is now conditional — it contradicted
  the panel once four of its metrics started rendering.
- PRE-EXISTING, not investigated: opening **Execution** on the 9,272-trade HFT run froze the
  renderer (the `/trace/history` fetch + render). Reproduced twice; unrelated to these changes,
  which only REMOVED two charts from that view. Verified Execution on a smaller run instead.

## HFT/MFT filter restored server-side + KPI value ellipsis (2026-09-14) — tsc + eslint clean, 230/230 vitest, browser-verified
- ✅ **HFT/MFT filter back on the three run lists** — reverses the 09-10 "dropped" item above. The deployed
  dev spec (`hft-dev.xnoquant.io/openapi.json`) and `hft-platform@origin/develop`
  (`crates/api/src/routes/runs/crud.rs`) now take `engine=hft|mft` on `GET /api/runs`: `hft` matches
  tick/L2 `data_kind` (or unset on older manifests), `mft` matches bar. The server filters before paging,
  so `total` and the page count stay correct, which was the reason for dropping it.
  - `RunsQuery` gained `engine?: "hft" | "mft"` (`hooks/api/use-runs.ts`), added by hand; `gen:types` was
    NOT re-run to avoid unrelated churn, so `types/api/hft.ts` still lacks the param.
  - `engineOf()` in `components/strategy-type-filter.tsx` maps All types/HFT/MFT → `undefined`/`hft`/`mft`,
    mirroring `assetKindOf`.
  - Backtesting and Paper Trading: control after the status Select. Live trade: after the symbol filter
    (that page has no status Select). All three reset to page 1 on change; `engine` rides in the query key.
  - Live trade KPI counts (`useLiveRunCounts`) take `engine` like `asset_kind`, so the tiles describe the
    same set as the table.
  - Alpha pool unchanged (still client-side over promotions).
- ✅ **MFT Overview KPI value truncates** (`create-strategy/mft/overview-mft.tsx` `KpiCards`) — a long Net PnL
  (`+204,626,563…`) spilled into the Sharpe card. Value span is now `min-w-0 truncate` with `title` for
  the full number; unit is `shrink-0`.
- **Verified in Chrome against the real dev API:** Backtesting → HFT: every row HFT-badged, 38 server pages,
  last `/api/runs` call carries `engine=hft` and `page=0`. Live trade → HFT: KPI tile 0/8 → 0/3, `engine=hft`
  on the list call and all three count calls. KPI card: long value clips to `+204,626,56…` inside its own
  card (`clientWidth` 128 < `scrollWidth` 153).
- NOTE (not changed): Performance view's `SummaryMetricCell` (`create-strategy/performance-view.tsx:84`) has
  the same un-truncated value span and could overflow on a very large PnL.
- ✅ **Type filter is now a colored switch** (user's pick: All | HFT | MFT) — `StrategyTypeFilter`
  body swapped from a Select to a segmented switch styled after `MarketSwitch` (`simulate-modal.tsx`): All
  neutral (`bg-secondary`), HFT green `#67e1c1`, MFT purple `#7b61ff`; `role=group` + `aria-pressed`. Same props, so
  all four callers (incl. Alpha pool) pick it up. Verified in Chrome on Backtesting: each segment lights in its
  color and sends `engine=hft` / `engine=mft` / no engine, from `page=0`.

## Live stream "running but no live data" (2026-09-14) — NOT fixable in this repo; upstream sends nothing
- Reproduced on two running MFT paper runs (`01a09e5d-2c31…`, `01a09dd3-b4f9…`): every live KPI reads "—"
  because the snapshot never arrives. The stream delivers no byte beyond our proxy's own `: connected` line:
  no data frames and no axum keep-alive comment (15s default) over 26s+.
- Checked and ruled out in this repo: the client parser/reconnect (`hooks/api/use-run-live-snapshot.tsx`) and the
  proxy passthrough (`app/hft/api/runs/[id]/live/stream/route.ts`). Ruled out in hft-platform: nginx
  (`proxy_buffering off`) and compression (no such layer in `crates/api`).
- The Network tab's 200 is the proxy's placeholder answer after `HEADER_GRACE_MS` (1.5s), NOT proof the upstream
  answered. The first-attempt 503 is the upstream's own status, forwarded at `route.ts:44`; nothing in
  `crates/api` returns it, so it comes from infra in front of the API (unverified).
- Unauthenticated or invalid-token requests get a 401 in ~0.1s, so the stall is on the authenticated handler path.
  Suspects (hft-platform `origin/develop`): `crates/api/src/routes/runs/live.rs:47` (`load_run`),
  `crates/api/src/result/live.rs:83` (Redis pubsub connect), or infra in front of `hft-dev.xnoquant.io`.
- Next step needs credentials/backend access: `curl -N` the upstream stream with a valid token to see whether
  keep-alives arrive, plus server logs for `live_stream`.
- ✅ Separate fix kept: `usePaperRuns` re-reads every 5s while a loaded row is running. `/live/stream` carries no
  status, so a run that stopped on its own left an open panel on "Running" forever. The poll wasn't seen firing
  in the browser (the automation tab reports `visibilityState: hidden`, which pauses `refetchInterval`).

## Pinnable strategy tabs on Create Strategy (2026-09-14) — tsc + eslint clean, 244/244 vitest, browser-verified
- ✅ **Hover a tab → outline pin; click → pinned** (user's pick: front + always visible). Pinned tabs lead the strip
  in pin order, so they sit in the leading run the fit logic keeps on-screen, not in "+N". A pinned tab shows a
  bold `text-primary` Solar `Pin`. Unpinning puts the tab back in its `created_at` place. × still works.
- ✅ **Per-account localStorage** — new `store/pinned-editor-store.ts` (zustand `persist`, key
  `xnoquant-pinned-editors`), `byUser: { [userId]: pinnedIds[] }`. `userId` comes from `useAuth()` (`/me`); while it's
  undefined no pin button renders and nothing is written. Strategy ids are unique across labs, so one list per
  account covers both. Stale ids are ignored at render.
- ✅ **`EditorsBar` only** (`page.tsx` untouched): a memoized `ordered` (pinned first) feeds the measuring copy, the fit
  effect, `visible`/`hidden` and the "+N" picker. The selector falls back to a module-level `NO_PINS`, because a fresh
  `[]` loops under zustand 5's useSyncExternalStore ("Maximum update depth") — caught in review before it shipped.
- **Verified in Chrome:** hover shows the outline pin beside ×; pinning the 3rd tab moved it to the front with a
  filled pin, stored under the signed-in user id; it survived a reload; unpin restored its place. With the pin
  held only by a fake second account id, this account's strip showed no pins. No console errors. Test state
  removed afterwards.

## "Started" column on every run list (2026-09-14) — tsc + eslint clean, 250/250 vitest, browser-verified
- ✅ **Started, just before Action**, on Backtesting, Paper Trading, Live trade and Alpha pool. Shows
  `Run.started_at` — the same field the HFT control plane's Runs list uses for "Started" — as `yyyy-MM-dd` over
  `HH:mm:ss` in local time. "—" when null (a queued run) or when an Alpha pool member has no source run.
- ✅ Data: `PaperRunRow.startedAt` (optional) set in `toPaperRunRow`. Shared cell: `components/started-at.tsx`.
- ✅ **Widths:** Started takes 8% in each table. The first pass took it from Strategy Name, which crushed names to
  "VW…" on Paper Trading and Live trade, so Strategy Name went back to its original width (Paper 12%, Live 15%,
  Alpha pool 14%) and the 8% came from columns with slack (Return, Sharpe, Action, PnL chart; Alpha pool's Note).
  Backtesting keeps Strategy Name 15% / Symbol 12%; names still read there.
- **Verified in Chrome:** the column renders on Backtesting, Paper Trading and Live trade with real start times. No
  header wraps (including "Max drawdown" on the narrower Live trade table). No Return or Started cell overflows.
  Names are readable again. No console errors. Alpha pool is empty on dev, so its table was code-verified only.

## Lark "Not yet started" triage (2026-09-15) — HFT base, Task list view, 18 records
Source: the user's Lark Base (Task Breakdown → Task list, Status = Not yet started). Read-only; nothing in the
base is edited from here (one accidental blank row was inserted while probing the grid and undone at once —
count re-checked at 18).
- ✅ F-004 Start live trading (Alpha pool → Live trade) — already built (`StartLiveTradingDialog`, T9 above).
- ✅ F-053 / F-055 Filter strategy list by owner — already there ("All owners" on Strategy List).
- ✅ F-068 Started time — shipped 2026-09-14 (467b959).
- ✅ F-054 Execution tab metrics, F-062 IS/OS/All missing, F-065 Cost & Edge / Regime charts — see
  "Run-detail charts wired to /risk-detail, /execution-detail, /symbol-pnl" below.
- 🔄 F-060 No live latency / live trades — PARTIAL. Reproduced on running paper run `01a09e5d-2c31`: our proxy
  gets 503, then a grace-path 200 that carries only `: connected` and never data (55 s+), so the client never
  reconnected; hft-dev direct gets 200 + data at once. Survives a dev-server restart. Fixed our half: the proxy
  (`lib/sse-proxy.ts`, shared by the live / trace / orderbook stream routes) now aborts the upstream on client
  cancel and gives up after 20 s, and the client has a 20 s idle watchdog — verified the stream now cycles
  (503, 200, 200, …) instead of freezing. STILL no data through our proxy for that run: unauthenticated Node
  probes always get a fast 401 (no 503, no hang), and the app has no 503-mapping error, so the refusal happens
  only on the authenticated path, above the app (ingress) or in its unbounded auth call — backend
  `crates/api/src/lib.rs:267` builds the `reqwest::Client` with no timeout and `AuthUser` awaits
  `AUTH_API_URL/me` on every request, which would hang the whole response before headers exactly like this.
  Needs an authenticated probe or the backend team.

## Run-detail charts wired to /risk-detail, /execution-detail, /symbol-pnl + IS/OS/All on MFT (2026-09-15) — tsc + eslint clean, 270/270 vitest, browser-verified
Compared our run detail with hft-dev.xnoquant.io on MFT backtest `01a0a047` (#4309) and HFT backtest
`01a08484`; every panel that had data there and not here came from `/risk-detail`, `/execution-detail`,
`/symbol-pnl` (never called) or `/summary` fields left unread.
- ✅ Data layer (4af9f53, 186bbd4): hand-written `RiskDetail` / `ExecutionDetail` (the deployed OpenAPI lists
  both paths but never defines the schemas), three hooks, pure transforms with tests. `run-as-mft`'s
  `total_fee` was `cost_bps / 10000` (cost per NOTIONAL) — now `summary.total_fee / capital`.
- ✅ HFT: Execution distributions + Avg Latency / Slippage (Std) / Market Impact; Risk "Consecutive loss
  streaks" + "Top drawdowns"; Performance "PnL by session hour (UTC)"; Cost & Capacity "PnL attribution".
- ✅ MFT: Regime session-hour chart + Top-3 Hours; Execution Slippage (Std) + both distributions; Cost & Edge
  Cost Breakdown donut, Gross-to-Net middle rows, Cumulative cost & Gross PnL, Turnover, PnL attribution.
  Overview "Cost Drag" is now cost ÷ gross (was cost ÷ capital), matching Cost & Edge and the reference.
- ✅ IS/OS/All ("Period:" row, `?sample=`) now also on MFT runs, in Create Strategy Results and the run detail
  panel: one `useSamplePeriodRow` (`sample-period-row.tsx`, rule in `lib/sample-period.ts`) for all four
  places, `sample` threaded through `MftResultsView` → every MFT query. Before this, MFT runs never sent
  `sample`, so they silently showed IN-SAMPLE figures (server default).
- **Verified in Chrome vs the reference:** MFT IS/OS/All Net PnL +19,034,450 / −2,536,028 / +16,498,422,
  Sharpe 0.94 / −3.59 / 0.77, trades 146 / 7 / 153 — identical. Cost Breakdown 5,365,550 = Commission
  1,825,000 (34%) + Tax 3,540,550 (66%); Gross→Net +24.40 / −1.83 / −3.54 / 0.00 / +19.03%; Cost Drag −21.99%
  (ref 22.0%). HFT Execution Avg Latency 14,169.07 ms, Std 0.68 bp, Market Impact −0.54 bp; Top drawdowns 1
  episode (−48,007,243, −4.80%); PnL attribution Signal −28,475,000 / Spread +31,255,000 — all match.
- NOTE: HFT "Slippage (Avg)" still reads `summary.slippage_bps` (0.00 bp, unsigned round-trip); the reference
  shows `execution-detail.slippage_avg_bps` (0.79 bp, signed per-fill). Left as is — different metrics.
- ⛔ F-067 PnL curve in run list — blocked: `pnl_sparkline` exists neither in the deployed OpenAPI `Run` schema
  nor on any hft-platform branch.
- ⬜ F-056 Paper list: Stop a running run + Demote a stopped one (Action cell has only Promote today).
- ⬜ F-058 Backtest list "Start paper trading" is a log-only stub (`backtest-runs-table.tsx`); launching paper
  needs the strategy in the paper basket (`launchMode`).
- ⬜ F-063 MFT Overview "Yearly Summary": only CAGR is filled; Sharpe / Max DD / Profit factor / Calmar blank.
- ⬜ F-064 Gross Return row blank in Yearly Statistics.
- ⬜ F-057 Best / Worst / Positive months — reference derives them from equity points (`pnl-buckets.ts`).
- ⬜ F-066 Remove the sidebar HFT/MFT toggle, move it into a filter (only the sidebar and Create Strategy read it).
- ⬜ F-069 MFT Equity Curve: drop the chart's own All/1M/3M/1W pills — the Period filter above already scopes it.
- ⬜ F-046 Results by Month / Quarter / Year, max 5 years — `/periodic-summary` has no granularity param, so
  month/quarter buckets would come from the equity curve.
- ⬜ F-037 Orderbook for any symbol — core already works (whole catalog, any venue); the note asks for a
  venue → account → symbol picker on top.
