# Create Strategy — build plan (Figma node → UI)

Figma file: XNO QUANT AI. Section **`14294:101743`** ("Create strategy"). Primary editor screen: **`13964:50200`**.
Build **piece by piece, matching Figma exactly** (per the `figma-ui-implementation` skill). Verify each in Chrome.

## Critical corrections vs the current (wrong) build
- **Code is PYTHON**, not Rhai. Sample: `from src.algo import StockAlgorithm` / `class MyAlgorithm(StockAlgorithm):` / `def __setup_data__(self):` / `self.buy(buy_signal, 1)`.
- Toolbar is NOT name+HFT/MFT+market+TF+Save. It's: **strategy name** · `MFT` badge · `···` menu · `● In sample` status pill · **`Crypto · BTC`** market pill · gear/copy/layout icon buttons · green **Simulate** button.
- Right-panel **Results** tab has two sub-tab rows + a chart selector (see below).
- Samples / Features have specific **card** designs (see below).
- There's a collapsible **Console** panel under the code editor.

## Layout (top → bottom), left column = editor, right column = panel
| Region | Figma node | Notes |
|---|---|---|
| Page Header (title + admin) | layout `Header` | exists (route title "Create Strategy") |
| **Editors bar** | `14175:92157` | Test bot AI · Crypto Scalping · `+`; close on hover. DONE — verify. |
| **Toolbar** | `13964:52172` (in `13964:50200`) | name · MFT badge · `···` · `In sample` pill · `Crypto · BTC` pill · gear/copy/layout icons · **Simulate** |
| **Code editor** | `13964:52186` | Monaco, **language=python**, xnoquant dark theme, line numbers |
| **Console panel** | `14034:37073` (in Features state `13964:56232`) | "Console N" header + log lines + clear/close; collapsible, under editor |
| **Right tabs** | `14180:15378` | underline: Samples · Results · Data · Features · Operators. DONE — verify. |

## Right-panel tab contents
- **Results** — `13964:56846` (Overview) + `13964:50200` (Analysis):
  - Row 1 sub-tabs: `Period: Train · Test · Simulate · Paper Trade`
  - Row 2 sub-tabs: `Overview · Performance · Analysis` (+ `Select chart` dropdown on Overview)
  - **Overview**: Aggregate Data metrics (Sharpe 1.56 · Turnover 2.58% · Fitness 0.88 · Returns 4.85% green · Drawdown -12.5% red · Margin 15.28%) → yearly table (Year·Sharpe·CAGR·Max dd·Profit factor·Calmar) → PNL area chart (green up / red drawdown area)
  - **Analysis**: Self correlation (slider Min -0.45 / Max 0.92 + red "High correlation" badge + warning "*Max Correlation > 0.8…") → correlation table (Name·Universe·Correlation·Sharpe·Returns, green Returns) → "Performance Comparison" chart (strategy vs VN-Index)
  - **Performance**: pull design (find sub-state)
- **Samples** — `13964:55798`: search "Search by name, category…" + `All Categories` dropdown → collapsible category sections ("Trend Confirmation / Momentum", "Technical Indicators") → sample cards (icon + name + desc; **selected** card = green border + "</> View source" + "Use template" buttons)
- **Features** — `13964:56232`: search "Search features…" → feature cards (`</>` icon + name + **`Returns: SeriesT`** badge + code signature `self.feat.ema(series: SeriesT, window: int)` + description)
- **Data** — node TBD (pull; find the tab-state frame)
- **Operators** — node TBD (pull; find the tab-state frame)

## Modals (later slice)
- Select Strategy Type `14135:29458` · Settings `14256:148354` · Select account `14072:16907`

## File ownership (parallel, disjoint)
- **Shell (Opus owns):** `page.tsx` (assembly), `results-panel.tsx` (tab bar → switches to tab components), `lib/mock/strategy-builder.ts` (Python code + samples/features/operators/data/correlation), `code-editor.tsx` (python), `editors-bar.tsx`.
- **Agent — Toolbar:** `toolbar.tsx` (node 13964:52172)
- **Agent — Console:** `console-panel.tsx` (node 14034:37073)
- **Agent — Results tab:** `results-tab.tsx` (nodes 13964:56846 + 13964:50200)
- **Agent — Samples tab:** `samples-tab.tsx` (node 13964:55798)
- **Agent — Features/Data/Operators tabs:** `features-tab.tsx`, `data-tab.tsx`, `operators-tab.tsx` (node 13964:56232 + find Data/Operators)
