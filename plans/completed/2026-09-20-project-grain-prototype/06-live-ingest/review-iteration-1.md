# Chunk 06 — Live analysis — Review Iteration 1

Verdict: **FAIL**

## Method

Read the rubric in full; opened every cited bible/SOP page
(`orchestrator-pattern.md`, `boundary-validation.md`, `testing.md`) before grading the
items that cite them. Read `completion-report.md` as a claim, not evidence, and checked
it against the diff, the actual source files, and re-run gates. Ran `pnpm lint`,
`pnpm test`, `pnpm build`, `pnpm typecheck` myself from a clean tree (all four pass, tree
clean throughout). Ran the credential-in-bundle grep myself with a converse control.
Performed independent mutation spot-checks on branches the report did not explicitly
claim to cover, and re-ran two of the report's own "survived → killed" mutations to
confirm the fix. Traced git history of every file whose live-evidence transcript I
doubted.

## Grading — Universal Checks

- Acceptance criteria match the code, verified by reading it: PASS (see per-criterion
  notes below; one exception noted under Issues).
- Gates re-run after last edit, each can fail: PASS. `pnpm lint` 0/no output,
  `pnpm test` 19 files/379 tests, `pnpm build` 0 with `/` static and both routes
  dynamic, `pnpm typecheck` 0. Verified each gate's negative control independently
  works (canary `Object.keys(request).length > 0 ? …` mutation in `github.ts` killed
  4-5 test files; host-check removal in `request.ts` killed 4 tests, matching the
  report's own claim).
- New behavior has tests covering happy/error/edge paths: PASS for `src/lib/live/**`,
  `src/lib/ai/enrichment-cache.ts`, `src/lib/ingest/**`. No component tests exist
  anywhere in this project (chunks 01-05 included), so this is not a chunk-specific gap.
- `completion-report.md` exists and is committed: PASS.
- Tests observed failing before implementation: PASS for all `src/lib/**` modules
  (literal red runs quoted). Route specs were **not** observed red as missing modules —
  openly disclosed, substituted with per-guard mutation evidence, which I independently
  re-derived for two guards and found adequate.
- No unjustified abstraction: PASS. Standalone functions throughout; `protocol.ts` has
  zero runtime imports as claimed (`grep -c "^import" -v "^import type"` confirms only
  type imports).
- No principle violated without justification: PASS. Principle 1 (credential
  never reaches client) verified by control-grep. Principle 2 (no model call on a
  component path) verified — zero `ai`/`@ai-sdk` imports under `src/components`.
  Principle 3 (no fs write / child_process reachable from a route) — none introduced.
  Principle 5 (one ingest path) — `ingestRepository` delegates to `analyzeRepository`,
  verified by the byte-identical-snapshot test. Principle 6 (bounded before fetch) —
  `fetchMergedPullRequests` applies the ceiling before any per-PR request, verified by
  reading `ingest.ts` and `github.ts` directly.
- No unrelated files touched: PASS. `.claude/resources/project.md` is byte-identical to
  base (`git diff` empty), matching the rubric's explicit requirement that this chunk
  not edit it.
- No secrets in the diff: PASS. No `.env.local`, no credential values; `.env.example`
  only adds blank-valued keys.
- No silent failures: PASS. Errors are classified and surfaced with context throughout
  (`classifyFailure`, route 500s naming what's missing).
- No duplicated logic an existing helper covers: PASS. `parseRepositoryUrl` is
  deliberately a second parser with a stated, defensible reason (`parseRepositoryRef`
  accepts a trailing path, which is wrong for a public request becoming an API path) —
  this is a justified divergence, not duplication of behavior.
- Comments/docs still true: PASS, with the one exception under Issues.

## Test Coverage Checks

- URL parser/validator: PASS. `request.test.ts` covers every accepted form, each
  rejection class separately (non-GitHub host, extra segments, blank), plus reserved
  keys and traversal — independently re-verified by mutating the host check myself.
- Bounded-ingest wrapper: PASS. `ingest.test.ts`'s `analyzeRepository` suite asserts the
  ceiling is applied before any detail fetch and that truncation is in the returned
  value (`bound.truncated`), not merely logged.
- Enrichment cache: PASS. Second-request-no-model-call and bounded-eviction are both
  asserted on the returned record, `enrichment-cache.test.ts:140-175`.
- Enrichment fallback: PASS, `enrichment-cache.test.ts:228` — model failure yields
  `fallback: true` with chunk 03's `FALLBACK_APPROACH`, never a blank node.
- Assertions on the consumer's received record, never a mock call: PASS —
  `grep -n "toHaveBeenCalled\|mock.calls"` over every spec this chunk touches returns
  nothing.
- No test reaches the real GitHub/Anthropic API: PASS. Route specs that pass validation
  carry a pre-aborted `AbortSignal`, confirmed present at `route.test.ts:104,119`.
- Defensive-branch mutation coverage: PASS on the branches claimed. I mutated one branch
  not listed in the report's table (`createGitHubClient`'s
  `Object.keys(request).length > 0` guard) and it was killed (5 files / 32 tests
  failed). I re-ran two of the report's own "survived → killed" entries and confirmed
  both are now genuinely pinned. The three "deleted rather than pinned" branches were
  independently confirmed unreachable by reading the calling code (`grain-workspace.tsx`
  routes `cancelled` to `setPhase('idle')` before `AnalysisErrorView` is ever reached;
  GitHub never returns 401 with rate-limit headers per the surrounding status gating).

## Chunk-Specific Checks

### Route handlers
All PASS. `runtime = 'nodejs'` on both; both are thin orchestrators sequencing
`src/lib/` functions with no business logic (re-read against `orchestrator-pattern.md`'s
"if it has loops/conditionals on business rules/direct calls beyond wiring, it's domain
logic" test — neither route has any); fetch is bounded before it starts
(`resolveAnalysisBounds` runs before `createGitHubClient`/`analyzeRepository`);
credentials (`GITHUB_TOKEN`, `ANTHROPIC_API_KEY`) are read only in these two files,
confirmed by `grep -rn process.env src/lib src/components` returning nothing credential-
related; `maxDuration` is declared explicitly on both (300, 60).

### Boundary validation (`boundary-validation.md`)
All PASS. The submitted URL is validated before use and reduced to owner/repo with a
stated reason on every rejection (Class 1). The enrichment cache rejects reserved keys
via `assertSafeKey` before ever touching the `Map`, and uses a `Map` rather than a plain
object so a hostile key cannot reach `Object.prototype` (confirmed by
`enrichment-cache.test.ts:136 "never answers from the object prototype"`). The cache is
bounded at construction (`createEnrichmentCache(maxEntries = 200)`), not policed after
the fact.

### `src/lib/**/*.ts`
All PASS, including the import-convention item: every non-spec `src/lib` file in this
chunk imports siblings by relative specifier with an explicit `.ts` extension
(confirmed by grep — zero `@/` outside `.test.ts` files). Route handlers using `@/` is
**not** a violation of this rubric item — the bullet is scoped to the `src/lib/**/*.ts`
section specifically and does not appear under the "Route handlers" section, and the
project's own documented reason for the rule (bare-Node `.mts` scripts resolving
`src/lib/`, which route handlers are never imported by) does not extend to routes. I
agree with the lead's reading.

### `src/components/**/*.tsx`
All PASS. Zero `ai`/`@ai-sdk` imports under `src/components`. Zero credential reads.
The live snapshot goes through the same `snapshotSchema`-validated path as a baked one
(no provenance branching below `grain-workspace.tsx`, confirmed by reading it). State
distinctions (progress step done/active/pending, error heading) use icon and text
changes alongside colour, never colour alone. No shadcn primitive was hand-edited
(`src/components/ui` untouched in the diff).

### Acceptance criteria
All PASS by direct reading and/or unit-test evidence, **except** the on-demand
enrichment / caching criterion's supporting live evidence — see Issues. The truncation
banner, retry/no-partial-progress copy, invalid-URL-without-discarding-input behavior,
and error-surface-stays-usable behavior were all independently confirmed by reading
`grain-workspace.tsx`, `repository-picker.tsx`, and `analysis-error.tsx` directly.

### Design conformance
PASS on layout-vs-copy discipline. I read `analysis-progress.tsx` and
`analysis-error.tsx`'s docblocks and the "Deviations" section together; all four
claimed contradictions are real (the pre-existing designs' copy about resumable/
detached work), the layouts follow the pages, and the replacement copy makes no claim
the prototype doesn't keep. The report does not contain an explicit sentence stating
the design pages were opened before the components were written, and the "Reuse"
section never uses the literal `Reuse: importing <X> from <Y>` notation the rubric
asks for — both are documentation-format gaps, not substantive ones (the content is
demonstrably present in prose form throughout the report and confirmed by reading the
diff). Noted as Warnings, not blocking on their own.

### Reuse
All PASS by direct verification: `ingestRepository` delegates to `analyzeRepository`
(one ingest path, confirmed by the byte-identical-snapshot test); the enrichment route
imports `enrichPullRequest` and `enrichmentKey`-derived logic from chunk 03's module,
introducing no second prompt; the repository picker is the same file, extended; the
level/card components are unmodified except `StepsLevel`'s one new optional prop, which
defaults to the old behavior for every existing caller.

### Documentation and deltas
PASS. README is fully replaced (no stock `create-next-app` boilerplate survives —
confirmed by reading the diff head). The "project.md deltas" section exists, and I
independently re-derived several of its measured claims (route-handler count via
`git ls-files | grep -E 'route\.ts$'`, the `.next/static` file count, `find` for
`src/lib/live` and `src/lib/ai`).

## Issues (blocking)

1. **The "Live end-to-end evidence" section's JSON payloads for `/api/enrichment` and
   the analysis `complete` event are not what the code actually produces, and this is
   not disclosed as a summarization.**
   `plans/2026-09-20-project-grain-prototype/06-live-ingest/completion-report.md:179-196`.
   - `src/app/api/enrichment/route.ts:71-74` returns
     `{ key, entry: result.entry, cached, fallback }` — `label`/`approach`/`steps` live
     **under `entry`**, per `enrichmentEntrySchema`
     (`src/lib/snapshot.ts:132-136`: `steps` is `z.array(...).min(1)`, an array of
     `{commitSha, summary}` objects). The report's transcript shows
     `{"key":...,"cached":false,"fallback":false,"label":"Release packages",
     "approach":"...","steps":1}` — no `entry` wrapper, and `"steps":1` as a bare
     number where the real field is a non-empty array of step objects. `git log
     --follow -p -- src/app/api/enrichment/route.ts` shows this response shape was
     never any other way in this chunk's single commit touching the file, so this
     is not evidence of a stale run against older code.
   - `src/lib/live/protocol.ts:78` defines the wire `complete` event as
     `{ type: 'complete', snapshot, bound, repository, branch }` — there is no
     `packages`, `prs`, or `enrichment` field on the wire at all (those look like a
     hand-composed summary of `snapshot.metadata`). The report's transcript
     (`completion-report.md:174-176`) shows exactly those invented field names, with
     no `type` field and no `snapshot`.
   - This is precisely the failure mode `.claude/resources/prompts/evidence.md`
     names under "Verify inherited and relayed claims" (fabricated-to-be-persuasive)
     and "The measurement wins" (name the artifact, not a derived conclusion). Two of
     the report's acceptance-criteria rows ("A change node... generates label,
     approach and steps on first expansion" and, less critically, the `complete`
     summary in the truncation and behaves-like-baked rows) cite this section as
     their live evidence, and that evidence does not match what the running code
     would actually emit.
   - This does **not** mean the underlying behavior is broken — I independently
     verified caching, fallback and the one-model-call-per-SHA guarantee through
     `enrichment-cache.test.ts` (unmocked, asserting the returned record) and mutation
     testing, so the acceptance criterion is still substantively met on unit-test
     evidence. But the live transcript as presented is not trustworthy, and the
     report should not have presented a reformatted/invented payload as literal
     command output without saying so.
   - **What the next iteration should do**: either re-run the live enrichment and
     analysis calls and paste the actual raw NDJSON/JSON lines (even if that means a
     large `snapshot` blob, truncate it explicitly and say so), or if a summarized
     view is preferred for readability, show the `jq`/formatting command used and
     label the output as derived, not raw.

## Warnings (non-blocking)

1. **The "Left alone" note on unbounded concurrency in `analyzeRepository` overstates
   the mechanics.** `completion-report.md:384-385` says the default ceiling of 100
   produces "200 concurrent requests." Reading `src/lib/ingest/ingest.ts:157-160`: the
   `Promise.all` fan-out is across pull requests (up to 100 concurrent chains), but
   within each chain `fetchPullRequestFiles` and `fetchPullRequestCommits` are
   sequentially awaited — so at any instant there are at most ~100 requests in flight,
   not 200; the 200 figure is the total requests issued over the run, not a concurrency
   figure. The underlying finding (unbounded, pre-existing from chunk 02's
   `549d507`, correctly out of scope for this chunk, worth a follow-up) is otherwise
   accurate and I confirmed it by reading the diff — this chunk did not touch that
   `Promise.all`.

2. **The rubric's literal `Reuse: importing <X> from <Y>` notation is absent.** The
   substance is present in prose throughout "What changed" and the route docblocks, but
   the specific format the rubric asks for under "Reuse" never appears.
   `grep -n "Reuse:" completion-report.md` returns nothing.

3. **No explicit sentence states the design pages were opened before the presentation
   components were written.** Strongly implied by the level of detail quoting exact
   copy from pages 3 and 8, but the rubric asks for the statement itself.

## Guidance for the next iteration

Fix Issue 1 first: replace the fabricated-looking `/api/enrichment` and `complete`-event
transcripts in the completion report with genuine raw output (or clearly-labeled,
clearly-commanded derived output). Nothing else in this chunk needs code changes — lint,
test, build and typecheck all pass on a clean re-run, the mutation-testing claims held up
under my own spot checks, and every Principle and Convention Map item I could verify
independently checked out. Pick up the two Warnings (the concurrency-figure correction
and the two documentation-format gaps) opportunistically while the report is already
being edited.
