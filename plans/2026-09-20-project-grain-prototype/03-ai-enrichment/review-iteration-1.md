# Chunk 03 — Enrichment — Review, Iteration 1

Reviewed against `plans/2026-09-20-project-grain-prototype/03-ai-enrichment/rubric.md`.
Base `cb41f75`. All gates re-run myself on `.worktrees/03-ai-enrichment` (HEAD `12087bb`):
`pnpm lint` exit 0, `pnpm test` → `Test Files 9 passed (9) / Tests 135 passed (135)`,
`pnpm build` → compiled, `pnpm typecheck` exit 0 — matching the completion report.

## Universal Checks

- [x] PASS — Acceptance criteria read against the code: `enrichPullRequest`/`enrichSnapshot`
      in `src/lib/ai/enrichment.ts` match all six criteria in `plan.md` § Acceptance
      Criteria; verified by reading, not by trusting the report.
- [x] PASS — All four gates re-run after the last edit (git status clean at HEAD before and
      after), typecheck last. Gate 1 (tests) and Gate 2 (snapshot enrichment) can fail —
      confirmed myself on a worktree at `cb41f75`: `pnpm test` fails there with
      `Cannot find package '@/lib/ai/enrichment'`, and the plan's own Gate 2 is vacuous
      there (see "Gate defect" below, graded separately). Lint/build/typecheck cannot fail
      on this diff (clean on base too) — falsified instead by the report's NC4/NC9, which I
      accept as adequate negative controls for gates that structurally can't regress here.
- [x] PASS — New behavior (schema bounds, fallback, cache, SHA resolution, payload bounding)
      has tests for the happy path and most error paths and edges. **One edge is untested —
      see Issue 1.**
- [x] PASS — `completion-report.md` exists, is committed, and is detailed enough to grade
      against.
- [x] PASS — Report's red-run transcripts are consistent with the code's actual error
      surface (`Cannot find package '@/lib/ai/enrichment'` before the module existed,
      `expected [] to have a length of 1` for the retry-fallback test, etc.) — plausible and
      internally consistent, not verifiable after the fact since the red state no longer
      exists, which is inherent to this kind of evidence.
- [x] PASS — No new abstraction beyond what Design Decision 10 and the plan call for:
      standalone functions, one bounded-concurrency helper, no class/registry/interface.
- [x] PASS — No principle violated without justification. Principles 1, 3, 4, 5 all checked
      directly against the diff (see Chunk-Specific and Convention Map sections below).
- [x] PASS — Scope: `git diff --stat cb41f75...HEAD -- src/lib/view/ src/components/
      src/app/ .claude/resources/project.md src/lib/snapshots/xyflow-xyflow-2026-08-31.json`
      is empty. Touched files match the completion report's table exactly.
- [x] PASS — `git diff cb41f75...HEAD | grep -inE 'sk-ant-|ghp_|ANTHROPIC_API_KEY\s*=|GITHUB_TOKEN\s*='`
      returns one hit, which is a regex literal inside a test assertion
      (`baked-snapshots.test.ts`), not a credential.
- [x] PASS — No silent failures: every failure path in `enrichPullRequest` returns
      `{failed: true, error}` and `enrichSnapshot` collects `failures` and reports them; the
      CLI prints each failure's number, key and error to stderr.
- [x] PASS — No duplicated logic: cache key, snapshot schema, `assertSafeKey`/`buildRecord`,
      CLI arg handling and credential reading are all reused or consolidated per the Reuse
      Audit, and I independently confirmed the imports (see Chunk-Specific below).
- [x] PASS — Base tree had 0 lint/typecheck errors and 0 test failures; the chunk's counts
      (0/0, +41 tests) are graded as deltas against that captured baseline, matching the
      report.
- [x] PASS — Comments/docs touched by this diff are still accurate — spot-checked the
      module-header comment in `enrichment.ts` and the usage comment in `ingest.mts` against
      the code beneath them.

## Test Coverage Checks

- [x] PASS — `modelEnrichmentSchema` tests cover a missing `approach`, an over-long step
      list, an empty step list, and an over-long `label`/`approach`
      (`enrichment.test.ts:113-141`).
- [x] PASS — `degrades to the pull request title when the model call throws`
      (`enrichment.test.ts:213-225`) asserts the record is labelled with the PR title and
      the failure string is surfaced on the returned outcome.
- [x] PASS — `makes no model call for a pull request this snapshot already carries`
      (`enrichment.test.ts:329-346`) asserts `model.doGenerateCalls` has length 0 **and**
      asserts the returned entry equals the stored one — behavior, not just the call count.
- [x] PASS — `baked-snapshots.test.ts` parses every committed snapshot through
      `snapshotSchema` and asserts every pull request has an enrichment entry with a
      non-empty `label`/`approach`/`steps`. I re-ran this independently against the three
      committed files and got the same coverage the report claims (see below).

## Chunk-Specific Checks

- [x] PASS — Record carries `label`, `approach`, ordered `steps`; bounds
      (`MAX_LABEL_CHARS`, `MAX_APPROACH_CHARS`, `MAX_STEP_SUMMARY_CHARS`, `MAX_STEPS`) are
      enforced in `modelEnrichmentSchema` (`enrichment.ts:87-130`), not in prose alone —
      each field also carries a `.describe()` that restates the bound in the model's own
      instruction (tested at `enrichment.test.ts:144-153`).
- [x] PASS — Sampled nine baked records directly from the committed JSON. Genuine method
      notes (`trpc#7604`'s stream-close check, `trpc#7583`'s docusaurus config rename,
      `xyflow#5977`'s visibility-check-before-render) coexist with two honest restatements
      on changes that structurally have no method (`shadcn-ui#11915`'s registry-list
      append, `xyflow#5992`'s automated release). Per instruction from the lead, the
      escalation call itself is settled and not re-litigated here; the pattern the report
      describes is what I independently observe in the data.
- [x] PASS — `enrichmentKey` (`enrichment.ts:165-167`) is the one place the key is derived;
      `scripts/ingest.mts` never re-derives it, and the completion report documents it as
      exported for chunk 06. Mutation-killed: forcing `enrichmentKey` to ignore
      `mergeCommitSha` fails 13 named tests.
- [x] PASS — `mergeCommitSha` is nullable in `src/lib/snapshot.ts:116`; `enrichmentKey` falls
      back to `String(pullRequest.number)`, tested explicitly
      (`enrichment.test.ts:160-162`). Gate 2's accessor
      (`snap.enrichment[p.mergeCommitSha ?? p.number]`) matches this rule.
- [x] PASS — `enrichmentEntrySchema` (imported, not redeclared) requires
      `{commitSha, summary}` with `.min(1)`; `resolveSteps` binds every step's `commitSha` to
      a real commit before the record is built. Mutation-killed: emptying the fallback's
      step array fails via the schema's `.min(1)` (5 named tests, including the schema
      `safeParse` assertions).
- [x] PASS — Every failure path returns `fallbackEnrichment(pullRequest)`, which never
      yields an empty label (falls back further to `Pull request #N` when the title is
      blank, tested at `enrichment.test.ts:264-272`). Mutation-killed: changing the throw
      handler's `failed: true` to `failed: false` fails 4 named tests including
      `enrichSnapshot > surfaces a failure instead of swallowing it`.
- [x] PASS — Every test uses `MockLanguageModelV4` from `ai/test`; no test reaches the
      network. Assertions are on the returned `outcome`/`result` record's fields
      (`label`, `approach`, `steps`, `failed`, `usage`, `reused`, `enriched`), not merely on
      whether the mock was called — where call count is asserted
      (`doGenerateCalls`), it is paired with a behavioral assertion in the same test.
      `.claude/resources/bibles/swe/testing.md` §"Assert the resolved value" is satisfied.
- [x] PASS — All three committed snapshots have alphabetically sorted keys at every nesting
      level (top-level, `metadata`, each pull request, each commit, each enrichment entry),
      matching `serializeSnapshot`'s `sortKeysDeep` exactly — the signature of pipeline
      output, not hand-editing. The claimed counts (100/100/36 pull requests, 0/0/1
      fallbacks) match what I independently derived from the files field-by-field, including
      the specific fallback PR (`trpc#7592`, key `81ed96ec…`).
- [x] PASS — `scripts/ingest.mts` gained `--enrich`/`--model`/`--concurrency`/`--reuse`; no
      second CLI file exists (`ls scripts/` shows only `ingest.mts`).
- [x] PASS — `secretFromEnvironment('ANTHROPIC_API_KEY')` is called only inside
      `scripts/ingest.mts`; grepped `src/lib/ai/enrichment.ts` for `process.env` — no hits.
      `LanguageModel` arrives as a parameter (`EnrichPullRequestOptions.model`).
- [x] PASS — Payload bounded via `MAX_PROMPT_COMMITS`/`MAX_PROMPT_FILES`/
      `MAX_PROMPT_BODY_CHARS` before the call. Mutation-killed: removing the `.slice()`
      calls fails the pathological-payload test.
- [x] PASS — `DEFAULT_ENRICHMENT_MODEL = 'claude-haiku-4-5'`; `scripts/ingest.mts` reads
      `args.model ?? process.env.ENRICHMENT_MODEL ?? DEFAULT_ENRICHMENT_MODEL` — no hardcoded
      id at the `generateObject` call site.
- [x] PASS — Grepped the `generateObject` call and the whole of `src/lib/ai/` and
      `scripts/ingest.mts` for `effort` — zero hits. No `thinking` option set either.
- [x] PASS — See payload-bounding item above; same evidence.
- [x] PASS — "Token totals per repository" table in the completion report gives measured
      input/output tokens and cost per repository (not just a PR count), matching Design
      Decision 10's ask.
- [x] PASS — Graded above under Chunk-Specific item 2; the report's quoted examples match
      what I independently read from the baked files.
- [x] PASS — `git diff --stat cb41f75...HEAD -- .claude/resources/project.md` is empty; the
      "project.md deltas" section is present and itemized.
- [x] PASS — All three judgment calls the plan asked for (concurrency bound, fallback-marker
      placement, PR-body truncation) are explained in the completion report's Judgment Calls
      section, each with the measurement or reasoning behind the choice.

### `src/lib/**/*.ts`

- [x] PASS — Standalone functions over plain objects; no class, registry or provider
      interface. `mapWithConcurrency` is a generic helper, not a seam for a second vendor.
- [x] PASS — No `fs` or `child_process` import in `src/lib/ai/enrichment.ts` (confirmed by
      grep and by reading the import list).
- [x] PASS — No `process.env` reference anywhere in `src/lib/ai/enrichment.ts`.
- [x] PASS — `enrichment.ts` imports from `../snapshot.ts` with a relative specifier and
      explicit `.ts` extension (line 10). Its own two test files use `@/lib/...`, which
      matches the project's existing convention for `*.test.ts` files (e.g.
      `src/lib/snapshot.test.ts` does the same) — the rubric's relative-import rule is
      scoped to `src/lib/**/*.ts` module-to-module imports, not test files, so this is not a
      violation.
- [x] PASS — `enrichment.ts` has a co-located `enrichment.test.ts`; `baked-snapshots.test.ts`
      covers the data files in the same directory.
- [x] PASS — `modelEnrichmentSchema` is demonstrably narrower (bounds, descriptions) than
      `enrichmentEntrySchema`, which is imported, not redeclared, from `src/lib/snapshot.ts`.
      Every model result is re-parsed through the imported schema before being returned.
- [x] PASS — The only place a repository-derived string becomes a record key is
      `buildRecord(entries, 'enrichment key')` in `enrichSnapshot` (`enrichment.ts:422`),
      which calls `assertSafeKey` per key — not the Zod schema. Mutation-confirmed live: a
      pull request with `mergeCommitSha: '__proto__'` throws `/reserved object key/`
      (test at `enrichment.test.ts:405-412`, and I ran it against the real code, not just
      read it).

### `scripts/**`

- [x] PASS — `ingest.mts`'s `enrich()` function sequences `enrichSnapshot`/`createAnthropic`
      and formats progress output; no schema, resolution or fallback logic lives here.
- [x] PASS — `secretFromEnvironment('ANTHROPIC_API_KEY')` and `writeFileSync(out, …)` both
      happen here, which is legal per Principle 1/3.
- [x] PASS — `../src/lib/ai/enrichment.ts` etc., all relative with `.ts` extensions.
- [x] N/A — No co-located spec for `ingest.mts` exists, correctly — the logic it drives is
      tested in `src/lib/`.
- [x] PASS — Same CLI file extended; no second entry point.

### `src/**/*.test.ts`

- [x] PASS — Graded above (Test Coverage Checks and bible citation item).
- [x] PASS — Both new spec files are under `src/lib/ai/*.test.ts`, matching
      `vitest.config.mts`'s `src/**/*.test.{ts,tsx}` include.
- [x] PASS — Reported count (`Test Files 9 passed (9) / Tests 135 passed (135)`) is an
      asserted number I reproduced myself, not just a zero exit code.

### `src/**/snapshots/**/*.json`

- [x] PASS — Sorted-key structure and per-file counts (documented above) are consistent
      with genuine pipeline output; no hand-editing signature found. The completion report
      names the exact bake command per file.
- [x] PASS — `baked-snapshots.test.ts`'s credential test passes on the real files; I
      independently grepped all three files for `sk-ant-`, `ghp_`/`gho_`/`ghu_`/`ghr_`,
      `access_token=` and `ANTHROPIC_API_KEY` — no hits.

### Manifests and config

- [x] N/A — No new dependency was added by this chunk. `ai`/`@ai-sdk/anthropic` were already
      present in `package.json` before this chunk (`git diff cb41f75...HEAD -- package.json
      pnpm-lock.yaml` is empty); the report correctly notes they are "now actually used"
      rather than newly added.
- [x] PASS — `project.md` unmodified in the diff; every architecture-fact delta (commands
      table, layout, conventions) is itemized in the report's "project.md deltas" section.

### Parallel-wave boundary

- [x] PASS — `src/lib/snapshots/xyflow-xyflow-2026-08-31.json` not created, edited or
      deleted by this diff (confirmed via `git diff --stat`, empty).
- [x] PASS — No file under `src/lib/view/`, `src/components/` or `src/app/page.tsx` touched
      (same check).

## The plan's own Gate 2/Gate 3 defect — adjudicated

Both of the report's claims about the plan's gate block are correct, verified myself on a
worktree at `cb41f75`:

- Gate 2's `for snap in $(git ls-files | grep -E 'snapshots?/.*\.json$')` iterates zero times
  and exits 0 on the base tree (`git ls-files | grep ... | wc -l` → `0`) — vacuously passes,
  proving nothing.
- The plan's Gate 3 needle (`git ls-files | grep -qE '(^|/)\.env($|\.)'`) matches the
  committed `.env.example` and fires `FAIL: an env file is tracked` on a clean base tree —
  a false positive on correct code.

The chunk's fix closes both: I ran the corrected Gate 2 (non-empty-corpus guard) against
`cb41f75` and got `FAIL: expected a committed snapshot per curated repository, found 0`
(exit 1, as intended), and against HEAD and got `OK …: 100/36/100 enriched` for the three
files. I ran the corrected Gate 3 needle (`| grep -v '^\.env\.example$'`) against `cb41f75`
and got a clean, empty result (no false positive). This is a defect in the plan, not in the
implementer's work, and the fix is sound.

## Issues (blocking)

1. **`resolveSteps`'s ambiguous-prefix rejection is untested — `src/lib/ai/enrichment.ts:257-272`.**
   The function requires a 7-character SHA prefix to identify *exactly one* commit
   (`matched.length === 1`); on a collision it throws and the record degrades. This is new
   logic (added after the real bake, per the report's own Deviations section) and it is
   exactly the branch the lead's task asked me to check ("verify the prefix resolution
   handles collision and no-match"). I mutation-tested it: changing
   `matched.length === 1` to `matched.length >= 1` (silently accepting an ambiguous match
   rather than rejecting it) leaves all 135 tests green. `enrichment.test.ts` has a test for
   an abbreviated-but-unique prefix (line 181), a mistyped-tail prefix (line 191), and a
   fully-unmatched SHA (line 238) — but no test constructs two commits sharing a 7-character
   prefix to prove the collision path rejects rather than picking one arbitrarily. I
   confirmed by hand that the shipped code does reject a collision correctly (constructed
   two commits sharing prefix `aaaaaaa`, got `failed: true`, error `does not contain`) — the
   code is correct, but nothing pins that behavior, so a future refactor that silently
   weakens it would ship undetected. Needs one test: two commits with the same 7-character
   prefix, a step naming that prefix, asserting the outcome degrades (or an equivalent
   assertion that a specific match was required, not just any match).

## Warnings (non-blocking)

1. **Case-insensitive commit-SHA matching is untested — `enrichment.ts:260`.** Removing
   `.trim().toLowerCase()` from `given` leaves all tests green. Not blocking since GitHub
   SHAs are always lowercase in practice and no bug was observed, but the normalization is
   dead code by the tests' own account.
2. **Gate 1's lint/build/typecheck legs cannot fail on this diff**, and the report is
   forthright about this rather than hiding it — flagged here only so the next iteration
   doesn't mistake "gate passed" for "gate exercised." The report's negative controls
   (NC4/NC9) are a reasonable substitute given the practical difficulty of writing a lint or
   type error deliberately triggerable only by this code.

## Guidance

Add the one missing test for `resolveSteps`'s collision case (Issue 1) — construct two
commits sharing a 7-character prefix, assert the record degrades rather than resolving to
an arbitrary one. Everything else in this chunk — the schema, the fallback path, the
cache-by-merge-SHA keying, the CLI extension, the three baked snapshots, and the Haiku 4.5
call shape — is sound, tested against real behavior rather than mock invocation, and
consistent with what's actually committed.

## Verdict

**FAIL** — one blocking issue: new, previously-unreviewed logic (ambiguous-prefix rejection
in `resolveSteps`) has no test pinning it, and a mutation that silently weakens it (accepting
any match instead of requiring exactly one) passes the full suite. Everything else graded
PASS or N/A. This is a small, mechanical fix — add the one test above — not a rework.
