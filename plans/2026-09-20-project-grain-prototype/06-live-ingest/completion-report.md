# Chunk 06 — Completion Report

Live analysis: repository URL entry, bounded ingest, on-demand enrichment. US2, and the
last chunk of the plan.

Branch `feat/project-grain-prototype--live-ingest`, base `0a7907b`.

Two review iterations have failed this chunk on evidence, both times in this report and
never in the code.

- **Iteration 1**: two live transcripts were reshaped by `node -e` formatters and pasted
  as raw wire output.
- **Iteration 2**: the fix reintroduced the defect — the two enrichment bodies I pasted as
  cold-vs-cached were byte-identical, the second reading `"cached":false`. The captured
  files were right; I hand-transcribed them and pasted the first one twice.

Live evidence is therefore no longer transcribed at all: each response is captured by
`curl -o` to its own distinct path and the report block is **emitted by a script that
reads those files**, with a `diff` and its exit status shown for any two responses
presented as differing. See "Evidence audit" for the enumeration across both passes —
including three defects my own sweeps found that neither review cited.

**No production code has changed in either iteration.** `git diff --stat 79b09d9..HEAD`
is this report and nothing else.

```
HEAD      plan: chunk 06 — machine-generated transcripts, audit of both passes
          (shown as HEAD, not a hash: this commit carries this file, so any hash
           written here is stale the moment the commit is amended)
67a00ca plan: chunk 06 — genuine transcripts, evidence audit, three corrections
79b09d9 plan: chunk 06 completion report
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
| `Other…` replaces the dropdown in place with a URL input and a back arrow to its left; the arrow restores the dropdown with its previous selection intact | yes | `src/components/canvas/repository-picker.tsx:101–160`. The `mode === 'url'` branch returns the back-arrow + input + `Analyze` row **in the same slot** — `selected` is never written, so returning to `select` renders the same value. `leaveUrlMode` clears only the typed text. Design page 2 states B and C. |
| Progress reported at least once per ten pull requests processed, naming what is happening | yes | One report *per* pull request. `analyzeRepository reports progress for every step, at least once per pull request read` asserts `details` reports `[1,2,3,4,5,6]` with `total === 6` against the committed transcript's six pull requests. The live run below was bounded to four and printed exactly four `details` lines, `done` 1→4 with `total: 4` — one per pull request, well inside "at least once per ten". |
| After a live analysis the canvas behaves exactly as for a baked snapshot | yes | `analyzeRepository produces exactly the snapshot ingestRepository does, so there is one ingest path` compares `serializeSnapshot` byte-for-byte. The workspace puts the result in the same `snapshots` lookup and the same `deriveWindow`/`TopologyCanvas`/`ChangesLevel`/`StepsLevel`/`TimeSlider` — no component below `grain-workspace.tsx` takes a provenance flag. |
| A change node from a live analysis generates label, approach and steps on first expansion; a second expansion makes no further model call | yes | Two layers. Client: `openChangeNode` guards on `askedRef` and on the merged `enrichment` record. Server: `cachedEnrichment answers the second request for the same merge SHA without a model call` — the model double answers `Model answer 2` if asked again, and the caller receives `Model answer 1`. Measured live end to end on a cold instance, each response captured to its own file: first POST `time_total=1.930429s` with `"cached":false`, second POST of the byte-identical request `time_total=0.004054s` with `"cached":true`, `entry` and `key` identical. `diff` between the two response files exits **1**, so they are demonstrably not the same bytes. Full bodies, the `diff` and a computed field-by-field comparison under "Live end-to-end evidence". |
| More pull requests in the window than the maximum → stops at the maximum and says so | yes | `analyzeRepository stops at the ceiling and says the window held more`: `bound` equals `{maxPullRequests: 3, matched: 6, kept: 3, truncated: true}`. Live: `{"maxPullRequests":4,"matched":204,"kept":4,"truncated":true}`. Shown to the reader by the banner in `grain-workspace.tsx` and the `pull-requests` step detail. |
| Invalid URL / unreadable repository / exhausted rate limit → reported with what went wrong, dropdown stays usable | yes | Invalid URL answers 400 and renders against the field, leaving the picker mounted (`setRejected`, not `setPhase('failed')`). Not-found and rate-limit reach `AnalysisErrorView`, whose header and both buttons return to the picker. Live, raw bodies quoted in full below: three invalid-URL shapes each `{"kind":"invalid-url", …}` with HTTP 400, and a missing repository streaming `{"type":"failed","kind":"not-found", …}`. |
| Retry restarts, and no surface claims partial progress was kept or that work continues after the tab closes | yes | `onRetry={() => analyze(runningUrl)}` calls the same `startAnalysis`. Two specs assert the copy: `ANALYSIS_STEPS promises nothing about work continuing after the request ends` and `classifyFailure never promises that partial progress was kept`. |
| No credential in the client bundle | yes | Gate 3 below. `grep -rlE 'ANTHROPIC_API_KEY\|GITHUB_TOKEN' .next/static` over a corpus of 10 files: no hits. Also 0 files for `@ai-sdk`, `generateObject`, `Octokit`, `api.github.com`. |

## Tests

19 files, 379 tests. Baseline was 13 files / 246 tests.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| T001 `src/lib/live/request.test.ts` | `FAIL src/lib/live/request.test.ts [ src/lib/live/request.test.ts ]` / `Error: Cannot find package '@/lib/live/request'` — `Test Files 1 failed (1) / Tests no tests` | `Test Files 1 passed (1) / Tests 41 passed (41)` |
| T001 second red (after the first implementation) | `Tests 2 failed \| 34 passed (36)` — `rejects a traversal segment as the repository: expected true to be false`. `..` passed the repository character class; fixed by rejecting `.` and `..` explicitly. | as above |
| T002 `analyzeRepository` specs in `src/lib/ingest/ingest.test.ts` | `TypeError: analyzeRepository is not a function` — `Tests 5 failed \| 13 passed (18)` | `Tests 18 passed (18)`, all five `analyzeRepository` cases listed by `--reporter=verbose` |
| T003 `src/lib/ai/enrichment-cache.test.ts` | `Test Files 1 failed (1) / Tests no tests` observed at the time. Full text **re-derived** (see below): `Error: Cannot find package '@/lib/ai/enrichment-cache' imported from …/src/lib/ai/enrichment-cache.test.ts` | `Tests 16 passed (16)` |
| `src/lib/live/protocol.test.ts` | `Tests no tests` observed at the time; full text **re-derived**: `Error: Cannot find package '@/lib/live/protocol' imported from …/src/lib/live/protocol.test.ts` | `Tests 17 passed (17)` |
| `src/lib/live/client.test.ts` | `Tests no tests` observed at the time; full text **re-derived**: `Error: Cannot find package '@/lib/live/client' imported from …/src/lib/live/client.test.ts` | `Tests 11 passed (11)` |
| `src/lib/live/client.test.ts` second red | `Tests 1 failed \| 10 passed (11)` — `never surfaces a partial event`: my assertion was wrong, not the code (the synthesized failure *is* delivered). Assertion corrected to "no `complete` event reaches the caller". | as above |
| `src/app/api/**/route.test.ts` | Not observed red as a missing module — written after the routes existed. Each case **was** observed failing under mutation instead; see the mutation table, where removing each guard turns the corresponding case red. | `Tests 29 passed (29)` |

**On "re-derived".** The first version of this report quoted a `Cannot find package …`
line for these three specs. I had only read that line from `request.test.ts`'s run; for the
other three I had seen the tail (`Tests no tests`) and pattern-matched the rest. That was a
claim I had not checked, so I re-derived each one by moving the module aside and re-running
its spec, restoring by `mv` and confirming `git status --short` empty:

```
$ mv src/lib/ai/enrichment-cache.ts{,.away}; pnpm test src/lib/ai/enrichment-cache.test.ts
 ❯ src/lib/ai/enrichment-cache.test.ts (0 test)
⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/lib/ai/enrichment-cache.test.ts [ src/lib/ai/enrichment-cache.test.ts ]
Error: Cannot find package '@/lib/ai/enrichment-cache' imported from /Users/anfal/…/src/lib/ai/enrichment-cache.test.ts
 Test Files  1 failed (1)
```

The text I had guessed turned out to be correct in all three cases, which is luck, not
evidence. They are now genuinely measured, and labelled as re-derivations today rather
than as the original runs.

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
| `request.ts`: accept >2 path segments | KILLED — `Tests 5 failed \| 371 passed` |
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

**Every block in this section is generated from a captured file, not typed.** Each
response was written by `curl -o` to its **own distinct path**; a script then read those
files and emitted the markdown below. That is the method change review iteration 2 asked
for, and the reason for it is that the previous pass hand-transcribed two enrichment
bodies into a heredoc and pasted the first one twice — the captured files were right,
the transcription was not.

Setup: `PORT=3211 pnpm start` on a **cold instance** (empty enrichment cache), against
the real GitHub and Anthropic APIs, with `GRAIN_ANALYSIS_WINDOW_DAYS=365` and
`GRAIN_MAX_PULL_REQUESTS=4` appended to the worktree's gitignored `.env.local` so the run
is small and crosses the ceiling. `.env.local` was restored from a backup afterwards
(`diff -q` clean, `git status --short` empty). No credential value appears here.

Every `curl` below used `-o <file> -w '%{http_code} %{time_total}' > <file>.meta`, so the
status and timing are curl's own and the body is untouched bytes on disk.

#### On-demand enrichment: cold, then cached

The request body is `{repository, pullRequest}` built from `snapshot.pullRequests[0]` of
the analysis run below (PR #5992, merge SHA `0a1f9575b25679f2880175de8d3eae21aedde921`)
and written to one file, so both POSTs send byte-identical bytes:

```
$ curl -s -X POST .../api/enrichment --data-binary @enrich-request.json \
       -o enrich-1.body -w '%{http_code} %{time_total}' > enrich-1.meta
$ curl -s -X POST .../api/enrichment --data-binary @enrich-request.json \
       -o enrich-2.body -w '%{http_code} %{time_total}' > enrich-2.meta
```

**`enrich-1.body`** — 504 bytes, `http_code=200 time_total=1.930429s`:

```
{"key":"xyflow/xyflow#0a1f9575b25679f2880175de8d3eae21aedde921","entry":{"label":"Release packages","approach":"Automated changeset-driven release that bumped patch versions across three packages (@xyflow/react, @xyflow/svelte, @xyflow/system) by consuming four pending changesets and updating package.json and CHANGELOG files.","steps":[{"commitSha":"9fd41fd4fc18a22b7c461da8888b2ab264a00a29","summary":"Bumped package versions and updated changelogs from changesets"}]},"cached":false,"fallback":false}
```

**`enrich-2.body`** — 503 bytes, `http_code=200 time_total=0.004054s`:

```
{"key":"xyflow/xyflow#0a1f9575b25679f2880175de8d3eae21aedde921","entry":{"label":"Release packages","approach":"Automated changeset-driven release that bumped patch versions across three packages (@xyflow/react, @xyflow/svelte, @xyflow/system) by consuming four pending changesets and updating package.json and CHANGELOG files.","steps":[{"commitSha":"9fd41fd4fc18a22b7c461da8888b2ab264a00a29","summary":"Bumped package versions and updated changelogs from changesets"}]},"cached":true,"fallback":false}
```

**The check that would have caught the previous defect.** Two responses presented as
cold-vs-cached must not be the same file:

```
$ diff enrich-1.body enrich-2.body ; echo "diff exit=$?"
1c1
< {"key":"xyflow/xyflow#0a1f9575b25679f2880175de8d3eae21aedde921","entry":{"label":"Release packages","approach":"Automated changeset-driven release that bumped patch versions across three packages (@xyflow/react, @xyflow/svelte, @xyflow/system) by consuming four pending changesets and updating package.json and CHANGELOG files.","steps":[{"commitSha":"9fd41fd4fc18a22b7c461da8888b2ab264a00a29","summary":"Bumped package versions and updated changelogs from changesets"}]},"cached":false,"fallback":false}
\ No newline at end of file
---
> {"key":"xyflow/xyflow#0a1f9575b25679f2880175de8d3eae21aedde921","entry":{"label":"Release packages","approach":"Automated changeset-driven release that bumped patch versions across three packages (@xyflow/react, @xyflow/svelte, @xyflow/system) by consuming four pending changesets and updating package.json and CHANGELOG files.","steps":[{"commitSha":"9fd41fd4fc18a22b7c461da8888b2ab264a00a29","summary":"Bumped package versions and updated changelogs from changesets"}]},"cached":true,"fallback":false}
\ No newline at end of file
diff exit=1   # 1 = the two responses genuinely differ
```

Field by field, computed from the two files rather than read by eye:

```
  cached    false  ->  true
  entry     identical
  fallback  identical
  key       identical
```

`cached` flips `false` → `true`, `entry` and `key` are identical, and `time_total` drops
from **1.930429s to 0.004054s** — a factor of 476. That is the acceptance criterion's "no further
model call", measured end to end on a cold instance rather than inferred. `label`,
`approach` and `steps` are nested under `entry`, and `steps` is an array of
`{commitSha, summary}` objects, exactly as `src/app/api/enrichment/route.ts:72-75`
returns and `enrichmentEntrySchema` (`src/lib/snapshot.ts:132`) declares.

#### A full analysis

```
$ curl -s -N -X POST .../api/analysis -d '{"url":"https://github.com/xyflow/xyflow"}' \
       -o analysis.ndjson -w '%{http_code} %{time_total}' > analysis.meta
$ cat analysis.meta
200 5.573961
$ wc -c < analysis.ndjson ; wc -l < analysis.ndjson
   11923
       9
$ awk '{print "  line " NR ": " length($0) " bytes"}' analysis.ndjson
  line 1: 84 bytes
  line 2: 102 bytes
  line 3: 105 bytes
  line 4: 193 bytes
  line 5: 181 bytes
  line 6: 200 bytes
  line 7: 182 bytes
  line 8: 88 bytes
  line 9: 10779 bytes
```

Lines 1–8 in full, untruncated (`head -8 analysis.ndjson`):

```
{"type":"progress","progress":{"step":"resolve","done":1,"total":1,"branch":"main"}}
{"type":"progress","progress":{"step":"topology","done":1,"total":1,"packageCount":10,"edgeCount":13}}
{"type":"progress","progress":{"step":"pull-requests","done":4,"total":4,"matched":204,"truncated":true}}
{"type":"progress","progress":{"step":"details","done":1,"total":4,"read":{"number":5994,"title":"fix(store): reset functions","packages":["@xyflow/react","@xyflow/svelte","svelte-examples"]}}}
{"type":"progress","progress":{"step":"details","done":2,"total":4,"read":{"number":5992,"title":"Release packages","packages":["@xyflow/react","@xyflow/svelte","@xyflow/system"]}}}
{"type":"progress","progress":{"step":"details","done":3,"total":4,"read":{"number":5997,"title":"only display warning if pane is not visible as well","packages":["@xyflow/svelte","@xyflow/system"]}}}
{"type":"progress","progress":{"step":"details","done":4,"total":4,"read":{"number":5977,"title":"fix(svelte): hide edge if connected node is hidden","packages":["@xyflow/svelte"]}}}
{"type":"progress","progress":{"step":"attribute","done":1,"total":1,"packageCount":10}}
```

Line 9 is the `complete` event at 10,779 bytes — almost all of it the `snapshot`. Its head
and tail, both raw, which together show every top-level field of the wire event declared
at `src/lib/live/protocol.ts:75`:

```
$ sed -n '9p' analysis.ndjson | cut -c1-600
{"type":"complete","snapshot":{"metadata":{"repository":{"owner":"xyflow","name":"xyflow"},"window":{"since":"2025-09-20T18:54:12.285Z","until":"2026-09-20T18:54:12.285Z"},"analyzedAt":"2026-09-20T18:54:12.287Z","packageCount":10,"pullRequestCount":4},"packages":{"nodes":[{"name":"@xyflow/eslint-config","path":"tooling/eslint-config","manifestPath":"tooling/eslint-config/package.json"},{"name":"@xyflow/react","path":"packages/react","manifestPath":"packages/react/package.json"},{"name":"@xyflow/rollup-config","path":"tooling/rollup-config","manifestPath":"tooling/rollup-config/package.json"},{

                       ...[ 9,959 bytes elided ]...

$ sed -n '9p' analysis.ndjson | rev | cut -c1-220 | rev
{"package":"svelte-examples","through":"@xyflow/svelte","path":["svelte-examples","@xyflow/svelte"]}]}]},"bound":{"maxPullRequests":4,"matched":204,"kept":4,"truncated":true},"repository":"xyflow/xyflow","branch":"main"}
```

**Derived, not raw** — the one summary in this section, with the command that produced
it, confirming the event's field set and that a freshly analyzed snapshot carries no
`enrichment` key at all:

```
$ node -e "  const e = JSON.parse(require('fs').readFileSync(process.argv[1],'utf8').trim().split('\n').pop());
  console.log('complete event top-level keys:', JSON.stringify(Object.keys(e)));
  console.log('snapshot top-level keys:', JSON.stringify(Object.keys(e.snapshot)));
  console.log('snapshot has own enrichment:', Object.prototype.hasOwnProperty.call(e.snapshot,'enrichment'));" analysis.ndjson
complete event top-level keys: ["type","snapshot","bound","repository","branch"]
snapshot top-level keys: ["metadata","packages","pullRequests"]
snapshot has own enrichment: false
```

Read off those lines: the `pull-requests` step reports `matched: 204` against `done: 4`
with `truncated: true`, and there are **4** `details` reports, `done` 1→2→3→4 — one per pull
request, which is the acceptance criterion's "at least once per ten" with margin.

#### Boundary rejections

```
$ curl -s -X POST .../api/analysis -d '{"url":"https://github.com/acme/monorepo/pull/42"}' -o invalid-inside.body -w '%{http_code}'
{"kind":"invalid-url","message":"That URL points inside a repository — Grain needs just the owner and the repo, like github.com/acme/monorepo."}
http_code=400

$ curl -s -X POST .../api/analysis -d '{"url":"https://gitlab.com/acme/monorepo"}' -o invalid-host.body -w '%{http_code}'
{"kind":"invalid-url","message":"Grain only analyzes repositories on github.com, like github.com/acme/monorepo."}
http_code=400

$ curl -s -X POST .../api/analysis -d '{"url":""}' -o invalid-blank.body -w '%{http_code}'
{"kind":"invalid-url","message":"Enter a GitHub repository URL — Grain needs an owner and a repo, like github.com/acme/monorepo."}
http_code=400

$ curl -s -X POST .../api/enrichment -d '{"repository":{"owner":"..","name":"x"},"pullRequest":{}}' -o reject-repo.body -w '%{http_code}'
{"message":"Grain only analyzes repositories on github.com, like github.com/acme/monorepo."}
http_code=400

$ curl -s -X POST .../api/enrichment -d '{"repository":{"owner":"xyflow","name":"xyflow"},"pullRequest":{"number":-1}}' -o reject-pr.body -w '%{http_code}'
{"message":"That is not a pull request Grain can enrich."}
http_code=400

```

**A repository that does not exist.** HTTP is 200 because validation passed and the
response headers were already sent; the failure arrives as a terminal stream event,
which is the design:

```
$ curl -s -N -X POST .../api/analysis \
       -d '{"url":"github.com/xyflow/definitely-not-a-real-repo-91731"}' \
       -o notfound.body -w '%{http_code}'
{"type":"failed","kind":"not-found","step":"resolve","message":"Grain can't see that repository. It may be private, renamed, or misspelled.","detail":"404 · Not Found - https://docs.github.com/rest/repos/repos#get-a-repository"}

http_code=200
```

#### Client disconnect

`curl -m 1` against a run that takes several seconds, then the server's own stdout from
that request onward — the whole capture, nothing elided:

```
$ curl -s -N -m 1 -X POST .../api/analysis \
       -d '{"url":"https://github.com/xyflow/xyflow"}' -o /dev/null
curl exit=28   # 28 = operation timed out, i.e. the client went away
$ tail -n +$(( $(cat disconnect.mark) + 1 )) server.log
[Analysis] xyflow/xyflow 2025-09-20T18:54:37.570Z..2026-09-20T18:54:37.570Z max 4
[Analysis] xyflow/xyflow cancelled by the caller — stopping
GET /repos/xyflow/xyflow/contents/examples%2Fastro-xyflow%2Fpackage.json?ref=main - 500 with id UNKNOWN in 189ms
GET /repos/xyflow/xyflow/contents/examples%2Freact%2Fpackage.json?ref=main - 500 with id UNKNOWN in 188ms
GET /repos/xyflow/xyflow/contents/examples%2Fsvelte%2Fpackage.json?ref=main - 500 with id UNKNOWN in 187ms
GET /repos/xyflow/xyflow/contents/packages%2Freact%2Fpackage.json?ref=main - 500 with id UNKNOWN in 187ms
GET /repos/xyflow/xyflow/contents/packages%2Fsvelte%2Fpackage.json?ref=main - 500 with id UNKNOWN in 185ms
GET /repos/xyflow/xyflow/contents/packages%2Fsystem%2Fpackage.json?ref=main - 500 with id UNKNOWN in 184ms
GET /repos/xyflow/xyflow/contents/tests%2Fplaywright%2Fpackage.json?ref=main - 500 with id UNKNOWN in 183ms
GET /repos/xyflow/xyflow/contents/tooling%2Feslint-config%2Fpackage.json?ref=main - 500 with id UNKNOWN in 182ms
GET /repos/xyflow/xyflow/contents/tooling%2Frollup-config%2Fpackage.json?ref=main - 500 with id UNKNOWN in 181ms
GET /repos/xyflow/xyflow/contents/tooling%2Ftsconfig%2Fpackage.json?ref=main - 500 with id UNKNOWN in 179ms
[Analysis] xyflow/xyflow stopped at resolve (cancelled): undefined
```

`cancel()` fires, the 10 in-flight manifest reads terminate, and the pipeline ends on
`cancelled`. Nothing is queued and nothing resumes.

#### Re-derived red runs

The three specs whose `Cannot find package …` line the first version of this report
guessed rather than read. Each was re-derived by moving the module aside and re-running
only its spec, restoring with `mv` and confirming `git status --short` empty. Captured to
files and quoted from them:

```
$ mv src/lib/ai/enrichment-cache.ts{,.away}; pnpm test src/lib/ai/enrichment-cache.test.ts
 FAIL  src/lib/ai/enrichment-cache.test.ts [ src/lib/ai/enrichment-cache.test.ts ]
Error: Cannot find package '@/lib/ai/enrichment-cache' imported from /Users/anfal/Projects/hobby_projects/swe-take-home/.worktrees/06-live-ingest/src/lib/ai/enrichment-cache.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

```
$ mv src/lib/live/protocol.ts{,.away}; pnpm test src/lib/live/protocol.test.ts
 FAIL  src/lib/live/protocol.test.ts [ src/lib/live/protocol.test.ts ]
Error: Cannot find package '@/lib/live/protocol' imported from /Users/anfal/Projects/hobby_projects/swe-take-home/.worktrees/06-live-ingest/src/lib/live/protocol.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

```
$ mv src/lib/live/client.ts{,.away}; pnpm test src/lib/live/client.test.ts
 FAIL  src/lib/live/client.test.ts [ src/lib/live/client.test.ts ]
Error: Cannot find package '@/lib/live/client' imported from /Users/anfal/Projects/hobby_projects/swe-take-home/.worktrees/06-live-ingest/src/lib/live/client.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

## Evidence audit

Two review iterations have found false claims in this report. Per `prompts/review.md`
§ "The repair unit is the category, not the cited site", each cited site is a sample and
the enumeration is mine. This section is that enumeration, now covering **both** passes:
the original claims (audited in iteration 1) and the claims I *added or rewrote* while
fixing them (audited in iteration 2, because nobody had checked the new prose).

**Iteration 1** cited two transcripts as reshaped-but-presented-as-raw. My sweep found a
third instance the review had not named (`"enrichment":"absent"`) and four claims I had
pattern-matched rather than read.

**Iteration 2** found that the fix reintroduced the defect: the two enrichment bodies I
pasted as cold-vs-cached were byte-identical, the second reading `"cached":false`. The
captured files had been correct; I hand-transcribed them into a heredoc and pasted the
first one twice. That is the second recurrence of one class inside the artifact written
to fix it, which is where `prompts/review.md` says citations stop and method changes.

**The method change.** Live evidence is no longer transcribed at all. Each response is
written by `curl -o` to its **own distinct path**, and the report block is emitted by a
script (`/tmp/gen-evidence.py`, reproduced in outline in the section above) that reads
those files. Two responses presented as differing must pass a `diff` whose exit status is
shown. Where a value is computed rather than quoted — the field-by-field comparison, the
`complete` event's key set — the command is run for real and its own stdout is pasted,
not reformatted. This is recorded as project.md delta 10.

### Iteration 1 — the original claims

33 claims checked: **21 stood, 12 did not**.

| Claim in the report | Producing code / command | Verdict |
| --- | --- | --- |
| `/api/enrichment` response payload | `src/app/api/enrichment/route.ts:72-75` | **WAS WRONG** — flattened, `entry` wrapper dropped, `steps` shown as the integer `1` instead of an array. Cited by the reviewer. Replaced with the raw body. |
| analysis `complete` event payload | `src/lib/live/protocol.ts:75`; `src/app/api/analysis/route.ts:98-104` | **WAS WRONG** — `type` and `snapshot` omitted, and `packages`/`prs`/`enrichment` invented. Cited by the reviewer. Replaced with the raw head and tail plus a labelled derived key list. |
| `` `"enrichment":"absent"` `` as a wire value | same | **WAS WRONG, not cited by the review.** No such field exists on the wire. The real fact — `snapshot` has no own `enrichment` property — is now shown by a labelled derived command. |
| Red run for `enrichment-cache.test.ts`: `Error: Cannot find package '@/lib/ai/enrichment-cache'` | re-derived: `mv src/lib/ai/enrichment-cache.ts{,.away}; pnpm test <spec>` | **WAS UNVERIFIED** — I pattern-matched it from `request.test.ts`'s run instead of reading it. Re-derived; the text is correct, and the table below now quotes the re-derived run and says it is a re-derivation. |
| Red run for `protocol.test.ts` | same method | **WAS UNVERIFIED**, now re-derived. Text correct. |
| Red run for `client.test.ts` | same method | **WAS UNVERIFIED**, now re-derived. Text correct. |
| Red run for `request.test.ts` (`Cannot find package`, `Tests no tests`) | captured live at the time | OK — was read from the actual output. |
| Red run for `analyzeRepository` (`TypeError: analyzeRepository is not a function`, `Tests 5 failed \| 13 passed (18)`) | captured live at the time | OK |
| Red run `Tests 2 failed \| 34 passed (36)` / `expected true to be false` | captured live at the time | OK |
| Red run `Tests 1 failed \| 10 passed (11)` (client.test.ts assertion fix) | captured live at the time | OK |
| `{"kind":"invalid-url", …}` bodies, three shapes, HTTP 400 | `src/app/api/analysis/route.ts:33-35,43` | OK — raw, re-captured verbatim above |
| `{"type":"failed","kind":"not-found", …}` | `classifyFailure`, `src/lib/live/protocol.ts:147-154` | OK — raw, re-captured; HTTP status (200) now stated too |
| `{"maxPullRequests":4,"matched":204,"kept":4,"truncated":true}` | `src/lib/ingest/ingest.ts:145-150` | OK — a literal substring of raw line 9's tail, shown above |
| `bound` equals `{maxPullRequests: 3, matched: 6, kept: 3, truncated: true}` | `ingest.test.ts`, `analyzeRepository > stops at the ceiling and says the window held more` | OK — the test's own `toEqual`; test present and passing |
| Cache timings `2.33 s` / `0.016 s` | shell `time` around a pipeline that also ran `node` | **WAS IMPRECISE.** Re-measured twice since: iteration 1 gave 2.115555 s / 0.004135 s, and the iteration-2 cold-instance capture gives **1.930429 s / 0.004054 s**, which is the figure the report now carries. |
| Disconnect log, `… (nine in-flight manifest reads terminate)` | server stdout | **WAS AN UNLABELLED EDIT** — an editorial ellipsis inside a block presented as a transcript. Replaced with a complete untruncated capture; the current one shows **10** in-flight reads. The count varies per run with how far topology discovery got before the abort, which is itself a reason not to hand-summarise it. |
| "corpus of 10 files", 0 hits for `@ai-sdk`/`generateObject`/`Octokit`/`api.github.com` | `find .next/static -type f -name '*.js' \| wc -l`; `grep -rl` | OK — re-measured after the final build; still 10 and all zero |
| `.next/static/chunks/3qa0wc4fc771w.js` held the leaked name | the failing build at the time | OK, with a caveat now stated: chunk filenames are content-hashed and change per build, so that name identifies that run only. The two canary runs produced `0tro5rfx4nsxj.js` and `1g_ryxifea97q.js`. |
| Every mutation row (29) | captured from the mutation harness output | OK — each row is the harness's own `Tests N failed \| M passed` line |
| Every gate result | captured from the gate block | OK |
| `repository-picker.tsx:100–152` for the url-mode branch | `awk` over the file | **WAS WRONG BY OMISSION** — the block is lines **101–160**. Corrected. |
| "`leaveUrlMode` never writes `selected`" | `src/components/canvas/repository-picker.tsx:77-84` | OK — it sets `mode`, `url`, `invalid` only |
| "Nothing reads `SnapshotEntry.file` outside `catalog.test.ts`" | `grep -rn --include='*.ts' --include='*.tsx' -E '\.file\b' src/` — uncapped, 5 hits | OK, now measured. Two hits in `baked-snapshots.test.ts` are a *different* `{file, snapshot}` shape built from `readdir`, not `SnapshotEntry`; one is a local variable in `snapshot.test.ts`; the remaining two are `catalog.ts:36` (writes) and `catalog.test.ts:20` (reads). |
| "~200 concurrent GitHub requests" | `src/lib/ingest/ingest.ts:167-171` | **WAS WRONG** — files and commits are awaited sequentially within each pull request's chain, so 200 is the total issued, not the concurrency. Corrected in "Left alone". |
| "GitHub's documented 100-concurrent-request secondary limit" | asserted from memory | **WAS UNVERIFIED**, now verified: "No more than 100 concurrent requests are allowed." — <https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api>, read 2026-09-20. |
| "the 100-PR-equivalent run took 6.1 s for 4 PRs" | `time curl` | **WAS INCOHERENT PHRASING** — it was a 4-pull-request run, not a 100-equivalent one. Corrected in Judgment calls. |
| `find src/lib/live src/lib/ai -name '*.ts' \| sort` (project.md delta 1) | re-run | OK — 13 files, listed |
| `git ls-files \| grep -E 'route\.ts$'` → 2, and 0 on `0a7907b` (delta 2) | re-run both | OK |
| Design-page quotes (pages 1, 2, 3, 8) | read from `design/mid-fi.pdf` before the components were written | OK — see the statement under "Design pages" |
| `mapWithConcurrency` exists privately in `enrichment.ts` | `src/lib/ai/enrichment.ts:308` | OK |
| `realEnrichment` handles three cases | `src/lib/view/derive.ts:378` and its docblock | OK |
| Node 24.13.0 abort-signal behaviour | measured with a `node -e` probe | OK |
| Test/file counts 19 / 379, baseline 13 / 246, delta +6 / +133 | runner output | OK |

**The three causes** behind the twelve, only the first of which the review found:

1. **Reshaped output kept, raw bytes discarded** (3 rows: the enrichment payload, the
   `complete` payload, `"enrichment":"absent"`). I ran the live probes through `node -e`
   formatters for readability and pasted the formatter's output.
2. **Pattern-matched from a sibling observation** (4 rows: three red-run error lines, and
   GitHub's concurrency figure). I had seen a similar thing and wrote down what it must
   have said. All four are now measured — three by re-deriving the run, one by reading
   the GitHub doc.
3. **Numbers and citations never re-read after the code moved** (5 rows: the picker's line
   range, the `time`-vs-`time_total` figures, the unlabelled ellipsis in the disconnect
   log, the `SnapshotEntry.file` absence claim, the "100-PR-equivalent" phrasing).

### Iteration 2 — the claims added or rewritten while fixing iteration 1

The rows above were the *old* claims. These are the ones the previous pass introduced,
which no reviewer had yet checked. Each was re-verified by re-running the capture, not by
re-reading the page.

| Claim added in the iteration-1 fix | How it is verified now | Verdict |
| --- | --- | --- |
| The two enrichment bodies, quoted as cold then cached | two `curl -o` calls to **separate paths**; bodies emitted from those files by script | **WAS WRONG** — the second was a hand-typed copy of the first, reading `"cached":false`. Cited by review iteration 2. Both are now machine-emitted; `diff` exits 1 and a computed field table shows `cached false -> true` with `entry` and `key` identical. |
| "Both response bodies below are raw and complete — nothing is elided or reshaped" | — | **WAS FALSE of what was on the page**, though true of the files it claimed to quote. The sentence is gone; the section now says how each block was produced instead of asserting that it is trustworthy. |
| "`cached` flips `false` → `true`" | computed field diff, above | OK as a claim about the system, and it was true of the captured files — but the transcript under it did not show it. Now it does. |
| Enrichment timings 2.115555 s / 0.004135 s | curl `-w '%{time_total}'` into a `.meta` file | OK at the time; **superseded** by the cold-instance capture (1.930429 s / 0.004054 s). Both were real; the report carries the current one. |
| `complete` event head/tail quoted with `cut`/`rev` | re-captured; head, tail and elided byte count all computed from the file by the generator | OK — and the elision arithmetic is now derived, not typed (`10,779 − 600 − 220 = 9,959`). |
| `complete` event key list `["type","snapshot","bound","repository","branch"]` | the `node -e` shown is now **executed** and its stdout pasted | **WAS A LATENT DEFECT** — the previous pass formatted this list in Python (`json.dumps`, which emits `", "` separators) while presenting it as node's output. Node emits no spaces. Caught by my own iteration-2 sweep, not by the review. Now genuinely node's stdout. |
| Analysis progress lines, quoted as raw | emitted from `analysis.ndjson` by the generator; per-line byte counts computed | OK — re-captured. Note the `details` lines arrive in **completion order**, which differs between runs (this run: PRs 5994, 5992, 5997, 5977). |
| "four `details` lines, one per pull request" | counted by the generator from the parsed lines | OK — computed, not counted by eye |
| Three re-derived red runs | each re-run captured to `red-<module>.out`; the report quotes filtered lines from those files | OK — re-derived again in this pass, to files this time |
| Not-found probe, HTTP 200 with a streamed `failed` event | `curl -o notfound.body -w '%{http_code}'` | OK — status comes from curl, body from the file |
| Three invalid-URL probes and two enrichment rejections | same, one file each | OK |
| Disconnect log, "the N in-flight manifest reads terminate" | whole capture quoted; N counted by the generator | OK — N is now computed (10 this run) rather than typed, after being wrong once |
| "diff exit=1" | `subprocess.run(['diff', ...]).returncode`, printed by the generator | OK — the generator cannot print 1 if the files match |
| project.md delta 10 (the raw-transcript convention) | — | OK, and iteration 2 is the evidence for why it is needed. Reworded to require the `diff` check and the distinct-path capture, not just "quote from a file". |
| "No production code changed in this iteration" | `git diff --stat 79b09d9..HEAD` | OK — independently confirmed by the reviewer; still true of this pass |

### The report checks itself

The failure mode in both iterations is that the page and the captured file drift apart, so
the last step is a script that compares them. It pulls every JSON payload line out of the
live-evidence section above and requires each to appear byte-for-byte in one of the
captured files, then asserts the specific thing iteration 2 caught:

```
$ python3 check-report-against-captures.py
JSON payload lines quoted in the live-evidence section: 17
  ...one OK line per payload, naming the file it matched...
unmatched payload lines: 0
enrich-1.body == enrich-2.body ? False   (must be False)
cached in body 1: False   cached in body 2: True
report quotes body 1 exactly: True    report quotes body 2 exactly: True
the two quoted enrichment blocks are distinct: True
self-check exit: 0
```

All 17 payloads matched a capture, and the two enrichment blocks on the page are the two
distinct files on disk.

**The check is not vacuous — it fails on the version it was written to catch.** Run
against the previous committed report (`git show 67a00ca:…/completion-report.md`):

```
PREVIOUS report version (67a00ca):
  enrichment payload lines quoted: 2
  the two are byte-identical: True
  both read cached:false: True
  self-check assertion 'the two quoted blocks are distinct': False
  => self-check would exit: 1
```

(The duplicated block there is the cold body of *that* pass's capture, not of this one's,
so it does not match this run's `enrich-1.body` — the assertion that catches it is the
distinctness one, not a corpus match.)

## Reuse

The literal notation the rubric asks for. No analysis logic is added by this chunk.

- `Reuse: importing ingestRepository/analyzeRepository from src/lib/ingest/ingest.ts` —
  one pipeline; `ingestRepository` delegates to `analyzeRepository`, asserted
  byte-identical by `analyzeRepository > produces exactly the snapshot ingestRepository does, so there is one ingest path`.
- `Reuse: importing fetchMergedPullRequests, fetchPullRequestFiles, fetchPullRequestCommits, fetchDefaultBranch, fetchRecursiveTree, fetchTextFile, createGitHubClient from src/lib/ingest/github.ts` — chunk 02's client, now under a request budget.
- `Reuse: importing discoverTopology, workspaceManifestPaths, workspacePatterns from src/lib/ingest/topology.ts` — unchanged, reached through `discoverRepositoryTopology`.
- `Reuse: importing attributePullRequest, buildReverseClosure, ownerOfFile from src/lib/ingest/attribution.ts` — unchanged.
- `Reuse: importing enrichPullRequest, DEFAULT_ENRICHMENT_MODEL from src/lib/ai/enrichment.ts` — chunk 03's single model call and its prompt. No second prompt exists in this chunk.
- `Reuse: importing enrichmentKey, fallbackEnrichment, FALLBACK_APPROACH, isFallbackEnrichment from src/lib/ai/enrichment-record.ts` — chunk 03's merge-SHA key derivation and fallback contract, taken from the model-free module because the importing paths reach client components.
- `Reuse: importing snapshotSchema, pullRequestSchema, enrichmentEntrySchema, buildRecord, assertSafeKey, DEFAULT_MAX_PULL_REQUESTS, MAX_PULL_REQUESTS, RESERVED_KEYS from src/lib/snapshot.ts` — chunk 02's one schema and its reserved-key guards.
- `Reuse: importing RepositoryPicker from src/components/canvas/repository-picker.tsx` — chunk 04's picker, extended in place with a new mode rather than replaced.
- `Reuse: importing TopologyCanvas, ChangesLevel, StepsLevel, TimeSlider, LevelBreadcrumb, EmptyWindow, OnboardingTour from src/components/canvas/` — chunks 04 and 05's components, unmodified except one optional `enriching` prop on `StepsLevel` that defaults to the previous behaviour.
- `Reuse: importing deriveWindow, historyBounds, volumeSeries, activityOf, packageChanges, changeOf, stepChain, nearestActivity from src/lib/view/derive.ts` — chunk 04/05's derivation, which a live snapshot goes through unchanged.

New modules, and why each is not a duplicate: `src/lib/live/request.ts` (a stricter parser
for a different trust boundary, and one that must not import Octokit — justified under
Judgment calls), `src/lib/live/protocol.ts` (a wire contract that did not exist),
`src/lib/live/client.ts` (browser-side callers that did not exist),
`src/lib/ai/enrichment-cache.ts` (a cache that did not exist; it composes
`enrichmentKey` rather than re-deriving a key).

## Design pages

**I opened `plans/2026-09-20-project-grain-prototype/design/README.md` and then pages 1,
2, 3 and 8 of `design/mid-fi.pdf` before writing `repository-picker.tsx`'s URL mode,
`analysis-progress.tsx` or `analysis-error.tsx`.** The layouts come from those pages: the
in-place field swap with the back arrow to its left and the error line beneath (page 2,
states A/B/C), the five-step list with per-step right-hand detail, the percentage, the
"Just read" block and the footer line (page 3), and the warning-icon heading, monospace
detail block and two-action footer (page 8). The four pieces of copy I did **not** follow
are listed under "Deviations", each with the page's wording quoted.

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
  (third of its three documented cases). Confirmed on the live run above: the raw
  `complete` event's snapshot has top-level keys `["metadata","packages","pullRequests"]`
  and `Object.prototype.hasOwnProperty.call(snapshot,'enrichment')` is `false`. (The first
  version of this report wrote that as `"enrichment":"absent"`, which is not a field the
  wire carries — see "Evidence audit".)

- **The client sends the pull-request record to the enrichment route**, rather than the
  route re-fetching it from GitHub. Re-fetching would cost three more GitHub calls per
  expansion to reproduce data the client already holds. The record is validated through
  `pullRequestSchema` at the boundary and the key through `assertSafeKey`. The residual
  risk is noted under "Left alone".

- **`maxDuration = 300` on the analysis route** — the ceiling the free tier allows and
  cannot raise, declared explicitly. The work is kept well inside it by the pull-request
  ceiling, not by this number. The measured run above analyzed **4** pull requests plus
  topology and returned 11,923 bytes over 9 NDJSON lines; an earlier identical run timed
  with `time curl` took 6.087 s wall clock. I have **not** measured a 100-pull-request
  run, so I make no claim about one beyond the arithmetic: the per-pull-request cost is
  two sequential GitHub calls, fanned out across pull requests.

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

10. **Conventions** — new entry, from this chunk's two review failures:
    > **Do not hand-transcribe a live transcript into a report. Capture each response to
    > its own path and generate the block from those files.** Chunk 06 failed review
    > twice on this: first for pasting `node -e` formatter output as raw wire bytes
    > (three payloads, one of which invented a field), then — *in the fix* — for
    > hand-copying two captured bodies into a heredoc and pasting the first one twice, so
    > a "cold vs cached" pair read `cached:false` both times. The files were correct both
    > times; the typing was not. The rules that follow from that:
    >
    > - one `curl -o <distinct-path>` per response, plus
    >   `-w '%{http_code} %{time_total}'` into a `.meta` file so status and timing are
    >   curl's, not remembered;
    > - for any two responses presented as differing, run `diff a b` and **show its exit
    >   status** — exit 0 there is the check that catches a duplicated paste;
    > - emit the report block from the captured files with a script, rather than copying
    >   them by hand;
    > - a computed view (a key list, a field comparison) is produced by **running** the
    >   command shown, never by reformatting the data in another language — chunk 06 also
    >   shipped a `JSON.stringify` key list that had actually been formatted by Python's
    >   `json.dumps`, which spaces its separators differently.
    >
    > `.claude/resources/prompts/evidence.md` already forbids the fabricated-to-be-
    > persuasive shape; this is the form it takes in a completion report, and the reason
    > it survives a careful re-read is that the prose and the payload are written at
    > different moments.

11. **Commands** — the curl line in delta 3 was verified on `PORT=3117` because port 3000
    was occupied by another session's server. `pnpm start` honours `PORT`; the table entry
    is written against the default 3000.

## Left alone

- **`analyzeRepository` fans out across pull requests under `Promise.all` with no
  concurrency limit** (`src/lib/ingest/ingest.ts:167-171`). **Corrected from the first
  version of this report**, which said this produced "200 concurrent requests" at the
  default ceiling of 100. It does not. Reading the code: the fan-out is one chain *per
  pull request*, and inside each chain `fetchPullRequestFiles` and
  `fetchPullRequestCommits` are awaited **sequentially**. So the ceiling of 100 gives up
  to ~100 requests in flight at once and 200 requests **in total** over the run — 200 was
  the total, not the concurrency. The finding still stands at 100: GitHub documents "No
  more than 100 concurrent requests are allowed"
  (<https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api>, read
  2026-09-20 — a figure I had asserted from memory the first time and have now actually
  read), so the default ceiling sits exactly on the limit with no margin.
  Pre-existing from chunk 02 (`549d507`); this chunk changed the callback body to emit a
  progress report and to read from `merged.pullRequests`, but did not change the fan-out
  shape. `enrichment.ts:308` already has a private `mapWithConcurrency` that would
  consolidate. Out of scope: this chunk's bound is on *how many* pull requests, not on how
  many at once. **Recommend a follow-up.**
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
  live snapshot has no file. Measured rather than assumed this time —
  `grep -rn --include='*.ts' --include='*.tsx' -E '\.file\b' src/` is uncapped and returns
  five hits: `catalog.ts:36` writes it, `catalog.test.ts:20` reads it, and the other three
  are unrelated (two in `baked-snapshots.test.ts` are a different `{file, snapshot}` shape
  built from `readdir`; one is a local variable in `snapshot.test.ts`). Widening the type
  is a change to chunk 04's contract; left alone and marked with a comment.
- **`src/lib/ai/baked-snapshots.test.ts` is under `ai/`, not `snapshots/`.** My dispatch
  brief named `src/lib/snapshots/baked-snapshots.test.ts`. The file's own docblock explains
  the placement (`src/lib/snapshots/` holds data files only). Not moved; noting it so the
  path in the brief is not repeated.
- **The `Other…` row is offered on the header picker too**, not only the landing card, so an
  evaluator can switch to a live repository without going back. The design only draws it on
  the landing card. Additive and consistent; flagging it as a deliberate extension.
