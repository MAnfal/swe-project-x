---
title: Time slider — whole-range resize gesture
priority: low
created: 2026-09-20
origin: plan 2026-09-20-project-grain-prototype, chunk 04, review iteration 2
---

# Whole-range resize gesture on the time slider

## What

Mid-fi design page 10 ("Time slider anatomy") shows a `⇕ resize` affordance on the selected
range — a gesture that changes the window's *width* while keeping it anchored, as distinct
from dragging either handle independently.

## Why it is not built

Deferred by lead decision on 2026-09-20, during chunk 04's second review. Two reasons, both
checked rather than assumed:

1. **The design does not specify it enough to build.** A reviewer opened page 10 directly and
   confirmed none of the four state cards (REST / DRAGGING / HANDLE FOCUSED / PRESET APPLIED)
   fixes the gesture's **anchor** (which end stays put — the centre, the nearest handle, the
   window start?) or its **amount** (per what unit of pointer travel?). Building it means
   inventing the interaction, and an invented interaction in a chunk graded against the design
   is worse than a disclosed gap.
2. **The obvious keyboard binding is already taken.** `⇕` is Up/Down, which carry the ARIA
   slider meaning of ±step on the focused thumb. Overriding them would make this slider behave
   unlike every other slider a user has met, and accessibility conventions are a poor place to
   be novel.

## What it would take

A design decision first, not code:

- Name the anchor and the amount.
- Choose a gesture that does not collide with ARIA slider semantics — a pointer drag on the lit
  segment between the handles is the obvious candidate, with a keyboard equivalent that is not
  Up/Down.
- Decide what happens at the history bounds: clamp the width, or slide the window.

Then it is a contained change to `src/components/canvas/time-slider.tsx` plus its spec.

## Related

- `plans/2026-09-20-project-grain-prototype/04-canvas-topology/plan.md` § Design Input
- `plans/2026-09-20-project-grain-prototype/design/README.md`, page 10
- Chunk 04 shipped Home/End jump-to-bounds, which covers the "get to the edges fast" need that
  overlaps this gesture's most likely use.
