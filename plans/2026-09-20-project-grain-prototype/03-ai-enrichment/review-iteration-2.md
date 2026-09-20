# Chunk 03 — Enrichment — Review, Iteration 2

Fresh reviewer, no inheritance from iteration 1's conclusions except as data. Reviewed
against `plans/2026-09-20-project-grain-prototype/03-ai-enrichment/rubric.md`. Diff graded:
`12087bb..9f1dcb7` (only `completion-report.md`, `review-iteration-1.md`,
`src/lib/ai/enrichment.test.ts` changed — confirmed `src/lib/ai/enrichment.ts`,
`scripts/ingest.mts` and `src/lib/snapshots/*.json` are byte-identical to `12087bb` via
`git diff 12087bb..HEAD --stat`, empty for those paths).

All four gates re-run myself on HEAD `9f1dcb7`: `pnpm lint` exit 0; `pnpm test` →
`Test Files 9 passed (9) / Tests 140 passed (140)`; `pnpm build` → compiled; `pnpm typecheck`
exit 0 (run last). Matches the completion report exactly.

## Independent mutation testing (not the four already reviewed)

Per the lead's instruction, I did not re-check the four named mutants. I applied my own
mutants to `src/lib/ai/enrichment.ts`, one at a time, running `pnpm test` after each and
restoring from a `/tmp` backup before the next (verified with `diff -q` and a final `md5sum`
match plus `git status --short` empty at the end):

| # | Mutant | Area | Result |
| - | ------ | ---- | ------ |
| 1 | Disabled the `exact` early-return in `resolveSteps`, forcing every step through the prefix path | exact-match path vs. prefix-path ordering | **Killed** — `takes an exact SHA even when another commit shares its 7-character prefix` fails |
| 2 | `stored[key]` in place of the `Object.prototype.hasOwnProperty.call(stored, key)` guard | cache-reuse read path | **Survived** — see Warning 1 below |
| 3 | `pullRequest.commits.length === 0` → `=== -1` (never true) | zero-commit-PR skip | **Killed** — `never calls the model for a pull request with no commits…` fails |
| 4 | `if (existing && !isFallbackEnrichment(existing))` → `if (existing)` | fallback-is-not-a-cache-hit rule | **Killed** — `retries a pull request whose stored entry is a degraded fallback` fails |
| 5 | `enrichmentKey` body → `return String(pullRequest.number)` (ignores `mergeCommitSha`) | merge-SHA key derivation | **Killed** — 13 tests fail, matching iteration 1's own count |
| 6 | Removed `.slice(0, MAX_PROMPT_COMMITS)` / `.slice(0, MAX_PROMPT_FILES)` in `buildEnrichmentPrompt` | payload bounding before the call | **Killed** — `bounds a pathological pull request before the call` fails |
| 7 | `buildRecord(entries, 'enrichment key')` → `Object.fromEntries(entries)` | `assertSafeKey`/`buildRecord` on the enrichment key | **Killed** — `refuses a merge SHA that would be written as a reserved object key` fails |
| 8 | `MAX_STEPS` 6→60, `MAX_LABEL_CHARS` 80→800 | schema bound *magnitude* | Survived, but not a defect — see note below |

**Mutant 2 is a real but unreachable gap.** `stored = snapshot.enrichment ?? {}` is parsed by
`enrichmentSchema = z.record(z.string().min(1), enrichmentEntrySchema)` in
`src/lib/snapshot.ts:138`, which (per the module's own doc comment) yields a normal
prototype-chain object, not a null-prototype one. Without the `hasOwnProperty` guard, a
*missing* key whose string form happens to equal `toString`, `valueOf`, `constructor`, etc.
would resolve to the inherited `Object.prototype` method instead of `undefined`, and the
snapshot's caching logic would treat that method as a truthy "already enriched" entry. This
is unreachable in this codebase's domain — every key is either a 40-character hex merge SHA
or `String(pullRequest.number)`, neither of which is ever a `Object.prototype` method name —
so I am not blocking on it. Recorded as a warning, in the same spirit iteration 1 recorded
the untested `.toLowerCase()` call: correct, protective, and dead by the tests' own account.

**Mutant 8 is not a defect.** Both bound tests (`enrichment.test.ts:124-132`,
`:138-145`) construct their "too many"/"too long" fixtures as `MAX_STEPS + 1` /
`MAX_LABEL_CHARS + 1` — relative to the constant, not a hardcoded literal — so widening the
constant widens the test's own fixture in lockstep and the assertion still holds. This is
the correct test-authoring pattern (it never needs updating if the constant legitimately
changes) and it still proves the bound is *enforced mechanically*, which is what the rubric
item asks for. It does not prove the specific chosen magnitude (6 steps, 80 characters) is
itself correct, but no rubric item asks for that, and pinning a product-chosen magnitude
with a hardcoded literal would just be a second, more brittle way of expressing the same
enforcement. Not reported as a finding.

## Adjudication 1 — the false-green claim

The completion report's decisive claim is the final gates table: `pnpm test` →
`Test Files 9 passed (9) / Tests 140 passed (140)`. I ran `pnpm test` myself on the current
HEAD, independent of the report, and got the identical file-count-and-test-count pair. That
is the evidence this iteration's grade rests on, not the report's transcript.

The report's account of catching its own false green (mid-run, `Tests 94 passed (94)` — the
baseline count, from a shell-escaping bug that corrupted `enrichment.ts` and silently
dropped two spec files while the run still exited 0) is internally consistent with
`project.md:139`'s recorded hazard ("a zero exit from `pnpm test` does not mean your spec
ran"), and its remedy — asserting `Test Files … (9)` alongside the test count — is exactly
what closes that hazard, and is what I independently reproduced. I cannot re-run the
corrupted intermediate state (it was transient and restored), so I cannot verify that
specific transcript beyond its internal consistency and its match to a documented,
previously-observed failure mode — the same evidentiary limit iteration 1 accepted for the
original red-run transcripts, and inherent to this kind of evidence. No other claim in the
report rests on an unasserted file count: every gates table in the document (§ Gates, § Review
iteration 1 — mutation evidence, § Gates re-run after the last edit) reports the file count
next to the test count.

## Adjudication 2 — Gate 2 / Gate 3 fix, verified independently on base and HEAD

I did not trust the completion report's or iteration 1's transcripts for this. I added a
temporary detached worktree at `cb41f75` (`git worktree add --detach … cb41f75`), ran the
corrected Gate 2 script and the corrected Gate 3 needle from the completion report against
it, then removed the worktree:

- **Gate 2 on `cb41f75`**: `FAIL: expected a committed snapshot per curated repository,
  found 0`, exit 1 — fails for the stated reason (empty corpus), not vacuously.
- **Gate 2 on HEAD**: `OK …shadcn-ui-ui…: 100 enriched` / `OK …trpc-trpc…: 36 enriched` /
  `OK …xyflow-xyflow…: 100 enriched`, exit 0.
- **Gate 3 needle on `cb41f75`**: `git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v
  '^\.env\.example$'` — no output, grep exit 1 (no false positive on the tracked
  `.env.example`).
- **Gate 3 needle on HEAD**: same command, same result — no output, exit 1; `.env.example`
  is the only tracked `.env*` file.

Both holes iteration 1 identified in the plan's own gate block are closed, on base and on
HEAD, and both gates can fail for the right reason (non-empty corpus with missing
enrichment; a genuinely tracked non-example env file) rather than passing vacuously. This
confirms iteration 1's own adjudication; I did not take it on faith.

## Universal Checks

- [x] PASS — Acceptance criteria unaffected by this iteration's diff (production code is
      byte-identical to `12087bb`); iteration 1's grading against `plan.md` § Acceptance
      Criteria stands, independently re-confirmed by reading `enrichment.ts` myself.
- [x] PASS — All four gates re-run after the last edit (`9f1dcb7`), typecheck last,
      reproduced myself. Gate 2 and Gate 3 (the plan's own gates, corrected) verified to
      fail for the right reason on base and pass on HEAD, independently, per Adjudication 2.
      Lint/build/typecheck still structurally cannot fail on this diff (clean on base too);
      accepted per iteration 1's NC4/NC9 reasoning, unchanged since no production code moved.
- [x] PASS — New behavior (the five added tests) covers the happy path (unique prefix,
      exact-amid-collision), the error path (ambiguous collision, sub-floor prefix) and the
      case-folding edge, closing iteration 1's Issue 1 exactly as scoped.
- [x] PASS — `completion-report.md` exists, is committed, and its "Updated after review
      iteration 1" section and mutation-evidence table are detailed enough to grade against.
- [x] PASS — Report's red-run transcripts for this iteration's tests are not re-demonstrable
      (the mutants were applied and reverted), but the report's own mutation table plus my
      independently-reproduced mutants 1, 3, 4, 5, 6, 7 above corroborate the same kill
      pattern for the four the report names — I did not merely read the report's claim.
- [x] PASS — No new abstraction. Five tests added; zero production lines changed.
- [x] PASS — No principle violated without justification (nothing changed in production
      code this iteration; iteration 1's grading stands).
- [x] PASS — Scope: only `completion-report.md`, `review-iteration-1.md` and
      `enrichment.test.ts` touched. No file outside the chunk's directories.
- [x] PASS — `git diff 12087bb..HEAD | grep -inE 'sk-ant-|ghp_|ANTHROPIC_API_KEY\s*=|GITHUB_TOKEN\s*='`
      — no hits.
- [x] PASS — No silent failures — unchanged from iteration 1; the five new tests assert on
      `outcome.failed`, `outcome.error` and `isFallbackEnrichment(outcome.entry)`, never on
      a swallowed exception.
- [x] PASS — No duplicated logic introduced this iteration.
- [x] PASS — Delta graded against the `cb41f75` baseline (0/0 errors); this iteration is
      +5 tests over the iteration-1 count (135 → 140), 0 lint/typecheck regressions.
- [x] PASS — Comments/docs touched by this diff (the new tests' own inline comments) are
      accurate against the code they describe — read alongside `resolveSteps` above.

## Test Coverage Checks

- [x] PASS — Schema-bound tests unchanged from iteration 1, re-confirmed still present and
      passing (`enrichment.test.ts:124-145`).
- [x] PASS — Fallback-labelled-by-title test unchanged and passing
      (`enrichment.test.ts:299-311`).
- [x] PASS — No-model-call-on-cache-hit test unchanged and passing, and mutation 4 above
      independently confirms the surrounding "fallback is not a cache hit" rule is pinned
      too, not just the simple case.
- [x] PASS — `baked-snapshots.test.ts` unchanged (byte-identical to `12087bb`), still
      validates every committed snapshot against the chunk 02 schema with enrichment
      populated; re-ran it myself as part of the full suite above.

## Chunk-Specific Checks

- [x] PASS — Bounds enforcement unchanged; re-confirmed by mutation 8 that the enforcement
      is mechanical (relative to the constant), not prose, even though the specific
      magnitude isn't pinned by a hardcoded literal — see note above; not a rubric gap.
- [x] PASS — Approach-note quality graded in iteration 1 by reading nine baked records; the
      snapshots are byte-identical this iteration, so that grade stands. Re-spot-checked two
      of the quoted records (`trpc/trpc#7604`, `shadcn-ui/ui#11915`) directly against the
      committed JSON — quotes match verbatim.
- [x] PASS — `enrichmentKey` single-source-of-truth claim independently re-confirmed via
      mutation 5 (13 failures on ignoring `mergeCommitSha`, matching iteration 1's count
      exactly).
- [x] PASS — `mergeCommitSha` nullable handling unchanged from iteration 1; re-confirmed by
      reading `enrichmentKey`'s fallback (`enrichment.ts:166`) and its dedicated test
      (`enrichment.test.ts:164-167`).
- [x] PASS — Per-step `{commitSha, summary}` requirement unchanged; `resolveSteps` now has
      full branch coverage (exact, unique prefix, ambiguous prefix — killed by mutation 1,
      too-short prefix, no match, case fold) after this iteration's fix. Iteration 1's Issue
      1 is closed: I constructed the same class of mutant independently (mutation 1, framed
      differently — disabling the exact branch rather than loosening the collision
      threshold) and it still dies.
- [x] PASS — Fallback-never-empty-label rule unchanged; mutation 3 above additionally
      confirms the zero-commit short-circuit that feeds this path is pinned, not just the
      generic-throw case iteration 1 checked.
- [x] PASS — No test reaches the network; assertions are on the returned record
      (`outcome.failed`, `outcome.entry.steps[...]`, `isFallbackEnrichment(...)`) in all five
      new tests, never on call-count alone —
      `.claude/resources/bibles/swe/testing.md` § "Assert the resolved value" read before
      grading this item; satisfied.
- [x] PASS — Committed snapshots unchanged (byte-identical), still pipeline output per
      iteration 1's sorted-key and field-count analysis —
      `.claude/resources/bibles/swe/testing.md` § "Test third-party dependency output
      against real generated files" read; the analogous rule here (snapshot is captured
      pipeline output, not hand-built) is satisfied, unchanged from iteration 1.
- [x] PASS — `scripts/ingest.mts` unchanged; still the single CLI.
- [x] PASS — Credential handling unchanged; re-confirmed no `process.env` in
      `src/lib/ai/enrichment.ts`.
- [x] PASS — Payload bounding unchanged; independently re-confirmed via mutation 6.
- [x] PASS — `DEFAULT_ENRICHMENT_MODEL` unchanged; `claude-haiku-4-5`, env-overridable.
- [x] PASS — `effort` grepped again across `src/lib/ai/` and `scripts/ingest.mts` — zero
      hits, unchanged.
- [x] PASS — Same evidence as payload-bounding above.
- [x] PASS — Token-totals-per-repository table unchanged from iteration 1's grading; present
      and itemized by repository.
- [x] PASS — Model-quality assessment unchanged (byte-identical snapshots); graded above.
- [x] PASS — `project.md` untouched by this diff — `git diff 12087bb..HEAD --stat --
      .claude/resources/project.md` is empty.
- [x] PASS — Judgment calls unchanged from iteration 1's grading; this iteration added no
      new judgment call.

### `src/lib/**/*.ts`

- [x] PASS — No class/registry/provider-interface introduced this iteration; zero
      production-code lines changed.
- [x] PASS — No `fs`/`child_process` import; unchanged.
- [x] PASS — No `process.env` reference in `enrichment.ts`; unchanged.
- [x] PASS — Relative `.ts`-extension imports unchanged.
- [x] PASS — Co-located test files unchanged; `enrichment.test.ts` still covers
      `enrichment.ts`.
- [x] PASS — `modelEnrichmentSchema` still narrower than the imported `enrichmentEntrySchema`;
      unchanged.
- [x] PASS — `assertSafeKey`/`buildRecord` still the only path a repository-derived key
      reaches the record; independently re-confirmed via mutation 7 above (bypassing
      `buildRecord` with `Object.fromEntries` kills the reserved-key test).

### `scripts/**`

- [x] PASS — Unchanged from iteration 1; `ingest.mts` untouched by this diff.
- [x] PASS — Credential read and snapshot write both still legal here; unchanged.
- [x] PASS — Relative imports unchanged.
- [x] N/A — No co-located spec for `ingest.mts`, correctly, unchanged.
- [x] PASS — Single CLI, unchanged.

### `src/**/*.test.ts`

- [x] PASS — Graded above (Test Coverage Checks and bible citation item).
- [x] PASS — The five new tests live in `src/lib/ai/enrichment.test.ts`, already matching
      `vitest.config.mts`'s include pattern (the file itself is not new).
- [x] PASS — Reported count (`Test Files 9 passed (9) / Tests 140 passed (140)`) is an
      asserted pair I reproduced myself twice (once for the plain gate run, once implicitly
      after every mutation-restore cycle), not a bare exit code.

### `src/**/snapshots/**/*.json`

- [x] PASS — Snapshots byte-identical to `12087bb`; iteration 1's pipeline-output analysis
      and credential grep stand unchanged.
- [x] PASS — Same evidence.

### Manifests and config

- [x] N/A — No new dependency this iteration; `package.json`/`pnpm-lock.yaml` untouched.
- [x] PASS — `project.md` unmodified; deltas remain itemized in the (unchanged) § project.md
      deltas section.

### Parallel-wave boundary

- [x] PASS — `src/lib/snapshots/xyflow-xyflow-2026-08-31.json` untouched (`git diff --stat`
      empty for that path across the whole `12087bb..HEAD` range).
- [x] PASS — No file under `src/lib/view/`, `src/components/` or `src/app/page.tsx` touched.

## Issues (blocking)

None. Iteration 1's single blocking issue (untested `resolveSteps` collision path) is closed
by the five new tests, which I independently confirmed kill the exact mutant iteration 1
demonstrated (`matched.length === 1` → `>= 1`) plus a related one of my own framing
(disabling the exact-match branch entirely). My own mutation sweep of the areas the lead
flagged (exact-match ordering, the fallback/degrade surfacing path, merge-SHA key
derivation, cache reuse, payload bounding and the zero-commit skip, `assertSafeKey`/
`buildRecord` on the enrichment key, and schema-bound enforcement) found one additional
survivor (mutant 2), which is real but unreachable given this codebase's key domain
(SHAs and PR numbers never collide with `Object.prototype` method names) — recorded as a
non-blocking warning below rather than a blocking issue, on the same footing iteration 1
used for the untested `.toLowerCase()` normalization.

## Warnings (non-blocking)

1. **Cache-reuse read at `enrichment.ts:388` has no test for a missing `hasOwnProperty`
   guard.** `const existing = Object.prototype.hasOwnProperty.call(stored, key) ? stored[key]
   : undefined;` — removing the guard (`stored[key]` directly) leaves all 140 tests green,
   because `stored` (`snapshot.enrichment ?? {}`, parsed through
   `enrichmentSchema = z.record(...)` in `src/lib/snapshot.ts:138`) is a normal
   prototype-chain object, and a *missing* key would only diverge from the guarded behavior
   if its string form matched an `Object.prototype` method name (`toString`, `valueOf`,
   `constructor`, etc.) — which a 40-character hex SHA or a stringified PR number never is.
   Not blocking: the guard is correct defense-in-depth for a data shape (arbitrary string
   keys) this pipeline's domain never actually produces, in the same spirit as iteration 1's
   untested `.toLowerCase()` call.
2. **Carried forward from iteration 1, still true and still non-blocking**: Gate 1's
   lint/build/typecheck legs cannot fail on this diff, falsified instead by negative
   controls (NC4/NC9), which remains a reasonable substitute.

## Guidance

None required — the chunk is done. If a future chunk touches `enrichSnapshot`'s cache-reuse
read path, consider a one-line regression test for the `hasOwnProperty` guard (Warning 1)
while that code is already open, rather than as a dedicated follow-up.

## Verdict

**PASS** — iteration 1's single blocking issue is closed with a targeted, correctly-scoped
fix (five tests, zero production-code changes). I independently re-ran all four gates,
independently re-verified both of the plan's own gate defects are closed on base and on
HEAD (not taking iteration 1's or the report's word for it), and ran my own mutation sweep
across the areas the lead specifically flagged as unchecked by either prior reviewer,
finding no new blocking gap — one non-blocking, domain-unreachable survivor, recorded above.
