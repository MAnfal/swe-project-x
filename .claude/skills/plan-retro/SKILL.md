---
name: plan-retro
description: Finalize a completed plan's retro — read the execution journal and git history, fill in Part 2, and propose evidence-backed framework improvements. Run at delivery, after all chunks merge.
allowed-tools: Bash, Read, Grep, Glob, Edit
---

# Plan Retro

Turns a plan's execution journal into patterns the next plan can use. The journal is the
primary source; git history fills gaps. A retro built from git archaeology alone produces
shallow, obvious findings — if the journal is thin, say so rather than padding.

<usage>
/plan-retro [plan-dir-path]
</usage>

## Step 1 — Gather

1. Read the plan's `retro.md` Part 1 in full — the journal and the cold-start brief.
2. Read `ORCHESTRATOR.md`: the State table, the Execution Log, the Design Decisions
   (including any dated amendments), and any Dismissed chunks.
3. Read `SPEC.md` and check each user story actually shipped. A story that was cut or
   struck through is a finding, not an omission.
4. Fill gaps from git: `git log --oneline` on the plan branch, and the per-chunk commit
   counts and file counts.
5. Read the "Distilled Patterns" section of every retro already in `plans/completed/`.
   A pattern seen here for the second time is a Rule; seen once, it's a Heuristic.

## Step 2 — Fill in Part 2

Write into the plan's `retro.md`, below the Part 2 marker:

- **Plan Stats** — chunks, waves, total review iterations, dates.
- **Per-Chunk Execution** — one row each: review iterations, failure categories, execution
  mode, whether conflicts occurred.
- **Prediction Accuracy** — where the planned parallelism matched reality and where it
  didn't. This is what makes the next plan's wave structure better.
- **Distilled Patterns** — tagged by confidence:
  - **Rules** — corroborated by a prior retro. Cite which one.
  - **Heuristics** — observed once here, likely to generalize.
  - **Observations** — notable, not yet enough data.

Be concrete. "Chunks that only add new files never conflicted across 3 plans" is usable;
"parallelism worked well" is not.

## Step 3 — Propose framework updates

This is the point of the retro. For each piece of friction in the journal:

1. **Trace it to a cause.** Which prompt, template, rubric, or convention allowed it?
   Go read that file — don't guess. The cause is usually missing guidance, ambiguous
   wording, or a rule that exists in one file and isn't enforced in another.
2. **Propose a specific edit** — the file, and what to change, in enough detail to act on.
3. **Cite the evidence** — the chunk and what happened. "Chunk 03: the reviewer flagged
   the same missing import across 3 iterations" is evidence. "Reviewers struggle with
   imports" is not, and the user can't make a decision from it.

Fill the Framework Updates Proposed table. Leave `Approved?` empty — the user decides.

## Step 4 — Promote learnings

Anything from the cold-start brief or the tribal-knowledge entries that a future
implementer would need — a convention, a gotcha, a helper that should be reused rather
than recreated — gets proposed as an addition to `.claude/resources/project.md`. List
these separately from the framework updates; they are project facts, not process changes.

### Step 4b — Does anything belong in a bible?

A finding graduates from `project.md` to `.claude/resources/bibles/` when it is a
**standard rather than a fact about this project** — it would still be true in the next
project, and it names something a reasonable default gets wrong.

The bar is deliberately high: `generate-chunk-rubric` turns a bible page into a rubric item
a reviewer blocks a PR over. Propose a new page only when **the same friction appears in
two retros** — the Rules-versus-Heuristics line from Step 2. One occurrence is a
`project.md` convention; two is a standard.

For each candidate, propose: the bible and the leaf path, what it prevents, the provenance
line (`origin:` naming both retros), the routing row for that bible's `decision-tree.md`,
and — if it should apply automatically — the `Doc` entry in `project.md`'s Convention Map.
A page with no routing row is a page nobody finds.

Also check the reverse: a bible page the plan found **wrong or stale** is a finding. Say
which chunk contradicted it and what the observation was — the measurement wins, and a
bible page nobody corrected outranks correct work at the next review.

## Step 5 — Present

Show the user:

- The stats and the distilled patterns
- The proposed framework updates, with evidence, as a numbered list for Apply / Defer /
  Reject
- The proposed additions to `project.md`

Apply what they approve. An unapplied retro is a diary — the loop only improves when the
approved edits actually land.
