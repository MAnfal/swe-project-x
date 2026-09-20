<!-- Copied into the plan directory at the start of execution.
     Part 1 is written continuously while executing. Part 2 is filled by plan-retro. -->

# <Plan Name> — Retro

## Part 1: Execution Journal

Written as execution progresses, while context is fresh. Not at the end.

### What to log

- **After a review that took 2+ iterations**: what kept failing, and whether it was a plan
  gap, a rubric gap, or a convention the implementer didn't know
- **After a blocker**: what blocked, and whether the plan should have predicted it
- **After a surprise**: wrong assumptions, renamed files, unexpected conflicts, a
  third-party constraint discovered
- **After friction**: tooling problems, slow steps, things harder than they should be
- **After a win**: chunk shapes worth repeating, predictions that were spot on
- **After any user correction**: "why did you do X" / "don't do Y" — trace it back to the
  prompt or template that allowed it, and propose the fix. This is the highest-value entry.
- **After any non-obvious decision**: a workaround, a rejected obvious path, a choice that
  wouldn't be derivable from reading the code. Ask "what made you pick X over Y?" and
  capture the answer — see below.

### What NOT to log

- Gate results and iteration counts — those are the Execution Log's job
- Per-file evidence — the reviewer's verdict has it
- "Passed on iteration 1, clean" — if nothing interesting happened, write nothing

### Tribal knowledge entries

Reasoning the source code cannot reveal. Nobody corrects a right-but-non-obvious choice,
so no friction surfaces and the knowledge dies with the chunk unless it's captured here.
Each entry needs four parts:

1. **The decision** — what was chosen
2. **The obvious alternative** — what a reader of the code would expect instead
3. **The constraint that made the choice right** — the why that source can't show
4. **The recognition signal** — the cue that tells a future reader they're in the same
   situation

Every one of these is a candidate for `.claude/resources/project.md`.

### Format

```markdown
## YYYY-MM-DD

### Chunk NN — <Name>

- Observation
- Observation
```

---

## Cold-start brief

Appended to after each chunk. What a fresh session — or the next chunk's implementer —
must know so it doesn't re-derive things from scratch. Every re-derivation is a burned
iteration; every line here skips one.

- **Helpers introduced**: "Chunk N added `<helper>` at `<path>` — later chunks import it,
  don't re-create it."
- **Convention discoveries**: "Library X exports `<actual>`, not `<expected>`."
- **Testing patterns**: "Component Y needs `<sequence>` in tests, not the naive one."
- **Setup requirements**: "After install, also run `<command>` before the gates run clean."

---

<!-- Everything below is filled by the plan-retro skill after all chunks merge.
     Do not write below this line during execution. -->

## Part 2: Retrospective Summary

### Plan Stats

| Field | Value |
| ----- | ----- |
| Plan | |
| Completed | |
| Chunks | |
| Waves | |
| Total review iterations | |

### Per-Chunk Execution

| Chunk | Review iterations | Failure categories | Mode | Conflicts? |
| ----- | ----------------- | ------------------ | ---- | ---------- |

Failure categories: `missing-tests`, `convention-violation`, `type-errors`,
`out-of-scope`, `acceptance-criteria`, `lint`, `other`.

### Prediction Accuracy

- Predicted parallel, actually safe:
- Predicted parallel, had conflicts:
- Predicted sequential, could have been parallel:

### Distilled Patterns

Tag each by confidence. Cross-reference the retros already in `plans/completed/`.

#### Rules (seen across 2+ plans)

#### Heuristics (seen once, likely to generalize)

#### Observations (notable, needs more data)

### Framework Updates Proposed

Evidence must cite the chunk and what happened — "Chunk 03: reviewer flagged the same
missing import 3 iterations running", not "reviewers struggle with imports".

| Target file | Proposed change | Evidence | Approved? |
| ----------- | --------------- | -------- | --------- |
