---
id: templates/orchestrator
description: Template for a plan's ORCHESTRATOR.md — the resumable state machine
---

---
owner: <git config user.name>
created: <YYYY-MM-DD>
plan_branch: <type>/plan--<plan-name>
source_branch: <branch this merges back into>
---

# <Plan Title> — Orchestrator

<1–2 sentences: what prompted this plan and what the end state looks like.>

## How to use this file

This is a **resumable state machine**. Any agent can cold-start here:

1. Read this file fully — the State table says where things stand.
2. Read `.claude/resources/prompts/execute.md` and follow it from the current state.
3. Read `retro.md` in this directory for carry-forward learnings from earlier chunks.

If resuming mid-execution, do not redo completed chunks — and inside a chunk that was
already started, its Tasks list is the resume point. The ticked boxes say what landed;
re-deriving that from the diff is how work gets done twice.

Every state transition gets two writes: a row in the Execution Log below, and a journal
entry in `retro.md`. The log is structured data; the journal is everything the log can't
hold.

## Spec

See `SPEC.md` in this directory.

## State

| Chunk | Story | Status | PR | Blocker |
| ----- | ----- | ------ | -- | ------- |
| 01 | US1 | Not started | — | — |
| 02 | US1 | Not started | — | — |

Every chunk names the story it serves. A chunk that serves no story is either scaffolding
that belongs inside another chunk, or scope that crept in.

**Status values**: `Not started` → `In progress` → `In review` → `PR open` → `Merged`.
Also `Blocked` and `Dismissed`.

A filled Blocker column means the chunk cannot proceed — surface it, skip to the next
unblocked chunk, re-evaluate after each state change.

Add an `Extra` row for any PR that merges during this plan but isn't a numbered chunk
(a mid-execution cleanup, an absorbed idea). Otherwise it vanishes from the record.

When every chunk is `Merged`, run `/plan:complete`.

## Execution Log

| Date | Event | Chunk | Detail |
| ---- | ----- | ----- | ------ |

Events: `wave_started`, `chunk_dispatched`, `gates_passed`, `review_iteration`,
`review_passed`, `pr_created`, `pr_merged`, `chunk_blocked`, `chunk_dismissed`,
`wave_merged`, `plan_delivered`.

Wave-boundary events are mandatory — the retro derives its wave metrics from them.

## Execution

- **Mode**: subagent-driven | inline — <one sentence on why>
- **Worktrees**: `.worktrees/<chunk-name>`, one per dispatched chunk, created from the plan
  branch tip and removed after that chunk's PR merges.
- **No stacking**: every chunk branch is cut from the plan branch and every chunk PR targets
  it. "Sequential" means the branch is cut later, not that it targets a sibling.

## Git

- **Plan branch**: `<type>/plan--<plan-name>`, from `<source-branch>`
- **Chunk branches**: `<type>/<plan-name>--<chunk-name>`
- **Chunk PRs target**: the plan branch — all of them, parallel and sequential alike
- **Final PR**: plan branch → `<source-branch>`

## Dependency Graph

```
Wave 1: [01, 02]  → <what this wave establishes> — PARALLEL
Wave 2: [03]      → <what this wave establishes> — SEQUENTIAL
```

## Story Checkpoints

After the last chunk of each story merges, the story is demoable on its own. This is what
makes the plan stoppable: the user can call it done after any checkpoint and keep working
software rather than a half-built layer.

| Story | Last chunk | Checkpoint — what works once this merges | Reached? |
| ----- | ---------- | ---------------------------------------- | -------- |
| US1 (P1) | NN | <what you can demo, with no later story built> | ☐ |
| US2 (P2) | NN | <…> | ☐ |

## Design Decisions

The "why" behind choices that aren't obvious from the chunk plans. Not rules — context
for judgment calls. Amend in place with a dated note if one changes mid-execution.

1. **<Decision>**: <rationale>

### Complexity

Every abstraction this plan introduces — a layer, a base class, an indirection — with what
it buys and what the flat alternative would have cost. An entry that can't justify itself
in two sentences is a sign the abstraction should come out.

| Abstraction | What it buys | Flat alternative, and why it loses |
| ----------- | ------------ | ---------------------------------- |

### Principle Exceptions

Any violation of a principle in `.claude/resources/project.md`, with the reason. Empty is
the expected state.

| Principle | Chunk | Why this ships anyway |
| --------- | ----- | --------------------- |

## Plan-Specific Constraints

Only rules unique to *this* plan that aren't already in the prompts.

- <constraint>
