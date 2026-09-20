---
id: prompts/execute
description: Phase 3 — the state machine that drives chunk-by-chunk implementation, review, and merge
requires:
  - An approved plan directory with ORCHESTRATOR.md, SPEC.md, and chunk folders
produces:
  - Each chunk implemented, reviewed, and merged into the plan branch
references:
  - prompts/preflight.md
  - prompts/worktree.md
  - prompts/fan-in.md
  - prompts/execution-journal.md
  - prompts/review.md
  - prompts/gates.md
  - prompts/evidence.md
  - prompts/rollback.md
  - prompts/git.md
  - templates/retro.md
---

# Phase 3 — Execution

Chunks run in dependency-ordered waves. Each chunk is implemented by a fresh agent,
graded by a separate reviewer, and merged before the next one starts.

## Roles

- **You are the lead.** You orchestrate, audit, and merge. You do not implement chunks
  yourself — a fresh subagent per chunk keeps the review honest and your context clean.
- **The implementer** (`implementer` subagent) writes the code for one chunk, runs its
  gates, and reports with evidence.
- **The reviewer** (`code-reviewer` subagent) grades the work against `rubric.md`. A new
  one every iteration — never reuse a reviewer.

## Dispatching subagents

Work is delegated with the **Agent tool**. There is no separate team construct — a
subagent is a fresh Claude instance with its own context window, its own tool permissions,
and the system prompt from its file in `.claude/agents/`.

```
Agent({ subagent_type: "implementer", name: "chunk-03", prompt: "<the dispatch brief>" })
```

Mechanics that shape how this loop runs:

- **Subagents run in the background.** You are notified when one finishes. Don't poll, and
  never write the result yourself before the notification arrives.
- **Continue an existing one with `SendMessage`**, addressing it by name. A new `Agent`
  call starts cold — use it for a *fresh* reviewer, and `SendMessage` to hand review
  feedback back to the implementer that already has the context.
- **Nesting is one level deep.** A subagent cannot spawn another, so the reviewer is
  always spawned by you, never by the implementer. This is what makes the review
  independent rather than self-graded.
- **Each chunk runs in its own worktree**, which **you** create and bootstrap before
  dispatching — not the Agent tool's isolation flag, because the base branch and the
  bootstrap both have to be right before the implementer starts. Read
  `.claude/resources/prompts/worktree.md` before the first dispatch of a plan.
- **Your own working directory stays the main checkout.** Every command you run against a
  chunk takes `git -C "$WT"`, and every file path is absolute. A relative path run from the
  wrong tree still resolves and still reports success.
- **The dispatch brief is the whole context.** The subagent cannot see this conversation.
  Anything it needs — paths, decisions, carry-forward learnings from earlier chunks —
  goes in the prompt or in a file the prompt names.
- **The session scratchpad is shared by every agent in the session, including you.** It is
  one flat directory, so two agents that both choose the obvious filename overwrite each
  other silently — and the second agent then reports a result produced by the first
  agent's file. Require each agent, in the dispatch brief, to work in
  `<scratchpad>/<agent-name>/`, a directory it creates and owns, and do the same with your
  own scratch files and backups. This matters most for anything whose output becomes
  evidence: a borrowed script that *fails* gets noticed, and a borrowed script that
  *passes* gets recorded under a chunk it never tested. Gate scripts avoid the problem
  entirely by living in the worktree and being committed — see `templates/chunk.md`
  § Verification Gates.

## Execution modes

Pick one at the start and record it in the ORCHESTRATOR:

- **Subagent-driven** (default): a fresh implementer per chunk, then a fresh reviewer. Best
  for anything multi-chunk — each chunk starts clean, and the reviewer is genuinely
  independent.
- **Inline**: you implement the chunks yourself and spawn only the reviewer. Reasonable for
  a two-chunk plan where dispatch overhead outweighs the benefit. The reviewer is still a
  subagent — that part is never skipped.

Everything else in this file applies to both.

## Step 0 — Start

1. Read `ORCHESTRATOR.md` fully. The State table says where things stand; if resuming, do
   not redo completed chunks. Inside a chunk that was already started, its Tasks list is
   the resume point — the ticked boxes say what landed, and re-deriving that from the diff
   is how work gets done twice.
2. Create the plan branch if it doesn't exist — see `prompts/git.md`.
3. **Copy `templates/retro.md` into the plan directory as `retro.md`** if it isn't there.
   This is a hard gate: execution does not begin without a journal file, because every
   later step appends to it.
4. Run the structural gate — the `plan-check` skill's script, directly, since this is the
   gate rather than the full review:

   ```bash
   .claude/skills/plan-check/scripts/check-prereqs.sh <plan-dir>
   ```

   A chunk missing its rubric has no reviewer contract, and a State table that disagrees
   with the directories on disk corrupts every count downstream. Non-zero exit halts
   execution — fix what it names before dispatching anyone.

## Step 1 — Build the queue

Read every chunk's frontmatter and topologically sort on `depends`:

- **Wave 1**: chunks with `depends: []`
- **Wave N**: chunks whose dependencies all landed in earlier waves

Within a wave, `parallel` chunks with no file overlap may run concurrently; `sequential`
chunks run one at a time.

## Step 2 — Preflight the wave

Read and run `.claude/resources/prompts/preflight.md` before dispatching each wave — not
just the first. It halts on unresolved references, a stale base, and cross-chunk drift,
all of which cost a full cycle if the implementer finds them instead.

## Step 3 — Dispatch a chunk

Before spawning, sanity-check the dispatch:

- **Does the chunk's test file naming match what the test runner actually discovers?**
  Check the runner's include patterns. A `.test.ts` file in a project configured for
  `.spec.ts` compiles, runs when invoked directly, and is invisible to CI.
- **If the chunk rewrites the shape of a shared type** (renames a field, changes a
  discriminant, splits a property), enumerate every read site first. Destructuring,
  discriminant checks, and constructor calls all break at compile time even when the
  chunk is scoped "contract-only". Either bring those sites into scope or defer the
  rewrite to a chunk that owns them.

Then create and bootstrap the worktree, per `.claude/resources/prompts/worktree.md`:

1. `git fetch` the plan branch — a sequential chunk must be cut from a tip that already
   contains its prerequisite.
2. `git worktree add .worktrees/<chunk> -b <chunk-branch> <plan-branch>`
3. Run the **Bootstrap** command from `project.md` inside it, and confirm the gates can
   actually run there before dispatching. An implementer that discovers your setup is
   broken spends its first cycle on that instead of the chunk.

Spawn the `implementer` agent with:

- The **absolute worktree path**, and an instruction to `cd` there and confirm with
  `pwd -P` and `git rev-parse --abbrev-ref HEAD` before doing anything
- The chunk's `plan.md` path — **not** its `rubric.md`
- The plan's `SPEC.md` path for context
- `.claude/resources/project.md` and `.claude/resources/prompts/evidence.md`
- The **bible leaf pages** in the chunk's Reference Files, named as rules to follow rather
  than reading material. The reviewer's rubric cites the same pages; an implementer that
  never opened them is being graded against something it didn't see. If the chunk touches
  anything under `.claude/`, add
  `.claude/resources/bibles/prompt-engineering/decision-tree.md` whether or not the chunk
  cited it.
- An instruction to run the chunk's verification gates and report evidence, not claims

## Step 4 — Fan in

Read and follow `.claude/resources/prompts/fan-in.md`. It covers verifying the
implementer's claims against evidence, the mandatory review loop, looking at visible output
yourself, the docs the change invalidated, and what to do when a chunk can't pass.

The summary below is the shape of it; the file is the procedure.

### Audit, then review

1. **Verify the implementer's claims yourself.** Re-run the gates. A "clean" result from
   before the last edit is stale and routinely wrong — re-run **after** the final change,
   every time, and run the type check last (test runners transpile without type-checking
   and will pass errors a type checker catches).
2. **Run the review loop** — `prompts/review.md`. This is not optional and a lead
   self-audit does not satisfy it. Your context is muddied by orchestration; a fresh
   reviewer sees what you can't.
3. **If the chunk changes something visible, look at it.** Run the app, take a screenshot,
   and look at the pixels yourself. A delegated visual audit reporting "PASS" and a
   surface that renders broken are fully compatible outcomes.
4. **Update the architecture record.** If the chunk changed anything
   `.claude/resources/project.md` asserts — a dependency, a command, a new kind of file, a
   moved directory, a principle — it changes there in **this** chunk. The Convention Map
   feeds `generate-chunk-rubric` for the *next* chunk, so a stale one produces an
   under-specified rubric rather than an obvious error.
5. **Journal it.** Append to `retro.md` before moving on, while the context is fresh —
   `.claude/resources/prompts/execution-journal.md` has the triggers and the shape of each
   entry kind.

## Step 5 — Deliver the chunk

Commit and open the chunk's PR per `prompts/git.md`. The user reviews and merges — you
never merge a PR yourself.

Update the State table and append an Execution Log row in `ORCHESTRATOR.md`. Wave
boundaries (`waveN_merged`, `waveN+1_dispatched`) are mandatory log entries — the retro
derives its wave metrics from them.

Once the PR is **merged**, remove the worktree and assert it is gone:

```bash
git worktree remove ".worktrees/<chunk-name>" && git worktree prune
git worktree list          # must show the main checkout only
```

Not before the merge — the branch still needs to exist. A worktree that refuses to be
removed is holding uncommitted work; look at it rather than forcing it.

**This is a step with a check, not a tidiness note.** A lint or test command that takes no
path argument walks the whole project directory, including a surviving worktree *and its
`node_modules`* — so the next gate run on the plan branch reports thousands of problems
that belong to nobody, or passes for reasons that have nothing to do with the tree you
think you measured. The `git worktree list` line above is what makes the removal
observable; without it the thing that removes the worktree is a human remembering.

Then wait for the user to say to proceed. Do not start the next chunk on your own.

## Step 5b — Story checkpoints

When the last chunk of a story merges, stop and confirm the checkpoint: the story works and
can be demoed **with no later story built**. Run it, look at it, tick the row in the
ORCHESTRATOR's Story Checkpoints table.

Then offer the user the exit: "US1 is done and working — that's a usable slice. Keep going
to US2, or stop here?" This is the entire point of slicing by value, and it only pays off if
the offer is actually made. A plan that runs to completion because nobody was asked spent
its optionality for nothing.

If the checkpoint doesn't hold — the story needs something a later chunk was going to build
— that's a planning defect and it gets a journal entry. The slice wasn't independent.

## Step 6 — Between waves

1. The prior wave's PRs are merged.
2. **Re-verify the remaining chunks against the SPEC.** Structural work already completed
   can make a later chunk's criterion unreachable — a runtime check that the type system
   now enforces, a path that no longer exists. Ask of each remaining chunk: "does this
   still test something that can fail?" If not, mark it Dismissed in the ORCHESTRATOR with
   a dated note rather than dispatching someone to implement a vacuous test.
3. **Re-derive carry-forward claims.** Anything a later chunk inherits from an earlier
   wave ("no X uses Y", "there are N of these") was true when written and may not be now.
   Re-check it against the current tree before handing it to an implementer.
3b. **Re-verify `project.md` against the merged tree.** Each chunk should have updated it
   as it landed; this is the check that it did. Confirm the Convention Map's globs still
   match where those files actually live, and that the Stack's versions still match what
   is installed. Whatever this catches is also a journal entry — a chunk that changed an
   architecture fact without recording it is a process gap, not a one-off, and the next
   wave inherits the stale file. Two ways this check is done wrong:

   - **Re-derive the Commands table from `package.json`; don't re-run what it already
     lists.** Running the listed commands only finds commands that *changed*. It
     structurally cannot find one that was never written down — and the commands most
     likely to be missing are the ones the **lead** uses (running the production build for
     a story checkpoint, a codegen script), because the deltas protocol only ever asks
     implementers what they changed.
   - **Re-read the sections this wave edited as a whole, not just the new facts.**
     Presence of the new line is not correctness of the section around it. An insertion
     into a nested block can reparent the paragraph below it, so a generic rule ends up
     reading as a description of one specific subdirectory — true content, wrong scope,
     and every later implementer reads it wrong.
4. **Sweep stale worktrees.** `git worktree list` — anything left for a chunk that already
   merged means the cleanup above didn't run. Remove it now, before the next wave adds more.
5. **Absorb open warnings.** If a non-blocking finding from the last wave naturally
   belongs in a chunk about to dispatch — same files, same concern — fold it in rather
   than opening a follow-up.
6. Start the next wave at Step 2.

## When all chunks are merged

Run `/plan:complete`.

## Regressions

A merged chunk that breaks something follows `.claude/resources/prompts/rollback.md` —
confirm the regression is real and is this chunk's, revert the merge (never force-push),
record it in the State table, then fix forward.

## Blockers

When a chunk is blocked: don't attempt it, surface the blocker to the user, move to the
next unblocked chunk, and re-evaluate after each state change. Record it in the State
table's Blocker column.

## Mid-execution scope changes

### Scope arriving

If a new ask contradicts a documented Design Decision in the active plan, **do not absorb
it into open chunks** — reviewers approved the original cut, not the new one. Instead:

1. Acknowledge it, change nothing that's open.
2. Write `plans/ideas/<short-name>.md` capturing the new scope, citing which Design
   Decision it contradicts so the lineage survives.
3. Finish the active plan as designed, then propose the follow-up.

If the ask could plausibly re-scope more than one chunk ("is X used consistently
everywhere?"), **run a discovery pass before amending anything**. It converts a vague ask
into an evidence-based decision: 3 files or 30, already fine or a new chunk.

Exception: if the new input reveals a **bug** in already-merged work, that's a normal
follow-up with a repro, not new scope.

### Scope leaving

When the user wants to cut scope mid-plan:

1. Surface the contradiction with receipts — quote the Design Decision and the SPEC story
   that justified it, with paths.
2. Offer three options with their concrete costs: proceed as planned, a narrower
   intermediate, or cut entirely. Two options forces a yes/no; four is noise.
3. If the answer is "cut", execute the cut as **its own chunk** so the removal is
   reviewable. Don't fold it into something still open.
4. Mark the affected chunks `Dismissed` in the State table — keep their directories, they
   are the record of the original approach. Amend the Design Decision in place with a
   dated note.
5. Strike through the affected SPEC stories with a pointer forward; don't delete them.
6. File the removed scope as an idea so it can be re-planned with its own boundary.
7. Journal it the same day. A retroactively narrowed plan reads as if it was always that
   small; the journal entry is the evidence that it was a decision.

## Standing rules

**Convention beats plan.** If a chunk's plan contradicts a documented convention, follow
the convention and flag the conflict in the PR so the next planner fixes the template.

**Rubric beats plan on artifacts.** If the rubric requires a deliverable the plan assigned
to a later chunk, ship it now. The rubric is the reviewer's contract; the plan's
chunk-to-artifact mapping is a suggestion. A rubric requirement arriving one chunk late
costs a full rework cycle.

**An amendment is a sweep, not a pair.** A plan amendment is complete when **every**
section that encodes the old decision has changed — Context, Acceptance Criteria, What To
Do, Tasks, Reuse Audit, Deliverables, Verification Gates, and the rubric — all in the same
commit. The reviewer grades against the rubric and the criteria; a chunk whose prose says
one thing and whose criteria, tasks and gates say another fails whatever it builds,
because two of its rubric items cannot both pass.

Before committing the amendment, grep the chunk for the old term and account for every
hit:

```bash
grep -in '<old term>' <chunk>/plan.md <chunk>/rubric.md
```

The prose is the easiest part to fix and the least load-bearing. **Verification gates are
the part that hurts most**, because a gate encodes a decision as a *filename pattern* —
the least reviewable place a design decision can hide. A gate resolving its target with
`grep -iE 'old-noun.*\.tsx$'` exits 1 against an implementer who correctly built the
renamed file, and a gate globbing a directory the project doesn't use matches zero files
and exits 0. Neither is visible from reading the amended prose.

**You originate claims too.** `.claude/resources/prompts/evidence.md` binds you as much as
the implementer. Before putting a factual claim into a dispatch brief, a review demand, or a
comment you're telling someone else to write: open the source and confirm it. A mechanism
you haven't read is a guess, and naming a file and line number doesn't make it checked. A
process fix you announced but didn't commit is not a fix.
