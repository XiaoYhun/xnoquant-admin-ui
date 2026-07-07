# XNOQuant Admin UI — MVP Design

**Date:** 2026-07-07
**Status:** Approved (pending spec review)
**Roadmap phase:** 1 — MVP (UI from design with mock data; react-query hooks ready for later API connect)

## 1. Goal & scope

Build the internal XNOQuant admin dashboard UI from the Figma design, using **mock data only** (no real API calls). Every data interaction goes through **TanStack Query hooks** whose query/mutation functions currently return typed mock data, so wiring real APIs in roadmap phase 3 is a near drop-in change. Types are generated from the live OpenAPI specs so mock data and hooks are shaped correctly from day one.

**In scope (MVP):** app shell + 6 screens, dark theme, mock data, typed data hooks, design system.
**Out of scope (later phases):** real auth/login (phase 2), real API wiring (phase 3), light theme, i18n.

### Non-goals / deliberate simplicity (per project CLAUDE.md)
- No real authentication — a static mock admin user only.
- No i18n framework — **English only**; the few Vietnamese strings in the design are translated to English.
- No speculative abstractions or config beyond what a screen needs.

## 2. Reference project

`G:/Develop/xno-builder` (Next 16 / React 19.2 / TanStack + SWR / Firebase / HeroUI). We reuse its **conventions and patterns**, restyled with **shadcn/ui instead of HeroUI**. Key reusable assets:
- **Structure:** flat root, `@/*` alias, `app/(dashboard)/` route group, co-located `_components/` + `_hooks/` per feature.
- **Font:** `next/font/google` **Be Vietnam Pro** (`--font-be-vietnam-pro` → `--font-sans`).
- **API base-URL scheme:** `lib/constant.ts` (`NEXT_PUBLIC_BASE_URL` → `/auth/v1`, `/xalpha-api/v1|v2`, etc.).
- **Create Strategy flavor:** `app/(dashboard)/build/**` — Monaco editor, resizable panels, tab structure, the Editor→Simulate→Strategy model. Replicated in Slice 6, restyled.
- **Auth (for phase 2, captured now):** Firebase ID token → exchange at `/auth/v1/auth/token` for backend `access_token`; client-side guard in dashboard layout.

## 3. Tech stack

Next.js 16 (App Router, Turbopack) · React 19.2 · TypeScript · Tailwind CSS v4 (CSS-first) · shadcn/ui (`new-york`, `neutral` base, lucide) · TanStack Query · Zustand · Zod · React Hook Form · Framer Motion · ECharts (`echarts-for-react`) · Monaco (`@monaco-editor/react`, Slice 6) · `openapi-typescript` (dev, type gen).

**Divergence from xno-builder:** it uses SWR for reads + TanStack for writes. We standardize on **TanStack Query for both reads and writes** (matches SPEC + roadmap "react-query hooks").

## 4. Data layer — the "API-ready mock" strategy

1. **Type generation** — `openapi-typescript` fetches all three live specs → `types/api/{auth,hft,xalpha}.ts`. Regeneration is a documented npm script.
   - AUTH: `https://api.dev.xnoquant.io/auth/swagger_docs/doc.json`
   - HFT: `https://hft-dev.xnoquant.io/openapi.json`  *(primary API for these screens)*
   - XALPHA: `https://api.dev.xnoquant.io/xalpha-api/swagger_docs/doc.json`  *(strategies/editors — Slice 6)*
2. **`lib/api-client.ts`** — fetch wrapper (Bearer-token ready, base-URL scheme from xno-builder). Present but unused in MVP.
3. **`lib/mock/`** — typed mock datasets + async functions (`mockApi.listVenues()`, `mockApi.listPortfolios()`, …) shaped to the generated types.
4. **`hooks/api/*`** — TanStack Query hooks. Query/mutation functions call the mock layer today. Swapping to `apiClient` later is a one-line change per hook. Toggled via `NEXT_PUBLIC_USE_MOCK` (default `true` in MVP).

**Hook example (target shape):**
```ts
// hooks/api/useVenues.ts
export function useVenues() {
  return useQuery({ queryKey: ['venues'], queryFn: () => mockApi.listVenues() });
}
// phase 3: queryFn: () => apiClient.get<Venue[]>('/venues')
```

## 5. Design system

- `shadcn init`; extract Figma variables via Figma MCP `get_variable_defs` on the **Components** section → map into shadcn HSL token names in `app/globals.css`. Dark-only (`dark` class on `<body>`), tokens structured so light is a later flip.
- Primitives from shadcn, restyled to Figma: Button, Input, Select, Table, Dialog, Tabs, Slider, Card, Badge/pill, Popover, Dropdown, Sidebar, Tooltip, Skeleton.
- `components/charts/` — ECharts React wrappers: line, bar, donut, sparkline, area/PnL, candlestick.
- Font: Be Vietnam Pro via `next/font`.

## 6. App shell & routes

Persistent left **Sidebar** (Create strategy · **Quant Lab**: Strategy List, Paper Trading · **Live Operations**: Venue, Live Account, Live Trading · Logout at bottom) + top **Header** (page title, admin avatar/name). Rendered in `app/(dashboard)/layout.tsx`.

| Route | Screen | Figma node |
|---|---|---|
| `/create-strategy` | Create Strategy | section 14294:101743 |
| `/strategies` | Strategy List | section 14294:101746 |
| `/paper-trading` | Paper Trading | section 14294:101747 |
| `/venues` | Venue | section 14294:101749 |
| `/accounts` | Live Account (Portfolios) | section 14294:101750 / frames 13970:117548, 117985 |
| `/live-trading` | Live Trading | section 14294:101748 |

`/` → redirect to `/strategies`. Design-system reference: **Components** section 14294:101751.

## 7. Auth in MVP

Mock only. A `useAuth` hook (zustand-backed) returns a static admin user (`Admin · admin@gmail.com`, per header). Sidebar Logout + avatar render but perform no real flow. The dashboard layout guard is a pass-through in MVP. Real Firebase + `/auth/v1/auth/token` exchange is **phase 2** (pattern already captured from xno-builder).

## 8. Screen inventory

| Screen | Complexity | Summary |
|---|---|---|
| **Venue** | Low | Two-pane: "New venue" form (Name, Type dropdown) + venue list (Binance/Coinbase/Kraken; Spot/Future/Margin; delete). |
| **Live Account** (Portfolios) | Low–Med | Two-pane: "New portfolio" form (Name, allocate-from-accounts rows, total allocated) + portfolio list with per-source allocation sliders. Empty + populated states. |
| **Live Trading** | Med | Data table of live strategies (status, id, name, alpha status, account, symbol/market, PnL, sparkline, actions) + pagination + filters. |
| **Strategy List** | Med–High | Analytics header (line/bar/donut) + strategy table + detail view (code + backtest charts) + start-paper-trading modals. |
| **Paper Trading** | High | Strategy table (name, status, account, symbol, PnL, sparklines, actions) + detail (PnL + returns charts, Trades tab, trading history) + "Start Live Trading" modals. |
| **Create Strategy** | Very High | Monaco code IDE, HFT/MFT variants, resizable panels, sub-tabs (Samples, Results, Features, Detail). Mirrors xno-builder `build/`. |

## 9. Project structure (target)

```
app/
  (dashboard)/
    layout.tsx            # sidebar + header shell, mock-auth guard
    page.tsx              # redirect → /strategies
    venues/               page.tsx, _components/
    accounts/             page.tsx, _components/
    live-trading/         page.tsx, _components/
    strategies/           page.tsx, _components/
    paper-trading/        page.tsx, _components/
    create-strategy/      page.tsx, _components/, _hooks/
  layout.tsx              # fonts, metadata, providers
  providers.tsx           # QueryClientProvider (+ mock-auth init)
  globals.css             # Tailwind v4 + shadcn tokens (from Figma)
components/
  ui/                     # shadcn primitives
  charts/                 # ECharts wrappers
  layout/                 # Sidebar, Header
hooks/api/                # TanStack Query hooks (→ mock layer)
lib/
  api-client.ts           # fetch wrapper (unused in MVP)
  constant.ts             # base URLs
  mock/                   # typed mock datasets + mockApi
  utils.ts                # cn + formatters
store/                    # zustand (mock-auth, ui)
types/api/                # generated from OpenAPI
```

## 10. Build slices (order: simple → complex; Create Strategy last)

Each slice builds the Figma UI with mock data + typed react-query hooks, then is **verified in Chrome** (CLAUDE.md §5).

- **Slice 0 — Foundation.** Scaffold Next 16 project + deps; Tailwind v4 + shadcn init + Figma tokens + Be Vietnam Pro; app shell (Sidebar + Header + dashboard layout); QueryClient provider; mock-auth; generate OpenAPI types; mock infra (`lib/mock`, `api-client`); ECharts wrapper base. **Verify:** `next dev` runs; shell renders; `/` → `/strategies` placeholder in browser; typecheck + lint clean.
- **Slice 1 — Venue.** Two-pane CRUD, `useVenues` + `useCreateVenue`/`useDeleteVenue` (mock). **Verify:** create/list/delete flow in browser.
- **Slice 2 — Live Account / Portfolios.** Two-pane form + allocation sliders + list (empty + populated). **Verify** in browser.
- **Slice 3 — Live Trading.** Data table + sparklines + pagination + filters. **Verify** in browser.
- **Slice 4 — Strategy List.** Analytics-header charts + table + detail. **Verify** in browser.
- **Slice 5 — Paper Trading.** Table + detail (PnL/returns charts, Trades) + modals. **Verify** in browser.
- **Slice 6 — Create Strategy.** Monaco IDE, resizable panels, HFT/MFT, sub-tabs; mirror xno-builder `build/`. **Verify** in browser.

## 11. Success criteria

- `npm run dev` serves the app (npm, matching xno-builder); all 6 routes render from the Figma design in dark theme with realistic mock data.
- Every data surface reads/writes through a TanStack Query hook backed by the mock layer; no component fetches directly.
- `types/api/*` generated from the live specs; mock data conforms to those types; typecheck passes.
- Each screen visually verified against Figma in Chrome.
- Swapping any hook from mock → real API is a localized, single-function change (documented pattern).

## 12. Open items (tracked, not blocking)

- Exact color/spacing tokens pulled from Figma **Components** during Slice 0.
- Per-screen field details resolved against Figma frames during each slice.
- Route slugs (`/accounts` vs `/portfolios`, etc.) may be adjusted on first review.
