---
chunk: 04
title: Canvas — topology view, time slider, and active/inactive derivation
branch: feat/project-grain-prototype--canvas-topology
base: feat/plan--project-grain-prototype
execution: parallel
depends: [02]
file-limit-waived: true
file-limit-reason: "Four derivation/layout specs plus their two modules, then five presentation components. The specs are the chunk's substance; splitting derivation from the canvas would leave a tested module nobody can see."
---

# Chunk 04 — Canvas: topology and time

## Context

This is Level 1: the codeowner opens the page, picks a repository, and sees the monorepo as
a set of nodes on an infinite canvas with a slider spanning the repository's history. Moving
the slider changes which packages are active. That single interaction is the product's
first claim — *something happened in my domain while I was away* — and everything else is
navigation into it.

Two decisions shape the work:

**Dependency edges are computed but not drawn.** The snapshot carries the dependency graph
because transitive attribution has no meaning without it, but rendering every edge in a
monorepo produces an unreadable hairball at exactly the moment the owner wants a quick
answer. Edges surface instead as a per-node count — `4 direct · 2 via Package 2` — and on
focus, where only the focused node's neighbourhood is shown.

**Derivation is separate from rendering.** Which packages are active in a window, and how
many changes reached each one and by which path, is a pure function of the snapshot and the
selected range. It is written as a function over plain objects and tested directly. The
React components render what it returns.

This chunk runs in parallel with chunk 03, so it renders the **fixture snapshot committed
by chunk 02**. It must not assume any baked snapshot exists, and it must render a snapshot
whose `enrichment` field is absent.

## Design Input — stop and ask before building any visual surface

Mid-fidelity designs for these screens are being produced separately and were not available
when this plan was written. **Before writing the first presentation component in this
chunk, stop and ask the user for them**, naming the screens this chunk needs:

- Level 1 topology canvas, with active and inactive packages
- The per-node direct/indirect badge
- The time slider, including its change-volume track and presets
- The repository dropdown
- The whole-canvas empty state


Do the non-visual work first — it does not depend on the designs and is the bulk of the
chunk:

- the derivation module and its specs (T001–T003, T005)
- the layout module and its spec (T004, T006)


Then ask, and wait. When the designs arrive, build against them: they are authoritative
over any layout, spacing, hierarchy or wording this plan describes, and where they
contradict it, **the designs win** — record the contradiction in the completion report so
the plan can be corrected rather than silently diverging.

If the user says to proceed without them, say so explicitly in the completion report and
build to this plan's written description, keeping the components structured so a later
restyle does not require re-deriving behaviour.

## Acceptance Criteria

- Given a snapshot, When the canvas renders, Then every app and package in the topology
  appears as a node on a pannable, zoomable canvas.
- Given a selected time range, When the canvas renders, Then packages with at least one
  pull request in that range are active and all others are inactive, distinguished by more
  than colour alone.
- Given an active package, When its node is read, Then it shows the number of pull requests
  that reached it directly and the number that reached it indirectly, naming the package
  they came through.
- Given a package node, When it is focused, Then its dependency neighbourhood is shown and
  the rest of the graph is not.
- Given the slider, When it is read, Then it shows the repository's full history, the
  selected range as explicit dates, a visual indication of where change volume clusters, and
  presets for the last 7, 30 and 90 days and all time.
- Given a range with no activity, When the canvas renders, Then an empty state says so.
- Given the same snapshot and range, When derivation runs twice, Then it returns the same
  active set and the same counts.
- Given the snapshot directory, When the repository picker renders, Then it lists the
  snapshots actually present rather than a hardcoded list.

## What To Do

### 1. Derivation, first and separately

A module under the view layer, taking a snapshot and a `{ from, to }` range and returning
what the canvas needs:

- the set of active package ids,
- per active package: the count of pull requests reaching it directly, and the indirect
  counts grouped by the package they came through,
- the change-volume series the slider renders behind its track,
- the repository's full history bounds.

Plain functions over plain objects. No React, no layout, no side effects — this is the part
the tests exercise.

### 2. Layout

Position nodes with dagre. Keep layout in its own function that takes nodes and edges and
returns positioned nodes; do not compute positions inside a component's render.

Note for later: dagre does not lay out sub-flows. Chunk 05 reveals deeper levels by
replacing the view rather than nesting inside a node, which is what keeps dagre viable.

### 3. The canvas

React Flow, with custom React nodes so the badge and the package name are ordinary
components. It is a client component. Keep the React Flow instance in one place and pass it
positioned nodes; do not spread graph state across several components.

Inactive nodes must be distinguishable without relying on colour — opacity plus border
weight, or a similar pairing.

### 4. The time slider

A range control with two handles across the repository's full history, showing:

- the selected range as explicit dates,
- change volume over time behind the track, from the series the derivation module returns,
- presets for last 7 / 30 / 90 days and all time.

Use the project's existing slider primitive from chunk 01's shadcn install rather than
adding a new dependency — check what it supports for two handles before reaching for
anything else, and say in the completion report what you found.

### 5. The repository picker and the page

A dropdown listing the snapshots present in the snapshot directory, discovered rather than
hardcoded — chunk 03 bakes more of them in a parallel chunk, and a hardcoded list would go
stale the moment it lands. Selecting one renders it.

This chunk ships the dropdown only. Chunk 06 adds the `Other…` option, the URL input, and
the back arrow; leave room for them but do not build them here.

### Tasks

- [ ] T001 — write failing spec for window derivation — asserts the active set for a range,
      and that a package with no pull requests in the range is inactive; fails because no
      derivation module exists
- [ ] T002 — write failing spec for attribution counts — asserts direct and indirect counts
      per package, with the indirect count grouped by the package it came through; fails
      because no derivation module exists
- [ ] T003 — write failing spec for the change-volume series and history bounds — asserts
      the series covers the repository's full range; fails because no derivation module
      exists
- [ ] T004 — write failing spec for layout — asserts positioned nodes come back for a
      known graph and that the function is pure; fails because no layout module exists
- [ ] T005 [P] — create the derivation module
- [ ] T006 [P] — create the layout module
- [ ] T007 — create the package node component — name, active/inactive treatment, and the
      direct/indirect badge
- [ ] T008 — create the canvas component — React Flow wiring, pan/zoom, focus behaviour
- [ ] T009 — create the time slider component
- [ ] T010 — create the repository picker — discovers snapshots present
- [ ] T011 — edit the app's page — compose picker, canvas and slider; render the empty
      state when the range has no activity
- [ ] T012 — create `completion-report.md` in this chunk directory

Judgment calls to explain in the completion report:

- You may hold the selected range in component state or in the URL; say which, and whether
  a scrubbed view can be shared as a link.
- You may render the volume series as a histogram or a sparkline; say which, and how it
  behaves when one window dominates the rest.
- You may show the focus neighbourhood on hover or on click; say which, and how it is
  reached from the keyboard.

Verify the React Flow API surface — custom node registration, the fit-view and control
components, and whether server rendering needs explicit node dimensions — against the
installed `@xyflow/react` before relying on it. Where the measurement contradicts this plan,
**the measurement wins**.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| Window derivation spec (T001) | Active set for a range; inactive when a package has no pull requests in it; boundary dates included consistently | No derivation module exists |
| Attribution counts spec (T002) | Direct count, indirect counts grouped by the reaching package, direct-wins precedence preserved from the snapshot | No derivation module exists |
| Volume series spec (T003) | Series covers the full history; a window with no activity yields a zero bucket rather than a gap | No derivation module exists |
| Layout spec (T004) | A known graph returns positioned nodes; the same input returns the same positions | No layout module exists |
| Snapshot-without-enrichment spec | Derivation succeeds on a snapshot whose `enrichment` is absent | No derivation module exists |

All five run against the fixture snapshot chunk 02 committed. Assert the values a consumer
receives — the active set, the counts — not the shape of the input handed in.

## Reuse Audit

The snapshot schema and its types come from chunk 02; import them rather than re-declaring
the shape. Search for an existing date-range or grouping helper before writing one, three
ways: by name, by algorithm (`group`, `bucket`, `range`), and by problem (`window`,
`between`, `histogram`). Record the outcome.

## Reference Files

| File | Why |
| ---- | --- |
| `.claude/resources/project.md` | Stack, gate commands, Principles, Convention Map — including "no model call in the render path" |
| `.claude/resources/bibles/swe/testing.md` | Assert the resolved value a consumer receives, not the input; test against the captured fixture rather than a hand-rolled approximation |
| `plans/2026-09-20-project-grain-prototype/02-ingest-core/plan.md` | The snapshot schema this chunk reads, including that `enrichment` is optional |

## External Dependencies

- `@xyflow/react` — the canvas, custom node types, pan/zoom and controls. Client-side;
  verify whether it needs explicit node dimensions under server rendering.
- `@dagrejs/dagre` — node positioning. Note that it does not support sub-flows.
- shadcn/ui primitives installed in chunk 01 — slider, select, badge, card.

## Verification Gates

Read `.claude/resources/prompts/gates.md` first. Capture a baseline before running anything
that emits errors, and grade the delta.

```bash
bash -s <<'GATE'
set -euo pipefail

# Gate 1 — standard gates from project.md, type check last.
pnpm lint
pnpm test --run
pnpm build
pnpm exec tsc --noEmit

# Gate 2 — the repository picker discovers snapshots rather than hardcoding them. Assert no
# source file outside the snapshot directory contains a literal curated repository name.
src=$(git ls-files 'src/**/*.ts' 'src/**/*.tsx' 'app/**/*.tsx' 'lib/**/*.ts' 2>/dev/null | tr '\n' ' ')
if [ -n "$src" ] && grep -nE '"(xyflow/xyflow|shadcn-ui/ui|trpc/trpc)"' $src | grep -vE '^\s*(//|\*)'; then
  echo "FAIL: a curated repository name is hardcoded in source" >&2; exit 1
fi

# Gate 3 — active/inactive is not encoded by colour alone. Assert the inactive treatment
# changes at least one non-colour property. Adjust the property names to what was used.
GATE
```

Complete gate 3 against the component this chunk writes: assert the inactive state sets a
non-colour property (opacity, border width, or similar) and not only a colour token. Derive
the assertion from the component source or a rendered-output test, not from a count carried
from planning time.

**Prove each gate can fail.** Run every gate against the base commit and record the exact
command, exit status, and failure evidence. Run the negative control per assertion: plant a
hardcoded repository name and confirm gate 2 fires; remove it by restoring a copied backup —
not with `git checkout --` — and confirm the gate returns clean.

## Deliverables

- [ ] `completion-report.md` in this directory, **committed**, written from
      `.claude/resources/templates/completion-report.md`
- [ ] A derivation module: active set, direct and indirect counts, volume series, history
      bounds — tested directly
- [ ] A layout module using dagre
- [ ] Canvas, package node, time slider, repository picker components
- [ ] An empty state for a range with no activity
- [ ] "project.md deltas" section in the completion report, for the lead to apply at the
      wave boundary

## Artifacts Checklist

- ☐ New tests for new behavior
- — Existing tests updated (no prior view behavior)
- ☐ Docs / conventions updated for changed behavior
- — Generated code re-run (no codegen)
- ☐ `.claude/resources/project.md` — report deltas; do not edit the file in this chunk
