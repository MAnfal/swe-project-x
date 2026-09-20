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
- **The CLI lives in `scripts/`, not `src/lib/`.** Principle 1 names route handlers and
  `scripts/` as the only places a credential is read, and Principle 3 forbids filesystem
  writes only on paths reachable from a route handler — so a script that writes a snapshot
  file is legal and a `src/lib/` module that does the same is not. There is no Convention
  Map row for `scripts/**` yet; chunk 02 reports it as a `project.md` delta.
- **A passing test suite is not evidence a guarantee is tested.** Chunk 02 shipped 84
  green tests of which three could not fail; the reviewer found them by mutation, not by
  reading. Before claiming a contract is covered, delete or invert the line that implements
  it and confirm something goes red.
- **`z.record` does not normalize key order** (measured on zod 4.6.5: `{"zzz","aaa"}`
  parses to `["zzz","aaa"]`), so `enrichment` ordering depends entirely on `sortKeysDeep`
  in `src/lib/snapshot.ts`. Chunk 03 is the first to populate `enrichment` and therefore
  the first whose determinism actually rests on it.
- **Fixtures belong under `src/**/fixtures/`.** The Convention Map row is
  `src/**/fixtures/**/*.json` and chunk 02's Gate 2 greps `git ls-files` for
  `fixtures?/.*\.json$`. A fixture placed outside `src/` matches neither the row nor the
  gate, and would pass review by being invisible to it.

### Wave 1 → Wave 2 boundary

- **Chunk 01 merged at `5e49bd2`.** Lead re-verified the merged tree rather than trusting
  the pre-merge run: lint 0, `Tests 3 passed (3)`, build compiled, typecheck 0, and
  `pnpm dev` serving HTTP 200. The Foundation checkpoint holds — the page that renders is
  still the scaffolder's default, which is correct for a chunk whose deliverable was the
  gates and `project.md`, not a surface.
- **Chunk 01's two non-blocking warnings are still open** (`project.md` frontmatter carries
  `id:`; `shadcn` sits in `dependencies` rather than `devDependencies`). Neither belongs in
  chunk 02 — it touches neither file — so they were not folded in. They are cheap and
  should be absorbed by whichever later chunk edits `package.json`.

#### Framework friction — a worktree is cut from the commit, not from the lead's working tree

1. **The friction.** Wave 2 preflight found two defects in chunk 02's gate block and I
   fixed them in the main checkout. I then created the worktree and dispatched. The
   implementer received the **unfixed** plan: `git worktree add` materializes the branch
   *commit*, and my fixes were still uncommitted working-tree changes. I caught it only
   because I grepped the worktree's copy afterwards on a hunch. Recovery was cheap here —
   commit, push, fast-forward the chunk branch, message the implementer — but only because
   nothing had been committed in the worktree yet. Ten minutes later it would have been a
   merge into someone else's live edits.

2. **The cause.** `prompts/worktree.md` § "Creating one" anticipates exactly one staleness
   mode: *"Cut it from the current tip of the plan branch. For a sequential chunk that means
   fetching after the prerequisite merged — a worktree created from a stale tip is how an
   implementer ends up re-doing work that already landed."* That is about **other people's
   merged commits**, and `git fetch` solves it. It says nothing about the lead's **own
   uncommitted edits**, against which `git fetch` is useless. The trap is structural rather
   than incidental: `prompts/preflight.md` is the step whose whole job is to *produce* plan
   amendments, and it closes with *"Fix the plan — or the tree — before spawning anyone"* —
   "fix", never "commit". `prompts/execute.md` § Step 3 then orders worktree creation
   immediately after preflight. The three files compose into a sequence where the most
   likely moment to have uncommitted plan edits is the moment just before the one command
   that cannot see them.

3. **The fix.** Two edits, both one line.
   - `prompts/worktree.md` § "Creating one", before the `git worktree add` snippet: *"Commit
     and push your plan amendments first. `git worktree add` materializes the branch's
     **commit**, not your working tree — an uncommitted preflight fix is invisible to the
     implementer, and `git fetch` does not help. Confirm with `git status --short` before
     running the command below."*
   - `prompts/preflight.md` § "On failure", amend the closing line to *"Fix the plan — or
     the tree — **and commit the fix** — before spawning anyone."*

#### Tribal knowledge — the bootstrap supplies a real token, because Principle 4 requires one

1. **The decision.** Chunk 02's worktree was bootstrapped with a `.env.local` holding a
   real `GITHUB_TOKEN`, taken from `gh auth token`.
2. **The obvious alternative.** Bootstrap with the empty `.env.example` template and let
   the implementer stub the network, which is what a reviewer reading the bootstrap step
   would expect and what every other worktree would need.
3. **The constraint that made it right.** Principle 4 and Design Decision 6 require the
   fixture to be *captured output of the real producer*. That is unsatisfiable without a
   working token at implementation time: you cannot capture a real GitHub response without
   calling GitHub. Handing the implementer an empty token would have forced it to choose
   between a blocked chunk and a hand-authored fixture, and the second is the one that
   looks like progress. `project.md`'s Bootstrap row already anticipates this — *"plus
   `cp .env.example .env.local` and fill it in, for any chunk that calls the GitHub or
   Anthropic API"* — but "fill it in" is addressed to nobody in particular, and the lead is
   the only party who can do it before dispatch.
4. **The recognition signal.** A chunk whose deliverable is a **captured** fixture, or any
   artifact whose provenance is itself a graded property. The moment a principle says "real
   output of the real producer", the credential that reaches the real producer becomes a
   bootstrap requirement rather than a runtime concern.


### Chunk 02 — Ingest core

- **The implementer's self-reporting was unusually honest and worth keeping.** It flagged
  an acceptance criterion as only *partly* met (the captured window cannot prove all three
  merge strategies are present) rather than claiming it; it reported two of its own gates
  as broken as written and falsified the replacements separately; and it caught a reuse
  defect in its own work (`ownerFor()` duplicating `ownerOfFile()`) before committing. It
  also noticed that its shell aliases `grep` to `ugrep --ignore-files`, which can pass by
  reading nothing, and re-ran the Reuse Audit with `/usr/bin/grep`. None of that was asked
  for by the brief.

#### Framework friction — "tests seen failing" is satisfied by a red run that proves nothing

1. **The friction.** Chunk 02's red run was textbook: six specs written before any
   implementation, `pnpm test` exit 1, verbatim output in the report. Every universal
   rubric item about observing tests red passed. But all six suites failed at **import**
   with `Cannot find package '@/lib/…'` and **0 tests collected** — which proves the
   modules were absent, not that a single assertion discriminates. The reviewer mutation
   tested instead of trusting it: 29 plausible wrong implementations, 20 caught, **9
   survived**. Three of the survivors were blocking, including one where deleting
   `sortKeysDeep` — the entire key-ordering guarantee — left all 84 tests green. I
   reproduced all three before acting on them.

2. **The cause.** `CLAUDE.md` § Non-negotiables says *"Tests first, and seen failing. A
   test that has never been observed red is not evidence that it checks anything."* The
   templated rubric item in `.claude/resources/templates/rubric.md` operationalizes it as
   *"The tests were observed failing before the implementation existed, and the report
   shows the red run."* Both are satisfied in full by a suite that cannot compile. The
   principle is about **discrimination**; the check written for it measures **absence**,
   and tests-first ordering guarantees absence for free. So the check passes most loudly
   exactly when it is least informative — at the moment the module does not exist yet.
   Nothing downstream recovers it: `prompts/gates.md` grades gate falsifiability, which is
   about the *gate*, not about whether an assertion inside a passing suite is load-bearing.

3. **The fix.** Amend the Universal Check in `.claude/resources/templates/rubric.md` from
   the current wording to: *"The tests were observed failing before the implementation
   existed **for the right reason** — the report distinguishes a suite that failed to
   import (which proves only that the module was absent) from an assertion that failed
   against a wrong value. For any guarantee the chunk's plan calls a contract, the report
   shows the assertion failing against a **plausible wrong implementation**, not against a
   missing file."* Then add to `.claude/resources/prompts/evidence.md`: *"A red run from
   tests-first ordering is necessary, not sufficient. `0 tests collected` is an import
   error wearing a red run's clothes."* This is cheap for an implementer — it is one
   deliberate mutation per contract, not a mutation-testing pass.

#### Framework friction — the reviewer invalidated its own harness, and only caught it by luck

1. **The friction.** The reviewer's first mutation-testing harness passed
   `--reporter=basic`, which is not a Vitest 5 reporter. Every run exited 1, so **every
   mutant looked caught** — a 29/29 "everything is tested" result that would have
   confirmed a PASS. It noticed, discarded the run, and redid it. Had it not, the review
   would have been confidently wrong in the direction of approving.

2. **The cause.** `prompts/review.md` tells the reviewer to verify the implementer's
   evidence but says nothing about validating the reviewer's **own** instrument. The
   asymmetry is baked in: `prompts/gates.md` requires a negative control for every gate an
   *implementer* writes — plant a canary, confirm it fires — and no equivalent obligation
   exists for a tool the reviewer builds during the review. A harness where every run
   fails is indistinguishable from a suite where every mutant is caught, and both look
   like success.

3. **The fix.** Add to `.claude/resources/prompts/review.md`, under the verification
   section: *"If you build an instrument during the review — a mutation harness, a script,
   a diff filter — validate it before trusting it. Run it once against an **unmutated**
   tree and confirm it reports clean, and once against a mutation you are certain is
   caught. An instrument that reports failure unconditionally is indistinguishable from
   one reporting that everything is covered."*


#### Chunk 02 — iteration 2 and 3, and what the review loop actually bought

- **Two review iterations, both worth their cost.** Iteration 1 blocked on three tests that
  could not fail; iteration 2 passed. Neither iteration found a behavioural defect — the
  code was correct throughout. What the loop bought was *evidence*, and the sortKeysDeep
  gap in particular would have surfaced as non-deterministic output in chunk 03, two chunks
  from its cause, since chunk 03 is the first to populate `enrichment`.
- **The implementer twice went beyond the brief, correctly.** Asked for one comparator test
  it wrote three, on the argument that *"has a tie-break"* and *"has the right tie-break"*
  are different claims and only the second protects determinism. It also added two mutants
  of its own — a narrow `devDependencies`-only drop (the realistic "tidying" regression)
  and an inverted tie-break (which would survive a test asserting only "not zero"). Both
  are better mutants than the one I specified.
- **It also declined a shortcut for the right reason.** To test the tie-break it could have
  edited two `merged_at` values in the transcript to manufacture a tie. It exported the
  comparator and spec'd it directly instead, because editing the fixture would have put
  fabricated data into a file whose entire purpose is being real captured output —
  Principle 4. The wiring is already pinned by iteration 1's reversed-listing tests.

#### Tribal knowledge — the mutant a reviewer names is the one that gets fixed

1. **The decision.** After iteration 1 named three surviving mutants, I asked the fresh
   iteration-2 reviewer to find *different* wrong implementations of the same three
   guarantees, rather than only re-checking the named ones.
2. **The obvious alternative.** Re-run the three named mutants, confirm they now die, pass
   the chunk. That is what "verify the fix" normally means and it is what the rubric's
   wording invites.
3. **The constraint that made it right.** The fix was written by an implementer who knew
   exactly which three mutants would be re-run. Tests tuned to kill three named mutants
   while leaving the surrounding guarantee unpinned would pass that check completely. The
   second reviewer found eight further wrong implementations and confirmed all eight die —
   which is what makes the PASS mean something. It also found two *new* gaps the named
   mutants never touched (`devDependencies`, worth 6 of 13 real edges).
4. **The recognition signal.** Any review iteration where the previous iteration handed the
   implementer a specific, enumerable list of failures. The narrower and more actionable
   the feedback, the more the re-check has to widen to stay honest.


### Wave 2 → Wave 3 boundary

Chunk 02 merged at `000da8d`. Gates re-verified on the merged tree, type check last:
`pnpm lint` 0, `pnpm test` `Tests 94 passed (94)` across 7 files, `pnpm build` 0,
`pnpm typecheck` 0.

#### Framework friction — the wave-2 gate fix was applied to one chunk when four carried the defect

Wave 2's preflight found two fatal defects in chunk 02's verification gates: `pnpm test --run`
exits 1 with `ERROR Unknown option: 'run'` before Vitest starts, and `pnpm exec tsc --noEmit`
was used where `project.md` declares `pnpm typecheck`. They were fixed at `20c9ff9` — **in
chunk 02 only**. Chunks 03, 04, 05 and 06 were written from the same template and carried the
same two lines the whole time. Wave 3's preflight found them again.

Re-measured at the wave-3 boundary before fixing, rather than trusted from the earlier entry:
`pnpm test --run` exits **1** with `ERROR Unknown option: 'run'`; `pnpm exec tsc --noEmit`
exits **0** and is merely off-convention, not fatal. Both are now corrected in all four
remaining chunk plans.

A third defect of the same family was in chunk 04 alone: its gate 2 globbed
`git ls-files 'src/**/*.ts' 'src/**/*.tsx' 'app/**/*.tsx' 'lib/**/*.ts'`. Measured — `src/**`
matches 15 and 9 files; `app/**/*.tsx` and `lib/**/*.ts` match **0**, because this project
puts both under `src/`. A gate whose file list is half-empty still exits 0 and reads as a
pass. Narrowed to the two globs that match.

**The generalization**: when preflight finds a defect in a gate block, the block was almost
certainly copied. Fix every unstarted chunk that shares it in the same commit, and say in the
log that you did. A per-chunk fix guarantees the next wave rediscovers it — which is exactly
what happened here, one wave later.

#### Framework friction — `pnpm lint` on the plan branch is unreadable while a worktree is live

The first gate run on the merged tree reported `✖ 3240 problems (148 errors, 3092 warnings)`
and exited 1. Nothing was wrong with the merged code. `pnpm lint` runs `eslint` with no path
argument, so it lints the whole project directory — including `.worktrees/02-ingest-core`,
whose PR had merged but whose worktree had not yet been removed, and that worktree's own
`node_modules`. Every reported file was under `.worktrees/`. After `git worktree remove`, the
same command exits 0 with no output.

This is a trap specific to the **lead's** position: an implementer inside its own worktree
never sees it, and `execute.md` puts worktree removal at Step 5 while the lead's re-verify
happens at Step 4. Ordering the two the other way round is not possible — the worktree must
outlive the merge. So the finding is promoted to `project.md` instead, with the scoped
fallback `pnpm exec eslint src scripts` for when a gate must run while a worktree is live.

#### Planning defect — chunk 04 was built on an artifact chunk 02 never produced

Chunk 04's Context said it renders "the **fixture snapshot committed by chunk 02**", and its
Test Plan said "All five run against the fixture snapshot chunk 02 committed." No such file
exists and none ever did. What chunk 02 committed is a recorded **HTTP transcript**,
`src/lib/ingest/fixtures/xyflow-xyflow-2026-08-31.transcript.json` — a different artifact for
a different purpose. `git ls-files | grep -i snapshot` on the plan branch returns only
`src/lib/snapshot.ts` and its spec.

This is precisely the case preflight §3 exists for, and it only fires because §3 insists on
checking the **base branch** rather than the working tree. It would have cost chunk 04 its
first full cycle: the implementer's very first task reads a file that isn't there.

The fix did not need a plan re-cut, because chunk 02 shipped a `--replay` mode. Verified by
the lead before writing it into the brief — `node scripts/ingest.mts … --replay …` with
`GITHUB_TOKEN` unset exits 0 and prints `10 packages, 6 pull requests`, producing a 24KB
snapshot. So chunk 04 now generates its own snapshot from the committed transcript, offline,
which keeps Principle 4 satisfied: it is captured output of the real producer, not a fixture
hand-written to look like one.

**What the planner actually got wrong** is worth naming precisely, because "chunk 04 assumed
too much" is not actionable. Chunk 02's plan promised "a committed fixture", and chunk 04's
author read that and assumed *fixture of the thing I need*. Two chunks used one word for two
artifacts. A plan that names the **path** rather than the kind — "reads
`src/lib/ingest/fixtures/<name>.transcript.json`" — cannot make this mistake.

#### Process gap — an explicit Plan-Specific Constraint was executed for one chunk out of five

ORCHESTRATOR.md § Plan-Specific Constraints says, in bold: *"Regenerate the rubrics for
chunks 02–06 when chunk 01 merges."* When chunk 01 merged, chunk 02's rubric was regenerated
and 03–06 were not. Measured by counting Convention Map citations per rubric: chunk 02 has 6,
chunks 03 and 04 had **0**.

Nothing caught this. `plan-check` validates structure and passes a plan whose rubrics are
stale, and the wave-2 preflight had no reason to look at a wave-3 rubric. The constraint was
written for the exact failure it then suffered — *"skipping this leaves every later review
graded against a map the project no longer has an excuse for missing"* — which suggests the
problem is not that nobody knew, but that a constraint phrased as a one-time instruction gets
discharged against whatever chunk is in front of you.

Both rubrics are now regenerated: chunk 03 gained 5 Convention Map sections plus a
parallel-wave boundary section, chunk 04 gained 6 plus a deployment section.

**Proposed framework fix**: preflight should check the rubric of every chunk in the wave it is
about to dispatch, not just the plan — at minimum, that the rubric cites the Convention Map at
all when the map is non-empty. Recorded for Part 2.

#### User correction — an unjustified model default survived planning and two reviews

The owner asked what our rationale was for `claude-opus-5`, and there wasn't one. The model
id appeared three times in chunk 03's plan — § What To Do, task T004, § External
Dependencies — and was justified in none of them. Nothing in SPEC.md or the Design Decisions
covered it. It was a default that got written down and then read back as though it were a
decision.

Worth noting where it *didn't* get caught. Chunk 03's plan was written, reviewed at planning
time, and had its rubric regenerated at this wave's preflight — three passes over the same
file — and none of them asked "why this model?". A named constant that looks like a
considered choice reads as one. `plan-check` has no notion of an unjustified default, and
neither does the rubric generator.

My first answer to the challenge was worse than the question deserved: I defended the
default by splitting the fields (`label`/`steps` are extraction, `approach` needs judgment)
and recommended keeping Opus while testing alternatives. That framing skipped the fact I had
just conceded — there was no rationale — and it also missed the substantive point, which the
owner then made: **the payload is metadata only**. Decision 4 caps the input at commit
messages, file paths and the PR body precisely to keep one call per pull request affordable.
With that input the ceiling on `approach` quality is set by the signal in the commit
messages, not by the model reading them. The argument for Opus was thinner than I made it
sound, and I was defending a position rather than evaluating one.

Settled as Design Decision 10: Haiku 4.5, with the escalation trigger bound to a rubric item
that already existed, and per-repository token totals reported so a later escalation argument
has evidence to stand on.

**The generalization worth keeping**: a plan that names a model, a timeout, a page size, a
retry count or a concurrency bound should carry the reason next to the number, or carry a
pointer to the Design Decision that holds it. The cost of the missing sentence is not the
wrong value — it is that nobody can tell a considered value from a default, so nobody
re-examines it. Chunk 03's plan named `claude-opus-5` beside a correct pricing note, which
made it look *more* considered, not less.

**Proposed framework fix**: the planning phase should require a one-line rationale beside any
externally-priced or externally-bounded constant, and `plan-check` should flag a model id
that appears in a chunk plan with no Design Decision referencing it. Recorded for Part 2.

#### Tribal knowledge — the parallel wave shares a directory, and that was a deliberate choice

1. **The decision.** Chunks 03 and 04 both write committed snapshots. I put them in one
   directory, `src/lib/snapshots/`, with window-qualified filenames, and told each chunk not
   to touch the other's files — rather than giving each chunk its own directory.
2. **The obvious alternative.** Chunk 04 writes a view-layer fixture under
   `src/lib/view/fixtures/`, chunk 03 owns `src/lib/snapshots/` alone. No possibility of
   collision, and the ORCHESTRATOR's "they share no file" claim stays literally true.
3. **The constraint that made it right.** Chunk 04 ships the repository picker, whose
   acceptance criterion is that it *"lists the snapshots actually present rather than a
   hardcoded list"*. If chunk 04's only snapshot lives somewhere the picker doesn't read,
   then at the moment chunk 04 merges the picker discovers nothing and the US1 slice is not
   demoable on its own — which is the entire point of the Story Checkpoints table. One
   directory is what keeps chunk 04 independently shippable. The collision risk is handled by
   naming, not by separation.
4. **The recognition signal.** Any parallel wave where one chunk produces data and another
   renders "whatever is present". Separating their outputs protects the merge and breaks the
   checkpoint; the checkpoint is worth more.

**A consequence to expect, not to fix**: after both chunks merge the picker lists four
snapshots, one of them un-enriched. That is not a defect — it is the case chunk 04's renderer
is explicitly required to handle, now exercised by real committed data rather than only by a
spec.


### Wave 3 — chunks 03 and 04

#### Pattern — three chunks, three reviews, the same failure mode

Every chunk in this plan that contained non-trivial logic has failed its first review for
**tests that cannot fail**, and for nothing else:

| Chunk | Iteration 1 verdict | What survived |
| ----- | ------------------- | ------------- |
| 02 | FAIL | Three tests that passed against any implementation |
| 03 | FAIL | `resolveSteps`' prefix-uniqueness check: `=== 1` → `>= 1`, 135/135 green |
| 04 | FAIL | `historyBounds`' widening loop deleted, and `volumeSeries`' final-bucket clamp removed — 135/135 green for each |

No iteration-1 review has ever found a behavioural defect in this plan. The code has been
correct every time. What the review loop has caught, three times out of three, is **evidence
that does not exist** — and in each case a mutation the lead then reproduced independently in
under a minute.

Two things this says, and they point in different directions.

**The loop is working.** These are not nitpicks. Chunk 04's `volumeSeries` clamp is the
difference between a merge exactly at `to` landing in the last bucket and writing off the end
of the array; chunk 03's uniqueness check is the difference between a mistyped SHA degrading
and silently attaching a step to the wrong commit. Both would have shipped invisible, and both
would have surfaced later as data that looks almost right.

**But "tests first, seen failing" is not catching it, and that is the interesting part.** Every
one of these chunks *did* write tests first and *did* observe them red. The red run proves the
test fails when the module does not exist. It proves nothing about whether the test fails when
the module is *wrong*. A test written against a fixture that lacks the edge case is red before
implementation and green after, exactly like a good test, and stays green forever after the
guarantee is deleted.

The common shape is sharper than "write better tests": in all four surviving mutants, the
unpinned logic was a **guard for an input the committed fixture does not contain** — a PR
outside the declared window, a merge exactly on a bucket boundary, two commits sharing a
prefix, an uppercase SHA. Principle 4 pushes hard toward testing against real captured output,
which is right, and the cost is that a real fixture only contains the cases that repository
happened to produce. The guard for the case it *didn't* produce has nothing to hold it.

**Proposed framework fix** (recorded for Part 2, not applied mid-plan): the chunk-plan template's
Test Plan section should require, per guard or boundary in the implementation, a named test
whose input is **constructed** rather than drawn from the fixture — and `generate-chunk-rubric`
should emit a standing rubric item: *"For each defensive branch, a test exists whose input
cannot come from the committed fixture."* The evidence is three chunks out of three, which is
enough to stop treating it as a per-chunk implementer failure and start treating it as a hole in
what we ask for.

#### Planning defect (mine) — one shared directory, two kinds of file, and a test that spanned both

Chunk 04's merge of the plan branch turned three tests red. One was expected and designed for:
its generated snapshot index listed one file while the directory now holds four, which is the
index doing its job.

The other two were not. Chunk 03's `src/lib/ai/baked-snapshots.test.ts` calls `readdirSync`
over `src/lib/snapshots/` and asserts that **every** file there carries enrichment for every
pull request. Chunk 04's snapshot deliberately carries none.

Neither chunk is wrong, and neither could have seen it. Chunk 03's invariant was true of
everything chunk 03 baked. Chunk 04's un-enriched snapshot is intended — I told it to commit
one there precisely so the picker has content and the enrichment-absent render path is
exercised by real committed data rather than only by a spec. Each chunk's tests passed against
its own base; the conflict exists only in the union, which is exactly the class of defect a
wave boundary is for.

**The error is mine and it is more specific than "parallel chunks conflicted."** I made the
one-directory call deliberately and journalled the reasoning above — sharing it is what keeps
chunk 04 independently demoable, because a picker that discovers nothing at the moment chunk 04
merges breaks the US1 checkpoint. I even wrote down the consequence: *"after both merge the
picker lists four snapshots, one of them un-enriched — that is intended."*

What I did not anticipate is that putting two **kinds** of file in one directory invites a test
that quantifies over the directory. I reasoned about the *files* colliding — and correctly
prevented that with window-qualified names and an explicit instruction to each chunk not to
touch the other's path. I did not reason about a **predicate** colliding. `readdirSync` plus
`it.each` is the obvious way to write "every committed snapshot is well-formed", and it is only
wrong because the directory holds two kinds of thing that look alike.

**The generalization worth keeping**: when two parallel chunks write to one directory, the
question is not only "can they collide on a filename" but "does either one's *definition* of
what lives here exclude what the other writes?" If the answer is yes, the directory holds two
kinds and the distinction has to be visible in the data — not in a naming convention, and not
in a whitelist that rots.

The fix I asked for makes the invariant the true one rather than scoping the test to a curated
list: a snapshot with no `enrichment` key is an un-enriched fixture and only its shape is
asserted; a snapshot **with** one must carry a complete one, because **partial** enrichment is
the actual bug. That is stronger than what it replaces — it catches a future bake that silently
enriched nothing, on a repository nobody has added yet. A whitelist would not have.

#### Framework friction — the session scratchpad is shared, and it silently corrupted a gate run

Chunk 04 reported a gate failing with a message it had never written:
`FAIL: expected a committed snapshot per curated repository, found 1`. Nothing was wrong with
chunk 04. Its `gate2.sh` had been **overwritten by chunk 03's gate 2**, which counts curated
snapshots and asserts enrichment — a different chunk's gate, in a file with the same name.

I confirmed it by listing the directory afterwards. Every agent in this wave writes to one flat
path, `<session>/scratchpad/`:

```
09:44  chunk04-gate2.sh   chunk04-gate3.sh   (chunk 04, after renaming defensively)
09:37  gate2.sh                              (chunk 03's, overwriting chunk 04's 08:55 copy)
09:42  d2.bak  derive-prev.ts  a.txt  b.txt  (mine, the lead)
09:31  e.bak                                 (mine)
09:29  d.bak                                 (mine)
```

**The lead is implicated too, and more dangerously.** `d.bak` and `d2.bak` are my backups of
`derive.ts`; `e.bak` is my backup of `enrichment.ts`. My mutation loops restore from those by
copying them back **into a worktree**. If a subagent had happened to write a file named `d.bak`
between my backup and my restore, I would have copied another agent's file into chunk 04's
source tree and then reported a gate result from it. A `git diff` would have caught it here —
but only because I happened to check, and only because the tree is version-controlled.

**The direction that actually frightens me is the one that did not happen.** Chunk 04 noticed
because the borrowed gate *failed* with unfamiliar wording. A borrowed gate that **passed**
would have been recorded as evidence, in a completion report, under a chunk it never tested.
Every other integrity mechanism in this loop — the reviewer, the lead's re-run, the falsification
controls — reads the gate's output. None of them checks that the script producing it is the one
the chunk wrote.

This is not a subagent mistake. `execute.md` tells agents to use the scratchpad and never says
the scratchpad is shared, so two agents choosing the obvious filename `gate2.sh` is the expected
outcome of following the instructions, not a deviation from them.

**Proposed framework fix**, recorded for Part 2:

1. `execute.md` § Dispatching subagents should state that the scratchpad is shared across every
   agent in the session, and require each agent to work in
   `<scratchpad>/<agent-name>/` — a directory it creates and owns.
2. The dispatch brief template should carry that instruction, so it arrives with the work rather
   than depending on the implementer having read the prompt file.
3. Gate scripts are chunk artifacts and belong in the **worktree**, not the scratchpad — a
   worktree is per-chunk by construction, and a gate script committed alongside the chunk is
   reviewable evidence rather than an untracked file that can vanish. This is the fix I would
   actually make; the first two are mitigations for everything else agents put there.

I have already applied (1) informally by giving iteration 3's reviewer its own subdirectory and
moving my own backups into `lead-04-i3/`.

#### Lead error — a measurement I reported with a caveat that could not carry its weight

I gave chunk 03's dispatch brief a table of merged-PR density: xyflow 67, shadcn-ui 13, trpc 36
at 90 days. The real numbers are **118, 212 and 36**. shadcn-ui was off by 16×.

The method was the bug. I listed *closed* pull requests sorted by `updated`, capped at 6 pages,
and counted the merged ones. In a repository with a large backlog of closed-but-unmerged pull
requests that keep receiving comments, the most-recently-*updated* closed PRs are dominated by
old unmerged ones, so the sample contained almost no recent merges. `trpc/trpc` came out exact
only because its backlog is small — which is worse than being uniformly wrong, because one
correct row makes the table look calibrated. The right query is the search API with
`is:pr is:merged merged:A..B`, which returns an exact `total_count`.

I did label it "lower bounds, not exact counts". That was true and it was not enough. A caveat
is doing too much work when the gap between the number and reality is 16×: an implementer could
reasonably have read "13" and dropped `shadcn-ui/ui` from the curated set as too quiet to be
worth scrubbing. The chunk was not misled only because it re-measured at bake time, which is the
behaviour the brief asked for — but the brief should not have needed rescuing.

**The generalization**: when the lead hands an implementer a number, the caveat has to be
proportionate to how wrong the number can be. "Lower bound" is fine for a 10% sampling error and
useless for a 16× one. If the method can be off by an order of magnitude, either measure
properly or hand over the *query* rather than the result and let the implementer run it.


### Wave 3 → Wave 4 boundary

Wave 3 closed with both PRs merged (#3 at `45866bf`, #4 at `30b90ee`). Merged tree
re-verified by the lead, type check last: `pnpm lint` 0, `pnpm test`
`Test Files 12 passed (12) / Tests 202 passed (202)`, `pnpm build` 0, `pnpm typecheck` 0.
Level 1 driven in a browser against `pnpm start` — topology nodes, direct/indirect counts,
dashed dependency edges, legend and the slider's volume histogram all render.

#### Framework friction — batching `project.md` deltas to the lead corrupts the file it protects

**The friction.** Chunk 04 reported eight `project.md` deltas and, as instructed, edited
nothing. Applying them at this boundary, I found the Layout section already broken from the
*previous* application: the generic `lib/` description — "Standalone functions over plain
objects… Co-located `*.test.ts`" — was sitting indented under `snapshots/`, reading as a
description of the snapshot directory. `src/lib/ingest/` and `src/lib/view/` were absent
entirely, though both have existed since chunk 02 and chunk 04 respectively.

Traced with `git log -L 339,347:.claude/resources/project.md`: the orphaning was introduced
by `539c42c`, the lead applying **chunk 03's** deltas at the wave-3 dispatch. Inserting the
`ai/` and `snapshots/` rows above the generic paragraph pushed it under a child entry, and
nothing re-anchored it. Two waves of implementers then read a Layout block whose `lib/` rule
was attached to the wrong directory.

**The cause.** Not carelessness at the keyboard — a role assignment. This plan's
Plan-Specific Constraint says chunks 02–06 *record* deltas in their completion report and
"the lead applies them when the wave merges", with a real justification: two chunks in one
parallel wave editing `project.md` is a merge conflict. But
`.claude/resources/project.md` § "How this file stays current" states the opposite rule in
its own table — *"During a chunk that changes an architecture fact | The implementer, **in
the same chunk**"* — and explains why: a stale Convention Map feeds `generate-chunk-rubric`
for the next chunk.

The plan overrode a documented convention for a good reason and inherited a cost nobody
priced. An implementer editing the Layout block has the directory open and knows where its
own module goes. The lead, applying eight bullets from a report a chunk later, is
transcribing prose into a structure it is not currently looking at — which is exactly the
edit that silently reparents a paragraph. The constraint solved a merge conflict by creating
a transcription step, and transcription is where this kind of drift lives.

**The fix.** Both files are right about their own half, so the fix is to scope the override
rather than pick a winner. In the plan template's Plan-Specific Constraints guidance, when a
plan defers `project.md` edits to the lead for parallel-wave safety, require that the
deferral name *which sections* are contested. Only sections a parallel wave could both touch
(Stack, Commands) need batching; **Layout, Convention Map and Conventions are
append-or-amend-in-place and rarely collide**, so chunks should edit those directly in-chunk
per the standing rule. And whichever role applies them, the boundary check in
`prompts/execute.md` § Step 6.3b should say explicitly that verifying `project.md` includes
**re-reading the sections this wave edited as a whole**, not just confirming the new facts
are present — presence is what I checked at the last boundary, and presence was true while
the structure was wrong.

#### Tribal knowledge — snapshots reach the build through generated static imports

**The decision.** Committed snapshots under `src/lib/snapshots/` are reached through
`src/lib/view/catalog.ts`, which imports a *generated* index
(`catalog.generated.ts`, written by `scripts/build-snapshot-index.mts` and run as
`prebuild`) consisting of one static `import` per snapshot file.

**The obvious alternative.** Read the directory — `fs.readdirSync('src/lib/snapshots')` — or
glob it. That is what the code's shape suggests, and it needs no generator, no committed
generated file, and no spec asserting the generated file is current.

**The constraint that made it right.** A source directory nothing imports is not carried
into the build output, and the deployment target has no readable source tree at request
time. Verified by the lead on the merged tree: `find .next -path '*snapshots*' -name
'*.json'` returns nothing, while a snapshot's merge SHA (`0a1f9575…`) does appear inside
`.next/server/chunks/ssr/src_00jhk_s._.js`. The static imports are what pull the data into
the bundle at all; a directory read would work in `pnpm dev` and return nothing in
production.

**The recognition signal.** You add a snapshot to `src/lib/snapshots/` and it does not
appear in the picker, or you are tempted to "simplify" `catalog.ts` by replacing the
generated index with a directory read. `src/lib/view/catalog.test.ts` is the tripwire — an
unindexed snapshot file makes it report `Tests 1 failed | 4 passed`. Canary re-run by the
lead at this boundary to confirm the tripwire still fires. Promoted to `project.md`
§ Conventions.

#### Framework friction — a design amendment applied section-by-section leaves a plan that contradicts itself

**The friction.** Wave 4's preflight found chunk 05's plan asserting both things about Level 2
at once. Its Context, all four relevant acceptance criteria, tasks T005/T006, the Reuse Audit
and the Deliverables all said "node"; its § "The nodes" section said a **card list anchored to
the package, not a graph of pull-request nodes**. The rubric carried both too, so items 47/49
("exactly one node per pull request") and item 60 ("Level 2 presents changes as cards") could
not both pass. And gate 2 resolved its target with
`git ls-files | grep -iE 'change.*node.*\.tsx$'`, which exits 1 with "no change node component
found" against an implementer who correctly built `change-card.tsx`. A chunk graded like this
fails whatever it builds.

**The cause.** The `designs_received` event at `887056f` records chunks 02/04/05/06 "and their
rubrics amended to match". That amendment was real but partial: it rewrote the sections that
*describe* Level 2 and left the sections that *specify* it — criteria, tasks, deliverables,
gates. The standing rule in `prompts/execute.md` § Standing rules is **"Amendments travel in
pairs"**, and it is written narrowly: *"No plan amendment is complete until the matching rubric
item is amended in the same commit."* It names plan → rubric and nothing else, so amending the
prose and the rubric prose both satisfies it while the acceptance criteria, the task list and
the gate still encode the old decision. The rule's own framing — a *pair* — is what makes a
partial sweep feel complete.

**The fix.** Widen the rule from a pair to a sweep in `prompts/execute.md` § Standing rules:
*"A plan amendment is complete when every section that encodes the old decision has changed —
Context, Acceptance Criteria, What To Do, Tasks, Deliverables, Verification Gates, and the
rubric. Grep the chunk for the old noun before committing the amendment; the prose is the
easiest part to fix and the least load-bearing."* The mechanical form is cheap: after amending
a chunk, `grep -in '<old term>' <chunk>/plan.md <chunk>/rubric.md` and account for every hit.
This would have caught all three defects in one command.

**Second-order note.** Verification gates are the part that hurts most, because a gate encodes
a decision as a *filename pattern* — the least reviewable place a design decision can hide.
Chunk 04's preflight caught the same shape (`app/**/*.tsx` globbing zero files in a `src/`-rooted
project); this is the second time a gate's path assumption survived a plan amendment. Two
occurrences makes it a pattern, not an accident.

#### Carry-forward claims re-derived for wave 4

- **Chunk 05's inputs exist as described.** `src/lib/view/` holds `derive.ts`, `layout.ts`,
  `catalog.ts`, `catalog.generated.ts` and `fixture.ts`; `src/components/canvas/` holds the
  six components chunk 04 shipped. Chunk 05 builds Levels 2 and 3 on top of these.
- **Four snapshots are committed and indexed**, not the one the plan assumed at writing
  time: `shadcn-ui-ui-2026-06-22`, `trpc-trpc-2026-06-22`, `xyflow-xyflow-2026-06-22`,
  `xyflow-xyflow-2026-08-31`. Three carry enrichment; `xyflow-xyflow-2026-08-31` is chunk
  04's deliberately un-enriched fixture.
- **The enrichment-completeness invariant changed shape at chunk 04's merge.** Absent
  `enrichment` means un-enriched fixture; present means it must be complete. Chunk 05 must
  not assume every catalog entry has enrichment — Level 2 renders one that does not.

### Wave 4 → US1 checkpoint boundary

Wave 4 closed with #6 merged at `af3cc5f`. Merged tree re-verified by the lead with the
worktree removed, type check last: `pnpm lint` 0, `pnpm test`
`Test Files 13 passed (13) / Tests 246 passed (246)`, `pnpm build` 0, `pnpm typecheck` 0.

#### US1 checkpoint holds — demoed end to end, and the negative clause was measured

The checkpoint reads *"pick a pre-analyzed repository, scrub to any window, see which
packages changed, expand one to its changes with labels and approach notes, expand a change
to its ordered steps. No token, no network, no model call."* Driven by the lead in a browser
against `pnpm start`, not delegated: landing page → `shadcn-ui/ui` → Level 1 → the 30d
preset → focus `v4` → Level 2 → Level 3 for #11582. Every clause rendered.

The part worth recording is the **negative** clause, because "no network, no model call" is
the kind of claim a screenshot cannot make. Three independent checks, not one:
`read_network_requests` captured **zero** requests across all three level transitions;
`find src/app -name route.ts` returns nothing, so there is no endpoint to call; and
`grep -rn -e 'process\.env' -e 'fetch(' --include='*.ts' --include='*.tsx' src/` outside
specs hits exactly one line — a *comment* in `github.ts` stating the token is a parameter.
`pnpm build` independently corroborates it: `/` and `/_not-found` are both `○ (Static)`.

**Method note for the next checkpoint.** The first grep was run without `--include`, and the
committed snapshot JSON — which contains other projects' changelogs — buried the answer
under a screenful of `process.env` matches from *inside a fixture*. A corpus-wide grep in
this repository is unreadable unless it is scoped to code extensions, because roughly half
the tracked bytes are captured API output. Scope first, then read.

#### Framework friction — the boundary check found a gap that no chunk was ever going to report

`execute.md` § Step 6.3b tells the lead to re-verify `project.md` against the merged tree,
framed as *"the check that each chunk did its part"*. Applying chunk 05's two declared
deltas took that framing literally. But re-running the Commands table turned up a third
gap that belongs to **no chunk**: `pnpm start` has existed in `package.json` since chunk 01
and has been used at three consecutive wave boundaries to demo a story — and was never in
the table. No chunk under-reported it; it is a command the *lead* uses, and the deltas
protocol only ever asks implementers what they changed.

Also worth recording: chunk 05's report said `derive.ts` needs **two** of
`enrichment-record.ts`'s exports. It imports **three** (`enrichmentKey`,
`fallbackEnrichment`, `isFallbackEnrichment`). Harmless here, and the delta went in
corrected — but it is the third wave running in which a reported `project.md` delta was
inaccurate in a detail that only reading the source catches. The rule that saved it is
`evidence.md`'s, not the protocol's: measure the claim before you write it down.

**Proposed** (for Part 2, evidence above): the boundary step should say the lead re-derives
the Commands table from `package.json` rather than re-running what the table already lists.
The existing wording only finds commands that *changed*; it structurally cannot find one
that was never written down.

#### Carry-forward claims re-derived at this boundary

- **Convention Map globs still match the tree.** Re-counted with `git ls-files`:
  `src/lib/**/*.ts` 24, `src/components/**/*.tsx` 20, `src/**/*.test.ts` 13,
  `src/components/ui/**` 7, `scripts/**` 2, `src/**/*.generated.ts` 1.
- **Two rows match zero files, both correctly.** `src/app/**/route.ts` — chunk 06 has not
  built a route yet, and it is the row that governs the one it will build. `src/**/*.test.tsx`
  — no component spec exists; the `src/components/**/*.tsx` row does not require one (only
  the `src/lib/**/*.ts` row demands a co-located spec), so this is a row waiting for its
  first file, not a violation.
- **A `git ls-files` count of `src/app/**/page.tsx` is 0 and this is a tooling artifact, not
  a missing file.** Git's `**/` requires an intervening directory, so the glob misses
  `src/app/page.tsx` at the root. Anyone re-running this check should confirm with a plain
  `git ls-files src/app` before concluding a convention row is dead.
- **Stack versions unchanged**; chunk 05 added no dependency, no command, no new file kind.

---

### Chunk 06 — Live analysis

Two review iterations, both **FAIL then PASS on the same axis** — and neither was about
behaviour. This is the first chunk in the plan whose blocking findings were entirely about
the *report*.

#### The streak broke, and a different one started

Chunks 02, 03, 04 and 05 each failed their first review on an unpinned defensive branch.
Chunk 06 did not. The dispatch brief carried that carry-forward explicitly, the implementer
mutation-tested before review, and iteration 1's reviewer went hunting for the same failure
mode and could not find it — it mutated a guard the report never claimed to cover
(`createGitHubClient`'s empty-request check, 5 files / 32 tests red) and confirmed the
three "deleted rather than pinned" branches were genuinely unreachable. **The carry-forward
worked.** That is the strongest evidence in this plan that the journal pays for itself.

What replaced it: **evidence that could not have been produced.**

#### The defect, and the fact that it recurred inside its own fix

Iteration 1 blocked on two "live end-to-end" transcripts showing output the code cannot
emit. `/api/enrichment` returns `{key, entry:{label,approach,steps}, cached, fallback}`;
the report flattened those three fields to the top level and printed `steps` as the integer
`1` where it is an array of `{commitSha, summary}`. The `complete` event's declared type is
`{type, snapshot, bound, repository, branch}`; the transcript dropped `type` and `snapshot`
and added `packages`, `prs` and `enrichment`, which are not fields on it. Cause: the
implementer piped both probes through `node -e` formatters, kept the formatter's output and
discarded the raw bytes.

The fix re-captured them — and **pasted the same body twice**. The two "raw and complete"
enrichment responses were byte-identical, the second reading `cached:false` directly above
prose claiming it flipped to `true`. The captured files were right; the heredoc was not.

The lead caught it by extracting both quoted bodies and comparing them programmatically
(`body1 == body2 → True`) rather than reading them, then establishing ground truth against
a cold instance: `cached=False` at 2.598946 s, `cached=True` at 0.003946 s.

#### What made the second fix different: the method changed, not the text

Per `prompts/review.md`, a recurrence at a new site after a fix at the cited one is where
citations stop. The lead required distinct capture paths per response, `diff` with its exit
status shown, script-generated report blocks, and an extended audit of the newly written
prose.

That is the part worth generalizing, because **re-running found defects that re-reading had
not**, including one neither review cited: a `complete`-event key list formatted by Python's
`json.dumps` while presented as node's `JSON.stringify` output — the two space their
separators differently. The implementer's own 33-claim audit found 12 bad claims, of which
only 2 were the ones cited; a third instance of the invented-field defect
(`"enrichment":"absent"`) was self-caught.

**The parts built to be falsified survived every independent re-run intact — the gates, the
mutation table. It was the prose around them that drifted.** Evidence discipline has to
reach the narrative, not just the checks.

#### Framework friction — the loop has no gate on report fidelity

Every verification gate in this project checks the *code*. Nothing checks that the
completion report describes what the code did, and the report is what the reviewer grades
several rubric items against. Both failures here were caught by a human-equivalent reading
plus an ad-hoc `python3` comparison the lead improvised twice. Chunk 06's `project.md`
delta 10 turns the capture procedure into a convention, which is the right layer — but a
convention is advice, and this chunk violated the advisory version of it twice in a row
before the mechanical one stuck.

**Proposed** (Part 2): `prompts/gates.md` or the completion-report template should carry a
self-check for any report containing a transcript — every quoted payload must appear
byte-for-byte in a captured file, and any two payloads presented as differing must
actually differ. Chunk 06 wrote exactly that script for itself and proved it non-vacuous by
running it against the previous commit (`the two are byte-identical: True → self-check
would exit 1`). It should not have to be reinvented per chunk.

#### The one surviving mutation, and why it is a warning

Iteration 2 mutated away `askedRef` in `grain-workspace.tsx:207` — the "already asked this
session" guard — and nothing failed, because `project.md` deliberately excludes `pnpm test`
from the component gate and no chunk in this plan has component specs. The reviewer framed
it as the one piece of model-spend bounding that is not machine-checked.

The lead narrowed that before accepting it. Line 208's `hasOwnProperty` check on the merged
`enrichment` record independently blocks a re-expand after a success, and the server's
per-instance cache blocks the model call even when a request is made. `askedRef` uniquely
covers the **in-flight double-expand** and the **instance-recycled-mid-session** case. Real,
but not "spend is unguarded". Filed as
`plans/ideas/bound-live-route-spend-and-concurrency.md` together with the two the
implementer flagged, since all three are the same concern — nothing bounds what one
anonymous request can spend.

#### Carry-forward correction the lead owed

The implementer's report said the ingest fan-out means "200 concurrent GitHub requests".
Files and commits are awaited sequentially *within* each pull request's chain, so it is
~100 concurrent chains issuing 200 requests in total. Both reviewers agreed with the
correction. The finding itself is real and correctly left alone: the lead verified the
`Promise.all` is untouched by chunk 06's diff and came from chunk 02 (`549d507`).

---

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
