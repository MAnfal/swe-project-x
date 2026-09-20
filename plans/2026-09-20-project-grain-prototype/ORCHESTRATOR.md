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
| 01 | Foundation | Merged | [#1](https://github.com/MAnfal/swe-project-x/pull/1) | — |
| 02 | US1 | Merged | [#2](https://github.com/MAnfal/swe-project-x/pull/2) | — |
| 03 | US1 | Merged | [#3](https://github.com/MAnfal/swe-project-x/pull/3) | — |
| 04 | US1 | Merged | [#4](https://github.com/MAnfal/swe-project-x/pull/4) | — |
| 05 | US1 | In review | — | — |
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
| 2026-09-20 | `wave_started` | — | Wave 1 — preflight clean: plan branch level with `origin/main`, all chunk-01 reference paths resolve, pnpm 9.15.4 / node v24.13.0 present |
| 2026-09-20 | `chunk_dispatched` | 01 | Worktree `.worktrees/01-boilerplate` on `feat/project-grain-prototype--boilerplate`; bootstrap is a no-op (no project exists yet) |
| 2026-09-20 | `designs_received` | — | `design/mid-fi.pdf` (11 pages) + `design/README.md` committed at `887056f` mid-wave-1, with chunks 02/04/05/06 and their rubrics amended to match. Unblocks the stop-and-ask in Plan-Specific Constraints; adds Design Decisions 8 and 9 and amends 3 |
| 2026-09-20 | `gates_passed` | 01 | Lead re-ran all four at `c391559` after the last edit, type check last: `pnpm lint` 0, `pnpm test` `Tests 3 passed (3)`, `pnpm build` compiled, `pnpm typecheck` 0 |
| 2026-09-20 | `pr_created` | 01 | [#1](https://github.com/MAnfal/swe-project-x/pull/1) → `feat/plan--project-grain-prototype`, at `f958434` (chunk work `c391559` + plan-branch bookkeeping merged in) |
| 2026-09-20 | `review_passed` | 01 | Iteration 1. Reviewer re-derived gate falsifiability with its own canaries and independently verified the `src/lib/**` arbitration against both sources. Two non-blocking warnings: `project.md` frontmatter still carries `id:`; `shadcn` sits in `dependencies` |
| 2026-09-20 | `pr_merged` | 01 | #1 merged at `5e49bd2`. Lead re-verified the merged tree: `pnpm lint` 0, `pnpm test` `Tests 3 passed (3)`, `pnpm build` compiled, `pnpm typecheck` 0; `pnpm dev` serves HTTP 200 at localhost:3000 |
| 2026-09-20 | `wave_merged` | — | Wave 1 complete. Worktree `.worktrees/01-boilerplate` removed; `git worktree list` clean. Foundation story checkpoint reached |
| 2026-09-20 | `preflight_failed` | 02 | Wave 2 preflight caught two gate defects invisible until chunk 01 wrote `project.md`: Gate 1's `pnpm test --run` exits `ERROR Unknown option: 'run'` before vitest starts (fatal under `set -euo pipefail`), and Gate 3's `lib/**/*.ts` glob matches nothing. Both fixed at `20c9ff9`, with `pnpm exec tsc --noEmit` replaced by the declared `pnpm typecheck` |
| 2026-09-20 | `wave_started` | — | Wave 2 — preflight clean after the fixes: plan branch 0 behind `origin/main`, all six chunk-02 reference paths resolve, chunk-01 outputs present on the plan branch. Chunk 02's rubric regenerated against the now-populated Convention Map |
| 2026-09-20 | `chunk_dispatched` | 02 | Worktree `.worktrees/02-ingest-core` on `feat/project-grain-prototype--ingest-core` from `5e49bd2`; bootstrapped with `pnpm install` and a `.env.local` carrying a real `GITHUB_TOKEN` (gitignored) so the fixture can be captured rather than hand-authored. All four gates verified green in the worktree before dispatch |
| 2026-09-20 | `review_iteration` | 02 | Iteration 1 **FAIL**, narrow — no behavioural defect. Reviewer mutation-tested rather than trusting the red run: 29 mutants, 20 caught, 9 survived (and it invalidated its own first harness run — `--reporter=basic` is not a Vitest 5 reporter, so every run exited 1 and every mutant looked caught). Blockers: three tests that cannot fail, and three references to `scripts/ingest.ts` when the file is `.mts`. Lead reproduced all three independently |
| 2026-09-20 | `review_passed` | 02 | Iteration 2, fresh reviewer (never reused). 27 mutants, 23 fatal; confirmed the three fixes generalize against 8 *different* wrong implementations, that the zod premise assertion fires, and that `transcriptWithReversedListing()` permutes only what is under test. No blocking issues |
| 2026-09-20 | `gates_passed` | 02 | Lead re-ran all four at `c1b8266` after the last edit, type check last: `pnpm lint` 0, `pnpm test` `Tests 94 passed (94)`, `pnpm build` 0, `pnpm typecheck` 0. Also re-applied 7 mutants independently — all fatal, tree byte-identical after each |
| 2026-09-20 | `pr_created` | 02 | [#2](https://github.com/MAnfal/swe-project-x/pull/2) → `feat/plan--project-grain-prototype`, at `c1b8266` (7 commits) |
| 2026-09-20 | `pr_merged` | 02 | #2 merged at `000da8d`. Lead re-verified the merged tree, type check last: `pnpm lint` 0, `pnpm test` `Tests 94 passed (94)` / 7 files, `pnpm build` 0, `pnpm typecheck` 0 |
| 2026-09-20 | `wave_merged` | — | Wave 2 complete. Worktree `.worktrees/02-ingest-core` removed; `git worktree list` clean. Its presence was why the first `pnpm lint` on the merged tree reported 148 errors — all under `.worktrees/`; promoted to `project.md` |
| 2026-09-20 | `preflight_failed` | 03, 04 | Wave 3 preflight halted on four defects. (a) Chunks 03–06 all still carried wave 2's two gate defects — the fix at `20c9ff9` was applied to chunk 02 only; re-measured, `pnpm test --run` exits 1, `pnpm exec tsc --noEmit` exits 0 but is off-convention. (b) Chunk 04's gate 2 globbed `app/**/*.tsx` and `lib/**/*.ts`, which match 0 files in a `src/`-rooted project. (c) Chunk 04 was written against a "fixture snapshot committed by chunk 02" that does not exist — chunk 02 committed a *transcript*. (d) Rubrics 03–06 were never regenerated against the Convention Map despite the explicit Plan-Specific Constraint; 02 had 6 citations, 03 and 04 had 0. All four fixed; 03 and 04 rubrics regenerated (05 and 06 regenerate before their own waves) |

| 2026-09-20 | `chunk_dispatched` | 04 | Worktree `.worktrees/04-canvas-topology` on `feat/project-grain-prototype--canvas-topology` from `a2b8565`; bootstrapped with `pnpm install`, all four gates verified green before dispatch. No credential needed — its snapshot is replayed offline from chunk 02's transcript |
| 2026-09-20 | `chunk_dispatched` | 03 | Worktree `.worktrees/03-ai-enrichment` from `cb41f75`, bootstrapped with `pnpm install` and `.env.local` carrying a working `GITHUB_TOKEN` and a workspace-scoped `ANTHROPIC_API_KEY`. Dispatch was held ~40 min on credentials: the first key was org-scoped (400, needs `anthropic-workspace-id`) and the second was invalid (401) |
| 2026-09-20 | `gates_passed` | 04 | Lead re-ran all four in the worktree, type check last: `pnpm lint` 0, `pnpm test` `Tests 135 passed (135)` / 10 files, `pnpm build` 0, `pnpm typecheck` 0. Snapshot provenance verified — byte-identical to a fresh offline replay except `metadata.analyzedAt`. Lead also drove the running app and looked at Level 1, focus and the empty state directly |
| 2026-09-20 | `gates_passed` | 03 | Lead re-ran all four in the worktree, type check last: `pnpm lint` 0, `pnpm test` `Tests 135 passed (135)` / 9 files, `pnpm build` 0, `pnpm typecheck` 0. Enrichment coverage derived from the files rather than the report: 100/100, 36/36, 100/100, zero missing `label`/`approach`/`steps` |
| 2026-09-20 | `review_iteration` | 04 | Iteration 1 **FAIL**, narrow — no architectural defect. Reviewer mutation-tested `derive.ts`/`layout.ts` (7 mutants) and found two survivors: `historyBounds`'s widening loop and `volumeSeries`'s final-bucket clamp both delete with 135/135 still green, because the fixture has no PR outside the window or on a bucket boundary. Lead reproduced both independently. Also: an undisclosed design deviation on page 10 (Home/End and whole-range resize), verified against the `@base-ui/react` primitive source, and a missing statement that designs preceded implementation |

| 2026-09-20 | `review_iteration` | 03 | Iteration 1 **FAIL**, one blocking item — no behavioural defect. Reviewer mutated `resolveSteps`' prefix-uniqueness check (`=== 1` → `>= 1`, silently accepting an ambiguous SHA prefix) and all 135 tests stayed green; the collision case is untested though the code handles it. Lead reproduced it, plus the non-blocking case-insensitivity survivor. Reviewer independently confirmed both plan gate defects the chunk reported |

| 2026-09-20 | `review_passed` | 03 | Iteration 2, fresh reviewer (never reused). Confirmed production code byte-identical to the reviewed tree — the specs were the defect, not the code. Swept five areas neither prior reviewer touched (zero-commit skip, fallback-is-not-a-cache-hit, key derivation, payload bounding, `assertSafeKey`/`buildRecord`) and killed all five mutants. Independently re-verified both plan gate-defect fixes on a detached worktree at `cb41f75`. Two non-blocking warnings |
| 2026-09-20 | `gates_passed` | 03 | Lead re-ran all four at `4133d49` after the last edit, type check last: `pnpm lint` 0, `pnpm test` `Test Files 9 passed (9) / Tests 140 passed (140)`, `pnpm build` 0, `pnpm typecheck` 0. Also re-applied all four SHA-resolver mutants independently — each killed a named test, tree clean after each |
| 2026-09-20 | `pr_created` | 03 | [#3](https://github.com/MAnfal/swe-project-x/pull/3) → `feat/plan--project-grain-prototype`, at `4133d49` (3 commits) |

| 2026-09-20 | `review_iteration` | 04 | Iteration 2 **FAIL**, fresh reviewer. Confirmed iteration 1's two mutants are genuinely dead, then widened as instructed and found three new survivors in the same functions — `historyBounds`' two boundary-tie comparisons and `volumeSeries`' span guard, each 144/144 green. Lead reproduced all three and split them by reachability: `github.ts:139` filters to `[since, until)` so the ties are defensive-only, but `snapshotSchema` accepts a zero-width **and inverted** window, so the span guard is reachable and yields a silent `NaN`. Iteration 3 scoped to those three plus a reachability disclosure, with a stated stopping rule: further survivors confined to unreachable defensive code are warnings, not blockers |

| 2026-09-20 | `pr_merged` | 03 | #3 merged at `45866bf`, brought onto the plan branch by merge (never rebase) at `ccaadcf`. Lead re-verified the merged tree: lint 0 (scoped `pnpm exec eslint src scripts`, because chunk 04's worktree is still live), `pnpm test` `Test Files 9 passed (9) / Tests 140 passed (140)`, `pnpm build` 0, `pnpm typecheck` 0. Worktree `.worktrees/03-ai-enrichment` removed. Chunk 03's 8 `project.md` deltas applied by the lead, with the new CLI flags verified against `scripts/ingest.mts --help` rather than trusted |

| 2026-09-20 | `review_iteration` | 04 | Iteration 3 **PASS**, fresh reviewer (third, never reused). Re-applied all three iteration-2 mutants itself and watched each named test fail. Hunted beyond them and found three more survivors, then argued each across the lead's stopping rule rather than hiding behind it — and **measured** that `layout.ts`'s self-edge guard changes nothing about the output rather than asserting unreachability. Also re-derived the "lower clamp is unreachable" argument independently instead of accepting the report's word. No blocking issues |
| 2026-09-20 | `chunk_blocked` | 04 | Briefly — merging the plan branch into chunk 04 turned 3 tests red. One was its own generated index (working as designed). The other two were chunk 03's `baked-snapshots.test.ts`, which quantifies over `src/lib/snapshots/` and asserts every file carries enrichment, against chunk 04's deliberately un-enriched snapshot. **Lead planning defect**: one directory holding two kinds of file invites a test that quantifies over the directory. Resolved on chunk 04's branch by changing the discriminator — absent `enrichment` means un-enriched fixture; present means it must be complete, so **partial** enrichment now fails on any snapshot. Stronger than what it replaced |
| 2026-09-20 | `gates_passed` | 04 | Lead re-ran all four at `257b7d3` **on the merged tree**, type check last: `pnpm lint` 0, `pnpm test` `Test Files 12 passed (12) / Tests 202 passed (202)`, `pnpm build` 0, `pnpm typecheck` 0. Re-ran the two decisive canaries independently — deleting a curated snapshot's enrichment fires only the curated assertion, proving the two checks are not redundant. Also drove the built app and looked at the four-snapshot picker and Level 1 directly |
| 2026-09-20 | `pr_created` | 04 | [#4](https://github.com/MAnfal/swe-project-x/pull/4) → `feat/plan--project-grain-prototype`, at `257b7d3`. Carries the plan-branch merge, so its diff is what actually lands |
| 2026-09-20 | `pr_merged` | 04 | #4 merged at `30b90ee`; plan branch fast-forwarded to it (no local merge needed — 0 ahead, 9 behind). Worktree `.worktrees/04-canvas-topology` removed; `git worktree list` clean. Lead re-verified the merged tree with the worktree gone, type check last: `pnpm lint` 0, `pnpm test` `Test Files 12 passed (12) / Tests 202 passed (202)`, `pnpm build` 0, `pnpm typecheck` 0. Merged tree byte-identical to the reviewed `257b7d3` except plan bookkeeping |
| 2026-09-20 | `wave_merged` | — | Wave 3 complete — chunks 03 and 04 both merged, the plan's only parallel wave. Level 1 driven in a browser against `pnpm start` on the merged tree: topology nodes, direct/indirect counts, dashed dependency edges, legend and the slider histogram all render. Chunk 04's 8 `project.md` deltas applied by the lead, each measured first rather than trusted — including the dagre default-export shape (`default.Graph` is `undefined`), the `prebuild` hook, and the snapshot-index canary (an unindexed snapshot makes `catalog.test.ts` report `Tests 1 failed \| 4 passed`). The boundary check also caught that `539c42c` had orphaned the Layout section's `lib/` description under `snapshots/` and omitted `ingest/` and `view/` — repaired, and journaled as framework friction against the batched-delta constraint |

| 2026-09-20 | `preflight_failed` | 05 | Wave 4 preflight halted on three defects, all from the design amendment being applied to some sections of chunk 05 and not others. (a) The plan contradicted itself on Level 2: Context, all four relevant acceptance criteria, tasks T005/T006, the Reuse Audit and the Deliverables said "node", while § "The nodes" and the design README say a **card list anchored to the package, not a graph of pull-request nodes** (design page 5, Design Decision 8). (b) The rubric carried both vocabularies — items graded "exactly one node per pull request" and "Level 2 presents changes as cards" simultaneously, so a correct implementation fails one of them whatever it builds. (c) Gate 2 resolved its target with `git ls-files \| grep -iE 'change.*node.*\.tsx$'` and exits 1 with "no change node component found" — it hunts for a filename the design tells the implementer not to create, so it fails on correct work. All three fixed; base freshness clean (0 behind `origin/main`), all six reference paths resolve, worktrees clean |
| 2026-09-20 | `rubric_regenerated` | 05 | Regenerated against the Convention Map per the standing Plan-Specific Constraint — it had never been run for 05. Injected the `src/components/**/*.tsx`, `src/components/ui/**`, `src/lib/**/*.ts`, test-convention and manifest rows (~20 items → ~40). Bible citations stay at 2, correctly: every matching row except the test rows carries `Doc: —`, and the skill forbids inventing a page. Folded in two wave-3 carry-forwards under Step 6.5 — a constructed-input test per defensive branch (the failure mode that sank the first review of 02, 03 and 04, in the same file 05 extends), and Level 2 rendering a snapshot with no `enrichment` key at all |
| 2026-09-20 | `wave_started` | — | Wave 4 — preflight clean after the three chunk-05 fixes: plan branch 0 behind `origin/main`, all nine dispatch-brief paths resolve in the worktree, worktrees swept |
| 2026-09-20 | `chunk_dispatched` | 05 | Worktree `.worktrees/05-canvas-levels` on `feat/project-grain-prototype--canvas-levels` from `0914657`; bootstrapped with `pnpm install`, all four gates verified green in it before dispatch (lint 0, `Tests 202 passed (202)` / 12 files, build 0, typecheck 0). No credential needed — Levels 2 and 3 render committed snapshots offline. Brief carries the two data carry-forwards (one of four snapshots has no `enrichment` key; the invariant is absent-or-complete) and the constructed-input mutation requirement, since 05 extends the same `derive.ts` whose guards survived chunk 04's review |
| 2026-09-20 | `gates_passed` | 05 | Lead re-ran all four in the worktree at `597c8b3` after the last edit, type check last: `pnpm lint` 0, `pnpm test` `Test Files 12 passed (12)` / `Tests 234 passed (234)`, `pnpm build` 0 with `/` still `○ (Static)`, `pnpm typecheck` 0. Re-applied two of the implementer's own mutants independently (M11 right-align, M15 entry-point predicate) — each killed its named tests, tree byte-identical after each. Verified Principle 2 with a converse control: no `@ai-sdk`/`anthropic` in the 10 client chunks while `approach` is present, proving the search scope was live. Drove the app through Levels 1–3, the onboarding tour and the un-enriched snapshot's fallback |
| 2026-09-20 | `review_iteration` | 05 | Iteration 1 **FAIL**, one blocking item — no architectural defect. This is the first chunk in the plan to mutation-test itself before review (15 mutants, 14 killed; the survivor diagnosed as dead code, deleted, replaced with an invariant test). The fresh reviewer found what that sweep missed: `assignGroups`' remainder-distribution comparison at `derive.ts:571` is unpinned — redistributing the remainder to the trailing steps leaves 234/234 green. Lead reproduced it and **widened the reachability measurement**: 13 of 236 enriched changes hit the branch (incl. #5978 at `extra=2`, which separates distributions that `extra=1` cannot), so it is reachable production behaviour, not defensive code. Two non-blocking warnings: `enrichment-record.ts` has no co-located spec, and `step-card.tsx:62-65` carries a state distinction by colour alone. Reviewer also re-derived the implementer's equivalent-mutant claim from the code rather than the fixtures and confirmed it holds generally |
| 2026-09-20 | `review_iteration` | 05 | Iteration 2 fixes, verified by the lead. Production code untouched — only specs, one component and the report, which is the right shape when the finding was missing evidence rather than wrong behaviour. Lead re-applied the blocking mutant: it now kills the named test `gives the leftover file groups to the earliest steps, not the last ones` (`1 failed | 245 passed (246)`), tree byte-identical after restore. The implementer's M20 equivalence claim was re-derived independently by transcribing both branches and comparing all `(groups, steps)` pairs over `0..40 × 1..40` — **1640 pairs, 0 differ** — so it is equivalence, not an untested guard. Implementer also re-measured the reachability sweep itself before fixing and reached the same 13 changes |
| 2026-09-20 | `review_passed` | 05 | Iteration 2 **PASS**, third reviewer (never reused). Rather than re-confirming prior findings it mutated the parts of `derive.ts` neither earlier pass had touched — `summarizeChange`'s package-chip filter, `dependencyFirst`'s tie-break sort, `assignGroups`' fewer-groups-than-steps offset — and all three died against named tests, zero survivors. Independently re-verified the `FALLBACK_APPROACH` mutant and confirmed by script that the no-`enrichment`-key snapshot drives an all-fallback, non-blank result. Read all five presentation components against design pages 5/6/9. One non-blocking warning: `change-card.tsx:81` hardcodes `aria-expanded={false}` on a control that navigates rather than expands, so it announces a permanently collapsed widget. Lead verified the removal is inert (nothing styles or tests off it — `ChangeCard` is a raw `<button>`, not the shadcn `Button`) and sent it back as a one-line fix with a matching correction to the report, which had justified keyboard support *by* that attribute |
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
| Foundation | 01 | `pnpm dev` serves a Next.js page; type check, lint, tests and build all run and are recorded in `project.md` | ☑ 2026-09-20 |
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
3. ~~**Dependency edges are computed but not drawn.**~~ **Amended 2026-09-20**, before any
   canvas chunk started: edges *are* drawn, but only between touched packages. Transitive
   attribution has no definition without the graph, and the original concern — that a
   monorepo with every edge drawn is an unreadable hairball — is real. The mid-fi designs
   resolve it by dimming untouched packages and giving them no edges, so only the active
   subgraph is drawn. That reads better than a count alone, because the dashed edge is what
   makes "2 via package-2" mean something. See decision 8.
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
8. **The mid-fi designs are authoritative over this plan's visual descriptions.** Delivered
   2026-09-20 and committed at `design/mid-fi.pdf`, indexed by `design/README.md`. They
   revised two decisions taken before they existed: Level 1 now draws edges between touched
   packages (dimming, not hiding, is what prevents the hairball), and Level 2 is a card list
   anchored to the expanded package rather than a graph of pull-request nodes.
9. **No background jobs.** The designs' progress and error screens carry copy promising that
   analysis survives a closed tab and that a retry resumes a partially fetched step. Both
   need durable server-side job state, which is out of scope for a prototype running in one
   bounded request. Build those screens' layout with copy that matches what actually
   happens: a retry restarts.

10. **Enrichment runs on `claude-haiku-4-5`, not an Opus-tier model.** Added 2026-09-20,
    before chunk 03 dispatched. The plan had defaulted to `claude-opus-5` in three places
    with **no recorded reason** — the owner challenged it and no justification existed.

    The reasoning that replaced the default: the enrichment payload is **metadata only** —
    commit messages, file paths, PR title and body, no diffs — because decision 4 keeps one
    call per pull request affordable. With that input the ceiling on `approach` quality is
    set by how much signal the commit messages carry, not by the model reading them. A
    larger model cannot infer the road not taken from evidence that is not in the payload.
    Two of the three output fields (`label`, `steps`) are extraction and summarization
    besides. Haiku 4.5 is also $1/$5 per MTok against $5/$25, and faster per call across a
    three-repository bake.

    **This is a reversible decision made on a prior, and it is set up to be corrected by
    evidence.** The model id is read from an environment variable, so escalating costs an
    env change and a re-bake, not a code change. The trigger is already a rubric item that
    predates this decision: *"The approach note describes how the change was made, not a
    restatement of what changed — graded by reading several baked records, not by field
    presence alone."* If chunk 03's reviewer finds the notes read as restatements, that is
    the signal to escalate, and the chunk reports it with quoted examples rather than
    passing silently. Chunk 03 also reports measured token totals per repository, because
    those are what an escalation argument would need and they are unrecoverable afterwards.

    Note for implementers: Haiku 4.5 is not an Opus-family model. `output_config.effort`
    errors on it, and its context window is 200K rather than 1M.

    **Resolved 2026-09-20, after the bake — the decision holds and the trigger did not fire.**
    236 pull requests enriched across the three repositories: 322,449 input / 32,742 output
    tokens, **$0.49** against $2.43 for the same payload on Opus 5. The lead read nine baked
    `approach` notes spanning all three repositories and judged them genuine method rather
    than restatement — e.g. *"Inlined the work of updateAbsolutePositions directly into
    updateNodeInternals to avoid iterating the nodeLookup twice"* (xyflow#5972), and
    *"Registered an abort event listener on the operation's signal that completes the
    observer, triggering existing teardown logic"* (trpc#7434). The notes that do read as
    restatement are all dependency bumps and release-bot pull requests, which have no approach
    to describe — that is a property of the input, not of the model. Chunk 03 independently
    reached the same conclusion and correctly declined to escalate on its own. **Do not
    re-open this without new evidence.**


11. **The time slider's `⇕ resize` gesture is deferred, not dropped.** Decided 2026-09-20 at
    chunk 04's second review. Design page 10 shows the affordance but none of its four state
    cards fixes the gesture's anchor or its amount, so building it means inventing the
    interaction — and `⇕` is Up/Down, which already carry the ARIA slider meaning of ±step on
    the focused thumb. A chunk graded against the design should not guess at the design.
    Filed as `plans/ideas/slider-range-resize-gesture.md` with what a real decision would have
    to settle. Chunk 04 ships Home/End jump-to-bounds, which covers the overlapping need.


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
- **The designs are delivered and committed at `design/mid-fi.pdf`.** Chunks 04, 05 and 06
  read `design/README.md`, open the pages their screens need, and build against them. A
  design that contradicts a chunk plan wins, and the contradiction is recorded in that
  chunk's completion report. No chunk implements a screen nobody opened.
- **Regenerate the rubrics for chunks 02–06 when chunk 01 merges.** They were written while
  `project.md`'s Convention Map was still empty, so they carry what the plan knew rather
  than what the project declares. Once chunk 01 writes the map, run `generate-chunk-rubric`
  over each remaining chunk directory and keep whichever items it adds. Skipping this leaves
  every later review graded against a map the project no longer has an excuse for missing.
