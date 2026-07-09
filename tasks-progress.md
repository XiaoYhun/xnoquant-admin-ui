# Tasks progress

Mirrors `user-tasks.md`'s current items (done items the user has removed are dropped). Status: ✅ done · 🔄 in progress · ⬜ todo

## Tasks
- ✅ **T13** "Use template" (card + View-source modal) → confirmation Dialog before replacing the editor code (`samples-tab.tsx`). Verified.
- ✅ **T14** Results MFT variant wired to the **real XALPHA API** like xno-builder (Stage Train/Test/Simulate/Live · summary-aggregate + summary-table · **multi-chart checkbox selector** → removable `/charts?series=…` cards · "No Results Yet" state), keyed by strategyId+stage. HFT variant untouched. Verified live in Chrome.
- ✅ **T15** Editors "+" with **HFT** → `POST /hft/api/strategies` + appends an HFT tab. Added a **Strategy name field** to the Create-Strategy modal (used by both MFT+HFT) — verified live: unique name → **201** (the fixed "Untitled Strategy" 409'd on a name-uniqueness constraint). Duplicate name keeps the modal open with an inline error.
- ✅ **T16** `GET /hft/api/strategies` → merged into the Editors list, each tab tagged MFT/HFT (`useHftStrategies`; error/empty → `[]` so a broken/empty HFT backend never blocks the page). `/hft` proxy+auth OK (venues → 200); empty today (no HFT strategies).
- ✅ **T17** Editors "+" with **MFT** → `POST /v2/editors` + **revalidate** the editors query (`useCreateEditor`). Verified live: created "Untitled 1", appended+selected, revalidation `GET /v2/editors → 200`.
- 🔄 **T18** MFT Simulate flow from xno-builder — after simulate, the Results panel shows a live **running screen** (progress bar + cancel, status-gated) then flips to results. Subagent building.
- ✅ **T19** `GET /auth/v1/me` wired (`useMe`) + surfaced for inspection (Network tab · `console` `[auth/me]` · `window.__me`) — sets up role-gating. Verified live → **200**; roles: `default, contributor, researcher, research-lead, admin`.

## Bugs
- ✅ **B6** Expanded sample shows the FULL description — moved into the animated grid section; collapsed truncates 1 line (`samples-tab.tsx`). Verified.
- ✅ **B7** Simulate: **MFT** submits directly via `POST /v2/editors/{id}/simulate` (no modal) — verified live → **200**; **HFT** opens the modal (dormant — no HFT strategies). Toolbar badge reflects the active editor's type (verified MFT). Button shows "Simulating…" feedback (no toast lib in repo).
- ✅ **B8** Scrollbar styling matched to xno-builder (`globals.css`): 6px, transparent track, translucent `#696b7450` thumb (radius 10px), `#60626850` hover.

## Notes / references
- Housekeeping (done): fixed a pre-existing `react-hooks/refs` lint error in `ResizableSplit` → **full `eslint` + `tsc` pass clean**; `next build` lint gate unblocked.
- xno-builder Results reference: `app/(dashboard)/build/_components/KetQuaStrategy.tsx` + `TongQuanComponent.tsx`; hooks `useStrategyStageSummaryAggregate`/`useStrategySummaryData`/`useListSeries`/`usePNLsChartData`. Endpoints (XALPHA v1, enveloped): `/series`, `/strategies/{id}/stages/{stage}/{summary-aggregate,summary-table,charts?series=…}`.
- Verify UI in Chrome vs Figma/xno-builder before marking done.
- Sync tasks-progress.md ↔ user-tasks.md; remove tasks the user removes. Do NOT edit user-tasks.md (user manages it).
