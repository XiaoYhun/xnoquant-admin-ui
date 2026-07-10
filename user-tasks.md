## Purpose

I will write down tasks here, you do them whenever you have free time or got blocked, bring in subagents to help. Have another md file to track progress.
Sync tasks-progress.md ↔ user-tasks.md; remove tasks the user removes. Do NOT edit user-tasks.md (user manages it).
Before do any task, make sure tasks-progress.md synced up

## Tasks
- For MFT Charts, when select Stage Test, Simulate or Live, chart should have multiple stage show on chart, with different color, you can check how it works in xno-builder.
- There is incorrect design Performance tab, and Analysis tab for MFT only, bring them from xno-builder. For current implement, leave them as HFT related
- The Live stage select button has a disable condition in xno-builder, bring them in

- Help me check if Paper Trading exist in xno-buider, or in xalpha API? write down answer in tasks-progress
- Help me read project hft-platform and understand how hft apis work, and start implement them on all HFT related features

- On click Start Live Trading, update the modal to this design, wire API if have, try to understand the logic here, if select Arbitrage, There 2 fields Account 1 and 2, if no, only 1 field Account
@https://www.figma.com/design/B7Hh2GpERHUPyy3Zdv35sY/XNO-QUANT-AI?node-id=13982-130240&m=dev
- Make the Live Trading right panel after click Action button, similar UI and animation with one in Strategy List when click a strategy row.
- In Create Strategy page, the Plus btn should stick at right side if the Editor list too long, only let the list scroll, but the + button is stick on right side, in other case, the + button should place stick to the last editor 

## Bugs
- All charts hover tooltip number format weird, check it out
- The tag (Crypto - BTC) in Toolbar got fixed, it should show current Setting of the strategy.
- Fix Simulate HFT modal header and buttons, only middle scrollable