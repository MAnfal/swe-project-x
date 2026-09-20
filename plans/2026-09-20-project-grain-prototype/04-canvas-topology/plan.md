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

**Dependency edges are drawn, but only between touched packages.** An earlier draft of this
plan said edges would be computed and never rendered, to avoid an unreadable hairball. The
designs solve that a better way: untouched packages are dimmed and carry no edges, so only
the active subgraph is drawn, and the dashed edge from `package-2` into `render-engine` is
what makes the badge `4 direct · 2 via package-2` legible at a glance. Follow the designs.
Focus mode still narrows to one package's neighbourhood.

**Derivation is separate from rendering.** Which packages are active in a window, and how
many changes reached each one and by which path, is a pure function of the snapshot and the
selected range. It is written as a function over plain objects and tested directly. The
React components render what it returns.

This chunk runs in parallel with chunk 03, so it must not assume any baked snapshot exists,
and it must render a snapshot whose `enrichment` field is absent.

**Amended 2026-09-20 at the wave-3 preflight — read this before task T001.** This plan
previously said the chunk renders "the fixture snapshot committed by chunk 02". No such file
exists. What chunk 02 committed is a *recorded HTTP transcript*,
`src/lib/ingest/fixtures/xyflow-xyflow-2026-08-31.transcript.json`, not a snapshot. **You
produce the snapshot yourself**, by replaying that transcript through the committed
ingester — which needs no token and no network. Measured by the lead on 2026-09-20 on the
plan-branch tip; this exact command exits 0 and prints
`xyflow/xyflow …: 10 packages, 6 pull requests`:

```bash
node scripts/ingest.mts --repo xyflow/xyflow \
  --since 2026-08-31T00:00:00Z --until 2026-09-02T00:00:00Z \
  --out src/lib/snapshots/xyflow-xyflow-2026-08-31.json \
  --replay src/lib/ingest/fixtures/xyflow-xyflow-2026-08-31.transcript.json
```

Commit that file. It is captured output of the real producer, so Principle 4 is satisfied —
do not hand-author or hand-edit it, and regenerate it by re-running the command if it needs
to change. It carries no `enrichment`, which is exactly the shape the Test Plan's
snapshot-without-enrichment spec needs and the state the picker must render.

**The committed snapshot directory is `src/lib/snapshots/`**, files named
`<owner>-<repo>-<since-date>.json`. Chunk 03 bakes its three curated repositories into the
same directory under its own window-qualified names, in parallel with you. The window above
is yours; do not touch any other file in that directory, and expect chunk 03's files not to
exist on your base. After both merge the picker lists four snapshots, one of them
un-enriched — that is intended, and it is the case your renderer must already handle.

## Design Input — the designs are delivered; build against them

Mid-fidelity designs for this chunk's screens are committed at
`plans/2026-09-20-project-grain-prototype/design/mid-fi.pdf`. Read
`plans/2026-09-20-project-grain-prototype/design/README.md` first — it indexes the pages and
lists the decisions the designs settled that override what this plan said when it was
written.

This chunk needs pages 4 (Level 1 topology), 7 (empty state), 10 (time slider anatomy), 11 (light theme), and 1 (the landing card's dropdown).

**Open those pages before writing a presentation component.** Where a design contradicts
this plan's description of layout, hierarchy, wording or interaction, **the design wins** —
record the contradiction in the completion report so the plan gets corrected rather than
silently diverging. Do not implement a screen you have not looked at.

## Acceptance Criteria

- Given a snapshot, When the canvas renders, Then every app and package in the topology
  appears as a node on a pannable, zoomable canvas.
- Given a selected time range, When the canvas renders, Then packages with at least one
  pull request in that range are active and all others are inactive, distinguished by more
  than colour alone.
- Given an active package, When its node is read, Then it shows the number of pull requests
  that reached it directly and the number that reached it indirectly, naming the package
  they came through.
- Given a range, When the canvas renders, Then dependency edges are drawn between touched
  packages and untouched packages carry none, with an edge reaching a package indirectly
  visually distinct from a direct dependency edge.
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

Render edges only between touched packages, and distinguish an indirect reach from a direct
dependency edge — the designs use a dashed violet edge against a solid grey one.

Inactive nodes must be distinguishable without relying on colour — the designs pair dimming
with a dashed border. Direct versus indirect is carried by the badge text as well as by
colour, so neither distinction rests on hue alone.

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

- [ ] T000 — replay chunk 02's committed transcript to produce
      `src/lib/snapshots/xyflow-xyflow-2026-08-31.json` and commit it, using the exact
      command in Context. Every spec below reads it, so it lands first
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

All five run against the snapshot you replay and commit (see Context). Assert the values a consumer
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
| `src/lib/snapshot.ts` | The merged schema itself — `Snapshot`, `PackageNode`, `PackageEdge`, `IndirectReach` types to import rather than re-declare |

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
pnpm test
pnpm build
pnpm typecheck

# Gate 2 — the repository picker discovers snapshots rather than hardcoding them. Assert no
# source file outside the snapshot directory contains a literal curated repository name.
src=$(git ls-files 'src/**/*.ts' 'src/**/*.tsx' 2>/dev/null | tr '\n' ' ')
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
- [ ] `src/lib/snapshots/xyflow-xyflow-2026-08-31.json`, **committed** — produced by
      replaying chunk 02's transcript, never hand-edited
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
