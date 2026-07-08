---
name: figma-ui-implementation
description: Use when implementing or matching any UI from the XNO QUANT Figma design in this project. Enforces pulling the real design directly, matching layout before details, using exact tokens, and verifying in Chrome.
---

# Figma UI implementation

How to build screens/components that match the Figma design **exactly**. Follow these in order.

## 0. Non-negotiables (this project has been burned by skipping these)

- **Pull the REAL design directly.** Use `get_design_context` / `get_screenshot` / `get_variable_defs` on the actual node. NEVER work from a second-hand brief, a metadata summary, or memory of "what it probably looks like". Typecheck-clean ≠ design-correct.
- **Match the LAYOUT/structure first, then details.** Get the containers, panels, tab bars, splits, and grid right across the whole screen before styling any single cell/tab. Confirm the skeleton matches before diving in.
- **When working on Details** Alway make sure you take it seriously about all small details like font size, background color, height, width,....
- **If the Figma desktop tab isn't on the XNO QUANT file**, node IDs return "No node could be found" — STOP and ask the user to switch the active Figma tab; don't fall back to guessing.
- **Always Chrome-verify** the built screen against its Figma frame (per CLAUDE.md §5). Compare side-by-side; fix discrepancies.
- For large frames, `get_metadata`/`get_design_context` may exceed the token limit → it's saved to a file; parse it in a subagent, don't read it into context.

## 1. Workflow

1. `get_screenshot` the whole frame → understand the layout.
2. `get_metadata` (or a subagent map) → child node IDs for each region.
3. `get_design_context` on the specific region/row/component → exact classes, colors, text, spacing.
4. `get_variable_defs` once → confirm color tokens.
5. Build layout skeleton → verify in Chrome → build each region → verify again.

## 2. Design tokens (verified against Figma variables)

| Token                      | Hex       | Tailwind                         |
| -------------------------- | --------- | -------------------------------- |
| BG Dark/Container (app bg) | `#0A0E14` | `bg-background`                  |
| BG Dark/Surface-main       | `#151A24` | `bg-surface`                     |
| Neutral/Black 800 (border) | `#1D2939` | `border-border` / `bg-secondary` |
| Neutral/Black 500 (muted)  | `#9DB2CE` | `text-muted-foreground`          |
| Base/White                 | `#FFFFFF` | `text-white`                     |
| Primary green              | `#67E1C1` | `text-primary`                   |
| Danger red                 | `#FF135B` | `text-destructive`               |

**Layout rule:** main content area = `bg-surface`; tables/cards/panels = **rounded-border `bg-background`** (a darker card on the lighter surface). Table header row = `bg-secondary` with **white** 12px medium text.

## 3. Design-system patterns (reuse these, don't reinvent)

- **Gradient text** (bg-clip-text) for statuses/values, NOT flat colors:
  - green `bg-[linear-gradient(158deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent`
  - yellow `...#fffbd6...#f1c617...` · red `...#ffcce2...#ff135b...`
- **Glassy pill** (Account/TF): `inline-flex h-7 items-center rounded-[40px] border border-white/25 bg-[rgba(14,20,42,0.5)] px-3 text-xs font-medium text-white shadow-[inset_0_0_8px_0_rgba(63,216,189,0.15)] backdrop-blur-[2px]`
- **Chart tooltips** are dark: `#151a24` bg, `#1d2939` border, rounded-8 (set once in `components/charts/base-chart.tsx` theme).
- **Segmented tabs** (MFT/HFT etc.): container `bg-secondary rounded-[20px] p-0.5`; active trigger `bg-surface text-white shadow-sm rounded-[18px]`; inactive muted.
- **Tables**: shared `Table` primitive; `table-fixed` + `%`-width columns (no auto-layout gaps); numbers right-aligned.
- **Multi-value cells** (Account↔Symbol pairs): stacked mini-rows aligned across columns, banded.

## 4. Icons

- **NO lucide-react.** Use `@solar-icons/react`, matching the Figma icon name (e.g. Figma "Bold/Video/Pause" → Solar `Pause weight="Bold"`). If Solar has no match, export the SVG from Figma into `components/icons/`. See [[icon-sourcing-rule]].

## 5. Charts (ECharts)

- Compose the shared `BaseChart`; it already registers the dark theme + dark tooltip + resize-after-mount (ResizeObserver + rAF) — required or charts render collapsed.

## 6. Complex components

- For IDE-like/complex screens (Create Strategy), check the reference project **`G:/Develop/xno-builder`** for the pattern before inventing one.

## 7. User-defined rules

<!-- The user adds project-specific Figma rules below. Keep them authoritative over the defaults above. -->
