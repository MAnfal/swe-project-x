---
id: templates/completion-report
description: Template for a chunk's completion-report.md — the implementer's evidence, read directly by the reviewer
---

# Chunk <NN> — Completion Report

<!-- Written by the implementer, committed with the chunk. The reviewer reads THIS FILE,
     not a relayed summary of it — a claim that only exists in a message cannot be graded
     and will be flagged as having no written artifact. -->

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `<path>` | <created / edited / deleted> | <what it does now> |

## Acceptance criteria

One row per criterion from the chunk plan. "Met" is not a verdict on its own — name the
thing a reader can open or run to see it for themselves.

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Given …, When …, Then … | yes | `<test name>` in `<path>`, or the command and its output |

## Tests

Red first, then green. A test that has never been observed failing is not evidence that it
checks anything, so both runs go here.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `<test name>` | <the failure, verbatim> | <pass> |

If this chunk had nothing testable, say which of types / declarative config / docs it was,
and why that leaves nothing to assert.

## Gates

For each gate in the chunk plan: the exact command, its output, and the base-tree
falsification — the gate run against the tree *without* this chunk's work, which must fail
there. A gate that passes on the base tree asserts something already true.

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| <name> | `<command>` | <output> | <the command's exit status and the failure it produced> |

Baseline captured at `<path>`: <N errors, M warnings> before this chunk. Gate results above
are the delta against it, not absolute counts.

## Judgment calls

Every decision the chunk plan asked to be explained, and anything chosen where a reader
would reasonably expect something else.

- **<Decision>** — chose <X> over <Y> because <the constraint that made it right>.

## Deviations from the plan

What the plan said, what was actually done, and why. A plan that turned out to be wrong is
normal and useful — the measurement wins, and this is where the next planner learns it.

- **<What the plan assumed>** — actually <what was true>. <What was done instead.>

## Left alone

Adjacent problems noticed and deliberately not fixed, so the reviewer doesn't read them as
oversights and the next plan can pick them up.

- <what, and where>
