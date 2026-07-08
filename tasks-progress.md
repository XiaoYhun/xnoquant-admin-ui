# Tasks progress

Progress tracker for `user-tasks.md`. Status: ✅ done · 🔄 in progress · ⬜ todo

## Tasks
- ✅ **T1** Create-Strategy top tabs from XALPHA editors list — `useEditors` (`GET /v2/editors` → `EditorTab`, mock/error fallback) + `page.tsx` seeds via a load-then-mount wrapper (lint-safe). Verified: real editors (Untitled 2…11) load.
- ✅ **T2** HFT Simulate click → modal (Figma 14197:30033) — `simulate-modal.tsx` (full launch-config form), wired to the toolbar Simulate button.
- ✅ **T3** Samples "View source" → modal showing the sample's code (Figma 13964:53280) — in `samples-tab.tsx`.
- ⬜ **T4** Sample item open animation — expand height animation
- ✅ **T5** "Use template" (card + modal) → loads the sample's code into the active editor via `onUseTemplate` (page.tsx `setActiveCode`).
- ✅ **T6** 2nd toolbar button (SidebarCode) toggles the Console panel — `page.tsx` lifts `consoleOpen`, `toolbar.tsx` wires the button, `console-panel.tsx` takes `open`/`onOpenChange`.
- ✅ **T7** Market Allocation pie thicker — donut `radius` inner 50%→42%, outer 72%→74% (`strategy-analytics.tsx`).
- ⬜ **T8** Strategy List: MFT row click → slide-in side panel (dark backdrop, read-only code, Results tab like Create-Strategy) (Figma 13964:132139) — big; pull design.

## Bugs
- ✅ **B1** Portfolio Performance chart — removed the per-category vertical split-lines, capped x-axis labels to ~6, and formatted epoch times as M/YY dates (`strategy-analytics.tsx`).
- ✅ **B2** Strategy List 10 items/page — `PAGE_SIZE` 8→10 (`strategies/page.tsx`).

## Notes
- Verify UI changes in Chrome against Figma before marking done.
- Bigger tasks (T2, T3, T8) need Figma designs pulled first; T1/T5 need XALPHA editors + xno-builder reference.
- Alway try to sync user-tasks.md and tasks-progress.md. Do not edit the user-tasks.md.