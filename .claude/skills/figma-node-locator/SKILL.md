---
name: figma-node-locator
description: Use when you have one Figma node URL but need its parent, siblings, or the rest of a screen — e.g. "here's the tab bar, implement each tab", or a node whose surrounding layout you can't see. Covers navigating a Figma file by node id when page dumps are unusable.
---

# Locating Figma nodes from a single node URL

A handoff usually names one node. The design you actually need is its parent, its
siblings, or the screen around it — and the Figma MCP has no "get parent" call.
This is how to navigate anyway.

## 0. First, know what you're working against

`get_metadata` with **no** `nodeId` lists the file's pages. Two traps:

- **Page dumps are size-capped.** A big page errors with "exceeds maximum allowed
  tokens" and is written to a file. **Check that it ends with `</canvas>`** — if it
  does, it's complete and an absent node genuinely isn't on that page. Don't assume
  truncation.
- **The desktop file may be a branch.** Node-level queries resolve against the open
  Figma desktop file; the page listing resolves against the `fileKey`. If
  `14876:146506` resolves fine but appears in *no* page dump, you're on a branch —
  page enumeration is a dead end, and **only node-id probing will work**.

## 1. Read node ids as `<session>:<local>`

The prefix is an editing-session id. Everything a designer created in one sitting
shares it, with **near-contiguous** local ids. That's the whole basis for probing:

- Children follow their parent: a frame at `:145685` has children at `:145688+`.
- A **parent's local id is lower** than its children's.
- Gaps are normal — component *instances* give their internals `I<instance>;<child>`
  ids, which never appear as plain ids, so runs of "not found" mean nothing.

## 2. Walk up: probe `local-1`, `local-2`, …

To find a parent, query descending local ids. Batch 3–4 per message — they're
independent, and most will 404.

```
14876:146506  ← given (tab bar)
14876:146505  → <frame name="Tabs"> containing it   ✅ parent found
14876:146504  → not found
```

`get_metadata` on any node returns **its entire subtree**, so the moment you hit an
ancestor you get everything below it for free. Keep walking up until the frame you
get back is the screen you need. Watch the `width`/`height` and `x`/`y` in each
result — a 793-wide frame at `x=0 y=48` is tab *content*; a 1006-tall divider is
artboard furniture. That tells you how far up you are.

## 3. Map the session's extent with a coarse sweep

To learn what else was designed in that sitting, sweep the local id space in steps
of ~100, then bisect around hits:

```
14876:146000 → hit (chart bar)      14876:145500 → miss
14876:146400 → hit (screen header)  14876:146600 → miss
```

Bounds tell you what exists. A session spanning ~1000 ids is roughly one screen —
so if the redesign should have covered five tabs and you only find one screen's
worth, **the others were not designed.** Say so rather than inventing them.

## 4. When the trail goes cold

A **small isolated island** (e.g. exactly 5 nodes, nothing adjacent) is a *paste*:
its parent belongs to an older session, so probing the same prefix cannot find it.
Switch anchors instead of probing harder:

- **Harvest ids already in the codebase.** This repo cites its source node in each
  view's header comment. `grep -rhoE '[0-9]{4,5}:[0-9]+' app components` gives a set
  of real anchors across sessions — walk up from the one nearest your target.
- Query a known sibling and check whether its subtree contains your node id.

## 5. Stop and ask

If you can't establish the session prefix for a frame that should exist, **stop**.
Blind sweeps across unknown prefixes don't converge and burn dozens of calls.

Ask the user to **select the parent frame in Figma** — `get_metadata` prints a
`Currently selected nodes:` header with its id, so one selection unblocks everything
— or to paste a node-specific URL. Say which frame you need and what you already
ruled out.

## Budget

Finding a parent: 2–5 calls. Mapping a session: 10–15. Past ~20 with no new
information, go to §5. Never present a layout you inferred as if it came from the
design — the project rule (CLAUDE.md §1, and `figma-ui-implementation` §0) is to pull
the real node or say you couldn't.
