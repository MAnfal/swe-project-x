---
id: prompts/review
description: The review loop — spawn a fresh reviewer, iterate with the implementer until PASS
requires:
  - Implementation complete, verification gates passing
  - rubric.md exists for the chunk
references:
  - prompts/evidence.md
produces:
  - A PASS verdict from an independent reviewer before delivery
---

# Review Loop

The lead runs this after auditing the implementer's output. Self-review is not acceptable.

## Step 1 — Spawn a fresh reviewer

Spawn a `code-reviewer` subagent with the Agent tool. You spawn it, not the implementer —
subagents cannot nest, and that constraint is what keeps the review independent. Pass it:

- The chunk folder path (it reads `rubric.md` — **not** `plan.md`)
- The paths it should review, or the diff to review
- `.claude/resources/project.md`
- An explicit instruction: **return the verdict as your final response text**, and write
  any rationale that needs to survive into a file in the chunk directory. A reviewer
  cannot see your messages; a judgment call that exists only in a message will be flagged
  as having no written artifact.

Never reuse a reviewer. Each iteration gets a fresh agent with clean context.

### Flag your own conclusions

Hand the reviewer your conclusions **labeled as conclusions, not premises**: "These are my
judgments, not givens — test them." An unflagged lead judgment reads as settled context
and gets inherited rather than checked. Everything not on that list is context; everything
on it is in scope for falsification.

### Validate any instrument you build during the review

If the review produces a tool — a mutation harness, a canary script, a diff filter, a
counting loop — validate it before trusting a single result from it. Run it once against
an **unmutated** tree and confirm it reports clean, and once against a mutation you are
certain is caught. An instrument that reports failure unconditionally is indistinguishable
from one reporting that everything is covered, and it fails in the direction of approving.

`prompts/gates.md` requires a negative control for every gate an *implementer* writes. The
same obligation binds a tool the reviewer builds; nothing downstream re-checks it, because
the review is the last independent pass.

## Step 2 — PASS

Record the iteration count, write the journal entry, proceed to delivery.

## Step 3 — FAIL

1. Read the issues and the guidance.
2. `SendMessage` the full list of blocking issues to the implementer subagent by name —
   don't spawn a new one. It still holds the chunk's context; a cold agent would rebuild it
   from scratch. Instruct it to fix, re-run every gate, and report back.
3. Increment the iteration count.
4. Return to Step 1 with a **new** reviewer — spawned fresh, never reused.

The reviewer never edits code. Fixes always come from the implementer.

## Step 4 — Exhaustion

At 10 failed iterations, stop. Report to the user: which rubric items keep failing, what
was tried each time, your read on why it persists, and a request for direction.

## Narrow re-review after a post-PASS change

A structural change made *after* a PASS gets a scoped re-review, not a full rubric re-run.
Brief the reviewer with 3–5 questions aimed at the change: does it preserve the invariant
the old code expressed? Does it introduce a failure mode the old one didn't have? Are any
comments or docs now false? A full re-run produces fatigue; the narrow pass is cheaper and
differently aimed.

## The repair unit is the category, not the cited site

When a review finds a false claim or a violated rule, the reviewer is reporting a
**sample**. The fixer owns the enumeration. Three boundaries each fail on their own:

- **The cited sites** — fixing the named line feels complete, the gate goes green, and
  nothing prompts the wider question.
- **The phrasing** — grepping the sentence finds restatements of that sentence, not other
  sentences with the same defect.
- **The diff** — a semantic change invalidates claims in files it never touched. The unit
  is "claims that depend on the semantics I changed", found by following the symbol to its
  consumers.

The moment a defect recurs at a new site after being fixed at the cited one, stop issuing
citations and require an enumeration: walk every docblock, comment, constant, and doc page
that depends on the changed thing and report a table of `claim / producing code / verdict`.
Finite set, no sampling. Issue this at the **second** recurrence, not the fifth.

## Automated reviewers flag instances, not patterns

When a bot flags one occurrence of a rule violation, treat it as a pointer to a class.
Grep the touched files for siblings and fix them all in one pass. Fixing only the flagged
line while identical violations sit three lines below creates a false impression that it's
resolved.

**Do not widen a shared contract under bot pressure.** If an automated reviewer prescribes
tightening or widening a type or schema used across modules to resolve a single instance,
fix the instance at its boundary and file the contract change as its own deliberate item.
A contract change riding a pressure-fix PR is unreviewable and may reject valid usage
elsewhere.

## Notes on specific chunk shapes

- **Pure-data chunks** (types, enums, declarative config, no control flow) pass on
  iteration 1 almost always. Review shape and naming, not behavior. Mark test-coverage
  items `N/A` explicitly rather than "unknown".
- **New end-to-end or integration specs**: run the suite at least twice under normal load
  before passing. A single run on a quiet machine passes on timing luck; hardcoded
  timeouts below the suite's real startup cost fail reliably under contention.
