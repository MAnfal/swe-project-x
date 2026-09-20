# Chunk 04 — Review Iteration 2

Fresh review, independent of iteration 1's conclusions. Base for the diff:
`512c5ed` (the tree iteration 1 reviewed) on branch
`feat/project-grain-prototype--canvas-topology`, fix commit `f4715d5`. Everything below
was re-derived in the worktree (`.worktrees/04-canvas-topology`), not inherited from the
implementer's or the lead's claims. `git status --porcelain` was empty before I started and
is empty now — every mutation applied during mutation-testing was restored from a `cp`
backup, never `git checkout --`.

## Universal Checks

- [x] PASS — The change does what the acceptance criteria say. Re-verified by reading
      `derive.ts`, `time-slider.tsx`, `grain-workspace.tsx` in full and re-running the
      gates myself (below). `derive.ts`/`layout.ts` are byte-identical to `512c5ed`
      (`diff` empty), confirming no production behaviour changed for the mutation fix.
- [x] PASS — All four gates re-run after the last edit (`f4715d5`), in this worktree, in
      order, type check last: `pnpm lint` exit 0 no output; `pnpm test` `Test Files 10
      passed (10)` / `Tests 144 passed (144)`; `pnpm typecheck` exit 0 no output; `pnpm
      build` exit 0, `○ (Static) prerendered`. Each gate is falsifiable: lint/typecheck/
      build were not re-derived with a fresh negative control this iteration (iteration 1
      already ran canaries on the base tree and nothing since touched their surface), but
      `pnpm test` was independently falsified below by direct mutation.
- [ ] **FAIL — Three new mutation survivors in the exact functions this iteration's fix
      targeted, adjacent to the two mutants that were killed.** The fix kills the two
      named mutants (verified, see below) but does not generalize to sibling edges in the
      same code. See § Mutation testing — my own survivors.
- [x] PASS — `completion-report.md` exists, is thorough about the iteration-1 response,
      and is committed (`f4715d5`).
- [x] PASS — The report is honest that the nine new assertions have no "code missing" red
      run and states their red run is the reapplied mutant instead — verified: reapplying
      mutant A and mutant B against a copy-backed `derive.ts` reproduces the reported
      3-failure blocks by name, byte for byte (see below).
- [x] PASS — No new abstraction introduced by this iteration's diff (a new fixture
      function and more test cases only).
- [x] PASS — No principle violated by this iteration's diff: `fixture.ts`'s addition
      re-parses the real committed snapshot through `snapshotSchema`, no `fs` write, no
      credential read, nothing in a component reads `process.env`.
- [x] PASS — Scope: `git diff a2b8565..HEAD --stat` (the whole chunk, not just this
      iteration) touches exactly the 19 files the chunk claims, no file under
      `src/lib/ai/`, no `scripts/ingest.mts` change, no `.claude/resources/project.md`
      change (all reconfirmed directly, not copied from the report).
- [x] PASS — No secret or credential literal: `git diff a2b8565..HEAD | grep -inE
      'ANTHROPIC_API_KEY|GITHUB_TOKEN|sk-…|ghp_…'` → no hits.
- [x] PASS — No new silent failure introduced by this iteration's diff.
- [x] PASS — No duplicated logic: `snapshotWithDeclaredWindow` is new, single-purpose, and
      explicitly modelled on the existing `transcriptWithReversedListing` precedent rather
      than reinventing a fixture-variation helper.
- [x] PASS — Baseline was captured before any edit in iteration 1 and carries forward;
      counts above are deltas against a clean base.
- [x] PASS — Comments this iteration touches are still true against the code beside them,
      **with one caveat that does not by itself flip this bullet** — see Warnings: the
      `historyBounds` doc comment ("a merge that landed outside it would otherwise be
      unreachable... so the bounds widen") reads as a live production necessity, but given
      the real producer's own guarantee (below), it currently describes an invariant no
      committed snapshot can violate. The sentence is not false — it correctly describes
      what the code does and why it would matter if the invariant broke — but it does not
      disclose that the invariant is currently always held by construction, the way the
      `layout.ts` guard's comment is honest about being "defensive."

## Test Coverage Checks

- [ ] **FAIL — Change-volume series and history bounds still have live mutation
      survivors** after the fix, in the boundary-tie logic and the span guard the widening
      loop and clamp depend on. Same rubric item iteration 1 failed; not yet resolved in
      full. See § Mutation testing.
- [x] PASS — Everything else under this heading (window derivation, attribution counts,
      layout, un-enriched snapshot) is unchanged since iteration 1 and was independently
      hand-verified there against the snapshot; I re-read `derive.test.ts` and
      `layout.test.ts` in full and found nothing that contradicts that verification.

## Chunk-Specific Checks

- [x] PASS — Derivation remains plain functions over plain objects; unchanged since
      iteration 1 (`derive.ts` byte-identical).
- [x] PASS — Dependency/reach edge filtering unchanged; re-read `derive.ts:207-210`,
      matches iteration 1's description exactly.
- [x] PASS — Neither distinction rests on colour alone; unchanged, re-read
      `package-node.tsx`.
- [x] PASS — Slider now additionally shows the corrected preset state (instant comparison)
      and the corrected Home/End behaviour; re-verified live in the source and against the
      installed primitive (below). Full-history, explicit dates, volume histogram and
      presets are otherwise unchanged from iteration 1.
- [x] PASS — Repository picker unchanged since iteration 1.
- [x] PASS — Un-enriched snapshot derivation unchanged since iteration 1.
- [x] PASS — Layout is a standalone function, unchanged.
- [x] PASS — Empty state renders; additionally no longer contradicted by a stale focus,
      per the `changeRange` fix (verified below).
- [x] PASS — Snapshot types imported from `src/lib/snapshot.ts`; unchanged.
- [~] **PASS, with a reachability caveat recorded rather than silently accepted** — Tests
      assert the derived value a consumer receives (`historyBounds(...)`,
      `deriveWindow(...).changeCount`, `volumeSeries(...)`), never an echoed literal;
      checked every new assertion in the diff. Separately, the *scenario* the new tests
      construct — a pull request outside its snapshot's own declared window, or landing
      exactly on the widened bound — is one `scripts/ingest.mts` can never produce: see
      § Reachability below. This does not violate the cited bible rule (which is about
      reading back inputs, not about production-reachability), so it is not graded as a
      bullet failure, but it is a real fact the report should state plainly rather than
      imply the opposite of.
- [x] PASS — `project.md` diff empty this iteration too; deltas section is unchanged from
      iteration 1 and still accurate.
- [x] PASS — The Home/End judgment call and the `⇕ resize` non-build are both explained
      with reasoning and evidence in the report (see § Design page 10 below for whether
      the reasoning holds, graded separately as its own item).
- [x] PASS — Completion report states plainly, with a git citation, that the mid-fi
      designs preceded implementation (`git merge-base --is-ancestor 887056f de50039`
      re-run here, still exits 0). Iteration 1's Issue 3 is resolved.
- [ ] **FAIL, but the fix is substantially complete — see reasoning below** — Design page
      10's keyboard model. `Home`/`End` are now built and verified correct in all four
      focus/key combinations (below). The `⇕ resize` gesture is still not built, disclosed
      in § Deviations with real, checkable reasoning (the primitive's own `ARROW_UP`/
      `ARROW_DOWN` mapping, cited without a stale line number because the dependency is
      caret-ranged — correct per the evidence rules). I read page 10 directly and judge the
      reasoning holds: none of the four state cards (REST, DRAGGING, HANDLE FOCUSED, PRESET
      APPLIED) describes what "resize" changes, from which anchor, or by how much, so
      building a guess would be worse than disclosing the gap. I am marking this bullet
      FAIL rather than N/A only because the rubric item is literally "the screens this
      chunk builds match the committed mid-fi designs" and the built screen's footer hint
      still does not offer the `⇕ resize` affordance page 10 promises — a real,
      undisputed gap between the design and the shipped screen, however well-reasoned the
      omission is. This is the correct way to leave a genuinely ambiguous design
      requirement rather than a defect in how it was handled.

### From the Convention Map — `src/lib/**/*.ts`

- [x] PASS — Unchanged since iteration 1: standalone functions, no `fs` write/
      `child_process`, no credential read, relative `.ts` imports.
- [~] N/A (same note as iteration 1) — `fixture.ts` still has no co-located spec, same
      shape as the existing `replay.ts` precedent.

### From the Convention Map — components and pages

- [x] PASS — Unchanged: no `ai`/`@ai-sdk` import, no `process.env` read, every render path
      through `snapshotSchema.parse`.

### From the Convention Map — `src/components/ui/**`

- [x] PASS — `git diff a2b8565..HEAD --stat -- src/components/ui/` is empty; the
      generated slider primitive is untouched. The Home/End override lives in
      `time-slider.tsx` (a wrapper), not a patch to the generated file — correct per the
      rubric's explicit instruction that a primitive limitation is fixed by a wrapper, not
      a hand-edit.

### From the Convention Map — `src/**/*.test.ts`, `src/**/*.test.tsx`

- [x] PASS — Consumer-value assertions throughout, including the new cases (verified by
      reading every new `it(...)` block in `derive.test.ts` and `layout.test.ts`).
- [x] PASS — The new `historyBounds`/`volumeSeries` cases are built on the real committed
      snapshot's real pull requests via `snapshotWithDeclaredWindow`, which varies only the
      declared window — not a hand-rolled approximation of a pull request. See the
      reachability caveat above for the separate question of whether that *scenario* is
      realistic.
- [x] PASS — New specs live under `src/lib/view/*.test.ts`, matched by
      `vitest.config.mts`.
- [x] PASS — `Tests 144 passed (144)` is the number asserted and independently reproduced,
      not just a zero exit.

### From the Convention Map — `src/**/snapshots/**/*.json`

- [x] PASS — Unchanged this iteration; the snapshot file itself was not touched
      (`git diff 512c5ed..HEAD -- src/lib/snapshots/` empty).

### From the Convention Map — manifests and config

- [x] PASS — Unchanged this iteration; no dependency added, `project.md` still
      unmodified.

### Deployment and parallel-wave boundary

- [x] PASS — Unchanged since iteration 1; nothing in this iteration touches the catalog,
      the generated index, or the build.

## Mutation testing — re-derived myself

### The two named mutants: confirmed killed

```
$ cp src/lib/view/derive.ts /tmp/derive.ts.bak
# Mutant A: delete historyBounds's widening loop (`for (...) { ... }` -> `void from; void to;`)
$ pnpm test -- --run derive.test.ts
 Tests  3 failed | 34 passed (37)
 FAIL … > widens the upper bound to the newest merge when the declared window ends before it
   expected 2 to be 6  // Object.is equality   (the "reachable by full-history range" case)
$ cp /tmp/derive.ts.bak src/lib/view/derive.ts   # restored, git status clean

# Mutant B: remove volumeSeries's final-bucket clamp
#   Math.min(bucketCount - 1, Math.max(0, ...)) -> Math.max(0, ...)
$ pnpm test -- --run derive.test.ts
 Tests  3 failed | 34 passed (37)
 FAIL … > still accounts for every pull request exactly once
   expected false to be true // Object.is equality
$ cp /tmp/derive.ts.bak src/lib/view/derive.ts   # restored, git status clean
```

Both match the completion report's claims exactly. The arithmetic in the report is
correct.

### My own survivors — three, all in the same functions

```
# Survivor 1: historyBounds's lower-bound tie, `merged < from` -> `merged <= from`
$ pnpm test -- --run derive.test.ts
 Test Files  1 passed (1)
      Tests  37 passed (37)          <- SURVIVED
$ cp /tmp/derive.ts.bak src/lib/view/derive.ts

# Survivor 2: historyBounds's upper-bound tie, `merged > to` -> `merged >= to`
$ pnpm test -- --run derive.test.ts
 Test Files  1 passed (1)
      Tests  37 passed (37)          <- SURVIVED
$ cp /tmp/derive.ts.bak src/lib/view/derive.ts

# Survivor 3: volumeSeries's span guard, `Math.max(end - start, 1)` -> `end - start`
$ pnpm test -- --run derive.test.ts
 Test Files  1 passed (1)
      Tests  37 passed (37)          <- SURVIVED
$ cp /tmp/derive.ts.bak src/lib/view/derive.ts   # all three restored, git status clean
```

(Two mutants I also tried were correctly killed and are not survivors: removing the
first/last-bucket edge-string reuse in `volumeSeries` fails
`counts that merge in the final bucket rather than off the end of the series` with a
`.000Z` vs no-milliseconds mismatch; loosening `deriveWindow`'s range filter from
`>=`/`<=` to `>`/`<` fails the `changeCount`/`pullRequests` assertions in the new
"reachable by the full-history range" test.)

**Why these three matter, not just that they exist.** The "merge exactly at `to`" tie is
precisely the scenario the review's own new test group
(`volumeSeries — a merge landing exactly on the upper bound`) says it is pinning — but that
test group sets `metadata.window.until` to equal PR 5992's own `mergedAt`, which means no
pull request is ever *strictly greater* than `to`; the widening loop's `if (merged > to)`
branch is never entered by that test at all, only `volumeSeries`'s own clamp is exercised.
The tie case in `historyBounds` itself — a pull request merging at the exact instant of the
declared boundary — was never tested even though the sibling case (a pull request merging
exactly at the *widened* boundary) was the whole point of this iteration's fix. Survivor 3
is a distinct, plain robustness gap: `snapshotSchema` (`src/lib/snapshot.ts:142`) does not
enforce `since < until`, so a schema-valid snapshot with a zero-width or inverted window is
constructible (including via the very `snapshotWithDeclaredWindow` helper this iteration
added), and `volumeSeries` would silently divide by zero, producing a `NaN` bucket index
that drops a pull request out of the series without either a bucket-count mismatch or a
thrown error — the exact `NaN` corruption mode the report itself flagged as "the failure
mode is worse than the comment implied" for Mutant B, just one guard clause to the left of
where the fix looked.

None of these three require new production code — like Mutant B, the current
implementation is already correct; only a test per case is missing. The fix pattern is
identical to what iteration 1 already prescribed: a `snapshotWithDeclaredWindow` case with
a pull request landing exactly at (not past) each declared boundary, and one with
`since`/`until` narrow enough to make `end - start` collapse to (or go below) zero.

## Reachability — does the scenario the new tests construct ever occur in real ingester output?

Checked directly, not assumed. `scripts/ingest.mts` is the only writer of a committed
snapshot; it calls `ingestRepository`, which:

- passes `options.since`/`options.until` unchanged into both `metadata.window`
  (`src/lib/ingest/ingest.ts`, the `Snapshot` object literal) and into
  `fetchMergedPullRequests`'s `bounds`;
- `fetchMergedPullRequests` (`src/lib/ingest/github.ts:139`) enforces
  `if (pr.merged_at < bounds.since || pr.merged_at >= bounds.until) continue;` **before**
  a pull request is ever added to the result the snapshot is built from.

So for any snapshot this repository's own ingester can produce, every `pullRequests[i]
.mergedAt` is already inside `[metadata.window.since, metadata.window.until)` by
construction — `historyBounds`'s widening loop can never fire, and no pull request can ever
land exactly on `metadata.window.until` (that instant is the excluded upper bound of the
fetch itself). **The scenario `snapshotWithDeclaredWindow` constructs cannot occur in real
ingester output; the guard the new tests pin is defensive, not currently reachable.**

This does not make the tests dishonest in the way the lead's question raised — they assert
real return values from real functions over the producer's real captured pull requests, not
an echoed literal, and the technique matches the codebase's own precedent
(`transcriptWithReversedListing`) for varying one field of real output rather than
hand-authoring a fixture. But the completion report's and `derive.ts`'s own comments
present the widening loop as guarding something that "would otherwise be unreachable by any
range" as if this is a live production concern, without stating — the way the report
correctly did for `layout.ts`'s known-node guard ("defensive, not exercised in the app") —
that under the current sole producer, the condition it guards against cannot happen at all.
`snapshotSchema` (`src/lib/snapshot.ts:142`) not enforcing `since < until` or
window-contains-every-pull-request is the actual reason the guard has any value: it
protects against a *hand-edited or future* producer, not this one. Recorded as a Warning,
not a bullet failure.

## Home/End — verified against the installed primitive directly

`node_modules/@base-ui/react/slider/thumb/SliderThumb.js:317-320` (version pinned in prose
as `1.8.0` rather than by line number, correctly — `package.json:16` has
`"@base-ui/react": "^1.8.0"`, a caret range, so a line citation would go stale unread):

```js
case _composite.END:
  newValue = range && Number.isFinite(sliderValues[index + 1]) ? sliderValues[index + 1] - step * minStepsBetweenValues : max;
case _composite.HOME:
  newValue = range && Number.isFinite(sliderValues[index - 1]) ? sliderValues[index - 1] + step * minStepsBetweenValues : min;
```

Confirmed by hand for all four combinations: `END` on the left thumb (index 0) sees
`sliderValues[1]` finite → clamps beside the right thumb, not `max`. `HOME` on the right
thumb (index 1) sees `sliderValues[0]` finite → clamps beside the left thumb, not `min`.
Only `HOME`-left and `END`-right fall through to `min`/`max` correctly. This is exactly the
report's claim.

The override (`time-slider.tsx:125-133`) is attached via `onKeyDownCapture` on an ancestor
of both thumbs. Traced the interaction with the primitive's own source
(`SliderThumb.js:288-291`: `onKeyDown(event) { if (event.defaultPrevented) return; ...}`):
a capture-phase `stopPropagation()` on an ancestor halts the event before the descendant
thumb's own bubble-phase `onKeyDown` ever runs, and the override additionally calls
`preventDefault()` first as a second, redundant layer of protection given that early-return
check. The override computes `{ from: history.from, to: range.to }` for Home and
`{ from: range.from, to: history.to }` for End, regardless of which thumb has focus — since
`range` is always a sub-range of `history` (the slider's own `min`/`max`), this can never
invert the range (`history.from <= range.to` and `range.from <= history.to` always hold).
Verified this is a superset of the primitive's own correct half, not a divergent
reinterpretation: on `HOME`-left and `END`-right the override reaches the identical
value the unmodified primitive already produced.

**Works for all four combinations.** I did not drive this through an actual browser (no
component-rendering test framework exists in this project, confirmed by iteration 1 and
still true), so "works" here means: traced against the actual installed primitive's control
flow and confirmed the override reaches the correct value algebraically for each of the
four (thumb, key) pairs, which is the same level of verification the report itself used.

## Design page 10 — the `⇕ resize` non-build, judged against the actual page

Opened `plans/2026-09-20-project-grain-prototype/design/mid-fi.pdf`, page 10 directly. The
footer hint reads `← → nudge a day · ⇕ resize · Home / End jump to repo start / end`. Four
state cards are shown: REST ("handles sit flush with the track edge"), DRAGGING ("the
moving handle widens and the date readout follows it live"), HANDLE FOCUSED ("Tab reaches
each handle; a 2px ring, not a colour change, marks focus"), PRESET APPLIED ("picking a
preset moves both handles and swaps the Custom pill for it"). None of the four describes
what `⇕` does, from which anchor, or by how much — DRAGGING describes only the pointer
gesture. The reasoning in § Deviations holds: this is a real, unresolved ambiguity in the
design itself, not a gap the implementer manufactured to justify skipping work. Separately
confirmed the cited primitive fact: `SliderThumb.js`'s `ARROW_UP`/`ARROW_DOWN` cases already
resolve to the same `direction`-based `newValue` computation as `ARROW_LEFT`/`ARROW_RIGHT`
(both call `getNewValue(roundedValue, increment, direction, min, max)`), which does mean
Up/Down on the *focused thumb* already nudges that one boundary today, unmodified — the
same thing `←`/`→` does. The gap is real (no whole-range resize gesture exists), the
reasoning for not guessing at anchor/amount is sound, but the report does not mention that
Up/Down already does something today (an unadvertised, ARIA-standard per-thumb nudge) —
worth one sentence, not a blocker.

## Focus and the empty state — confirmed fixed without a regression

`grain-workspace.tsx:44-70`: only two call sites ever mutate `range` —
`selectRepository` (already cleared `focused` before this iteration) and the new
`changeRange`, which now backs **both** `TimeSlider`'s `onRangeChange` (including the new
Home/End path, since that also calls `onRangeChange`) and `EmptyWindow`'s "jump to nearest
activity" `onRangeChange`. No third call site bypasses it (`grep -n "setRange"` in the file
returns exactly these two). The normal focus case is unaffected: `changeRange` only clears
`focused` as a *consequence* of a range change, it is never called on its own, so clicking a
node to focus it while the range is untouched still works exactly as before.

## Verdict

**FAIL**

### Issues (blocking)

1. **Three new mutation survivors in `historyBounds`/`volumeSeries`, the exact functions
   this iteration's fix targeted** — `derive.ts:82` (`merged < from`), `derive.ts:86`
   (`merged > to`), `derive.ts:108` (`Math.max(end - start, 1)`). All three were
   independently confirmed to survive the full `derive.test.ts` suite (37/37 green with
   each mutation applied, restored afterward). This is the same failure mode iteration 1
   blocked on, in the same two functions, one guard-clause away from the lines that were
   fixed. Fix: one `snapshotWithDeclaredWindow` case per boundary-tie (a pull request
   merging at exactly `since`, and one at exactly the pre-widened `until`, not past it),
   and one case where the declared window is narrow enough that `historyBounds` collapses
   `from`/`to` to the same instant (`end - start <= 0`), asserting `volumeSeries` does not
   emit a `NaN` count instead of throwing or degrading predictably.

2. **Design page 10's `⇕ resize` gesture is still not built.** The reasoning for not
   guessing at its anchor/amount is sound and I verified it against the actual page — this
   is a judged, disclosed gap, not an oversight, and is far better handled than iteration
   1's undisclosed version of the same gap. It remains a literal mismatch between the
   committed design and the shipped screen, so it is named here rather than waived, but it
   should not by itself block a chunk that has otherwise disclosed it correctly — see
   Guidance.

### Warnings (non-blocking)

- **The scenario the new `historyBounds`/`volumeSeries` tests construct cannot occur in
  real ingester output.** `src/lib/ingest/github.ts:139` filters every pull request to
  `[since, until)` before it is ever written into a snapshot, and `metadata.window` is set
  from the same bounds — so the widening loop and the exactly-on-boundary clamp are
  defensive against a hand-edited or future producer, not against this repository's own
  ingester. The tests are honest (they assert real return values off real captured pull
  requests, not echoed input), but the code comments and the completion report present the
  guard as a live production necessity rather than disclosing it the way `layout.ts`'s
  guard was disclosed ("defensive, not exercised in the app"). One sentence in `derive.ts`'s
  doc comment and the report would resolve this.
- **The footer hint no longer mentions Up/Down at all**, even though the unmodified
  primitive already gives the focused thumb's Up/Down arrows the same effect as Left/Right
  (confirmed in `SliderThumb.js`). Not a defect — just an omitted, free affordance that
  could be documented in the same hint string.
- Carried forward from iteration 1, still true, still non-blocking: `layout.ts`'s
  known-node guard is now pinned by position (mutant C, confirmed killed), and
  `fixture.ts` still has no co-located spec, consistent with the `replay.ts` precedent.

### Guidance

Fix Issue 1 first — it is mechanical, cheap (test-only, no production code changes, by the
implementer's own demonstrated pattern), and it is the second time this exact class of gap
has been found in the same two functions, so this time close the whole neighbourhood
(both comparison operators in the widening loop, the span guard) rather than the specific
line a reviewer named. Then add the one-sentence reachability disclosure (Warning 1) next
to the existing `layout.ts` precedent for how to phrase a defensive-but-unreachable guard
honestly. Issue 2 does not need new code — it needs a decision from whoever owns the
design about the resize gesture's anchor and amount; note it in the plan and move on.
