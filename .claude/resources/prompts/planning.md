---
id: prompts/planning
description: Phase 2 — turn an agreed approach into a plan directory of reviewable chunks
requires:
  - An agreed approach (from brainstorm, an idea file, or a direct user request)
produces:
  - plans/<YYYY-MM-DD-name>/ with SPEC.md, ORCHESTRATOR.md, and NN-<chunk>/{plan,rubric}.md
references:
  - templates/spec.md
  - templates/orchestrator.md
  - templates/chunk.md
  - templates/rubric.md
  - prompts/gates.md
  - prompts/evidence.md
  - bibles/README.md
  - sops/decision-tree.md
---

# Phase 2 — Plan Creation

## Universal constraints

- A chunk plan is **self-contained**: an agent reading only that file and the files it
  names can execute it without further context.
- **~10 files per chunk.** Generated output, lock files, and one-line barrel re-exports
  don't count. If a chunk will exceed it, ask the user before proceeding and record the
  waiver (and its reason) in the chunk's frontmatter.
- The ORCHESTRATOR is the single source of truth for plan state.
- Never merge orchestrator content into a chunk file, or vice versa.
- Plan names are date-prefixed kebab-case: `YYYY-MM-DD-<name>`.
- **Reuse before invention.** Before a chunk introduces a new helper, utility, or pattern,
  grep for an existing one. If it exists, the chunk imports it. If the same logic is
  already duplicated in 2+ places, the chunk consolidates it. Record the result in the
  chunk: "Reuse: importing X from Y" / "Consolidation: moving X into Y" / "New: none found".
- **Convention-first ordering.** If the plan establishes a new convention, the chunk that
  writes it down comes FIRST, and later chunks quote it. That doc becomes the
  implementation spec for later chunks and the reviewer's standard — it eliminates drift.

## Phase 1 — Understand

Extract every distinct task from the source material. Group tasks that touch the same
files or concepts into one chunk.

## Phase 1.5 — Slice by value, not just by dependency

Chunks are grouped **under the story they serve**, and the stories are ordered P1 first.
The test for a slice: if the plan stopped right after this story's last chunk, would the
user have something that works and can be demoed?

A plan ordered purely by technical dependency — all the types, then all the services, then
all the UI — cannot be stopped early. Every chunk is green, nothing is usable, and a plan
cut short leaves a half-built layer nobody can see. Scope gets cut constantly on real
projects; make that cheap instead of destructive.

This does not override dependency order — a chunk still cannot run before its prerequisite.
It orders the *stories*, and pulls the work each story needs into that story's chunks, so
the first vertical slice lands complete before the second one starts.

Record the mapping in the ORCHESTRATOR's State table (a `Story` column) and fill in the
Story Checkpoints table: what works once each story's last chunk merges. A chunk that
serves no story is either scaffolding that belongs inside another chunk, or scope creep.

Foundational work that genuinely blocks every story — project setup, a shared schema — goes
in a wave before US1 and is marked as such. Keep it as small as it can be; "foundational" is
where dependency-ordered planning sneaks back in.

## Phase 2 — Structure

1. **Name the plan** — `YYYY-MM-DD-<name>`, the date planning begins.
2. **Read prior retros.** Skim the "Distilled Patterns" section of each retro in
   `plans/completed/`. Let history shape chunk sizing and review expectations. Skip if
   there are none yet.
3. **Set an execution mode per chunk**:
   - **sequential** — depends on a prior chunk's output. Record the dependency.
   - **parallel** — independent; can run alongside its wave.
   - Default to parallel only when chunks are additive-only with **zero** shared files.
   - **Shared-file audit (required before declaring a wave parallel):** enumerate every
     index, registry, README, and routing file any chunk in the wave would write. Two
     chunks writing the same one means the wave is not parallel-safe — re-shape it, or
     make one chunk the owner of that file and have the others defer their entries.
     "Additive new files" declarations routinely omit the registry update step.
4. **Order the chunks** — independent first, dependents after their prerequisites.
5. **Re-check inherited thresholds.** Any strictness carried in from an idea file or a
   prior plan (zero warnings, coverage floors, "no `any`") gets checked against what the
   rest of the project actually does before it's locked into a chunk. Inherited
   strictness is a common source of scope blowout.

### Sizing notes worth pre-declaring

- **Threading changes under-count.** Passing a new field through N layers costs
  N × (implementation + test) + every contract file on the path. Count the hops at
  planning time and pre-declare the file-count waiver rather than getting flagged later.
- **Enumerate judgment calls.** When a chunk contains three or more non-mechanical
  decisions (two defensible implementations, a naming or placement choice, a keep-or-delete
  call), list them explicitly as: "You may X or Y; explain your choice in the completion
  report." The implementer reports rationale inline and the reviewer grades it without a
  round-trip. Mechanical sweeps don't need this.
- **Label performance numbers in pairs.** A perf gate needs a **mandated floor** (the pass
  criterion — below it, escalate) and an **aspirational baseline** (context — below it but
  above the floor, note and move on). Conflating them produces false escalations or a
  missing pass criterion.
- **Sweeps are discovery-authoritative.** For a rename or removal across the codebase,
  write the chunk as "fix every hit this command returns", not "fix the files listed
  below". A hand-typed list silently under-covers. Add a repo-wide invariant check that
  runs after the chunks merge, not just per-chunk greps.
- **Sequence additions before removals.** When removing something with silent downstream
  breakage (no compile error when a consumer breaks): ship the replacement first, mark the
  old thing deprecated in one place that drives every surface, gate that marker, and only
  then remove — in a later chunk.

### Claims in a plan are claims you own

Everything in `.claude/resources/prompts/evidence.md` applies while planning, and planning
is where unverified claims are cheapest to make and most expensive to ship. A plan that
asserts a file exists, a symbol is unused, or a library behaves a certain way hands that
assertion to an implementer who has no reason to doubt it. Open the source. A capped or
scoped search proves presence, never absence.

**A number you hand an implementer needs a caveat proportionate to how wrong it can be.**
"Lower bound, not exact" is honest for a 10% sampling error and useless for an order of
magnitude — an implementer can reasonably act on a figure that is 16× low before anyone
notices the method was wrong. If your method can be off by an order of magnitude, either
measure properly or hand over the **query** rather than the result and let the implementer
run it.

**Name the path, not the kind, when one chunk consumes another's output.** Write "reads
`src/lib/ingest/fixtures/<name>.transcript.json`", never "reads the fixture chunk 02
commits". Two chunks using one word for two different artifacts is invisible at planning
time and costs the consuming chunk its first full cycle: its very first task reads a file
that was never produced. A path is checkable by preflight; a kind is not.

**Every externally-priced or externally-bounded constant carries its reason.** A model id,
a timeout, a page size, a retry count, a concurrency bound, a rate ceiling — put a one-line
rationale beside the number, or a pointer to the Design Decision that holds it. The cost of
the missing sentence is not the wrong value; it is that nobody can tell a considered value
from a default, so nobody re-examines it. A default written down next to a *correct*
adjacent fact reads as more considered, not less.

## Phase 3 — Write the gates

Each chunk gets executable verification gates. Read `.claude/resources/prompts/gates.md`
and follow it — especially **prove each gate can fail** before the plan ships. A gate that
already passes on the untouched tree asserts something true regardless of the
implementer's work and reports coverage it does not provide.

If you cannot run the gate yourself while planning, write the instruction as a question
rather than an assertion:

> "Run this gate against the base commit **and** against the finished tree. Record the
> exact command, both exit statuses, and the observed failure evidence. If it exits 0 on
> base, the gate proves nothing. If it fails on both with the **same error text**, the
> command is broken rather than the tree — the gate is vacuous in the direction an exit
> code cannot show. Revise it either way and record the revision."

An assertion ("this gate MUST fail on base") written from a mental model is wrong exactly
when it matters. The question form cannot be wrong and returns the same evidence.

The base-tree check is the one a planner most often gets half right: a command the tool
rejects before it reaches the project fails on base, fails after, and satisfies "must fail
on base" completely. Asking for the *error text* on both trees is what separates the two.

## Phase 2.4 — Cite the standards each chunk has to meet

A chunk plan is the implementer's whole context. If a standard governs the work and the
plan doesn't name it, the implementer doesn't know it exists — and the reviewer grades
against a rubric that may cite it. That gap is a plan defect, not an implementer error.

For each chunk:

1. Identify which bible covers the work. `.claude/resources/bibles/README.md` lists them —
   `swe/` for engineering, `prompt-engineering/` for anything that changes `.claude/`
   itself.
2. Read that bible's `decision-tree.md` and follow it to the **leaf page** covering this
   chunk's concern.
3. Add the leaf page to the chunk's **Reference Files** table with a one-line note naming
   the rule the implementer has to follow — not "read this for context".

**Cite the leaf page, never the decision-tree.** A routing table tells someone where to
start looking; it does not tell them what rule applies. A chunk that cites the tree has
deferred the reading to the implementer, which is the thing this phase exists to prevent.

```
| `.claude/resources/bibles/swe/patterns/service-design.md` | Interface-first: the contract
  goes in its own module and the class implements it explicitly |
```

If no bible page applies, write nothing. A padded Reference Files table costs the
implementer context and teaches it to skim the list.

## Phase 2.5 — Run the planning SOPs

Read `.claude/resources/sops/decision-tree.md`, identify every Planning SOP that applies to
the drafted chunks, and run each one. They are procedures, not reading material — each
catches a defect class that has shipped more than once, and each is cheap now and expensive
after dispatch.

The SOPs are maintained separately from this file so a retro can add one without editing
the protocol.

## Phase 3.5 — Check the plan against itself

Three checks before you present anything. Each one catches a class of defect that is cheap
now and expensive after dispatch.

### Principles

Read the Principles section of `.claude/resources/project.md` and check every chunk against
it. A chunk that violates one either gets reshaped, or gets an explicit justification
recorded in the ORCHESTRATOR's Design Decisions. An unjustified violation doesn't reach
gate 1.

**Check twice.** Once here against the chunk list, and again after the chunk plans are
written in Phase 5 — the violation usually appears when the abstract chunk ("add caching")
becomes a concrete one ("add a singleton cache manager"), not when it was a line in a list.
Note the version of the Principles section you checked against, so a later amendment makes
it obvious which plans were approved under the old rules.

### Unresolved unknowns

Mark every genuine uncertainty in the SPEC and the chunks as `[NEEDS CLARIFICATION: <the
specific question>]` rather than picking a plausible answer and moving on. A guess written
in a confident voice is indistinguishable from a decision, and it gets implemented as one.

Then resolve them: ask the user the marked questions directly, and fold the answers in.
**Zero markers may remain when the plan is approved** — that's what makes marking them safe
rather than a way to defer thinking. If one genuinely cannot be resolved until execution,
convert it to a chunk-level decision point with the options enumerated and the criterion
for choosing.

### Complexity

For every abstraction the plan introduces — a layer, a base class, a plugin point, a new
indirection — record in Design Decisions what it buys and what the flat alternative would
have cost. An abstraction that cannot justify itself in two sentences gets removed. This is
the same bias as "start flat" in the brainstorm, applied where it's still cheap to act on.

## Phase 4 — Present for approval (gate 1)

Write nothing yet. Present:

- The plan name
- The chunk list with one-line descriptions
- Execution mode per chunk and the dependency graph
- The principles check: anything that needed a justification, and what it was
- Any remaining `[NEEDS CLARIFICATION]` markers, as direct questions

Ask: "Are we done planning? Anything to add, remove, reorder, or change?" Iterate until
the user says it's complete.

## Phase 5 — Write the files

```
plans/<YYYY-MM-DD-plan-name>/
  SPEC.md              problem, user stories, success metrics, non-goals
  ORCHESTRATOR.md      state table, dependency graph, design decisions, execution log
  01-<chunk-name>/
    plan.md            what the implementer reads
    rubric.md          what the reviewer grades against — the implementer never reads it
  02-<chunk-name>/
    ...
```

Invoke the **`plan-scaffold`** skill to create the directory and each chunk, rather than
creating files by hand. It owns the date prefix, the chunk numbering, which template lands
where, and adding each chunk's State table row as the directory is created.

Then fill in what it scaffolded:

1. **SPEC.md** from `templates/spec.md`.
2. **ORCHESTRATOR.md** from `templates/orchestrator.md`. It must be standalone: a fresh
   agent reading only that file can tell what's done and resume.
3. **Each chunk's `plan.md`** from `templates/chunk.md`, including Given/When/Then
   acceptance criteria and its verification gates.
4. **Each chunk's `rubric.md`** — invoke the **`generate-chunk-rubric`** skill on the chunk
   directory once its `plan.md` is written. It matches the files the chunk touches against
   the Convention Map in `project.md` and injects the review checks and per-file test
   expectations that follow. Then read what it produced and add anything the acceptance
   criteria imply that the map couldn't know.

   Hand-writing the rubric instead means it contains only what you thought of this turn.

**The rubric and the plan are separate documents.** `plan.md` must not reference
`rubric.md` and vice versa. The implementer works from the plan; the reviewer grades
against the rubric. Merging them teaches to the test.

**Rubric items state the rule, not the example.** "Only properties that differ from the
default" — not "only the horizontal layout deltas" copied out of the plan's sample code.
Reviewers read the rubric cold; a too-literal item produces false failures on correct work.

Then invoke the **`plan-check`** skill. Its script settles everything mechanically
decidable — missing artifacts, a chunk without a rubric, frontmatter that isn't the chunk's
own, a State table that disagrees with the directories on disk, unresolved clarification
markers — and exits non-zero when any of them fail. The skill then covers the judgment half:
coverage, sizing, requirement quality, and whether the gates can fail.

Fix everything it reports before presenting the plan.

## Phase 6 — Present the plan (gate 2)

Show the user:

- The spec summary (problem, stories, non-goals)
- The chunk list with modes and the dependency graph
- The `plan-check` report
- "The plan is ready. Should I start execution?"

<planning-ends-here>

**HARD STOP.** Planning is complete. Do not implement anything, do not spawn agents, do
not start a chunk. Execution is `/plan:execute`, in a separate session, after the user reads
the plan. The only exception is an explicit "start chunk 1 now" from the user.

</planning-ends-here>
