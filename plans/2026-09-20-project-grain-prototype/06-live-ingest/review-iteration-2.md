# Chunk 06 — Review, iteration 2

Reviewer: fresh (not the iteration-1 reviewer). Grading against `rubric.md` only;
`plan.md` read only where the rubric points to it for context.

## Method

- Confirmed location: worktree `06-live-ingest`, branch
  `feat/project-grain-prototype--live-ingest` at `d956c6c`.
- `git diff --stat 79b09d9..HEAD` = `completion-report.md` only, 508 insertions / 74
  deletions. Independently re-confirmed the code has not moved since iteration 1's
  review — I did not re-grade behaviour from scratch, but I did not take it on faith
  either; see below.
- Re-ran every gate myself, after the last edit, from this worktree:
  - `pnpm lint` → exit 0, no output.
  - `pnpm typecheck` → exit 0, no output.
  - `pnpm test` → `Test Files 19 passed (19) / Tests 379 passed (379)`.
  - `pnpm build` → exit 0; route table shows `/` `○ (Static)`, `/api/analysis` and
    `/api/enrichment` `ƒ (Dynamic)`.
  - `.next/static`: 10 `.js` files; `grep -rlE 'ANTHROPIC_API_KEY|GITHUB_TOKEN'
    .next/static` → no hits (exit 1); no hits for `@ai-sdk`, `generateObject`,
    `Octokit`, `api.github.com`.
  All match the report's claims exactly.

## The self-check script and the exact prior capture files are gone

`/tmp/gen-evidence.py` (the block-emitting generator) is still on disk and I read it in
full — it does what the report says: reads `<name>.body`/`<name>.meta` files written by
`curl -o`, computes byte counts, runs `diff` for real and prints its exit code, runs the
`node -e` snippet for real via `subprocess.run` and pastes its actual stdout. I could not
find `check-report-against-captures.py` or the underlying `.body`/`.ndjson` capture files
on disk — they were evidently cleaned from `/tmp` before this session started, so I could
not re-run the reader's exact self-check invocation or its documented deliberate-break
test verbatim.

Rather than accept that as a substitute, I reproduced the live evidence independently,
from scratch, against the real APIs, with my own credentials and my own capture files
(`/private/tmp/.../scratchpad/ev/`):

- **Analysis**: `POST /api/analysis` for `xyflow/xyflow` with `GRAIN_MAX_PULL_REQUESTS=2`
  appended to `.env.local` → `200`, 7 NDJSON lines, terminal `complete` event with
  `"bound":{"maxPullRequests":2,"matched":204,"kept":2,"truncated":true}`. Matches the
  report's *mechanism* claim (ceiling applied before any per-PR fetch, truncation
  reported in the returned value) with different numbers because I used a different
  ceiling on purpose, to prove it isn't hardcoded.
- **Enrichment, cold then cached**: same PR (#5992, merge SHA
  `0a1f9575b25679f2880175de8d3eae21aedde921` — literally the same PR the report used,
  since it's the same repository's newest matching pull request). First POST:
  `200 2.364367s`, `"cached":false`. Second POST, byte-identical request body: `200
  0.004361s`, `"cached":true`. `diff` on the two response bodies exits `1` — they differ
  only in the `cached` field; `key` and `entry` are byte-identical between the two. The
  model's own generated text (`label`/`approach`) differs from the report's capture,
  which is expected and itself evidence this is a real, non-deterministic model call, not
  replayed fixture text.
- **Boundary rejections**: re-ran the not-found and non-GitHub-host probes live —
  `{"type":"failed","kind":"not-found", ...}` with the documented detail line, and
  `{"kind":"invalid-url","message":"Grain only analyzes repositories on github.com..."}`
  with 400 — both exact matches to the report's quoted bodies.

This independently corroborates the report's central "no further model call" claim and
the truncation/rejection mechanics from a different process, a different port, a
different ceiling value and a different capture toolchain than the report's own script
used. I did not merely re-read the report's transcript; I made the calls myself.

**On the self-check's soundness in principle** (since I could not execute the exact
artifact): the design is sound and not vacuous by construction — it (a) requires a
`diff` between the two enrichment bodies to have a *nonzero* exit and (b) requires the
`cached` field specifically to read `false` then `true`. A duplicated paste (the
iteration-2 defect) fails both: `diff` exits 0, and reading `cached` off both bodies
gives `false`/`false`. The report also shows the check run against the actual *previous*
committed version (`67a00ca`) and quotes it failing (`self-check would exit: 1`) — that
is itself evidence of the check catching the version it was written to catch, not merely
an assertion that it would. I was not able to independently execute that specific
comparison since the `67a00ca` capture and the check script are gone, but the logic
described is correct and my own from-scratch capture behaves exactly as the report's
would need to for the check to pass.

## Code audit (not inherited from prior passes)

Read end-to-end and cross-checked against the rubric and the two cited bibles:

- **`orchestrator-pattern.md`**: both route handlers (`analysis/route.ts`,
  `enrichment/route.ts`) are wiring only — validate, read credential, sequence
  `src/lib/` calls, log. No business rule (bounds, truncation, attribution, fallback)
  lives in either file; each would be unaffected if such a rule changed elsewhere.
- **`boundary-validation.md`**: the submitted URL is parsed and reduced to
  `{owner, repo}` before use (`src/lib/live/request.ts`); reserved keys
  (`__proto__`, `constructor`, `prototype`) are rejected explicitly, in addition to a
  `Map`-backed cache that structurally cannot answer from `Object.prototype`. The cache
  is bounded at construction (`createEnrichmentCache` throws on a non-positive integer)
  and enforced inside `set`, not policed after the fact.
- **Principle 1** (credentials as parameters): `grep -rn "process.env" src/lib/
  src/components/` finds no credential read outside the two route handlers — only a
  comment in `github.ts` documenting the rule, and an unrelated `process.env.NODE_ENV`
  string sitting inside a committed JSON *transcript fixture* (not code).
- **Principle 2** (no model call on a component path): no `ai`/`@ai-sdk` import and no
  `process.env` read anywhere under `src/components/`.
- **Principle 5** (schema-validated snapshot, one path): `ingestRepository` now
  delegates to `analyzeRepository`; both return the same `snapshotSchema`-validated
  shape, and `grain-workspace.tsx` puts a live result into the same `snapshots` lookup
  used for baked ones — nothing below it branches on provenance.
- **Principle 6** (bound before fetch starts): `analyzeRepository` applies
  `maxPullRequests` inside `fetchMergedPullRequests` *before* the per-PR `files`/
  `commits` fan-out (the volumetric cost) begins, and reports `truncated` as a computed
  field of the returned `bound`, not merely a log line.
- **shadcn primitives**: `git diff --stat` for `src/components/ui/` is empty against
  base — nothing there was hand-touched; the picker/progress/error views compose
  `Button`/`Input`/`Select` unchanged.
- **Colour-only state**: the progress view's step states (`done`/`active`/pending) are
  each distinguished by icon and font-weight in addition to colour, not colour alone;
  same for the error surface, which uses distinct headings and copy per failure kind
  rather than colour coding.
- **`.claude/` is untouched**: `git diff --stat` against base for `.claude/` is empty,
  and specifically `project.md` has a zero-line diff — correctly left to the lead, and
  the deltas are recorded in the report instead.

## Mutation testing — three of my own, on code neither prior pass is on record mutating

1. `src/lib/live/protocol.ts`: forced `classifyFailure` to treat every non-abort error
   as `not-found` (`if (status === 404)` → `if (true)`). **Killed**: 9 tests failed
   across `protocol.test.ts` and a route spec. Restored, tree clean.
2. `src/lib/ai/enrichment-cache.ts`: gutted the LRU eviction loop to a no-op comment.
   **Killed**: 3 tests failed in `enrichment-cache.test.ts`, including the eviction
   spec. Restored, tree clean. (This reproduces the report's own claimed result for the
   same mutation, done independently rather than trusted.)
3. `src/components/canvas/grain-workspace.tsx`: removed the `askedRef` guard in
   `openChangeNode` so a re-expansion would re-request enrichment. **Survived** — the
   full suite still passed 379/379. This is real: there is no automated test anywhere
   under `src/components/` (none exist in the tree, on this branch or on base) that
   would catch a regression in the client-side "no further model call" guarantee. It is
   **not a rubric violation**: `project.md`'s convention-map row for
   `src/components/**/*.tsx` lists `pnpm lint`, `pnpm build`, `pnpm typecheck` as its
   gates — `pnpm test` is deliberately not one of them, and no chunk in this plan (04,
   05 included) has a component spec. The rubric's Test Coverage Checks section also
   only requires coverage for `src/lib/` modules, not components. Flagged below as a
   non-blocking residual-risk note, not a defect: the guarantee is currently backed by
   the server-side cache (which *is* mutation-tested and killed the equivalent
   mutation) plus manual/live verification by two independent reviewers, not by an
   automated regression test.

## Verdict

**PASS**

## Issues

None.

## Warnings

1. **The client-side "ask once per session" guarantee has no automated regression
   coverage.** `openChangeNode`'s `askedRef` guard in `grain-workspace.tsx` is the only
   thing preventing a second model call on re-expansion from the browser side; removing
   it does not fail any test. This is consistent with the project's established
   convention (no component test gate), so it is not a rubric FAIL, but it is worth
   naming: the acceptance criterion "expanded again in the same session it makes no
   further model call" currently rests on (a) the server-side cache, which is
   mutation-tested, and (b) manual verification, which is not repeatable by a future
   change. A lightweight regression option worth a future chunk's consideration:
   extract the "already asked or already enriched" predicate into a pure function in
   `src/lib/` (it does not need React) so it gets a co-located spec under the existing
   convention, and let the component call it.
2. **The exact self-check artifact (`check-report-against-captures.py`) and its captured
   input files were not present in `/tmp` for me to re-run or deliberately break myself**
   — they were evidently cleaned between sessions. I did not treat the report's quoted
   output of that script as sufficient on its own; I substituted an independent,
   from-scratch live capture (different port, different ceiling, different toolchain)
   that reproduces the same cold→cached, diff-exit-1, distinct-body behaviour the script
   asserts. If this chunk's evidence is audited again later, regenerating and keeping
   the self-check script and its capture directory alongside the report (or inlining the
   script's source into the report, as `gen-evidence.py` already effectively is) would
   remove this gap for the next reviewer.

## Guidance

Nothing blocks merge. If there is a next iteration for any reason, start with Warning 1
(extract a pure predicate for the "ask once" rule so it can be spec'd under the existing
`src/lib/` convention) since it is the one piece of this chunk's most safety-critical
behaviour (bounding model spend) that isn't machine-checked.
