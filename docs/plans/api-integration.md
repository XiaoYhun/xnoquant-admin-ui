# API Integration — implementation plan (replace mocks with dev APIs)

Roadmap item **3. API Integration** — "Check out all API docs, start implementing them into all UIs."
Goal: replace the mock data behind every `hooks/api/*.ts` hook with the real dev APIs, **keeping `USE_MOCK` as a working fallback**. Auth is DONE (`lib/api-client.ts` auto-attaches `Bearer access_token`).

> Research basis: read all 6 hooks, all mock modules, `types/api/{auth,hft,xalpha}.ts` (OpenAPI-generated, authoritative for paths/params/schemas), every consuming page/component, and **verified the live dev APIs are reachable** (see §2).

---

## 0. TL;DR — the two things you must understand first

1. **There are TWO backends, and they behave differently.**

   | | HFT | XALPHA | AUTH |
   |---|---|---|---|
   | Base URL const | `HFT_API_URL` = `https://hft-dev.xnoquant.io` | `XALPHA_API_URL` (`/xalpha-api/v1`), `XALPHA_API_URL_V2` (`/v2`) | `AUTH_API_URL` (`/auth/v1`) |
   | Envelope | **NONE — raw payloads** | **`models.DefaultResponseModel` — unwrap `.data`** | same envelope (done) |
   | Domain | venues, accounts, **runs** (paper/live), symbols, thin Rhai strategies | research **strategies**, **stats/analytics**, **editors**, simulate, features/operators/samples (Python) | user/token (done) |
   | Type file | `types/api/hft.ts` | `types/api/xalpha.ts` | `types/api/auth.ts` |

   **Verified in §2:** an HFT list endpoint returns a bare JSON array; an XALPHA endpoint returns `{success, status_code, message, data, pagination}`. **Do NOT unwrap `.data` for HFT. Always unwrap `.data` for XALPHA/AUTH.** This single rule is the most common thing an implementer will get wrong.

2. **The current placeholder endpoints are partly wrong.** Every hook's real branch was stubbed against `HFT_API_URL`, but three of those paths **do not exist on HFT** (`/api/portfolios`, `/api/strategies/analytics`, and the `?mode=live|paper` filter), and the Strategy List / Create-Strategy screens are actually the **XALPHA** product (Python `StockAlgorithm` code — see `lib/mock/strategy-builder.ts` and `docs/plans/create-strategy.md`), not HFT's thin Rhai `Strategy`. This plan re-points those hooks and flags the ambiguous ones as decisions (§6).

---

## 1. Inventory — every data hook → UI → mock → current (placeholder) endpoint

| Hook (`hooks/api/…`) | Consumed by | Mock (`lib/mock/…`) | UI-expected type | Current placeholder call |
|---|---|---|---|---|
| `useVenues` | `venues/page.tsx` → `venue-list.tsx`, `new-portfolio-form` account lookups | `venues.ts` `MOCK_VENUES` | `Venue` (= HFT `Venue`) | `GET HFT /api/venues` |
| `useCreateVenue` | `venues/new-venue-form.tsx` | `index.ts createVenue` | in `{name, venue_type}` → `Venue` | `POST HFT /api/venues` |
| `useDeleteVenue` | `venues/venue-list.tsx` | `index.ts deleteVenue` | `id` → void | `DELETE HFT /api/venues/{id}` |
| `useAccounts` | `accounts/new-portfolio-form.tsx`, `strategies/start-paper-trading-dialog.tsx` | `accounts.ts` `MOCK_ACCOUNTS` | `Account` (= HFT `Account`) | `GET HFT /api/accounts` |
| `usePortfolios` | `accounts/page.tsx` → `portfolio-list.tsx` | `portfolios.ts` `MOCK_PORTFOLIOS` | `Portfolio` (UI-only) | `GET HFT /api/portfolios` **(404 — no such endpoint)** |
| `useCreatePortfolio` | `accounts/new-portfolio-form.tsx` | `index.ts createPortfolio` | `{name, sources[]}` → `Portfolio` | `POST HFT /api/portfolios` **(404)** |
| `useDeletePortfolio` | `accounts/portfolio-list.tsx` | `index.ts deletePortfolio` | `id` → void | `DELETE HFT /api/portfolios/{id}` **(404)** |
| `useLiveRuns` | `live-trading/page.tsx` → `live-runs-table.tsx` | `live-runs.ts` `MOCK_LIVE_RUNS` | `LiveRunRow[]` (denormalized) | `GET HFT /api/runs?mode=live` **(no `mode` param)** |
| `usePaperRuns` | `paper-trading/page.tsx` → `paper-runs-table.tsx` | `paper-runs.ts` `MOCK_PAPER_RUNS` | `PaperRunRow[]` (denormalized) | `GET HFT /api/runs?mode=paper` **(no `mode` param)** |
| `useTradeHistory(runId)` | `paper-trading/run-detail-panel.tsx` (Trades tab) | `paper-runs.ts getTradeHistory` | `TradeHistoryRow[]` | `GET HFT /api/runs/{id}/trades` (returns `TradePage`, not `TradeHistoryRow[]`) |
| `useStrategies` | `strategies/page.tsx` → `strategies-table.tsx` | `strategies.ts` `MOCK_STRATEGIES` | `StrategyRow[]` (denormalized) | `GET HFT /api/strategies` (HFT `Strategy` lacks most fields) |
| `useStrategyAnalytics` | `strategies/strategy-analytics.tsx` | `strategies.ts STRATEGY_ANALYTICS` | `StrategyAnalytics` | `GET HFT /api/strategies/analytics` **(404 — no such endpoint)** |

**Static mock (no hook — Create Strategy tabs):** `create-strategy/{features,operators,samples,data,results}-tab.tsx`, `editors-bar.tsx`, `toolbar.tsx`, `console-panel.tsx` all read `lib/mock/strategy-builder.ts` directly (FEATURES/OPERATORS/SAMPLES/RESULT_METRICS/YEARLY_ROWS/CORRELATION_ROWS/PNL_SERIES/INITIAL_EDITORS). No React Query. These get their own XALPHA hooks (§5.C).

**Mutation UIs that are currently pure stubs (no API call at all):**
- `strategies/start-paper-trading-dialog.tsx` — "Start paper trading" just closes the dialog.
- `paper-trading/start-live-trading-dialog.tsx` — hardcoded `DEMO_ACCOUNTS`, "Start live trading" just closes.
- `live-trading/live-runs-table.tsx` — "Stop Bot" / "Start Bot" buttons have **no `onClick`**.
- `create-strategy/toolbar.tsx` — "Simulate" button is a no-op; there is no "Save" button.
- `hooks/use-live-ticks.ts` — fakes a live feed by mutating the query cache every 1.5s (pure UI demo; the real live feed is SSE — see §6 GAP-9).

---

## 2. Verified facts (probed the live dev APIs)

```
401  https://hft-dev.xnoquant.io/api/venues              (exists, needs Bearer)
200  https://hft-dev.xnoquant.io/openapi.json            (title: "HFT XnoQuant API")
200  https://api.dev.xnoquant.io/xalpha-api/v1/ping
401  https://api.dev.xnoquant.io/auth/v1/countries       (exists, needs Bearer)
```
- **XALPHA `GET /xalpha-api/v1/ping`** returned:
  `{"success":true,"status_code":200,"message":"success","data":{...},"total":0,"page":0,"limit":0,"pagination":{"total_items":0,"total_pages":0,"current_page":0,"page_size":0}}`
  → confirms the envelope + pagination shape. **Payload is in `.data`.**
- **HFT `openapi.json`** shows `/api/accounts` 200 schema is `{"type":"array","items":{"$ref":…}}` — a **bare array, no envelope**.
- All base URLs are reachable from this network, so implementers can flip `USE_MOCK=false` and hit dev directly once logged in (a valid Firebase login is required to obtain the Bearer — Auth is done).

---

## 3. HTTP-client standardization (do this FIRST — Phase 1)

`lib/api-client.ts` today exposes `apiGet/apiPost/apiDelete` (Bearer auto-attached) and throws `ApiError(status, statusText)` on `!res.ok`. Extend it minimally:

1. **Add `apiPut<T>`** (XALPHA editor/strategy update + HFT account/venue update use PUT; none wired yet).
2. **Add an unwrap helper for enveloped APIs only.** Do NOT bake unwrapping into `apiGet` — HFT must stay raw. Add:
   ```ts
   // For XALPHA/AUTH. T is the payload type (what lives in `.data`).
   export async function apiGetData<T>(url, token?): Promise<T>            // GET  → env.data
   export async function apiPostData<T>(url, body, token?): Promise<T>     // POST → env.data
   export async function apiPutData<T>(url, body, token?): Promise<T>      // PUT  → env.data
   // + a way to read env.pagination for paginated XALPHA lists (return {data, pagination} variant, or a separate apiGetPage).
   ```
   Type the envelope from the generated symbol: `components["schemas"]["models.DefaultResponseModel"] & { data?: T }` (identical shape in `auth.ts` and `xalpha.ts`).
3. **Better error messages for enveloped APIs.** On `!res.ok`, try to read `{message}` from the JSON body and throw `ApiError(status, body.message ?? statusText)`. HFT errors have no body → keep `statusText`.
4. **Keep the `USE_MOCK` ternary in every hook.** Pattern stays `queryFn: () => USE_MOCK ? mockApi.x() : <realCall>`. Never delete the mock branch.

**Envelope rule (post it in the file header):** `HFT_API_URL` → use `apiGet/apiPost/apiPut/apiDelete` (raw). `XALPHA_API_URL[_V2]` / `AUTH_API_URL` → use `apiGetData/apiPostData/apiPutData` (unwrapped).

**Pagination:** HFT list endpoints (`/api/venues`, `/api/accounts`, `/api/runs`, `/api/strategies`) return the **full array** — the pages already paginate/filter client-side (`paper-trading/page.tsx`, `strategies/page.tsx`), so keep client-side pagination. The only **server-paginated** endpoint is HFT `GET /api/runs/{id}/trades?page=&size=` → `TradePage {page,size,total,rows}`. XALPHA `GET /v1/strategies` supports `page/limit/query/status/tag/sort` server-side + returns `pagination` — prefer server params there if we adopt XALPHA for Strategy List.

**Loading/error:** pages currently render `isLoading ? "Loading…"` and default to `[]`, but **none handle `isError`**. Standardize: add an error branch (e.g. `isError && <p className="text-destructive">Failed to load.</p>`) to each list page as part of wiring. React Query already provides `isLoading/isError/error`.

---

## 4. Endpoint map — CLEAN mappings (HFT: Venues, Accounts, Runs)

### 4.A Venues — clean, zero transform (`hooks/api/use-venues.ts`)
`domain.Venue` **is** `components["schemas"]["Venue"]` from `hft.ts`. Mock shape already matches the API 1:1.

| Hook | Method + path | Req type | Res type | Transform |
|---|---|---|---|---|
| `useVenues` | `GET /api/venues` | — | `Venue[]` | none (raw) |
| `useCreateVenue` | `POST /api/venues` (201) | `NewVenue {name, venue_type}` | `Venue` | none — form already emits `{name, venue_type}` (`new-venue-form.tsx` zod matches `VenueType`) |
| `useDeleteVenue` | `DELETE /api/venues/{id}` (204) | — | void | none. **Handle 409** "Still referenced by accounts" → surface a toast/inline error (delete dialog in `venue-list.tsx`). |

### 4.B Accounts — clean read (`hooks/api/use-accounts.ts`)
`domain.Account` = `hft.ts` `Account`. Mock matches.

| Hook | Method + path | Res | Transform |
|---|---|---|---|
| `useAccounts` | `GET /api/accounts` | `Account[]` | none (raw) |

Note: the app never creates/edits accounts through a hook today, though HFT supports `POST/PUT/DELETE /api/accounts` (`NewAccount`/`UpdateAccount`). Out of scope unless the account CRUD UI is added. **The `new-portfolio-form` + both trading dialogs select accounts by `Account.id`/`name`** — those work as soon as `useAccounts` is real.

### 4.C Live & Paper runs (`use-live-runs.ts`, `use-paper-runs.ts`) — HFT, HEAVY transform
Runs come from `GET /api/runs` → `Run[]` (no `mode` query param exists). **Filter by mode client-side:** `runs.filter(r => r.mode === 'live')` / `=== 'paper'`.

The UI rows (`LiveRunRow`, `PaperRunRow`) are heavily denormalized. Source fields:

| UI row field | Source | Transform / note |
|---|---|---|
| `id` | `Run.id` | ✅ |
| `strategyName` | `Run.manifest.strategy.name` | ✅ (`ManifestStrategy.name`) |
| `accounts[]` | `Run.manifest.account.name` + `manifest.extra_accounts[].name` | ✅ names available in manifest |
| `symbols[].symbol` | `Run.manifest.symbols[].symbol` | ✅ |
| `symbols[].market` | derive from `manifest.symbols[].{instrument_class, venue_id/venue_type}` | ⚠️ **lossy** — no `market` label in HFT. Approximate: dnse/tcbs→"VNFuture"/"Vietnam", binance_*→"Crypto". See GAP-4. |
| `timeframe` | `Run.manifest.data_kind` | `{kind:'bar',interval:'5m'}` → map interval→UI label ("5m"→"5min"); `{kind:'tick'}` → "tick". Needs a small map. |
| `status` | `Run.status` | `RunStatus` = pending/running/stopped/failed/completed/paused → matches UI `RunStatus` 1:1 ✅ |
| `strategyType` (`MFT`/`HFT`, paper only) | `Run.manifest.data_kind.kind` | bar→`MFT`, tick→`HFT` (per manifest doc: Tick→HFT engine, Bar→MFT engine) ✅ |
| `alphaStatus` (live only) | — | constant/derived ("Live Trading"); no API field. Minor GAP-4. |
| `returnPct`, `maxDrawdownPct` | `GET /api/runs/{id}/summary` → `RunSummary` | ⚠️ `RunSummary.net_pnl`/`max_drawdown` are **absolute PnL units, not %**. Need starting equity (`manifest.account.balances`) to compute %. See GAP-3. `sharpe` maps directly. |
| `sharpe` | `RunSummary.sharpe` | ✅ |
| `pnlSeries` (sparkline) | `GET /api/runs/{id}/equity-curve` → `EquityPoint[]` | map `.equity` (or `.pnl`) to `number[]` ✅ |
| `pnlChartSeries`, `returnsChartSeries` (paper detail) | `equity-curve` (→ `{date: ts, value: equity}`); returns series has no direct source | ⚠️ returns-series not provided by HFT; derive from equity deltas or GAP. |

**Architectural cost (flag to orchestrator):** a fully-populated row needs the list **plus per-run `summary` + `equity-curve`** = N+1 (×2) fetches. Options: (a) render the list first from `/api/runs`, then lazily fetch summary+equity per visible row (extra hooks, `enabled` on row mount); (b) accept sparkline/metrics loading after the row. There is **no list-with-metrics endpoint**. Recommend (a): `useLiveRuns` returns base rows from `manifest`; add `useRunSummary(id)` + `useRunEquity(id)` used inside the row/detail. Metrics columns show a skeleton until they resolve. This also means `useLiveTicks` (fake feed) should be retired for live mode in favor of the SSE stream (GAP-9) or polling `summary`.

### 4.D Trade history (`useTradeHistory`) — HFT, field-mismatch transform
`GET /api/runs/{id}/trades?page=&size=` → `TradePage { page, size, total, rows: TradeRow[] }`. Unwrap `.rows`. Wire server pagination into the Trades tab (currently fetches once).

| `TradeHistoryRow` | `TradeRow` source | Note |
|---|---|---|
| `id` | `` `${order_id}-${fill_ts}` `` | synthesize — no id field |
| `time` | `fill_ts` (epoch ms) → ISO | ✅ |
| `action` (Buy/Sell) | `side` | map string ("buy"/"sell" or "bid"/"ask" — verify live) |
| `price` | `fill_price` | ✅ |
| `size` | `fill_qty` | ✅ |
| `latencyMs` | `fill_ts - submitted_ts` | ✅ derive (check units ms vs ns) |
| `role` (Maker/Taker) | — | ❌ **not in `TradeRow`** — GAP-5 |
| `fee` | — | ❌ only aggregate `SymbolPnlSummary.total_fee` per symbol — GAP-5 |
| `equity` (running) | — | ❌ only downsampled `equity-curve`, not per-fill — GAP-5 |

Recommend: show available columns; hide/placeholder `role`/`fee`/`equity` or approximate, pending backend.

---

## 5. Endpoint map — screens that belong to XALPHA (recommended re-point)

> These three screens are the **XALPHA research product** (Python `StockAlgorithm`, market/universe, sharpe/drawdown as ratios). HFT's `Strategy` is a thin Rhai control-plane record and cannot fill them. `docs/plans/create-strategy.md` already states the code is Python. **Decision DEC-1 (§6) must confirm XALPHA ownership before building these.** All XALPHA responses are enveloped → use `apiGetData` etc.

### 5.A Strategy List (`use-strategies.ts` → `useStrategies`)
Re-point to `GET /xalpha-api/v1/strategies` (supports `page,limit,query,status[],tag[],sort[],min_sharpe,min_drawdown,min_pnl`) → `data: StrategyInfo[]`, plus `pagination`.

| `StrategyRow` | `StrategyInfo` source | Note |
|---|---|---|
| `id` | `id` | ✅ |
| `name` | `name` | ✅ |
| `market` | `market` | ✅ (HFT has none — this is why XALPHA fits) |
| `universe` | `universe` | ✅ |
| `status` (published/in_sample/completed) | `status` (created/submitted/published/completed/error) | map: published→published, submitted/created→in_sample, completed→completed, error→(new state) |
| `statusUpdatedAt` | `updated_at` (or `published_at`) | format |
| `returnPct` | `performance.performance.cumulative_return` (or `total_return`/`annual_return`) | ⚠️ ratio → ×100 if the API returns a fraction (verify) |
| `sharpe` | `performance.performance.sharpe` | ✅ |
| `maxDrawdownPct` | `performance.performance.max_drawdown` | ⚠️ ratio → ×100 |
| `livePerfSeries` | `GET /v1/strategies/{id}/charts?series=pnls` → `StrategyChartData.values` | per-row extra fetch, or omit sparkline initially |
| `group` (MFT/HFT), `strategyType` (taker/maker/arbitrage), `timeframe` | — | ❌ **not in `StrategyInfo`** — GAP-6 (the MFT/HFT tabs + type have no XALPHA field) |

### 5.B Strategy Analytics (`use-strategies.ts` → `useStrategyAnalytics`) — CLEAN on XALPHA
The mock `StrategyAnalytics` has three parts, each with a clean XALPHA source (this is strong evidence the screen is XALPHA):

| `StrategyAnalytics` part | XALPHA endpoint → type | Transform |
|---|---|---|
| `portfolioPerformance {categories, data}` | `GET /v1/stats/performance` → `UserResearchPerformanceRecord {times[], values[]}` | `categories = times`, `data = values` ✅ |
| `strategyPipeline {categories, total[], published[]}` | `GET /v1/stats/strategies` → `StrategyStatsResult {by_date: StrategyDailyStats[]{date,total,published}, total, published}` | `categories = by_date.map(date)`, `total = by_date.map(total)`, `published = by_date.map(published)` ✅ |
| `marketAllocation [{name,value}]` | `GET /v1/stats/markets` → `UsageStatItem[] {name, pct, total}` | `{name, value: pct}` ✅ |

This is a clean 3-call composition (or keep as one `useStrategyAnalytics` that `Promise.all`s the three). **Replaces the non-existent `/api/strategies/analytics`.**

### 5.C Create Strategy (new hooks — the tabs currently read `strategy-builder.ts` statically)
XALPHA v1 `documents/*` + v2 `editors/*` cover almost the whole screen:

| UI piece | XALPHA endpoint → type | Maps to mock |
|---|---|---|
| Features tab | `GET /v1/documents/features` → `FeatureFunctionItem[] {name, prototype, returns, docs, group, allowed}` | `FEATURES` ({name, desc}) → {name, prototype/returns badge, docs} |
| Operators tab | `GET /v1/documents/operators` → `OperatorFunctionItem[]` (same shape) | `OPERATORS` |
| Data tab | `GET /v1/documents/datas?market=&universe=&data_category=&dataset=` → `DataFunctionItem[]` | data-tab (static) |
| Samples tab | `GET /v2/codes/examples` → `CodeExample[] {category, code, name, summary}` | `SAMPLES` |
| Editors bar (open tabs) | `GET /v2/editors` → `StrategyEditorInfo[] {id,name,code,market,universe,train_ratio,…}`; create `POST /v2/editors`; clone `POST /v2/editors/{id}/clone`; delete `DELETE /v2/editors/{id}/delete` | `INITIAL_EDITORS` (`EditorTab {id,name,code}`) |
| Save/update editor | `PUT /v2/editors/{id}/update` body `handlers.updateStrategyEditorRequest {code, train_ratio, universe}` | (no save button today) |
| Verify code | `POST /v2/editors/{id}/verify` | console output |
| Autocomplete | `POST /v2/editors/autocomplete` body `EditorAutocompleteRequest` → `EditorAutocompleteResponse` | Monaco (optional) |
| **Simulate** button | `POST /v2/editors/{id}/simulate` (201) — proxied to Python; **needs kyc+contributor role** | toolbar Simulate no-op |
| Results tab (RESULT_METRICS / YEARLY_ROWS / correlation / PNL) | `GET /v1/strategies/{id}/stages/{stage}/summary-aggregate` → `SummaryAggregateItem {sharpe,cagr,max_drawdown,profit_factor,calmar,from_time,to_time}`; `.../summary-table` → `SummaryTableItem[]` (year rows: time,sharpe,cagr,max_drawdown,profit_factor,calmar — **matches `YEARLY_ROWS`**); `.../charts?series=pnls|returns` → `StrategyChartData`; `.../events/{event_id}/correlation` → `StrategyEventScore`; `.../evaluations` → `EvaluationRecord[]` | `RESULT_METRICS`, `YEARLY_ROWS`, `CORRELATION_ROWS`, `PNL_SERIES` |
| Progress / cancel a sim | `GET /v2/strategies/{id}/progress` → `StrategyProgress`; `POST /v2/strategies/{id}/cancel` | console/status |

**Complexity:** Results/simulate is a stateful flow (create/pick editor → simulate → poll progress → read stages). It also requires the **kyc+contributor role** on the logged-in user. Treat Create-Strategy as its own phase (§7 Phase 5) and possibly its own follow-up roadmap item — the static tabs (features/operators/samples/data) are easy wins; simulate+results is the hard part.

---

## 6. GAPS / BLOCKERS / DECISIONS (most important section — be honest)

**DEC-1 — HFT vs XALPHA ownership of the Strategy screens (biggest decision).**
Strategy List, Strategy Analytics, and Create Strategy currently point at `HFT_API_URL`, but the data model, the Python code samples, and `docs/plans/create-strategy.md` all say these are the **XALPHA** product. HFT's `Strategy` (Rhai `code`, `strategy_type`, `features` only) cannot supply `market`/`universe`/`status`/`returnPct`/`sharpe`/`maxDrawdownPct`/analytics. **Recommendation: re-point these three screens to XALPHA (§5).** Needs user confirmation because it changes base URL, types (`xalpha.ts`), and the envelope handling. If the answer is "keep HFT," then Strategy List loses most columns and Analytics has no source (stays mock).

**DEC-2 — Two strategy systems don't obviously connect.** A strategy built in Create-Strategy (XALPHA, Python) is a different object from what an HFT `Run` executes (`ManifestStrategy` with Rhai code + `strategy_type` taker/maker/arbitrage). The Strategy List "Send to paper trading" (`start-paper-trading-dialog`) and Paper→Live promotion cross the XALPHA↔HFT boundary. **Is there a bridge (XALPHA strategy → HFT run), or does "Start paper trading" create an HFT run from an HFT strategy only?** This determines whether the trading dialogs consume XALPHA `StrategyInfo` or HFT `Strategy`. Needs a product answer.

**GAP-1 — Portfolios have NO backend anywhere.** No `/portfolios` path or `Portfolio` schema in HFT, XALPHA, or AUTH (`domain.Portfolio` is explicitly marked UI-only with a `TODO(phase3)`). `usePortfolios`/`useCreatePortfolio`/`useDeletePortfolio` and `accounts/page.tsx` cannot be wired. **Options:** (a) keep Portfolios on mock indefinitely (leave `USE_MOCK` semantics for this hook only); (b) get a backend portfolio resource added; (c) redefine "portfolio" as a client-side grouping of `Account`s persisted locally. **Blocker — needs decision.** Recommend (a) for now: leave the three portfolio hooks mock-only and document it.

**GAP-2 — No `mode` filter on `/api/runs`.** Fetch all runs, filter `r.mode==='live'|'paper'` client-side. Minor. (Also `backtest` mode is omitted server-side "until the dataset feature lands.")

**GAP-3 — Run % metrics not provided.** `RunSummary` gives `net_pnl`/`max_drawdown` in **absolute PnL units**, not the `returnPct`/`maxDrawdownPct` the tables show. Need starting equity (`manifest.account.balances`/`StartingBalances`) to compute %. Decide: compute % from starting balance, or change the columns to show absolute PnL. (XALPHA strategies don't have this problem — their performance is already ratio-based.)

**GAP-4 — Run `market` label + `alphaStatus` are UI inventions.** HFT symbols carry `instrument_class`/`venue_type`, not a "VNFuture"/"NASDAQ"/"Crypto" market label; `alphaStatus` ("Live Trading") has no field. Derive approximately (lossy) or accept placeholders.

**GAP-5 — Trade-history `role`/`fee`/`equity` per-fill missing.** `TradeRow` has no maker/taker flag, no per-fill fee (only aggregate `SymbolPnlSummary.total_fee`), and no running equity (only downsampled `equity-curve`). The Trades table can't be fully populated from the API. Decide: drop/placeholder those columns, or request backend fields.

**GAP-6 — Strategy `group` (MFT/HFT), `strategyType`, `timeframe` absent from XALPHA `StrategyInfo`.** The Strategy List's MFT/HFT tab filter and type/timeframe columns have no XALPHA field. Options: infer from `tags[]`/`universe`, drop the columns, or request fields. (On HFT, `strategy_type` exists but is taker/maker/arbitrage, not MFT/HFT.)

**GAP-7 — No "Start/Resume Bot" endpoint.** HFT has `POST /api/runs/{id}/stop` (running→stopped) but **no start/resume**. The live-runs "Start Bot" button (for paused/stopped) can't be wired; "Stop Bot" can. Also `paused` status isn't reachable via any API action (only `stop`). Decide: hide "Start Bot", or backend adds resume.

**GAP-8 — Create-Strategy `simulate` requires kyc+contributor role.** `POST /v2/editors/{id}/simulate` and `/verify` are gated on that role. Confirm the admin/test user has it, or simulate will 403.

**GAP-9 — Live feed is SSE, not the fake ticker.** Real live updates come from `GET /api/runs/{id}/live/stream` (text/event-stream) or `/live` snapshot (both 404 if Redis unconfigured / nothing published). `use-live-ticks.ts` is a mock that randomizes cached values. Decide: (a) leave the fake ticker for now (works over any data), (b) poll `summary`/`equity-curve` on an interval, or (c) implement an SSE hook. Recommend (a) short-term, (c) later. Not required to "de-mock" the tables.

**GAP-10 — `feature-catalog` on HFT is untyped.** HFT also has `GET /api/strategies/feature-catalog` and `POST /api/strategies/validate[-features]`, but their response bodies are `content?: never` (no schema). If Create-Strategy stays partly HFT, these need live inspection. XALPHA `documents/features` (§5.C) is fully typed and preferred.

**Non-blocking:** AUTH data endpoints (`/me`, `countries`, `organizations`, KYC) are out of scope (Auth done); wire only if a profile/settings screen is added.

---

## 7. Phased implementer breakdown (Sonnet, disjoint file ownership)

> Ordering: **Phase 1 (client) → Phase 2 (HFT clean) can start immediately.** Phases 4–5 (XALPHA) are **gated on DEC-1**. Each phase's files are disjoint from the others' so agents don't collide. Every phase flips `USE_MOCK=false` locally and confirms real data renders; the orchestrator does the browser verification per CLAUDE.md §5.

### Phase 1 — HTTP-client foundation (1 Sonnet; unblocks all) — no DEC needed
- **Files:** `lib/api-client.ts` (add `apiPut`, `apiGetData/apiPostData/apiPutData`, envelope error parsing, pagination helper), `lib/constant.ts` (no change expected; confirm URLs).
- **Verify:** `npx tsc --noEmit` clean; unit-test that `apiGetData` unwraps `.data` against the `models.DefaultResponseModel & {data}` type; `apiGet` still returns raw. Hit XALPHA `/v1/ping` via `apiGetData` and log the unwrapped payload.

### Phase 2 — HFT Venues + Accounts (1 Sonnet; clean; parallel-safe after P1) — no DEC needed
- **Files:** `hooks/api/use-venues.ts`, `hooks/api/use-accounts.ts`; add 409 handling in `app/(dashboard)/venues/venue-list.tsx`; add `isError` branches in `venues/page.tsx`, `accounts/page.tsx` (accounts list rendering only — NOT portfolios).
- **Endpoints:** `GET/POST /api/venues`, `DELETE /api/venues/{id}`, `GET /api/accounts` (all raw, no transform).
- **Verify:** `USE_MOCK=false` → venues list loads from dev; create a venue (201) and see it appear; delete (204); delete a referenced venue → 409 surfaced; accounts dropdowns in the portfolio form + paper dialog populate from real accounts.

### Phase 3 — HFT Runs: Live + Paper + Trade history (1 Sonnet; depends on P1) — no DEC needed
- **Files:** `hooks/api/use-live-runs.ts`, `hooks/api/use-paper-runs.ts`, a new `hooks/api/use-runs.ts` (shared `useRunSummary(id)`, `useRunEquity(id)`), a new `lib/transform/runs.ts` (Run→LiveRunRow/PaperRunRow, TradeRow→TradeHistoryRow, interval→timeframe, market derivation). Wire server pagination in `paper-trading/run-detail-panel.tsx` Trades tab. Do NOT touch strategies/venues files.
- **Endpoints:** `GET /api/runs` (+client `mode` filter), `GET /api/runs/{id}/summary`, `/equity-curve`, `/trades?page=&size=`, `POST /api/runs/{id}/stop`.
- **Handles GAPs 2,3,4,5,7,9** — implement the best-effort transforms; leave documented placeholders for missing fields; wire "Stop Bot" (`POST /stop`), hide "Start Bot" (GAP-7) or leave no-op.
- **Verify:** `USE_MOCK=false` → live & paper tables render real runs; a run's sparkline/metrics fill from summary+equity; open a run → Trades tab paginates real fills; Stop Bot transitions a running run.

### Phase 4 — XALPHA Strategy List + Analytics (1 Sonnet; **gated on DEC-1**; uses enveloped client)
- **Files:** `hooks/api/use-strategies.ts` (re-point both hooks to XALPHA), `lib/transform/strategies.ts` (StrategyInfo→StrategyRow, stats→StrategyAnalytics, status map). `strategies/page.tsx`/`strategies-table.tsx`/`strategy-analytics.tsx` only if columns must change for GAP-6.
- **Endpoints:** `GET /v1/strategies` (+ `page/limit/query/status/sort`), `GET /v1/strategies/{id}/charts?series=pnls`, `GET /v1/stats/{performance,strategies,markets}`.
- **Handles GAPs 6** — infer/drop `group`/`timeframe`/`strategyType`; **handles the `returnPct`/`max_drawdown` ratio scaling.**
- **Verify:** `USE_MOCK=false` → strategy table lists real XALPHA strategies with real perf; the 3 analytics charts render from `stats/*`.

### Phase 5 — XALPHA Create Strategy (1 Sonnet; **gated on DEC-1 + GAP-8 role**; largest)
- **Files:** new `hooks/api/use-strategy-builder.ts` (features/operators/samples/data/editors), refactor `create-strategy/{features,operators,samples,data}-tab.tsx` + `editors-bar.tsx` + `toolbar.tsx` to consume hooks; `lib/mock/strategy-builder.ts` stays as the `USE_MOCK` fallback source. Results/simulate wiring (`results-tab.tsx`, `results-panel.tsx`, `console-panel.tsx`) is a **sub-phase 5b** (simulate → progress → stages) — can be deferred.
- **Endpoints:** `GET /v1/documents/{features,operators,datas}`, `GET /v2/codes/examples`, `GET/POST /v2/editors`, `PUT /v2/editors/{id}/update`, `POST /v2/editors/{id}/{simulate,verify,clone}`, `GET /v2/strategies/{id}/progress`, `GET /v1/strategies/{id}/stages/{stage}/{summary-aggregate,summary-table,charts,evaluations}`.
- **Verify:** `USE_MOCK=false` → features/operators/samples/data tabs list real catalog entries; editors bar loads real editors; (5b) Simulate on a test editor returns 201 and results/console populate (needs kyc+contributor).

### Portfolios — NOT a phase (GAP-1)
Leave `hooks/api/use-portfolios.ts` and `accounts/page.tsx` on mock. Add a code comment + this doc reference. Revisit when DEC on GAP-1 lands.

---

## 8. Definition of done (per hook)
- [ ] Real branch hits the correct base URL with the correct method/params/types (cite `types/api/*` symbol).
- [ ] Envelope handled correctly (raw for HFT, `.data` for XALPHA/AUTH).
- [ ] Transform produces exactly the UI-expected mock shape (or the shape/columns were adjusted with a noted gap).
- [ ] `USE_MOCK=true` still works unchanged (fallback intact).
- [ ] `isLoading` + `isError` handled in the consuming page.
- [ ] `USE_MOCK=false` browser-verified: the affected page renders **real** dev data (orchestrator drives Claude-in-Chrome per CLAUDE.md §5), console/network clean.
