---
id: prompts/fan-in
description: What the lead does between an implementer reporting done and the chunk being delivered
references:
  - prompts/review.md
  - prompts/gates.md
  - prompts/evidence.md
---

# Fan In

The implementer says it's done. Nothing is verified yet — a completion report is a claim,
and this is where it gets tested.

## 0. The agent went quiet

If the implementer never reported, don't assume failure and don't re-dispatch. `SendMessage`
it and ask for its status. A second implementer spawned onto the same chunk will collide
with the first one's work, and the recovery costs more than the wait.

## 1. Verify the claims against evidence

Read the chunk's `completion-report.md` and check it against the tree, not against itself:

- **Re-run every gate yourself.** A result you didn't observe is hearsay. Re-run **after**
  the last edit — a clean run from before the final change is stale and routinely wrong.
- **Read the diff**, from the lead's side and with an explicit path:

  ```bash
  git -C "$WT" diff "$PLAN_BRANCH"...HEAD   # three dots: only this chunk's work
  git -C "$WT" status                        # nothing uncommitted left behind
  ```

  Compare it against what the report says changed. Files touched that the chunk didn't call
  for are the most common review failure.
- **Check the red runs are real.** The report should show each test failing before the
  implementation existed. A test only ever seen green proves nothing about what it checks.
- **Spot-check one claim you'd be embarrassed to be wrong about.** Not all of them — one,
  chosen because it's load-bearing.

Anything that doesn't hold goes back to the implementer before a reviewer is spawned.
Sending a reviewer at work you already know is incomplete wastes the one independent look
you get.

## 2. Run the review loop

Read `.claude/resources/prompts/review.md` and follow it. **This is not optional and your
own audit does not satisfy it** — your context is full of orchestration, and a fresh
reviewer sees what you can't.

## 3. Look at it yourself

For anything with visible output: run it, and look. Not a delegated audit's summary — the
actual surface. A report saying "PASS" and a screen rendering broken are entirely
compatible outcomes, and only one of them is visible from the terminal.

## 4. Check the docs the change invalidated

If the chunk moved, renamed, or removed anything, the docs describing it change in the
**same chunk**. Grep for the old names, then read the docs covering the area and ask
whether they still describe how the thing works. Prose like "the module keeps its own copy"
survives a grep for the deleted filename and is wrong all the same.

## 5. Update the architecture record

If the chunk changed anything `.claude/resources/project.md` asserts, it changes there **in
this chunk**, not at delivery. Check each section against what just landed:

- **Stack** — a dependency added, removed, or upgraded. Read the version off disk, not off
  the manifest range.
- **Commands** — a script added or renamed, or a gate command whose invocation changed. Run
  it before writing it down.
- **Convention Map** — a new *kind* of file the chunk introduced, or an existing row whose
  globs no longer match where those files live.
- **Principles** — a rule the chunk established or that the plan's Design Decisions
  amended. Date it.
- **Layout / Conventions** — a moved directory, or a gotcha this chunk paid for.

The Convention Map is the one that compounds: `generate-chunk-rubric` reads it when it
builds the **next** chunk's rubric, so a stale map doesn't just sit there being wrong — it
produces an under-specified rubric, and the next chunk gets reviewed against it. That is
how unreviewed work ships with a clean record.

Delivery's "promote learnings" step is for what the *plan* taught, not for architecture the
chunk already made true. Anything deferred to it stays false for every chunk in between.

## 6. Journal it

Append to `retro.md` before moving on — see `.claude/resources/prompts/execution-journal.md`.
Write it now, while the context is fresh; reconstructed later it becomes a summary of the
diff, which the diff already provides.

## 7. When it fails

A chunk that can't pass after the review loop exhausts is not a chunk to push through.
Surface it: which rubric items keep failing, what was tried, and your read on why. The
answer is often that the chunk was mis-shaped at planning time, which is a finding worth
having rather than a problem to grind down.
