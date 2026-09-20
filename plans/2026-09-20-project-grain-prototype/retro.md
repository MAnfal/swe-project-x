<!-- Copied into the plan directory at the start of execution.
     Part 1 is written continuously while executing. Part 2 is filled by plan-retro. -->

# Project Grain — Codeowner Visibility Prototype — Retro

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

## 2026-09-20

### Chunk 01 — Boilerplate

- **Passed review on iteration 1.** The implementer independently falsified three of the
  plan's own instructions rather than following them into a vacuous result, and said so.
  Chunk shape worked: "boilerplate only, no product code" was unambiguous enough that
  nothing crept in — the diff is scaffolder output plus one re-export plus `project.md`.

- **The plan's verification gates had never been run, and two of the four were broken.**
  Gate 3 asserted `.env`/`node_modules` are untracked, which is trivially true on an empty
  base tree. Gates 1 and 2 invoked `pnpm test --run`, which pnpm's own CLI parser rejects
  before the script starts. The implementer caught both and revised them; the reviewer
  independently reproduced the `pnpm test --run` failure in a scratch directory with no
  `package.json` at all, confirming it is pnpm's parser and not the project.

#### Framework friction — a gate can fail on base for the wrong reason and nothing checks

1. **The friction.** `pnpm test --run` exits non-zero on the base tree *and* on the
   finished tree, with the identical error both times. It would have satisfied every
   existing check for gate quality while proving nothing about the chunk's work. Only the
   implementer thinking past the letter of the instruction caught it.

2. **The cause.** `.claude/resources/prompts/gates.md` § "Prove the gate can fail on the
   base tree" asserts a non-zero **exit status** on base and stops there. Its evidence
   table ("Gate kind → Evidence to record") asks what to record, never whether the failure
   was *caused by the chunk's work being absent*. `prompts/planning.md:126-133` inherits the
   same blind spot in its fallback for gates the planner cannot run while planning: it asks
   "if it exits 0 on base it proves nothing" and never asks the converse. A command that is
   simply malformed fails on base, fails after, and passes both files' checks.

   Secondary: `prompts/preflight.md` § 4 does say to dry-run each gate command, which would
   have caught this — but for a bootstrap chunk there is no project to dry-run against at
   preflight time. The one check positioned to catch it is structurally unavailable for
   exactly the chunk that most needs it.

3. **The fix.** In `gates.md` § "Prove the gate can fail on the base tree", add a third
   watched shape beside the two already there:

   > **A failure that is not about the chunk.** A non-zero exit on base proves the gate can
   > fail; it does not prove it fails *because the work is missing*. Run the gate on base
   > and on the finished tree and compare the **error text**, not the exit status. Identical
   > output both times means the command is broken, not the tree — the gate is vacuous in
   > the direction the exit code cannot show. Most common cause: a malformed invocation the
   > tool rejects before it ever reaches the project.

   Mirror one sentence of this into `planning.md`'s block at 126-133, since that is the path
   a planner takes when it cannot run the gate itself.

#### Tribal knowledge — both already promoted to `project.md`, recorded here for lineage

- **Keeping the scaffolder's `AGENTS.md` is what protects `CLAUDE.md`.** The obvious read is
  that `AGENTS.md` is redundant next to `CLAUDE.md` and should be deleted. It is not:
  `writeAgentFiles` in `node_modules/next/dist/server/lib/generate-agent-files.js`
  (next@16.3.5) writes its rules block into `AGENTS.md` when that file exists and into
  `CLAUDE.md` when it does not, on every `next dev` start. Recognition signal: any impulse
  to tidy away a framework-generated agent file in a repo whose instructions live in
  `CLAUDE.md`.

- **The `src/lib/**` Convention Map row ships with no `Doc` citation on purpose.** The SWE
  decision tree routes it to `patterns/service-design.md`, whose mandatory section requires
  an interface in `contracts/`, an `@Injectable()` class and a DI provider token —
  the exact abstraction `ORCHESTRATOR.md` § Complexity rejects by name. The routing row
  matches on the words "a module with a public API", not on the situation. Recognition
  signal: a decision-tree row that routes on vocabulary while the destination page assumes
  a framework this project does not use. Ruled by the lead 2026-09-20; the reviewer
  independently verified both sources before agreeing.

#### Cold-start additions for chunks 02–06

- **shadcn now builds on `@base-ui/react` 1.8.0, not Radix.** Chunks 04–06 use `select`,
  `slider` and `dialog` — read the Base UI API, not the Radix one.
- **`pnpm test --run` does not reach Vitest.** Use `pnpm test` (the script is already
  `vitest run`).
- **A zero exit from `pnpm test` does not mean your spec ran.** A spec outside
  `src/**/*.test.{ts,tsx}` is skipped silently while the run still exits 0 — verified by
  the reviewer with a deliberately failing orphan spec. Assert the passing count.
- **`find node_modules/...` does not follow pnpm symlinks.** Use `find -L` before concluding
  a package ships no types.
- **`src/lib/` modules are standalone functions over plain objects**, each with a
  co-located `*.test.ts`. No class, registry, or one-implementation interface.

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
