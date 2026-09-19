---
name: plan-check
description: Validate a plan directory before execution — structure, spec coverage, chunk sizing, and whether its file references actually resolve. Pass a plan dir path, or omit to check the most recent one.
allowed-tools: Bash, Read, Glob, Grep
---

# Plan Check

Catches the defects that waste an execution session: missing artifacts, stories no chunk
covers, chunks that are too big, references to files that don't exist, and gates that
can't fail. Fixing them now costs minutes; finding them mid-execution costs a cycle each.

<usage>
/plan-check [plan-dir-path]
</usage>

## Step 1 — Structure

Run the script. Everything mechanically decidable lives there, so it cannot vary with how
carefully anyone reads:

```bash
${CLAUDE_SKILL_DIR}/scripts/check-prereqs.sh [plan-dir]
```

It covers required artifacts and sections, chunk frontmatter, missing rubrics, plan/rubric
cross-references, State-table-versus-disk agreement, and unresolved clarification markers.
It exits non-zero when any of those fail.

Report its output as-is, then continue with the checks below — the ones that need judgment
rather than a grep. If the script exits non-zero, the plan is not ready for the rest of
this review; say so and stop.

## Step 2 — Coverage and completeness

- **Coverage**: every SPEC user story is addressed by at least one chunk. An uncovered
  story is CRITICAL.
- **Orphans**: every chunk traces back to a user story. An orphan is MEDIUM.
- **Sizing**: count the files each chunk creates or meaningfully modifies (exclude
  generated output, lock files, one-line barrel re-exports). Over 10 is HIGH unless the
  frontmatter declares `file-limit-waived: true` with a reason. Report the count and ask:
  "This chunk touches N files (guideline is 10). Split it, or waive the limit?"

## Step 3 — Requirement quality

The structure can be perfect while the requirements are unbuildable. Check the SPEC and the
acceptance criteria as writing, not just as sections:

- **CRITICAL — unresolved `[NEEDS CLARIFICATION]` markers.** None may survive into an
  approved plan. Report each with its question; they are what the user still has to answer.
- **HIGH — a success metric that names an implementation.** "Uses a background worker" is
  a design decision that wandered into the spec. Metrics describe outcomes; the how is the
  plan's business.
- **HIGH — a success metric with nothing to measure.** "Fast", "clean", "robust". Name the
  observation and the number that settles it.
- **HIGH — a user story that isn't independently testable.** If it can only be demoed once
  a later story lands, it is a step inside that story, not a story — and the checkpoint it
  claims to provide is fictional. Check every story against its "Independently testable
  because" line.
- **HIGH — an acceptance criterion that can't fail.** "The feature works correctly", "the
  code is clean", "performance is acceptable". If you can't name the observation that would
  falsify it, neither can the reviewer, and it will be graded on vibes.
- **HIGH — a criterion with no Given/When/Then.** A bare assertion has no state and no
  trigger, so two people reading it will test different things.
- **MEDIUM — undefined terms.** A word carrying the weight of the requirement that the spec
  never defines ("valid", "recent", "large", "supported").
- **MEDIUM — a requirement that names a solution rather than an outcome.** It forecloses
  the implementation at spec time and hides the actual goal.

## Step 3b — Principles

Read the Principles section of `.claude/resources/project.md`. Flag as **HIGH** any chunk
that violates one without a justification recorded in the ORCHESTRATOR's Design Decisions.
Quote the principle and the chunk text that conflicts with it.

Flag as **MEDIUM** any abstraction the plan introduces — a layer, a base class, an
indirection — with no Design Decision explaining what it buys over the flat alternative.

## Step 4 — Does it resolve against the actual code

For every path and symbol a chunk names:

- **Files to modify** must exist — missing is CRITICAL, the chunk cannot run.
- **Files to create** must have an existing parent directory — missing is HIGH.
- **Reference files** must exist — missing is HIGH; the implementer will be flying blind.
- **Bible citations** must resolve and must be leaf pages. A cited path under
  `.claude/resources/bibles/` that doesn't exist is HIGH. A chunk citing a
  `decision-tree.md` instead of the leaf page it routes to is MEDIUM — it defers the
  reading to the implementer, which is what the citation was supposed to prevent. A chunk
  that touches `.claude/` and cites no prompt-engineering page is MEDIUM.
- **Symbols**: if a chunk says "add method X to Y" or "follow the pattern in F", verify Y
  and F exist and contain what's claimed. Unresolvable is HIGH.
- **Dependency order**: if chunk N uses something chunk M creates, M must be in N's
  `depends`. Wrong order is CRITICAL — execution will fail.
- **Cross-chunk conflicts**: two chunks modifying the same file is MEDIUM (verify they
  don't conflict); two chunks *creating* the same file is CRITICAL.
- **Parallel waves**: enumerate every index, registry, or README any parallel chunk would
  write. Two chunks writing the same one means the wave is not parallel-safe — HIGH.

## Step 5 — Gate quality

For each chunk's verification gates, flag:

- **MEDIUM — a bare-word grep with no syntactic anchor.** It will match prose, comments,
  and the test that names the token to prove its absence. Suggest the anchored form.
- **MEDIUM — an OR pattern** (`grep -E 'a|b'`). Hits prove nothing about which branch
  matched, and if one matches the base tree the gate is permanently vacuous.
- **HIGH — a negated quiet grep** (`grep -qv`). It passes on almost any non-empty input.
- **HIGH — no base-tree falsification recorded or instructed.** Every gate must be proven
  capable of failing.
- **MEDIUM — a gate over immutable history** (a grep across an append-only directory
  asserting something about current state).

## Report

One severity-ranked list: CRITICAL, HIGH, MEDIUM, LOW. Each finding names the file, what's
wrong, and the fix.

List any unresolved `[NEEDS CLARIFICATION]` markers separately at the top, as questions for
the user rather than as findings to fix — they're the one class of issue the planner can't
close alone.

End with `N issue(s) found (X critical, Y high, Z medium, W low)` or
`Plan is clean — no issues found.`

If the plan directory doesn't exist or has no chunks, report CRITICAL immediately. If
`SPEC.md` is missing, say that coverage and orphan analysis could not run, and report that
as HIGH.
