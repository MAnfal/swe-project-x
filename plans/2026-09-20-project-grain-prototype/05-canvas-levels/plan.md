---
chunk: 05
title: Canvas levels — change clusters, step chains, breadcrumb and onboarding
branch: feat/project-grain-prototype--canvas-levels
base: feat/plan--project-grain-prototype
execution: sequential
depends: [04]
file-limit-waived: true
file-limit-reason: "Three specs plus the derivation extension, then five presentation components (two node types, breadcrumb, walkthrough, empty state) that together make US1 demoable. Splitting would leave a level half-rendered."
---

# Chunk 05 — Canvas: change clusters and step chains

## Context

Chunk 04 answers "was my domain touched". This chunk answers the two questions that follow:
**what were those changes**, and **how were they built** — Levels 2 and 3 of the progressive
disclosure model, plus the navigation that makes moving between levels legible.

Level 2 is one node per pull request that reached the expanded package in the selected
window, directly or through a dependency. Each node carries the enrichment from chunk 03:
the label, the pull request's own metadata, the packages it spanned, and the one-line
`approach` note. **The approach note is the highest-value content on the screen** — it is
the only thing that says how the work was done rather than what changed — so it must be
readable at a glance rather than buried behind another interaction.

Level 3 is the ordered step chain that produced one change, rendered left to right, each
step naming the files involved.

Levels replace the view rather than nesting inside it. dagre does not lay out sub-flows, and
nesting would force a different layout engine for no gain the owner can see. A breadcrumb
carries the depth instead.

Once this chunk merges, US1 is complete and demoable end to end with no token, no network
call and no model call.

## Design Input — stop and ask before building any visual surface

Mid-fidelity designs for these screens are being produced separately and were not available
when this plan was written. **Before writing the first presentation component in this
chunk, stop and ask the user for them**, naming the screens this chunk needs:

- Level 2 change cluster nodes, including how the approach note is presented
- The fallback treatment for a change whose enrichment failed
- Level 3 step chain
- The breadcrumb
- The onboarding walkthrough
- The expanded-package empty state


Do the non-visual work first — it does not depend on the designs and is the bulk of the
chunk:

- the package-level and step-level derivation and their specs (T001–T004)


Then ask, and wait. When the designs arrive, build against them: they are authoritative
over any layout, spacing, hierarchy or wording this plan describes, and where they
contradict it, **the designs win** — record the contradiction in the completion report so
the plan can be corrected rather than silently diverging.

If the user says to proceed without them, say so explicitly in the completion report and
build to this plan's written description, keeping the components structured so a later
restyle does not require re-deriving behaviour.

## Acceptance Criteria

- Given an active package in the selected window, When it is expanded, Then exactly one node
  appears per pull request that reached it in that window, directly or indirectly.
- Given a change node, When it is read, Then it shows the label, the pull request number,
  the author, the merge date, the packages the change spanned, and the approach note.
- Given a change whose enrichment failed or is absent, When its node renders, Then it shows
  the pull request's own title and is distinguishable from a change with a real label —
  never a blank node.
- Given a change node, When it is expanded, Then its steps render as an ordered
  left-to-right chain, each step naming the files it covers.
- Given any level, When the breadcrumb is read, Then it shows the path from the repository
  through the package to the change, and each segment returns to that level when activated.
- Given the keyboard alone, When a node is focused, Then it can be expanded and collapsed
  without a pointer.
- Given a first visit, When the page loads, Then a dismissible walkthrough introduces the
  slider and the three levels, and it can be replayed afterwards.
- Given a package expanded in a window with no changes, When the level renders, Then it says
  so rather than rendering an empty canvas.

## What To Do

### 1. Level derivation, tested directly

Extend chunk 04's derivation module — do not start a second one. Add:

- for a package and a range: the ordered list of pull requests that reached it, each with
  its enrichment if present and the reason it was included (direct, or the package it came
  through),
- for a pull request: its ordered steps, each with the files it covers.

Ordering must be deterministic and stated: choose merge date or attribution order, and say
which in the completion report.

### 2. The nodes

A change node and a step node, both custom React Flow nodes built from the shadcn primitives
chunk 01 installed. The change node's layout should let the approach note be read without
another click — it is a sentence, so give it room rather than truncating it to a chip.

A change whose enrichment is missing or marked failed renders the pull request title and is
visibly distinct from an enriched one. Decide the treatment and say what it is; the rule is
that a viewer must never mistake a fallback label for a real one.

### 3. Navigation

- A breadcrumb showing repository → package → change, each segment activating that level.
- Expansion and collapse reachable from the keyboard, with visible focus.
- Level transitions replace the view; the slider stays visible and keeps driving what is
  shown at every level.

### 4. Onboarding and empty states

A short dismissible walkthrough — three or four steps covering the slider and the three
levels — shown on a first visit and replayable from a control on the page. Persist the
dismissal locally; it is a convenience, not state anyone else needs.

An empty state for an expanded package with no changes in the range, distinct from chunk
04's "nothing happened anywhere" state.

### Tasks

- [ ] T001 — write failing spec for package-level derivation — asserts one entry per pull
      request reaching the package in the range, with its inclusion reason; fails because the
      function does not exist
- [ ] T002 — write failing spec for the fallback path — asserts a pull request with absent
      or failed enrichment yields a record carrying the pull request title and a flag marking
      it as a fallback; fails because the function does not exist
- [ ] T003 — write failing spec for step derivation — asserts ordered steps with their files
      for a pull request; fails because the function does not exist
- [ ] T004 — edit the derivation module from chunk 04 — add package-level and step-level
      derivation
- [ ] T005 [P] — create the change node component — label, metadata, spanned packages,
      approach note, fallback treatment
- [ ] T006 [P] — create the step node component
- [ ] T007 — edit the canvas component — expansion state, level transitions, keyboard
      expand/collapse
- [ ] T008 [P] — create the breadcrumb component
- [ ] T009 [P] — create the onboarding walkthrough component, with replay
- [ ] T010 — create the expanded-package empty state
- [ ] T011 — create `completion-report.md` in this chunk directory

Judgment calls to explain in the completion report:

- You may order change nodes by merge date or by attribution; say which and why.
- You may render the fallback treatment as a badge, a muted style, or an explicit note; say
  which, and how a viewer tells it apart from a real label.
- You may hold expansion state in the URL or in component state; say which, and whether an
  expanded view can be shared as a link.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| Package-level derivation spec (T001) | One entry per reaching pull request, with inclusion reason and enrichment attached | The function does not exist |
| Fallback spec (T002) | Missing or failed enrichment yields the pull request title plus a fallback flag, never an empty label | The function does not exist |
| Step derivation spec (T003) | Ordered steps with their files; a pull request with no steps yields an empty chain rather than throwing | The function does not exist |
| Ordering spec | Two runs over one fixture return the same order | The function does not exist |

Run these against the fixture snapshot from chunk 02 and, once available, a baked snapshot
from chunk 03. Both must pass — that is what proves a snapshot without enrichment and a
snapshot with it are both renderable.

## Reuse Audit

This chunk extends chunk 04's derivation module and reuses its layout function, its canvas
component and the shadcn primitives from chunk 01. Record `Reuse: importing <X> from <Y>`
for each. Write new code only for the two node components, the breadcrumb, the walkthrough
and the empty state. Before adding any local-persistence helper, search for one already in
the tree.

## Reference Files

| File | Why |
| ---- | --- |
| `.claude/resources/project.md` | Stack, gate commands, Principles, Convention Map |
| `.claude/resources/bibles/swe/testing.md` | Assert the value a consumer receives; run against captured snapshots rather than hand-rolled approximations |
| `plans/2026-09-20-project-grain-prototype/04-canvas-topology/plan.md` | The derivation module and canvas this chunk extends, and why levels replace the view instead of nesting |
| `plans/2026-09-20-project-grain-prototype/03-ai-enrichment/plan.md` | The enrichment record's shape, and that a failed enrichment is marked rather than absent |

## External Dependencies

- `@xyflow/react` — custom nodes for the change and step levels, and the expansion
  interaction.
- shadcn/ui primitives from chunk 01 — card, badge, dialog, button.

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

# Gate 2 — the approach note is rendered, not just carried in the data. Assert the change
# node component reads the approach field. Adjust the field name to the schema in use.
node_src=$(git ls-files | grep -iE 'change.*node.*\.tsx$' | head -1)
[ -n "$node_src" ] || { echo "FAIL: no change node component found" >&2; exit 1; }
grep -qE '\bapproach\b' "$node_src" || {
  echo "FAIL: the change node does not render the approach note" >&2; exit 1; }

# Gate 3 — a missing enrichment cannot produce an empty label. Run the derivation spec that
# covers it and assert it executed, rather than trusting an exit code from an empty run.
out=$(pnpm test --run 2>&1); echo "$out"
echo "$out" | grep -Eq '[1-9][0-9]* (passed|passing)' || {
  echo "FAIL: test runner reported no executed tests" >&2; exit 1; }
GATE
```

**Prove each gate can fail.** Run every gate against the base commit and record the exact
command, exit status, and failure evidence — no change node component exists on base, so
gate 2 fails on its first assertion. Run the negative control per assertion: remove the
approach field from the component, confirm gate 2 fires, restore it from a copied backup —
not with `git checkout --` — and confirm the gate returns clean.

## Deliverables

- [ ] `completion-report.md` in this directory, **committed**, written from
      `.claude/resources/templates/completion-report.md`
- [ ] Package-level and step-level derivation, tested directly
- [ ] Change node and step node components, with an explicit fallback treatment
- [ ] Breadcrumb navigation and keyboard-reachable expand/collapse
- [ ] A dismissible, replayable onboarding walkthrough
- [ ] An empty state for an expanded package with no changes in range
- [ ] "project.md deltas" section in the completion report, for the lead to apply at the
      wave boundary

## Artifacts Checklist

- ☐ New tests for new behavior
- ☐ Existing tests updated — the derivation module gains functions
- ☐ Docs / conventions updated for changed behavior
- — Generated code re-run (no codegen)
- ☐ `.claude/resources/project.md` — report deltas; do not edit the file in this chunk
