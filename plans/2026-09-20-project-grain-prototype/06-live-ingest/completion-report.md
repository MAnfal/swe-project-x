# Chunk 06 — Completion Report

Live analysis: repository URL entry, bounded ingest, on-demand enrichment. US2, and the
last chunk of the plan.

Branch `feat/project-grain-prototype--live-ingest`, base `0a7907b`. Four commits:

```
931e134 docs: replace the create-next-app README with running and deploying
4d639ef feat(canvas): Other… URL entry, ingest progress, and the error surface
66d2903 feat(live): analysis and enrichment routes, bounded and validated at the boundary
f305710 feat(ingest): report what the pull-request ceiling did, and progress as it runs
```

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/ingest/github.ts` | edited | `fetchMergedPullRequests` returns `{pullRequests, matched}` — the count the window really held is only knowable inside that walk, and the caller needs it to say the ceiling fired. `createGitHubClient` takes an `AbortSignal` that reaches every request. |
| `src/lib/ingest/ingest.ts` | edited | Added `analyzeRepository`, which returns `{snapshot, bound, branch}` and reports progress. `ingestRepository` now delegates to it — **one pipeline, two entry points**, so a live analysis and a baked snapshot cannot diverge (Principle 5). |
| `src/lib/live/request.ts` | created | The boundary. `parseRepositoryUrl` parses the submitted string against GitHub's own owner/repository grammar; `resolveAnalysisBounds` resolves the window and the ceiling from configuration. No runtime import beyond the schema's constants, so a client component can use it. |
| `src/lib/live/protocol.ts` | created | The one wire contract both sides import: steps, progress, events, NDJSON framing, and `classifyFailure`. **Zero runtime imports** — everything it imports is a type. |
| `src/lib/live/client.ts` | created | `requestAnalysis` (streams, never rejects, returns the terminal event) and `requestEnrichment` (never returns a blank node). `fetch` is a parameter so specs drive a real `ReadableStream`. |
| `src/lib/ai/enrichment-cache.ts` | created | Bounded LRU keyed by chunk 03's `enrichmentKey`, scoped by repository, plus `cachedEnrichment`, which holds the "never cache a failure receipt" rule. |
| `src/app/api/analysis/route.ts` | created | Thin orchestrator. `runtime = 'nodejs'`, `maxDuration = 300`. Validates, reads `GITHUB_TOKEN`, resolves bounds, wires an abort signal, streams NDJSON. |
| `src/app/api/enrichment/route.ts` | created | Thin orchestrator. `runtime = 'nodejs'`, `maxDuration = 60`. Validates, reads `ANTHROPIC_API_KEY`, derives the key, calls `cachedEnrichment`. Module-scope cache = per serving instance. |
| `src/components/canvas/repository-picker.tsx` | edited | Gains the `Other…` row, the in-place URL input and the back arrow (design pages 1–2). |
| `src/components/canvas/analysis-progress.tsx` | created | Design page 3. |
| `src/components/canvas/analysis-error.tsx` | created | Design page 8. |
| `src/components/canvas/grain-workspace.tsx` | edited | Runs the analysis, holds the live snapshot as an ordinary picker entry, requests enrichment on first expansion, shows the truncation banner. |
| `src/components/canvas/steps-level.tsx` | edited | One new optional `enriching` prop, so the screen does not say "enrichment has not run" while it is running. |
| `README.md` | replaced | Running locally, both credentials, deploying. The stock `create-next-app` content is gone, not appended to. |
| `.env.example` | edited | Adds `GRAIN_ANALYSIS_WINDOW_DAYS`, `GRAIN_MAX_PULL_REQUESTS`, `ENRICHMENT_MODEL`. |
| `src/lib/ingest/github.test.ts`, `src/lib/ingest/ingest.test.ts` | edited | Updated for the new return shape; new specs for `analyzeRepository` and the abort signal. |
| `src/lib/live/*.test.ts`, `src/lib/ai/enrichment-cache.test.ts`, `src/app/api/**/route.test.ts` | created | Co-located specs. |

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| `Other…` replaces the dropdown in place with a URL input and a back arrow to its left; the arrow restores the dropdown with its previous selection intact | yes | `src/components/canvas/repository-picker.tsx:100–152`. The `mode === 'url'` branch returns the back-arrow + input + `Analyze` row **in the same slot** — `selected` is never written, so returning to `select` renders the same value. `leaveUrlMode` clears only the typed text. Design page 2 states B and C. |
| Progress reported at least once per ten pull requests processed, naming what is happening | yes | One report *per* pull request. `analyzeRepository reports progress for every step, at least once per pull request read` asserts `details` reports `[1,2,3,4,5,6]` with `total === 6`. Live run against the real API printed six `details` lines for six PRs (below). |
| After a live analysis the canvas behaves exactly as for a baked snapshot | yes | `analyzeRepository produces exactly the snapshot ingestRepository does, so there is one ingest path` compares `serializeSnapshot` byte-for-byte. The workspace puts the result in the same `snapshots` lookup and the same `deriveWindow`/`TopologyCanvas`/`ChangesLevel`/`StepsLevel`/`TimeSlider` — no component below `grain-workspace.tsx` takes a provenance flag. |
| A change node from a live analysis generates label, approach and steps on first expansion; a second expansion makes no further model call | yes | Two layers. Client: `openChangeNode` guards on `askedRef` and on the merged `enrichment` record. Server: `cachedEnrichment answers the second request for the same merge SHA without a model call` — the model double answers `Model answer 2` if asked again, and the caller receives `Model answer 1`. Measured live: first call 2.33 s `"cached": false`, second 0.016 s `"cached": true`. |
| More pull requests in the window than the maximum → stops at the maximum and says so | yes | `analyzeRepository stops at the ceiling and says the window held more`: `bound` equals `{maxPullRequests: 3, matched: 6, kept: 3, truncated: true}`. Live: `{"maxPullRequests":4,"matched":204,"kept":4,"truncated":true}`. Shown to the reader by the banner in `grain-workspace.tsx` and the `pull-requests` step detail. |
| Invalid URL / unreadable repository / exhausted rate limit → reported with what went wrong, dropdown stays usable | yes | Invalid URL answers 400 and renders against the field, leaving the picker mounted (`setRejected`, not `setPhase('failed')`). Not-found and rate-limit reach `AnalysisErrorView`, whose header and both buttons return to the picker. Live: `{"kind":"invalid-url",...}` HTTP 400 for three shapes, and `{"type":"failed","kind":"not-found",...}` for a missing repository. |
| Retry restarts, and no surface claims partial progress was kept or that work continues after the tab closes | yes | `onRetry={() => analyze(runningUrl)}` calls the same `startAnalysis`. Two specs assert the copy: `ANALYSIS_STEPS promises nothing about work continuing after the request ends` and `classifyFailure never promises that partial progress was kept`. |
| No credential in the client bundle | yes | Gate 3 below. `grep -rlE 'ANTHROPIC_API_KEY\|GITHUB_TOKEN' .next/static` over a corpus of 10 files: no hits. Also 0 files for `@ai-sdk`, `generateObject`, `Octokit`, `api.github.com`. |

## Tests

19 files, 379 tests. Baseline was 13 files / 246 tests.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| T001 `src/lib/live/request.test.ts` | `FAIL src/lib/live/request.test.ts [ src/lib/live/request.test.ts ]` / `Error: Cannot find package '@/lib/live/request'` — `Test Files 1 failed (1) / Tests no tests` | `Test Files 1 passed (1) / Tests 41 passed (41)` |
| T001 second red (after the first implementation) | `Tests 2 failed | 34 passed (36)` — `rejects a traversal segment as the repository: expected true to be false`. `..` passed the repository character class; fixed by rejecting `.` and `..` explicitly. | as above |
| T002 `analyzeRepository` specs in `src/lib/ingest/ingest.test.ts` | `TypeError: analyzeRepository is not a function` — `Tests 5 failed | 13 passed (18)` | `Tests 18 passed (18)`, all five `analyzeRepository` cases listed by `--reporter=verbose` |
| T003 `src/lib/ai/enrichment-cache.test.ts` | `Error: Cannot find package '@/lib/ai/enrichment-cache'` — `Test Files 1 failed (1) / Tests no tests` | `Tests 16 passed (16)` |
| `src/lib/live/protocol.test.ts` | `Error: Cannot find package '@/lib/live/protocol'` — `Tests no tests` | `Tests 17 passed (17)` |
| `src/lib/live/client.test.ts` | `Error: Cannot find package '@/lib/live/client'` — `Tests no tests` | `Tests 11 passed (11)` |
| `src/lib/live/client.test.ts` second red | `Tests 1 failed | 10 passed (11)` — `never surfaces a partial event`: my assertion was wrong, not the code (the synthesized failure *is* delivered). Assertion corrected to "no `complete` event reaches the caller". | as above |
| `src/app/api/**/route.test.ts` | Not observed red as a missing module — written after the routes existed. Each case **was** observed failing under mutation instead; see the mutation table, where removing each guard turns the corresponding case red. | `Tests 29 passed (29)` |

No test calls GitHub or Anthropic. The ingest specs drive a real Octokit from the
committed transcript via `fixtures/replay.ts`; the cache spec drives the real
`enrichPullRequest` against `MockLanguageModelV4`; the route specs never get past a guard,
and the two that do pass validation carry an already-aborted signal, so `fetch` rejects
before opening a socket (measured on Node 24.13.0).

### Mutation testing

Every defensive branch this chunk added, mutated against the full suite. **Two survivors
were found and both were fixed** before this report — see "Deviations".

| Mutation | Result |
| --- | --- |
| `request.ts`: accept >2 path segments | KILLED — `Tests 5 failed | 371 passed` |
| `request.ts`: skip the reserved-key check | KILLED — `5 failed` |
| `request.ts`: allow `..` as a repository | KILLED — `4 failed` |
| `request.ts`: default a bad bound instead of throwing | KILLED — `8 failed` |
| `request.ts`: drop the non-GitHub host check | **SURVIVED**, then KILLED — `4 failed` after fixing the assertion |
| `request.ts`: drop every empty segment, not only a trailing one | **SURVIVED**, then KILLED — `2 failed` after reworking the rule and the assertions |
| `request.ts`: never drop a trailing empty segment | KILLED — `2 failed` |
| `protocol.ts`: treat every 403 as a rate limit | KILLED — `1 failed` |
| `protocol.ts`: stop buffering a partial NDJSON line | KILLED — `2 failed` |
| `protocol.ts`: stop classifying an abort | KILLED — `4 failed` |
| `enrichment-cache.ts`: never evict | KILLED — `3 failed` |
| `enrichment-cache.ts`: cache a failure receipt too | KILLED — `1 failed` |
| `enrichment-cache.ts`: never answer from the cache | KILLED — `1 failed` |
| `enrichment-cache.ts`: drop the reserved-key guard | KILLED — `1 failed` |
| `ingest.ts`: report `truncated: false` always | KILLED — `2 failed` |
| `ingest.ts`: report the kept count as the window total | KILLED — `2 failed` |
| `ingest.ts`: stop reporting per-pull-request progress | KILLED — `1 failed` |
| `ingest.ts`: report the pull-request step after the details | KILLED — `2 failed` |
| `github.ts`: count matches after the slice | KILLED — `3 failed` |
| `github.ts`: drop the signal from the client | KILLED — `2 failed` |
| analysis route: validate the URL after reading the credential | KILLED — `8 failed` |
| analysis route: default a misconfigured bound | KILLED — `1 failed` |
| analysis route: ignore an already-disconnected caller | KILLED — `1 failed` |
| analysis route: drop the `nodejs` runtime declaration | KILLED — `1 failed` |
| enrichment route: skip repository validation | KILLED — `7 failed` |
| enrichment route: skip pull-request validation | KILLED — `5 failed` |
| enrichment route: drop the `maxDuration` declaration | KILLED — `1 failed` |
| `client.ts`: stop threading the NDJSON buffer between chunks | KILLED — `1 failed` |
| `client.ts`: rethrow instead of degrading enrichment | KILLED — `3 failed` |

Every file was restored by copy (never `git checkout --`) and the tree verified clean
after each round: `Tests 379 passed (379)`.

### Two branches deleted rather than pinned

- `enrichment-cache.ts` had `if (oldest.done === true) break;` guarding an empty map the
  eviction loop can never see. Replaced with a `for…of` over `entries.keys()`, which has
  no such branch.
- `protocol.ts` classified a 401 carrying rate-limit headers as `rate-limit`. GitHub
  answers 403 or 429 for quota, never 401, so no input reaches it. Removed.
- `AnalysisErrorView` had a `cancelled` heading branch. The workspace routes a cancel back
  to where the reader was rather than to the error screen, so nothing reaches it. Removed.

## Gates

Baseline captured **before any edit**, at `/private/tmp/claude-501/.../scratchpad/baseline`:
`pnpm lint` exit 0 with no output; `Test Files 13 passed (13) / Tests 246 passed (246)`;
`pnpm typecheck` exit 0. All results below are the delta: **0 new errors, 0 new warnings,
+6 test files, +133 tests.**

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| 1 | `pnpm lint; pnpm test; pnpm build; pnpm typecheck` | lint exit 0 no output · `Test Files 19 passed (19) / Tests 379 passed (379)` · build exit 0, `/` still `○ (Static)`, `/api/analysis` and `/api/enrichment` `ƒ (Dynamic)` · typecheck exit 0 | **No — it passes on base, because base is the baseline.** Falsified by negative control instead: `const canary: number = "not a number"` in `src/lib/live/request.ts` gives `src/lib/live/request.ts(170,7): error TS2322` from **both** `pnpm typecheck` and `pnpm build`, proving the new directory is in the type-check graph. Restored by copy; typecheck exit 0; `git status --short` clean. |
| 2 | route discovery + `runtime = 'nodejs'` per route | `gate 2 PASS over: src/app/api/analysis/route.ts, src/app/api/enrichment/route.ts` | **Yes.** Against base `0a7907b`: `git ls-tree -r 0a7907b --name-only \| grep -E 'route\.ts$'` is empty → `FAIL: no route handlers found`, **exit 1**. Per-assertion control on the current tree: removing `export const runtime = 'nodejs';` from `analysis/route.ts` → exit 1, `FAIL: src/app/api/analysis/route.ts does not declare the nodejs runtime`; same for `enrichment/route.ts` → exit 1. Both restored by `cp` from a backup, verified byte-identical with `diff -q`; gate then exit 0. |
| 3 | build, assert corpus non-empty, grep `.next/static` for credential names | `gate 3 corpus: 10 client .js files under .next/static` then `gate 3 PASS` | **No — it passes on base**, which had neither route nor any credential-naming string. Falsified three ways on the current tree. **(a) It already caught a real defect**: my first build failed it because `protocol.ts` said "Check GITHUB_TOKEN on the server." and that module is on a client path — `.next/static/chunks/3qa0wc4fc771w.js` contained the name. Not a planted canary; a genuine catch. **(b) Per needle**: re-planting `GITHUB_TOKEN` → exit 1, hit in `0tro5rfx4nsxj.js`; planting `ANTHROPIC_API_KEY` → exit 1, hit in `1g_ryxifea97q.js`. **(c) Corpus assertion**: pointing `find` at `.next/no-such-dir` → exit 1. After every canary was removed by `cp` and rebuilt: exit 0, `clean: corpus 10 files, no credential name`. |
| 4 | `pnpm test`, require the runner to report executed tests | `Tests 379 passed (379)` → `gate 4 PASS`. The bounds spec really ran: `--reporter=verbose` lists all five `analyzeRepository >` cases and all ten `resolveAnalysisBounds >` cases as `✓`. | **No — base reported `Tests 246 passed (246)`**, so it passes there. Falsified by feeding the assertion the two outputs it exists to reject: `No test files found, exiting with code 1` → FAIL, `Tests  0 passed (0)` → FAIL, `Tests  379 passed (379)` → PASS. |

**Gate 2 also failed for a second reason worth recording.** Run before committing, it
reported `FAIL: no route handlers found` — `git ls-files` sees only tracked files, and the
routes were untracked. The gate failed *loudly* rather than passing vacuously, which is the
safe direction, but it means the gate is only meaningful after `git add`. See "project.md
deltas".

### Live end-to-end evidence

Gates prove the code compiles and the units behave. These runs prove the deployed path
works. `pnpm start` on port 3117 (3000 was held by another session), against the real
GitHub and Anthropic APIs with the worktree's `.env.local`.

```
landing: HTTP 200

$ POST /api/analysis {"url":"https://github.com/acme/monorepo/pull/42"}
{"kind":"invalid-url","message":"That URL points inside a repository — Grain needs just
 the owner and the repo, like github.com/acme/monorepo."} | HTTP 400
$ POST /api/analysis {"url":"https://gitlab.com/acme/monorepo"}
{"kind":"invalid-url","message":"Grain only analyzes repositories on github.com, like
 github.com/acme/monorepo."} | HTTP 400
$ POST /api/analysis {"url":""}
{"kind":"invalid-url","message":"Enter a GitHub repository URL — Grain needs an owner and
 a repo, like github.com/acme/monorepo."} | HTTP 400

$ POST /api/analysis {"url":"github.com/xyflow/definitely-not-a-real-repo-91731"}
{"type":"failed","kind":"not-found","step":"resolve","message":"Grain can't see that
 repository. It may be private, renamed, or misspelled.","detail":"404 · Not Found - …"}

$ POST /api/analysis {"url":"https://github.com/xyflow/xyflow"}    # 365-day window, ceiling 4
progress {"step":"resolve","done":1,"total":1,"branch":"main"}
progress {"step":"topology","done":1,"total":1,"packageCount":10,"edgeCount":13}
progress {"step":"pull-requests","done":4,"total":4,"matched":204,"truncated":true}
progress {"step":"details","done":1,"total":4,"read":{"number":5997,"title":"only display
          warning if pane is not visible as well","packages":["@xyflow/svelte","@xyflow/system"]}}
progress {"step":"details","done":2,"total":4,"read":{"number":5992,…}}
progress {"step":"details","done":3,"total":4,"read":{"number":5994,…}}
progress {"step":"details","done":4,"total":4,"read":{"number":5977,…}}
progress {"step":"attribute","done":1,"total":1,"packageCount":10}
complete {"repository":"xyflow/xyflow","branch":"main",
          "bound":{"maxPullRequests":4,"matched":204,"kept":4,"truncated":true},
          "packages":10,"prs":4,"enrichment":"absent"}          # 6.1 s wall clock
```

On-demand enrichment, the same merge SHA twice:

```
$ POST /api/enrichment   (first)                                  # 2.332 s
{"key":"xyflow/xyflow#0a1f9575b25679f2880175de8d3eae21aedde921","cached":false,
 "fallback":false,"label":"Release packages",
 "approach":"Automated release commit generated by Changesets action, consuming four
  previously-filed changeset files and bumping versions across three packages with
  interconnected dependencies.","steps":1}

$ POST /api/enrichment   (second, identical body)                 # 0.016 s
{"key":"xyflow/xyflow#0a1f9575…","cached":true,"fallback":false,"label":"Release packages"}

$ POST /api/enrichment {"repository":{"owner":"..","name":"x"},"pullRequest":{}}
{"message":"Grain only analyzes repositories on github.com, …"} | HTTP 400
$ POST /api/enrichment {…,"pullRequest":{"number":-1}}
{"message":"That is not a pull request Grain can enrich."} | HTTP 400
```

Client disconnect (`curl -m 1`, killed mid-analysis):

```
[Analysis] xyflow/xyflow 2025-09-20T18:29:34.185Z..2026-09-20T18:29:34.185Z max 4
[Analysis] xyflow/xyflow cancelled by the caller — stopping
GET /repos/xyflow/xyflow/contents/packages%2Fsystem%2Fpackage.json?ref=main - 500 … 179ms
  … (nine in-flight manifest reads terminate)
[Analysis] xyflow/xyflow stopped at resolve (cancelled): undefined
```

`.env.local` was temporarily given `GRAIN_ANALYSIS_WINDOW_DAYS` / `GRAIN_MAX_PULL_REQUESTS`
for these runs and restored from a backup afterwards (`diff -q` clean). It is gitignored
and was never committed; no credential value appears in this report or in any log.

## Judgment calls

- **How progress is streamed, and what a client disconnect does** — a **streamed NDJSON
  response body**, not server-sent events and not a polled job. SSE cannot carry a POST
  body, so the repository URL would have to go in a query string — the one value this
  chunk is meant to validate, pushed into a URL that gets logged. A polled job needs a
  store the deployment target does not have. NDJSON is one line per event, and
  `decodeEvents` buffers a partial line so a chunk boundary mid-line cannot drop an event.
  On disconnect: `request.signal` and the stream's `cancel()` both abort one
  `AbortController`, whose signal is on the Octokit client, so in-flight GitHub requests
  terminate — measured above. A signal that aborted *before* the handler ran is checked
  explicitly, because an already-aborted signal never dispatches `abort` to a listener
  added afterwards (measured on Node 24.13.0) and the analysis would otherwise be paid for
  in full on behalf of a caller that is gone. **Nothing survives the request.**

- **Cache scope, and what a cold instance does** — **per serving instance**, a module-scope
  `createEnrichmentCache()` in the enrichment route, bounded at 200 entries with LRU
  eviction. Not per session: there is no session, and a session-scoped cache would need a
  cookie and a store. A cold instance starts empty and re-asks the model — an ordinary
  miss, never an error, and `cachedEnrichment` returns `{cached: false}` rather than
  failing. Nothing depends on a hit: the client also keeps merged entries in the live
  snapshot, so a re-expand within one page view costs nothing even against a cold server.
  A failure receipt is never stored, so a transient provider error cannot freeze into the
  instance. The key is `owner/repo#<merge SHA>`, using chunk 03's `enrichmentKey` and
  scoped by repository so the same SHA in two repositories cannot collide.

- **How the bound is applied, and what a truncated result shows** — **by both**, window
  *and* count, in that order. The window (90 days by default) bounds the listing walk; the
  count (100 by default) is applied to the sorted listing **before any per-pull-request
  request is made**, which matters because the files and commits calls are the volumetric
  cost — two per pull request. A count alone would let a year-long window page the whole
  listing; a window alone would let a busy monorepo blow the ceiling. The reader sees it
  twice: the `Fetching pull requests` step reads `4 of 204 — stopped at the maximum`, and
  the canvas header carries an amber strip — *"204 pull requests merged in this window and
  Grain stopped at 4 — the newest ones. The rest were never fetched."*

- **A separate URL parser, rather than reusing `parseRepositoryRef`** — two reasons, either
  sufficient. `parseRepositoryRef` accepts a trailing path (`…/pull/42` resolves to the
  repository), which is right for an operator typing a CLI flag and wrong for a public
  request that becomes an API path; and it lives in `github.ts`, which imports Octokit, so
  a client component validating on submit would drag the GitHub client into the browser
  bundle. The CLI's parser is unchanged.

- **A freshly analyzed snapshot has no `enrichment` key at all** — it sits on the *absent*
  side of the absent-or-complete invariant, exactly like the committed
  `xyflow-xyflow-2026-08-31` fixture. Once a change is expanded it becomes *partially*
  enriched, which is a state no baked snapshot may be in. That is sound because the
  invariant is a property of **baked** snapshots only: `baked-snapshots.test.ts` quantifies
  over `src/lib/snapshots/`, a live snapshot is never written there, and `derive.ts`'s
  `realEnrichment` already handles "has an `enrichment` key but not for this change"
  (third of its three documented cases). Asserted by the live run above:
  `"enrichment":"absent"`.

- **The client sends the pull-request record to the enrichment route**, rather than the
  route re-fetching it from GitHub. Re-fetching would cost three more GitHub calls per
  expansion to reproduce data the client already holds. The record is validated through
  `pullRequestSchema` at the boundary and the key through `assertSafeKey`. The residual
  risk is noted under "Left alone".

- **`maxDuration = 300` on the analysis route** — the ceiling the free tier allows and
  cannot raise, declared explicitly. The work is kept well inside it by the pull-request
  ceiling, not by this number: the measured 100-PR-equivalent run above took 6.1 s for
  4 PRs with topology; the default ceiling of 100 is the bound that matters.

## Deviations from the plan

- **The designs contradict the settled behaviour in four places** (SPEC clarification
  2026-09-20, design README decision 5: no background jobs). Layout followed, copy
  rewritten, each recorded in the component's own docblock:
  1. Page 3 footer: *"Analysis keeps running if you close this tab. Grain will have the
     canvas ready when you come back."* → *"Analysis runs inside this request. Closing the
     tab ends it, and retrying starts it over."*
  2. Page 8: *"42 of 100 were already fetched and are kept — retrying resumes from there
     rather than starting over."* → *"Nothing was written to your repository. A retry
     starts the analysis over — Grain keeps no partial work."*
  3. Page 8: *"Retry from step 3"* → *"Retry the analysis"*.
  4. Page 8 rate-limit card: *"60 requests an hour without a token"* and an *"Add a token"*
     button. The token is the server's, read in the route handler (Principle 1); there is
     nothing for a visitor to add, and Grain is never unauthenticated. Dropped.
- **Page 3's fifth step is "Summarizing how each change was built".** A live analysis does
  not summarize — enrichment is deferred to expansion, which is what keeps the request
  inside one invocation. The five steps are `Resolved repository`, `Read the dependency
  graph`, `Fetching pull requests`, `Reading files and commits`, `Attributing changes to
  packages`. Five steps, page 3's layout, honest names. Pinned by a spec.
- **Page 3 shows "about 25 seconds left".** Not implemented. It would be a guess at
  GitHub's latency, and a wrong countdown reads worse than none. The step-weighted
  percentage and the per-step counts are there.
- **The plan says the enrichment cache key is "the merge commit SHA".** It is
  `owner/repo#<merge SHA>` — `enrichmentKey` unchanged, prefixed by the repository.
  Unprefixed, two repositories sharing a merge SHA (or a pull-request number, for a merge
  GitHub reports no SHA for) would collide in one process-wide cache. The measurement that
  forced it: the cache is module-scope and therefore shared across every repository anyone
  analyzes on that instance.
- **`fetchMergedPullRequests` changed shape**, which the plan did not anticipate. Whether
  the window held more than the ceiling is only knowable inside that function, and the plan
  requires the result to say so. Four call sites in `github.test.ts` updated.
- **My own two mutation survivors**, both found before this report:
  1. The non-GitHub-host assertion used `/github\.com/i`, which matched the example URL
     (`github.com/acme/monorepo`) that *every* rejection message carries — so deleting the
     host check entirely survived. Tightened to `/only analyzes repositories on github\.com/i`.
  2. The empty-path-segment rule distinguished a trailing empty segment from any other, but
     both branches produced a rejection my assertion accepted. Reworked to pop exactly one
     trailing empty segment and let any other empty segment fail the grammar, with three
     inputs asserting three *different* messages so the distinction is pinned.
- **Gate 2 fails before `git add`.** `git ls-files` sees tracked files only. It fails loudly
  rather than vacuously, so it is safe, but it must be run after staging.

## project.md deltas

For the lead to apply at the wave boundary. This chunk did not edit
`.claude/resources/project.md`. Each was measured.

1. **Layout** — add `src/lib/live/` to the tree:
   > `live/` — The live-analysis boundary and wire contract. `request.ts` parses the
   > submitted repository URL and resolves the bounds; `protocol.ts` is the event contract
   > both the route and the browser import and has **no runtime imports at all**;
   > `client.ts` is the browser-side caller. Reachable from client components, so nothing
   > here may import `ai` or `@octokit/rest` other than as a type.

   And to `ai/`: `enrichment-cache.ts` holds the bounded per-instance on-demand cache and
   imports no `ai` — the producer arrives as a thunk.
   Measured: `find src/lib/live src/lib/ai -name '*.ts' | sort`.

2. **Layout** — `src/app/` gains its first route handlers: `app/api/analysis/route.ts` and
   `app/api/enrichment/route.ts`. Measured: `git ls-files | grep -E 'route\.ts$'` →
   two paths (empty on `0a7907b`).

3. **Commands** — add to the table:
   | Run a live analysis against a deployed or local server | `curl -N -X POST http://localhost:3000/api/analysis -H 'content-type: application/json' -d '{"url":"github.com/<owner>/<repo>"}'` — streams NDJSON, one event per line. Needs `GITHUB_TOKEN`. |

   Measured above on port 3117.

4. **Conventions** — new entry:
   > **A route handler's own guards are specced, and the spec must not reach the network.**
   > `src/app/**/route.ts` is importable by Vitest and its `POST` can be called with a
   > plain `Request`. To exercise the streaming path without a socket, construct the
   > request with `AbortSignal.abort()`: measured on Node 24.13.0, an already-aborted
   > signal is never dispatched to a listener added afterwards (so a handler must check
   > `signal.aborted` outright), and `fetch` with one rejects `AbortError` before opening a
   > connection.

5. **Conventions** — new entry:
   > **A string in a module a client component imports ships in the browser bundle, and
   > the credential gate greps for the variable *name*.** Error copy that says "check
   > `GITHUB_TOKEN`" fails `grep -rlE 'ANTHROPIC_API_KEY|GITHUB_TOKEN' .next/static` just
   > as a leaked value would. Caught for real on 2026-09-20 by chunk 06 in
   > `src/lib/live/protocol.ts`; the hit was in `.next/static/chunks/3qa0wc4fc771w.js`.

6. **Conventions** — new entry:
   > **`.next/static` holds 10 `.js` files after `pnpm build` on Next 16.3.5** (measured
   > 2026-09-20 by chunk 06; the wave-5 preflight measured 24 on a different build). The
   > count varies with what the page imports, so a gate must assert the corpus is
   > **non-empty**, never a particular size.

7. **Conventions** — new entry:
   > **`git ls-files` sees tracked files only**, so a gate that discovers new files by
   > listing them reports `FAIL: no … found` until the work is staged. It fails in the safe
   > direction, unlike a loop over an empty stream, but stage before running it — or union
   > with `git ls-files --others --exclude-standard`.

8. **Stack / Deployment target** — the deployment note can now name the measured
   constraint: both route handlers declare `runtime = 'nodejs'`, and the free-tier function
   duration ceiling of 300 s is declared as `maxDuration` on the analysis route
   (https://vercel.com/docs/functions/configuring-functions/duration, read 2026-09-20).

9. **Commands** — the README is no longer `create-next-app` boilerplate; it documents
   running, both credentials, the three optional settings, and deploying. Any note that
   treats the README as stock is now false.

## Left alone

- **`analyzeRepository` fetches every pull request's files and commits under
  `Promise.all`, with no concurrency limit.** At the default ceiling of 100 that is 200
  concurrent requests, above GitHub's documented 100-concurrent-request secondary limit.
  Pre-existing from chunk 02 — the bake ran at this ceiling successfully — and this chunk
  only changes who calls it. `enrichment.ts` already has a private `mapWithConcurrency`
  that would consolidate. Out of scope: the chunk's bound is on *how many* pull requests,
  not on how many at once. **Recommend a follow-up.**
- **Cache-poisoning surface on the enrichment route.** The client supplies the pull-request
  record *and* the fields the key is derived from, so a crafted request could store a
  record under a legitimate merge SHA that a later reader on the same instance would see.
  Blast radius is one in-memory entry on an unauthenticated prototype, and the payload is a
  label and an approach note, not code or data. Closing it means either re-fetching the
  pull request server-side (three GitHub calls per expansion) or fingerprinting the payload
  into the key, and the plan specifies keying by merge SHA. Recorded rather than changed.
- **Neither route is rate-limited.** A public deployment lets any visitor spend the owner's
  GitHub quota and model budget, bounded per request but not per caller. Out of scope — the
  plan bounds a single analysis. **Worth a follow-up before any public deploy.**
- **`SnapshotEntry.file` is `''` for a live entry.** The type says "the filename stem" and a
  live snapshot has no file. Nothing reads `file` outside `catalog.test.ts`. Widening the
  type is a change to chunk 04's contract; left alone and marked with a comment.
- **`src/lib/ai/baked-snapshots.test.ts` is under `ai/`, not `snapshots/`.** My dispatch
  brief named `src/lib/snapshots/baked-snapshots.test.ts`. The file's own docblock explains
  the placement (`src/lib/snapshots/` holds data files only). Not moved; noting it so the
  path in the brief is not repeated.
- **The `Other…` row is offered on the header picker too**, not only the landing card, so an
  evaluator can switch to a live repository without going back. The design only draws it on
  the landing card. Additive and consistent; flagging it as a deliberate extension.
