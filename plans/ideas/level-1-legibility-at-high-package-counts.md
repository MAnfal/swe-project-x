---
title: Level 1 is a hairball on a repository with many packages
priority: medium
created: 2026-09-20
origin: plan 2026-09-20-project-grain-prototype, delivery boundary (Part 1 UI verification)
---

# Level 1 legibility at high package counts

## What

On a large monorepo analyzed over a wide window, Level 1 renders as a dense mesh in which
no individual package node is readable at the default zoom.

Measured 2026-09-20 at the delivery boundary, against the merged plan branch served by
`PORT=3100 pnpm start`:

| Repository | Packages | Dependency edges | Touched in window | Level 1 reads as |
| ---------- | -------- | ---------------- | ----------------- | ---------------- |
| `shadcn-ui/ui` (snapshot) | 5 | — | 5 of 5 | clear; every node and count legible |
| `trpc/trpc` (live, 90d) | 40 | 106 | 38 of 40 | crowded but navigable |
| `radix-ui/primitives` (live, 90d) | 68 | 513 | 66 of 68 | unreadable without zooming |

The `radix-ui/primitives` figures come from the analysis route's own `topology` progress
event (`{"packageCount": 68, "edgeCount": 513}`) and the workspace header
(`53 changes · 66 of 68 packages touched`).

## Why this is not a bug

No acceptance criterion is violated. US1 asks that changed packages render active and
every other package render visibly inactive "not by colour alone", and they do — the
legend distinguishes touched-directly, touched-via-a-dependency, and untouched by fill
**and** by a dashed outline. Focus mode also works exactly as specified: clicking
`@radix-ui/react-menu` reduced the view to its neighbours and offered
`Expand 16 changes →`. The view is correct; it is the *unfocused* default that stops
paying for itself past a few dozen packages.

## Why it was not fixed at delivery

Scope. The SPEC's revised clarification (2026-09-20) chose dimming over edge-hiding
deliberately — "the mid-fi designs avoid the hairball by dimming untouched packages rather
than by hiding edges, which makes indirect reach legible" — and that trade was sound for
the repositories the plan was specified against. What the delivery run surfaced is that
the chosen answer has a ceiling: at 66 of 68 packages touched, dimming has almost nothing
left to dim, and 513 edges are drawn regardless.

Changing it means revisiting a recorded SPEC clarification, which is a planning decision,
not an implementation detail.

## Directions worth considering

None of these is chosen; they are what the next planning session should weigh.

- **Default to a narrower window on a large repository.** The empty-state panel already
  computes and offers a "nearest activity" window; the same machinery could pick the
  opening window rather than defaulting to the full span.
- **Degrade edge rendering above a threshold.** Draw edges only for the focused node's
  neighbourhood once `edgeCount` passes some bound, keeping the per-node dependency count
  that the SPEC's first clarification settled on.
- **Open a large repository already focused**, on the package with the most direct
  changes, rather than on the whole topology.

## Where the evidence is

`plans/2026-09-20-project-grain-prototype/retro.md`, § "Delivery boundary — Part 1", under
"Two things worth seeing that no chunk review could have".
