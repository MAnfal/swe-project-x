---
id: prompts/completion
description: Phase 4 — final PR, retro, and archive
requires:
  - Every chunk merged into the plan branch
produces:
  - Final PR to the source branch, a finalized retro.md, and the plan moved to plans/completed/
references:
  - prompts/git.md
  - prompts/gates.md
  - templates/pr-description.md
  - skills/plan-retro
---

# Phase 4 — Delivery

Two halves, in this order: ship the work, then close the loop.

## Part 1 — Ship

### Pre-delivery gates

These are hard gates. Each exists because skipping it shipped something broken.

1. **The reviewer ran and passed.** Point to the verdict — in the retro journal or in this
   conversation. If you skipped it because the gates were green or the diff felt obvious,
   go back and run it. A lead self-audit does not satisfy this.
2. **Deferred verification actually ran.** Anything a chunk marked as "the lead will smoke
   this" — cross-process behavior, real-browser rendering, anything the implementer's
   environment couldn't exercise — runs **before** the PR opens. Not at bug bash, not when
   the user asks. Specs assert what they mock; only the real surface tells the truth.
3. **You looked at the UI yourself.** For anything visible: run it, screenshot it, look at
   it, and show the user the screenshot as evidence rather than summarizing it as "PASS".
4. **Full suite re-run on the merged result.** See `prompts/git.md`.

Anything that fails here goes back through fix and re-review before the PR opens.

### Converge: does the code match the spec?

Before opening the PR, check the codebase against the artifacts rather than against your
memory of executing them. Chunk reviews grade chunks; nobody has yet asked whether the
thing the SPEC described actually exists.

Walk the SPEC's user stories and success metrics. For each, find the code that satisfies it
and the test that proves it. Three outcomes:

- **Satisfied** — name the file and the test.
- **Partially satisfied** — the gap is new work. Add a chunk, or file it as an idea naming
  the story it leaves incomplete.
- **No longer applies** — structural work made it unreachable, or the user cut it. It
  should already be struck through in the SPEC with a dated note; if it isn't, do that now.

Run the success metrics as measurements, not as claims. A metric nobody measured is a
metric nobody met.

If this surfaces missing work, say so before opening the PR and let the user decide whether
it ships now or becomes the next plan. Don't quietly absorb it.

### Open the final PR

1. Merge the source branch into the plan branch and resolve conflicts.
2. Re-run the full gate set on the merged tree.
3. Review the assembled diff as a whole (`prompts/git.md`).
4. Open the PR: plan branch → source branch, using the final-plan shape in
   `.claude/resources/templates/pr-description.md`. Write it against the SPEC — what
   problem it solves, what was explicitly left out, and how to tell it worked.
5. Log `plan_delivered` in the ORCHESTRATOR's Execution Log.
6. Tell the user the PR is up and that `/plan:complete` will finish the close-out once they
   merge it.

**The close-out is a separate PR.** Retro, archive move, and any framework updates land
after the work PR merges, never bundled into it. Bundling pollutes the diff and forces a
fix to land on top of the retro commits, corrupting the as-shipped record.

## Part 2 — Close the loop

After the work PR is merged:

1. **Finalize the retro.** Run the `plan-retro` skill on the plan directory. It reads the
   journal written during execution and fills in the summary: per-chunk review iterations
   and failure categories, prediction accuracy, and the distilled patterns.
2. **Review the proposed framework updates** with the user. The retro proposes edits to
   these prompts and templates with evidence from specific chunks. Apply the approved
   ones — that is how the loop gets better. An unapplied retro is a diary.
3. **Promote learnings.** Anything a future implementer would need to know goes into
   `.claude/resources/project.md` — conventions discovered, gotchas, paths that must be
   reused rather than recreated, and tribal knowledge the retro surfaced.

   This step is for what the *plan* taught. Architecture the plan made true — dependencies,
   commands, the Convention Map, principles, layout — should already be there, written by
   the chunk that changed it (`prompts/fan-in.md` §5). Read the file against the delivered
   tree and confirm. Anything you find stale here is a process finding: name the chunk that
   should have written it, and put it in the retro's Framework Updates table rather than
   just fixing it silently.

4. **Sync the entry point.** Update `CLAUDE.md` so the next session starts current: a
   one-line entry under Recent Work, and its pointers to `project.md` still resolving. It
   is the first thing any session reads, so stale content there misleads every future
   session — worse than an empty section.

   **Don't restate the stack or the command table there.** `project.md` owns those; two
   copies drift, and the copy a session happens to read first wins. `CLAUDE.md` says what
   the project is and where the facts live.
5. **Archive**: `git mv plans/<plan-name> plans/completed/`
6. **Clean up branches** — with the user's go-ahead, delete the merged chunk branches and
   the plan branch, locally and on the remote.
7. Commit the close-out and open its PR.

A plan does not move to `completed/` without a finalized `retro.md`. That file is what the
next planning session reads.
