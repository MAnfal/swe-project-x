# Chunk 04 — Review Iteration 3

Fresh review, independent of iterations 1 and 2. Diff graded: `f4715d5..1911fae` (HEAD) on
branch `feat/project-grain-prototype--canvas-topology`, in worktree
`.worktrees/04-canvas-topology`. Everything below was re-derived directly — gates re-run,
mutants re-applied and reverted with `cp` (never `git checkout --`), reachability re-checked
against `src/lib/ingest/github.ts`, `src/lib/ingest/ingest.ts` and `src/lib/snapshot.ts`
directly. `git status --porcelain` is empty now; every scratch file lived under my own
subdirectory (`scratchpad/review-04-i3-anfal/`) or `/tmp`, never the shared scratchpad root.

## What changed since iteration 2's FAIL

`git diff f4715d5..HEAD --stat`: `completion-report.md`, `review-iteration-2.md` (the
iteration-2 verdict, committed as the record), `src/lib/view/derive.test.ts` (+57),
`src/lib/view/derive.ts` (+17, comments only), `src/lib/view/fixture.ts` (+22, a
`keepPullRequests` option on `snapshotWithDeclaredWindow`). No component file changed. Scope
is exactly what iteration 2 asked for.

**`derive.ts`'s executable code is unchanged.** Re-verified independently:
`git diff -U0 f4715d5..HEAD -- src/lib/view/derive.ts | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-]\s*(\*|/\*\*|\*/)'`
produces no output — every added line is a comment.

## Universal Checks

- [x] PASS — The change does what the acceptance criteria say. Read `derive.ts` in full;
      production logic is byte-identical to `f4715d5`/`512c5ed`, so the acceptance-criteria
      grading from iterations 1–2 (independently spot-checked here against
      `topology-canvas.tsx`, `package-node.tsx`, `grain-workspace.tsx`) still holds.
- [x] PASS — All four gates re-run after the last edit (`1911fae`), in this worktree, in
      order, type check last: `pnpm lint` exit 0 no output; `pnpm test` `Test Files 10
      passed (10)` / `Tests 149 passed (149)`; `pnpm build` exit 0, `○ (Static)
      prerendered`; `pnpm typecheck` exit 0 no output. Each gate is falsifiable: lint/build/
      typecheck were canaried in prior iterations and nothing here touches their surface;
      `pnpm test` was independently falsified by direct mutation, below.
- [x] PASS — The three survivors iteration 2 named are confirmed killed, independently
      re-derived (not copied from the report): mutant D (`merged < from` → `<=`), mutant E
      (`merged > to` → `>=`), mutant F (`Math.max(end - start, 1)` → `end - start`) all fail
      the suite when applied and pass clean when reverted. See § Mutation kills — re-derived.
      My own hunt beyond these three (§ My own survivors) found nothing on a reachable path
      that the stopping rule would block on.
- [x] PASS — `completion-report.md` exists, documents this iteration's fix distinctly under
      "Review iteration 2 — what changed in response," and is committed (`1911fae`).
- [x] PASS — Honest about the red run: the report states plainly that the D/E/F cases have
      no "module missing" red run and that their red run is the reapplied mutant. Verified —
      reapplying each mutant reproduces a real failure by name (§ Mutation kills).
- [x] PASS — No new abstraction. A fixture gains an option parameter; nothing else.
- [x] PASS — No principle violated by this iteration's diff. `fixture.ts`'s addition still
      re-parses the real committed snapshot through `snapshotSchema` (Principle 4); no `fs`
      write, no credential read, no component touched.
- [x] PASS — Scope: `git diff a2b8565..HEAD --stat` (whole chunk) touches nothing under
      `src/lib/ai/`, does not modify `scripts/ingest.mts`, does not modify
      `.claude/resources/project.md` — reconfirmed directly.
- [x] PASS — No secret or credential literal in the diff (checked for `GITHUB_TOKEN`,
      `ANTHROPIC_API_KEY`, token-shaped strings — the only hits are the review docs quoting
      the grep pattern itself, not a value).
- [x] PASS — No new silent failure introduced. `activityOf`'s and `volumeSeries`'s
      guard-clause throws are unchanged and still fire; see Warnings for the narrow note
      that neither has a direct unit test of its own (unchanged since iterations 1–2, not a
      new gap).
- [x] PASS — No duplicated logic: the `keepPullRequests` option on
      `snapshotWithDeclaredWindow` is new but single-purpose and stays inside the existing
      fixture, not a second fixture-variation helper.
- [x] PASS — Baseline captured before any edit in iteration 1 and still the delta base; the
      149/149 count above is the full delta from the captured 94/94 baseline.
- [x] PASS, with one thing checked directly rather than accepted — **the two new
      reachability disclosures in `derive.ts` are accurate.** Re-verified against the actual
      files, not trusted:
      - `historyBounds`'s comment claims this repository's own ingester cannot trigger the
        widening loop. Confirmed: `fetchMergedPullRequests`
        (`src/lib/ingest/github.ts:139`) drops any pull request outside `[since, until)`
        before it is written, and `ingestRepository` (`src/lib/ingest/ingest.ts:93-103,157`)
        copies the same `since`/`until` into `metadata.window` and rejects a non-positive
        window before it starts. So no snapshot this ingester produces can have a merge
        outside its own declared window — the claim is true.
      - `volumeSeries`'s comment claims `snapshotSchema` parses a window whose `since`
        equals or follows its `until`. Confirmed: `snapshotMetadataSchema`
        (`src/lib/snapshot.ts:142`) is `window: z.object({ since: z.string().min(1), until:
        z.string().min(1) })` — no cross-field check at all. True, and `ingestRepository`'s
        own `since < until` guard (line 93) is the reason no *ingester* snapshot can carry
        one.
      - Both comments frame the guard the same way `layoutGraph`'s known-node guard is
        already framed elsewhere in the codebase (a defence against what the schema admits,
        not what this producer emits) — same status, consistent phrasing. Neither comment
        overstates a defensive guard as load-bearing; if anything they are precise about
        which of the two guards (widening vs. span floor) sits on which side of the
        ingester/schema line.

## Test Coverage Checks

- [x] PASS — Change-volume series and history bounds: the rubric item iterations 1 and 2
      failed on is now closed. All five mutants in `historyBounds`/`volumeSeries` (the
      widening loop, both its comparison operators, and the span floor) die by name when
      re-applied. See § Mutation kills — re-derived.
- [x] PASS — Everything else under this heading is unchanged since iteration 2 and was
      re-read here (window derivation, attribution counts, layout, un-enriched snapshot);
      nothing contradicts the earlier verification.

## Chunk-Specific Checks

Unchanged items (derivation as plain functions, edge filtering, non-colour distinction,
slider contents, picker discovery, un-enriched derivation, layout as a standalone function,
empty state, snapshot types imported not redeclared, `project.md` untouched with deltas
reported, judgment calls explained, designs-preceded-implementation statement) are
re-confirmed by re-reading the relevant files directly; none of this iteration's diff
touches them, so I am not re-litigating what iterations 1–2 already established correctly.

- [x] PASS — Tests assert the derived value a consumer receives
      (`.claude/resources/bibles/swe/testing.md`). Every new assertion in this iteration's
      diff reads `historyBounds(...)`, `deriveWindow(...).changeCount`, or
      `volumeSeries(...)` — never an echoed literal. Checked every new `it(...)` block.
- [x] PASS — The transform is tested against the producer's real captured output, not a
      hand-rolled approximation. `snapshotWithDeclaredWindow`'s new `keepPullRequests` option
      filters the *real* committed pull requests by number; it does not fabricate one. One
      thing worth a Warning below: the option has no assertion that a requested number was
      actually found, so a typo would silently narrow to fewer records than intended — not
      live today (the one call site's assertions are specific enough that a typo would
      surface as a failing count), but worth hardening if the fixture grows more call sites.
- [x] PASS — Design page 10's `⇕ resize` gesture. Per dispatch, not re-opened. The
      completion report states the deferral plainly ("Deferred by lead decision at review
      iteration 2 ... The lead has taken the decision") and points at
      `plans/ideas/slider-range-resize-gesture.md`. Confirmed on `main`
      (`plans/2026-09-20-project-grain-prototype/ORCHESTRATOR.md:235-241`, Design Decision
      11) that the idea file and the decision both exist and match the report's account —
      this lives outside the chunk's own worktree branch, as expected for an
      orchestrator-level record, and the report's pointer to it is accurate.

### From the Convention Map — `src/lib/**/*.ts`, components, `ui/**`, tests, snapshots, manifests, deployment

All unchanged since iteration 2 (no file in these categories other than `derive.ts`,
`derive.test.ts`, `fixture.ts` moved). Re-confirmed directly rather than assumed:
`git diff a2b8565..HEAD --stat -- src/components/ui/` is empty; regenerating
`catalog.generated.ts` (`node scripts/build-snapshot-index.mts`) produces no diff against the
committed copy; `pnpm build` + route table still show `○ (Static) prerendered`; no file
under `src/lib/ai/`, no `scripts/ingest.mts` change.

## Mutation kills — re-derived, not copied from the report

All applied to a `cp`-backed file, restored with `cp`, `git status --porcelain` empty before
and after each.

```
# Mutant D: historyBounds's lower-bound tie — `merged < from` -> `merged <= from`
Tests  1 failed | 148 passed (149)
 FAIL … historyBounds — a merge sitting exactly on a declared bound … keeps the declared
       lower bound when the oldest merge sits exactly on it
restored, git status clean

# Mutant E: historyBounds's upper-bound tie — `merged > to` -> `merged >= to`
Tests  1 failed | 148 passed (149)
 FAIL … keeps the declared upper bound when the newest merge sits exactly on it
restored, git status clean

# Mutant F: the span floor — `Math.max(end - start, 1)` -> `end - start`
Tests  1 failed | 148 passed (149)
 FAIL … volumeSeries — a history with no width … still counts the merge that sits on that
       instant
restored, git status clean
```

All three match the completion report's claims exactly.

## My own survivors — hunted outside derive.ts's five now-pinned mutants

Per dispatch, concentrated on `deriveWindow`'s boundary handling, `nearestActivity`,
`layout.ts` beyond the dangling-edge guard, and `catalog.ts`/`fixture.ts`. Three found, all
classified against the stopping rule (reachable-by-schema-valid-snapshot blocks; genuinely
inert or unreachable-by-any-schema-valid-snapshot does not):

1. **`nearestActivity`'s tie-break, `derive.ts:253`: `distance < bestDistance` → `<=`
   survives** (`pnpm test -- --run derive.test.ts` stays 42/42 green). Reachable in
   principle — two merges can be exactly equidistant from a range's edges — but the two
   candidates the mutation chooses between are both, by construction, equally valid
   "nearest" merges: the function's contract is "a merge near the range," not "the
   lexicographically-first among ties," and either choice keeps that contract. **Warning,
   not a blocker** — it changes which of two equally-correct answers is returned, not
   whether the answer is correct.

2. **`layoutGraph`'s self-edge skip, `layout.ts:59` (`if (edge.from === edge.to) continue;`)
   has no test and survives its own deletion** (`layout.test.ts` stays 8/8 green with the
   guard removed). Checked reachability at the schema boundary myself:
   `packageEdgeSchema` (`src/lib/snapshot.ts:71-75`) does not forbid `from === to`, so a
   schema-valid snapshot could declare a package depending on itself, and if that package
   were active the edge would reach `layoutGraph` un-filtered without this line. But I
   measured what removing it actually does — a two-line dagre repro
   (`new Graph(...).setEdge('a','a'); layout(graph)`) lays the single node out normally, no
   throw, no shifted rank — so unlike the derive.ts guards, this one guards against
   something that is inert rather than something that corrupts output. **Warning, not a
   blocker**: worth a one-line test for completeness, but it is not the same failure class
   as mutants A–F (nothing renders wrong if it goes unfixed).

3. **`activityOf`'s unknown-package throw and `volumeSeries`'s `bucketCount < 1` throw have
   no direct unit test asserting the throw**, unchanged since iteration 1. Both prior
   reviewers passed "no silent failure" by reading the code rather than by finding a test,
   and I am applying the same reading here for consistency: these are caller-misuse guards
   (a typo'd package name, a non-positive bucket count), already covered qualitatively under
   the Universal Check for silent failures, and distinct from the business-logic edges
   (window boundaries, no-width history) the Test Coverage Checks actually enumerate.
   **Warning, not a blocker.**

None of the three rise to the stopping rule's "reachable path" bar in the way A–F did: A–F
each produced a *wrong, silently-corrupted value* (a re-spelled ISO bound, an off-the-end
bucket write, a `NaN` bucket that drops a merge with no error) when their guard failed. All
three of mine either produce an equally-valid alternative answer, produce no observable
difference at all, or guard against a typo rather than a data shape the schema admits in the
wild.

## The two recorded-but-unfixed warnings — checked myself, not taken on trust

- **Footer hint omits Up/Down.** Confirmed: `time-slider.tsx:238` reads `← → nudge
  {stepLabel} · Home / End jump to repo start / end · Tab reaches each handle` — no mention
  of Up/Down, even though the unmodified primitive already gives the focused thumb's
  Up/Down the same effect as Left/Right. Correctly recorded as a non-blocking warning; the
  lead's dispatch scoped this iteration to the three mutants plus the disclosure, and this
  is a one-word addition when someone wants it, not a defect.
- **`volumeSeries`'s lower clamp, `Math.max(0, …)` at `derive.ts:131`, is unreachable for
  *any* schema-valid snapshot, not just ingester output.** Re-derived the argument myself
  rather than accepting it: `volumeSeries` computes `start` from `historyBounds(snapshot)`,
  whose `from` is the minimum of the declared `since` and every `pullRequest.mergedAt` in
  that *same* snapshot's *same* `pullRequests` array — the same array `volumeSeries` then
  iterates to compute `offset`. Because both functions read the identical list, no element
  of it can produce an `offset` below zero relative to a bound computed as that list's own
  minimum. This holds structurally, independent of what produced the snapshot — genuinely
  the "defensive-only, no schema-valid snapshot can reach it" side of the stopping rule, not
  merely "our ingester doesn't produce it." Correctly left unpinned.

## Verdict

**PASS**

### Issues (blocking)

None. The three survivors iteration 2 failed on (`derive.ts:82`, `derive.ts:86`,
`derive.ts:108`) are confirmed killed, independently re-derived rather than trusted. My own
hunt across `deriveWindow`, `nearestActivity`, `layout.ts`, `catalog.ts`, and `fixture.ts`
found three further survivors, none of which sit on a path where a schema-valid snapshot
would make them return an actually-wrong value — the bar the stopping rule sets for
blocking. All four standard gates were re-run after the last edit and are each falsifiable
(re-confirmed with my own negative controls on gate 2 and gate 3, not the report's).

### Warnings (non-blocking)

- `nearestActivity`'s tie-break (`distance < bestDistance`) is untested and its mutant
  survives; both outcomes it could pick are equally valid, so this is a determinism/test-
  completeness note, not a correctness gap.
- `layoutGraph`'s self-edge skip (`layout.ts:59`) is untested and its mutant survives;
  reachable at the schema boundary (nothing forbids `from === to` in `packageEdgeSchema`)
  but measured to be inert — dagre lays a self-edged node out identically either way.
- `activityOf`'s and `volumeSeries`'s guard-clause throws have no test asserting the throw
  directly (unchanged since iteration 1; treated consistently with how both prior reviewers
  graded "no silent failure").
- `snapshotWithDeclaredWindow`'s new `keepPullRequests` option does not assert that a
  requested pull-request number was actually found; a typo would silently narrow the set
  rather than error. Not live today — the one call site's assertions are specific enough to
  catch it — but worth an assertion if more call sites are added.
- Carried forward, still true, still non-blocking: the slider's footer hint does not mention
  Up/Down; `volumeSeries`'s lower clamp is unpinned but is unreachable for any schema-valid
  snapshot, not merely ingester output (re-derived myself, not accepted on the report's
  word).

### Guidance

Nothing blocks. If a future iteration touches this area again, the self-edge guard in
`layout.ts` is the cheapest of the leftover warnings to close (one test, same shape as the
existing dangling-edge case), followed by the `nearestActivity` tie-break. Neither needs
production code to change.
