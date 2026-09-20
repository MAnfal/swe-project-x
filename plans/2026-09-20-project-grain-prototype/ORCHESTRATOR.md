---
owner: Anfal
created: 2026-09-20
plan_branch: feat/plan--project-grain-prototype
source_branch: main
---

# Project Grain — Codeowner Visibility Prototype — Orchestrator

A codeowner cannot see how work in their domain got done, because the cost of a drifting
approach is invisible in any single diff. This plan builds a deployable prototype: an
infinite canvas of the monorepo's packages, a time slider over the repository's history,
and three levels of progressive disclosure — which packages changed, what each change was
and how it was approached, and the ordered steps that produced it.

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
| 01 | Foundation | Not started | — | — |
| 02 | US1 | Not started | — | — |
| 03 | US1 | Not started | — | — |
| 04 | US1 | Not started | — | — |
| 05 | US1 | Not started | — | — |
| 06 | US2 | Not started | — | — |

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

- **Mode**: subagent-driven — chunks 03 and 04 are independent after 02 lands, and the
  remaining chunks each carry enough context to run in isolation.
- **Worktrees**: `.worktrees/<chunk-name>`, one per dispatched chunk, created from the plan
  branch tip and removed after that chunk's PR merges.
- **No stacking**: every chunk branch is cut from the plan branch and every chunk PR targets
  it. "Sequential" means the branch is cut later, not that it targets a sibling.

## Git

- **Plan branch**: `feat/plan--project-grain-prototype`, from `main`
- **Chunk branches**: `feat/project-grain-prototype--<chunk-name>`
- **Chunk PRs target**: the plan branch — all of them, parallel and sequential alike
- **Final PR**: plan branch → `main`

## Dependency Graph

```
Wave 1: [01]      → runnable Next.js app, gates wired, project.md true — FOUNDATION
Wave 2: [02]      → snapshot schema + deterministic ingest of a repo   — SEQUENTIAL
Wave 3: [03, 04]  → AI enrichment + baked snapshots · topology canvas  — PARALLEL
Wave 4: [05]      → change clusters and step chains on the canvas      — SEQUENTIAL
Wave 5: [06]      → live repository analysis from the landing page     — SEQUENTIAL
```

Wave 3 is parallel: chunk 03 works under `lib/ingest/` and `lib/ai/`, chunk 04 works under
`lib/view/`, `components/` and `app/page.tsx`. They share no file. Chunk 04 renders the
fixture snapshot chunk 02 commits, so it does not wait on 03's baked output.

## Story Checkpoints

After the last chunk of each story merges, the story is demoable on its own. This is what
makes the plan stoppable: the user can call it done after any checkpoint and keep working
software rather than a half-built layer.

| Story | Last chunk | Checkpoint — what works once this merges | Reached? |
| ----- | ---------- | ---------------------------------------- | -------- |
| Foundation | 01 | `pnpm dev` serves a Next.js page; type check, lint, tests and build all run and are recorded in `project.md` | ☐ |
| US1 (P1) | 05 | Open the deployed page, pick a pre-analyzed repository, scrub to any window, see which packages changed, expand one to its changes with labels and approach notes, expand a change to its ordered steps. No token, no network, no model call. | ☐ |
| US2 (P2) | 06 | Choose `Other…`, paste a GitHub monorepo URL, watch specific progress, and land on the same three levels with labels generated on demand. | ☐ |

## Design Decisions

The "why" behind choices that aren't obvious from the chunk plans. Not rules — context
for judgment calls. Amend in place with a dated note if one changes mid-execution.

1. **GitHub API is the only ingest source; no local clone.** A clone gives free diffs and
   unlimited history, but the deployed target has no git binary and no writable filesystem,
   and maintaining a second clone-based path would mean the demo runs on code the live path
   never exercises. One source, one code path, one snapshot schema.
2. **PR identity comes from the API, not from commit messages.** `git log --first-parent`
   plus a `(#123)` regex covers squash and merge commits but silently misses rebase merges,
   which leave no merge commit and no PR number. `/repos/{owner}/{repo}/pulls` and
   `/pulls/{n}/commits` are exact regardless of merge strategy.
3. **Dependency edges are computed but not drawn.** Transitive attribution ("this PR
   reached your package through Package 2") has no definition without the graph, but
   rendering every edge in a monorepo produces an unreadable hairball. The edges surface as
   a per-node count and on focus instead.
4. **AI never sits between a click and a frame.** Enrichment is one model call per pull
   request, keyed by merge SHA. Curated repositories ship with it baked into the committed
   snapshot; live repositories generate it on expand and reuse it for the session. This is
   also what keeps live analysis inside a single serverless request: ingest is deterministic
   API work only.
5. **The `approach` note is part of the enrichment schema, not a later feature.** It is one
   additional field on a model call the plan already makes, and it is the only field that
   answers the memo's actual question — how the work got done, rather than what changed.
6. **Pre-analyzed snapshots are captured output of the real ingester, never hand-authored.**
   A fixture written by hand to look like real output exercises only the simple case, and
   the divergence surfaces as a bug in the path that was never tested
   (`.claude/resources/bibles/swe/testing.md`). One schema, two producers: `bake` ahead of
   time, and the live route at request time.
7. **Level transitions replace the view; levels are not nested sub-flows.** dagre does not
   lay out sub-flows, and nesting would force elkjs and a more complex layout model for no
   gain the owner can see.

### Complexity

| Abstraction | What it buys | Flat alternative, and why it loses |
| ----------- | ------------ | ---------------------------------- |
| `Snapshot` as a Zod-validated contract between ingest and view | The view layer renders one shape whether it came from a committed file or a live API call, and the schema is the test oracle for both | Passing raw GitHub responses into the view. Loses: the view would branch on provenance, and every rendering test would need network shapes. |
| `discoverTopology(repo) → { nodes, edges }` as a single function | A second ecosystem later replaces one function body | A provider/plugin interface. Loses: an abstraction with exactly one implementation, built for a non-goal. |

No layer, base class, or registry is introduced. Ingest, enrichment and view derivation are
standalone functions over plain objects.

### Principle Exceptions

| Principle | Chunk | Why this ships anyway |
| --------- | ----- | --------------------- |

Empty. `project.md`'s Principles section is unwritten until chunk 01 fills it, so chunks
02–06 are the first work checked against it. Chunk 01 writes the Principles this plan is
graded against and records the date.

## Plan-Specific Constraints

- **`project.md` is written by chunk 01 and amended only at wave boundaries.** Chunks 02–06
  record any architecture fact they changed (a new dependency, a new command, a new kind of
  file) in their completion report under "project.md deltas"; the lead applies them when the
  wave merges. Two chunks in one parallel wave editing that file is the merge conflict this
  avoids.
- **Secrets never reach the client.** `GITHUB_TOKEN` and `ANTHROPIC_API_KEY` are read only
  inside route handlers and scripts. No `NEXT_PUBLIC_` variable carries a credential, and no
  chunk commits a `.env` file.
- **Live analysis is bounded.** Every live ingest caps what it fetches (window and pull
  request count) before it starts. An unbounded fetch on a public URL spends the owner's
  GitHub rate limit and model budget.
- **Route handlers that use Octokit or the AI SDK declare the Node.js runtime.** The Edge
  runtime does not support them.
- **Deployment target is Vercel.** No chunk may introduce a writable-filesystem dependency
  at request time, a background worker, or a git subprocess.
- **Chunks 04, 05 and 06 stop and ask the user for the mid-fi designs** before their first
  presentation component. The designs were still being produced when this plan was written.
  Each of those chunks does its derivation, routing and test work first, then asks. When the
  designs arrive they are authoritative over any layout this plan describes; a contradiction
  is recorded in the completion report so the plan gets corrected rather than diverging
  silently.
- **Regenerate the rubrics for chunks 02–06 when chunk 01 merges.** They were written while
  `project.md`'s Convention Map was still empty, so they carry what the plan knew rather
  than what the project declares. Once chunk 01 writes the map, run `generate-chunk-rubric`
  over each remaining chunk directory and keep whichever items it adds. Skipping this leaves
  every later review graded against a map the project no longer has an excuse for missing.
