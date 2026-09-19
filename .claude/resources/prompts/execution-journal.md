---
id: prompts/execution-journal
description: When to write to the plan's retro.md during execution, and what belongs in it
references:
  - templates/retro.md
---

# Execution Journal

The plan's `retro.md` is written **during** execution, not after. The lead owns it, and
writing to it is mandatory at every state transition — not "when there's time".

Reconstructed at the end, a journal becomes a summary of the diff. The diff already exists.
What can't be recovered later is why something happened.

## Two kinds of entry

### Execution notes (brief)

One or two bullets per chunk. Not pass/fail counts or gate results — those belong in the
ORCHESTRATOR's Execution Log. What's worth writing here:

- The implementer made a good call on its own — what, and why
- The plan had a gap it had to work around
- The chunk shape worked well, or didn't, for this kind of work

### Framework friction (the point)

Every one of these needs three parts:

1. **The friction** — the correction, the repeated mistake, the convention gap
2. **The cause** — which prompt, template, or agent file allowed it. Go **read** that file
   before writing this line. An untraced entry becomes a complaint nobody can act on.
3. **The fix** — the specific edit, in enough detail for someone else to make it

Be skeptical when tracing. The cause is usually one of: missing guidance, wording that
admitted a second reading, work assigned to the wrong role, or a rule that exists in one
file and isn't enforced in the file that would catch it.

### Tribal knowledge (capture proactively)

Reasoning the source can't reveal. This is the one nobody writes, because nothing prompts
it — the right non-obvious choice gets made, no one corrects it, no friction surfaces, and
the knowledge dies with the chunk.

Four parts, all of them:

1. **The decision** — what was chosen
2. **The obvious alternative** — what a reader of the code would expect instead
3. **The constraint that made it right** — the part the code cannot show
4. **The recognition signal** — the cue telling a future reader they're in the same
   situation

Every one of these is a candidate for `project.md`.

## Write an entry when

- An implementer finishes — brief note
- A review takes two or more iterations — what kept failing, and whether it was a plan gap,
  a rubric gap, or a convention nobody had written down
- Anything blocks — and whether the plan should have predicted it
- **The user corrects you** — "why did you do X", "don't do Y". Highest-value trigger there
  is. Trace it to the file that allowed it and propose the fix.
- The same friction hits twice — the framework should prevent it, not individual judgment
- A non-obvious decision gets made — ask "what made you pick X over Y?" and capture the
  answer
- Someone says "we have to do it this way because…" — capture it verbatim
- A wave boundary — what the wave cost, and what it taught

## Don't write

- Iteration counts and gate results — the Execution Log has them
- Per-file evidence — the reviewer's verdict has it
- "Passed on iteration 1, clean" — if nothing interesting happened, write nothing

## Fill Part 2 as you go

Per-chunk rows, prediction accuracy, and emerging patterns get filled in as the data
arrives, not at the end. `plan-retro` finalizes Part 2 at delivery, and it can only distill
what the journal captured.
